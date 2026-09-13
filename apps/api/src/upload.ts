// Upload resumable: init → put chunk (dengan verifikasi sha) → status → complete.
import { createHash } from "node:crypto";
import { Router } from "express";
import { CHUNK_SIZE } from "@nas/shared";
import { query } from "./db.js";
import { requireUser } from "./auth.js";
import { hasChunk, writeChunk } from "./storage.js";
import { addAncestorSizes, createFileNode } from "./nodes.js";

export const uploadRouter = Router();
uploadRouter.use(requireUser);

// Init sesi upload.
uploadRouter.post("/", async (req, res) => {
  const uid = req.user!.id;
  const filename = String(req.body?.filename ?? "").trim();
  const size = Number(req.body?.size);
  const parentId = req.body?.parentId ?? null;
  if (!filename || !Number.isFinite(size) || size < 0)
    return res.status(400).json({ error: "input tidak valid" });

  // Dedup cepat: kalau user sudah punya file dengan ukuran+hash sama... hash belum ada di init,
  // jadi dedup utama tetap di level chunk. Sesi dibuat apa boleh.
  const r = await query<{ id: string }>(
    `INSERT INTO upload_sessions(user_id, target_parent_id, filename, size, mime, chunk_size)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [uid, parentId, filename, size, req.body?.mime ?? null, CHUNK_SIZE]
  );
  const totalChunks = Math.max(1, Math.ceil(size / CHUNK_SIZE));
  const body: import("@nas/shared").UploadInitResponse = {
    uploadId: r.rows[0].id,
    chunkSize: CHUNK_SIZE,
    receivedChunks: [],
  };
  void totalChunks;
  res.status(201).json(body);
});

// Cek progres — dipakai client untuk resume.
uploadRouter.get("/:id", async (req, res) => {
  const uid = req.user!.id;
  const s = await query(
    `SELECT id, filename, size, chunk_size FROM upload_sessions
     WHERE id=$1 AND user_id=$2`,
    [req.params.id, uid]
  );
  if (!s.rows[0]) return res.status(404).json({ error: "sesi tidak ada" });
  const received = await query<{ idx: number }>(
    "SELECT idx FROM upload_session_chunks WHERE session_id=$1 ORDER BY idx",
    [req.params.id]
  );
  const size = Number(s.rows[0].size);
  const body: import("@nas/shared").UploadStatusResponse = {
    uploadId: (s.rows as any[])[0].id,
    filename: (s.rows as any[])[0].filename,
    size,
    chunkSize: (s.rows as any[])[0].chunk_size,
    receivedChunks: received.rows.map((r: any) => r.idx),
    totalChunks: Math.max(1, Math.ceil(size / (s.rows as any[])[0].chunk_size)),
  };
  res.json(body);
});

// Put satu chunk. Body = raw bytes. Client wajib kirim X-Chunk-Sha256.
uploadRouter.put("/:id/chunks/:idx", async (req, res) => {
  const uid = req.user!.id;
  const idx = Number(req.params.idx);
  if (!Number.isInteger(idx) || idx < 0) return res.status(400).json({ error: "idx tidak valid" });
  const s = await query(
    "SELECT id FROM upload_sessions WHERE id=$1 AND user_id=$2",
    [req.params.id, uid]
  );
  if (!s.rows[0]) return res.status(404).json({ error: "sesi tidak ada" });

  const expectedSha = String(req.headers["x-chunk-sha256"] ?? "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedSha))
    return res.status(400).json({ error: "X-Chunk-Sha256 wajib" });

  // Validasi ukuran chunk terhadap posisi idx: chunk non-terakhir harus
  // persis chunk_size; terakhir = size - (total-1)*chunk_size.
  const sess2 = await query<{ size: string; chunk_size: number }>(
    "SELECT size, chunk_size FROM upload_sessions WHERE id=$1 AND user_id=$2",
    [req.params.id, uid]
  );
  const totalSize = Number(sess2.rows[0].size);
  const cSize = sess2.rows[0].chunk_size;
  const total = Math.max(1, Math.ceil(totalSize / cSize));
  if (idx >= total)
    return res.status(400).json({ error: `idx di luar jangkauan (total ${total})` });
  const expectedLen =
    idx === total - 1 ? totalSize - (total - 1) * cSize : cSize;
  const declaredLen = Number(req.headers["content-length"] ?? -1);
  if (declaredLen !== expectedLen)
    return res.status(400).json({
      error: `ukuran chunk ${idx} harus ${expectedLen} byte, diterima ${declaredLen}`,
    });

  try {
    // Sudah pernah diterima? (dedup + resume) → 200 tanpa baca body.
    const already = await query(
      "SELECT 1 FROM upload_session_chunks WHERE session_id=$1 AND idx=$2",
      [req.params.id, idx]
    );
    if (!already.rowCount) {
      if (!(await hasChunk(expectedSha))) {
        await writeChunk(expectedSha, req); // stream body → disk, verify hash
      }
      await query(
        `INSERT INTO upload_session_chunks(session_id, idx, chunk_sha256)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [req.params.id, idx, expectedSha]
      );
    } else {
      // drain body biar koneksi bersih
      await new Promise<void>((resolve) => {
        req.resume();
        req.on("end", () => resolve());
        req.on("error", () => resolve());
      });
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "gagal" });
  }
});

// Complete: validasi semua chunk ada, susun node FILE.
uploadRouter.post("/:id/complete", async (req, res) => {
  const uid = req.user!.id;
  const s = await query(
    `SELECT id, target_parent_id, filename, size, mime, chunk_size
     FROM upload_sessions WHERE id=$1 AND user_id=$2`,
    [req.params.id, uid]
  );
  if (!s.rows[0]) return res.status(404).json({ error: "sesi tidak ada" });
  const sess = s.rows[0];
  const size = Number(sess.size);
  const totalChunks = Math.max(1, Math.ceil(size / sess.chunk_size));

  const received = await query<{ idx: number; chunk_sha256: string }>(
    "SELECT idx, chunk_sha256 FROM upload_session_chunks WHERE session_id=$1 ORDER BY idx",
    [sess.id]
  );
  const recvRows = received.rows as any[];
  const missing: number[] = [];
  for (let i = 0; i < totalChunks; i++) {
    if (!recvRows.find((r) => r.idx === i)) missing.push(i);
  }
  if (missing.length)
    return res.status(409).json({ error: "chunk belum lengkap", missing });

  const chunks = recvRows.map((r) => ({ idx: r.idx, sha: r.chunk_sha256 }));

  // head hash file = gabungan berurutan chunk hash.
  const head = createHash("sha256");
  for (const c of chunks) head.update(c.sha, "hex");

  // Tambahkan ukuran ke folder leluhur.
  await addAncestorSizes(uid, sess.target_parent_id, size);

  const node = await createFileNode({
    ownerId: uid,
    parentId: sess.target_parent_id,
    name: sess.filename,
    mime: sess.mime ?? null,
    size,
    headSha: head.digest("hex"),
    chunks,
  });

  await query("DELETE FROM upload_sessions WHERE id=$1", [sess.id]);
  res.status(201).json(node);
});
