// Pekerjaan berkala: purge trash > 30 hari, GC chunk yatim di disk.
import { readdir } from "node:fs/promises";
import path from "node:path";
import { query, pool } from "./db.js";

const ROOT = process.env.NAS_DATA_DIR ?? "/opt/nas/data";
const TRASH_TTL_DAYS = 30;

export async function purgeOldTrash(): Promise<number> {
  const r = await query(
    `DELETE FROM nodes
     WHERE deleted_at IS NOT NULL AND deleted_at < now() - ($1 || ' days')::interval`,
    [TRASH_TTL_DAYS]
  );
  return r.rowCount ?? 0;
}

/** Hapus chunk di disk yang tidak direferensikan node_chunks maupun upload_session_chunks. */
export async function gcOrphanChunks(): Promise<number> {
  let removed = 0;
  const levels = await readdir(path.join(ROOT, "chunks"));
  for (const l1 of levels) {
    const l2s = await readdir(path.join(ROOT, "chunks", l1));
    for (const l2 of l2s) {
      const files = await readdir(path.join(ROOT, "chunks", l1, l2));
      for (const f of files) {
        if (!f.match(/^[0-9a-f]{64}$/)) continue; // skip .tmp-*
        const sha = f;
        const ref = await query(
          `SELECT
             EXISTS(SELECT 1 FROM node_chunks WHERE chunk_sha256=$1) AS in_nodes,
             EXISTS(SELECT 1 FROM upload_session_chunks WHERE chunk_sha256=$1) AS in_uploads`,
          [sha]
        );
        if (!ref.rows[0].in_nodes && !ref.rows[0].in_uploads) {
          // Hapus via DB-free path supaya tidak perlu import balik storage.ts.
          const { unlink } = await import("node:fs/promises");
          await unlink(path.join(ROOT, "chunks", l1, l2, f)).catch(() => {});
          removed++;
        }
      }
    }
  }
  return removed;
}

export function startJobs() {
  const tick = async () => {
    try {
      const purged = await purgeOldTrash();
      const gc = await gcOrphanChunks();
      if (purged || gc) console.log(`[jobs] purged=${purged} gcChunks=${gc}`);
    } catch (e) {
      console.error("[jobs]", e);
    }
  };
  setInterval(tick, 6 * 3600_000); // tiap 6 jam
  setTimeout(tick, 30_000); // sekali tepat setelah boot
}

// CLI kecil: tsx src/jobs.ts run
if (process.argv[2] === "run") {
  (async () => {
    console.log("purged:", await purgeOldTrash());
    console.log("gc chunks:", await gcOrphanChunks());
    await pool.end();
  })();
}
