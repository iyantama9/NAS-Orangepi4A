// Download/preview: rangkai chunk jadi stream, dukung HTTP Range untuk video seek.
import type { Request, Response } from "express";
import { PassThrough } from "node:stream";
import { query } from "./db.js";
import { readChunkStream } from "./storage.js";

export async function streamNode(
  req: Request,
  res: Response,
  nodeId: string,
  opts: { ownerCheck?: (node: any) => boolean; downloadForced?: boolean }
) {
  const n = await query(
    `SELECT id, name, mime, size FROM nodes WHERE id=$1 AND type='FILE'`,
    [nodeId]
  );
  const node = n.rows[0];
  if (!node || (opts.ownerCheck && !opts.ownerCheck(node)))
    return void res.status(404).json({ error: "tidak ada" });

  const chunks = await query<{ chunk_sha256: string }>(
    "SELECT chunk_sha256 FROM node_chunks WHERE node_id=$1 ORDER BY idx",
    [nodeId]
  );
  if (!chunks.rows.length) return void res.status(404).json({ error: "file kosong/korup" });

  const size = Number(node.size);
  const mime = node.mime ?? "application/octet-stream";
  const disposition =
    req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Type", mime);
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename*=UTF-8''${encodeURIComponent(node.name)}`
  );
  res.setHeader("Accept-Ranges", "bytes");

  // Parse Range header manual (req.range butuh string length arg & bisa null).
  const rangeHeader = req.headers.range;
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!m || (!m[1] && !m[2]))
      return void res.status(416).set("Content-Range", `bytes */${size}`).end();
    if (m[1] === "") {
      // suffix range: last N bytes
      const n2 = Math.min(Number(m[2]), size);
      start = size - n2;
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    }
    if (start > end || start >= size)
      return void res.status(416).set("Content-Range", `bytes */${size}`).end();
    status = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  }

  const total = end - start + 1;
  res.status(status);
  res.setHeader("Content-Length", String(total));

  if (req.method === "HEAD") return res.end();

  // Pipa byte-range lewat chunk 8 MiB berurutan.
  const CHUNK = 8 * 1024 * 1024;
  let pos = 0; // offset global saat mulai chunk ke-i
  const out = new PassThrough();
  out.pipe(res);

  for (let i = 0; i < chunks.rows.length && pos <= end; i++) {
    const sha = chunks.rows[i].chunk_sha256;
    const cStart = pos;
    const cEnd = pos + CHUNK - 1; // inklusif secara logis; chunk terakhir pendek
    pos = cEnd + 1;

    const s = Math.max(start, cStart);
    const e = Math.min(end, cEnd);
    if (e < s) continue; // range tidak menyentuh chunk ini

    const stream = readChunkStream(sha) as import("node:fs").ReadStream;
    await new Promise<void>((resolve, reject) => {
      let skipped = 0;
      stream.on("error", reject);
      out.on("error", () => stream.destroy());
      res.on("close", () => {
        stream.destroy();
        resolve();
      });
      stream.on("data", (buf) => {
        if (typeof buf === "string") return;
        const bStart = cStart + skipped;
        const bEnd = bStart + buf.length - 1;
        skipped += buf.length;
        if (bEnd < s || bStart > e) return; // sebelum/lewat window
        const cutStart = Math.max(0, s - bStart);
        const cutEnd = Math.min(buf.length - 1, e - bStart);
        out.write(buf.subarray(cutStart, cutEnd + 1));
      });
      stream.on("end", resolve);
    });
    stream.destroy();
  }
  out.end();
}
