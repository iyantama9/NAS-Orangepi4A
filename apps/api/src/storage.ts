// Content-addressed chunk store di disk: chunks/ab/ab3f... (nama = hex sha256 isi).
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
} from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const ROOT = process.env.NAS_DATA_DIR ?? "/opt/nas/data";
const chunkDir = (sha: string) =>
  path.join(ROOT, "chunks", sha.slice(0, 2), sha.slice(2, 4));

export function chunkPath(sha: string): string {
  return path.join(chunkDir(sha), sha);
}

export async function hasChunk(sha: string): Promise<boolean> {
  try {
    await fs.access(chunkPath(sha));
    return true;
  } catch {
    return false;
  }
}

/**
 * Tulis chunk dari stream, verifikasi sha256 == expected.
 * Tulis ke file sementara lalu rename atomik; kalau hash tidak cocok, buang.
 */
export async function writeChunk(
  expectedSha: string,
  input: NodeJS.ReadableStream
): Promise<void> {
  await fs.mkdir(chunkDir(expectedSha), { recursive: true });
  const tmp = chunkPath(expectedSha) + ".tmp-" + Math.random().toString(36).slice(2);
  const hash = createHash("sha256");
  try {
    const out = createWriteStream(tmp);
    const tap = pipeline(
      async function* () {
        for await (const buf of input as AsyncIterable<Buffer>) {
          hash.update(buf);
          yield buf;
        }
      },
      out
    );
    await tap;
    if (hash.digest("hex") !== expectedSha) {
      throw new Error("chunk hash mismatch");
    }
    // Kalau sudah ada (dedup), tulisan tmp ini cukup dibuang.
    await fs.rename(tmp, chunkPath(expectedSha));
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

/** Ukuran real chunk di disk (untuk hitung dedup & usage). */
export async function chunkSizeOnDisk(sha: string): Promise<number> {
  const st = await fs.stat(chunkPath(sha));
  return st.size;
}

export function readChunkStream(sha: string): NodeJS.ReadableStream {
  return createReadStream(chunkPath(sha));
}
