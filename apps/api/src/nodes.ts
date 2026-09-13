// CRUD pohon file/folder + trash.
import { Router } from "express";
import type { NodeDto } from "@nas/shared";
import { query } from "./db.js";
import { requireUser } from "./auth.js";

const nodeCols = `id, owner_id, type, name, parent_id, size, mime, deleted_at, created_at`;

function toDto(r: any): NodeDto {
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    parentId: r.parent_id,
    size: Number(r.size),
    mime: r.mime ?? null,
    createdAt: r.created_at?.toISOString?.() ?? String(r.created_at),
    deletedAt: r.deleted_at?.toISOString?.() ?? (r.deleted_at ? String(r.deleted_at) : null),
  };
}

/** Update size folder leluhur: delta = perubahan ukuran (byte). */
export async function addAncestorSizes(
  ownerId: string,
  parentId: string | null,
  delta: number
): Promise<void> {
  if (!parentId || !delta) return;
  await query(
    `UPDATE nodes SET size = size + $1
     WHERE id IN (
       WITH RECURSIVE anc AS (
         SELECT id FROM nodes WHERE id = $2 AND owner_id = $3
         UNION ALL
         SELECT n.parent_id FROM nodes n JOIN anc ON n.id = anc.id WHERE n.parent_id IS NOT NULL
       ) SELECT id FROM anc
     )`,
    [delta, parentId, ownerId]
  );
}

async function ownsNode(userId: string, nodeId: string): Promise<boolean> {
  const r = await query("SELECT 1 FROM nodes WHERE id = $1 AND owner_id = $2", [
    nodeId,
    userId,
  ]);
  return !!r.rowCount;
}

export const nodesRouter = Router();
nodesRouter.use(requireUser);

// List isi folder (atau root), dipakai juga untuk search ?q= di seluruh milik user.
nodesRouter.get("/", async (req, res) => {
  const uid = req.user!.id;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  let rows;
  if (q) {
    rows = await query(
      `SELECT ${nodeCols} FROM nodes
       WHERE owner_id = $1 AND deleted_at IS NULL AND name ILIKE '%' || $2 || '%'
       ORDER BY type DESC, name LIMIT 200`,
      [uid, q]
    );
  } else {
    const parent = req.query.parentId as string | undefined;
    const parentFilter =
      parent === "trash"
        ? { where: "deleted_at IS NOT NULL", params: [] as any[] }
        : {
            where: "parent_id IS NOT DISTINCT FROM $2 AND deleted_at IS NULL",
            params: [parent ?? null],
          };
    rows = await query(
      `SELECT ${nodeCols} FROM nodes
       WHERE owner_id = $1 AND ${parentFilter.where}
       ORDER BY type DESC, name`,
      [uid, ...parentFilter.params]
    );
  }
  res.json(rows.rows.map(toDto));
});

nodesRouter.post("/folders", async (req, res) => {
  const uid = req.user!.id;
  const name = String(req.body?.name ?? "").trim();
  const parentId = req.body?.parentId ?? null;
  if (!name || name.includes("/")) return res.status(400).json({ error: "nama tidak valid" });
  if (parentId && !(await ownsNode(uid, parentId)))
    return res.status(404).json({ error: "folder tujuan tidak ada" });
  const dup = await query(
    "SELECT 1 FROM nodes WHERE owner_id=$1 AND parent_id IS NOT DISTINCT FROM $2 AND name=$3 AND deleted_at IS NULL",
    [uid, parentId, name]
  );
  if (dup.rowCount) return res.status(409).json({ error: "nama sudah dipakai" });
  const r = await query(
    `INSERT INTO nodes(owner_id, type, name, parent_id) VALUES ($1,'FOLDER',$2,$3)
     RETURNING ${nodeCols}`,
    [uid, name, parentId]
  );
  res.status(201).json(toDto(r.rows[0]));
});

// Upload complete menyusun node FILE dari upload session (dipanggil dari upload.ts).
export async function createFileNode(opts: {
  ownerId: string;
  parentId: string | null;
  name: string;
  mime: string | null;
  size: number;
  headSha: string;
  chunks: { idx: number; sha: string }[];
}): Promise<NodeDto> {
  const client = await (await import("./db.js")).pool.connect();
  try {
    await client.query("BEGIN");
    // Nama unik per folder: tambahkan " (n)" kalau bentrok — biar upload ulang tidak menimpa diam-diam.
    let name = opts.name;
    let n = 2;
    while (
      (
        await client.query(
          "SELECT 1 FROM nodes WHERE owner_id=$1 AND parent_id IS NOT DISTINCT FROM $2 AND name=$3 AND deleted_at IS NULL",
          [opts.ownerId, opts.parentId, name]
        )
      ).rowCount
    ) {
      name = opts.name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
      n++;
    }
    const nodeR = await client.query(
      `INSERT INTO nodes(owner_id, type, name, parent_id, size, mime, head_sha256)
       VALUES ($1,'FILE',$2,$3,$4,$5,$6) RETURNING id`,
      [opts.ownerId, name, opts.parentId, opts.size, opts.mime, opts.headSha]
    );
    const nodeId = nodeR.rows[0].id;
    for (const c of opts.chunks) {
      await client.query(
        "INSERT INTO node_chunks(node_id, idx, chunk_sha256) VALUES ($1,$2,$3)",
        [nodeId, c.idx, c.sha]
      );
    }
    await client.query("COMMIT");
    const final = await query(`SELECT ${nodeCols} FROM nodes WHERE id=$1`, [nodeId]);
    return toDto((final.rows as any[])[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Get satu node (metadata), plus daftar chunk utk file.
nodesRouter.get("/:id", async (req, res) => {
  const uid = req.user!.id;
  const r = await query(
    `SELECT ${nodeCols} FROM nodes WHERE id=$1 AND owner_id=$2`,
    [req.params.id, uid]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "tidak ada" });
  const chunks = await query(
    "SELECT chunk_sha256 FROM node_chunks WHERE node_id=$1 ORDER BY idx",
    [req.params.id]
  );
  res.json({ ...toDto(r.rows[0]), chunks: chunks.rows.map((c) => c.chunk_sha256) });
});

nodesRouter.patch("/:id", async (req, res) => {
  const uid = req.user!.id;
  const node = await query(
    "SELECT id, parent_id, name FROM nodes WHERE id=$1 AND owner_id=$2",
    [req.params.id, uid]
  );
  if (!node.rows[0]) return res.status(404).json({ error: "tidak ada" });

  const newName = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;
  const newParent = req.body?.parentId !== undefined ? req.body.parentId : undefined;

  if (newParent !== undefined && newParent !== null) {
    if (!(await ownsNode(uid, newParent)))
      return res.status(404).json({ error: "folder tujuan tidak ada" });
    if (newParent === req.params.id)
      return res.status(400).json({ error: "tidak bisa pindah ke diri sendiri" });
    // Cegah memindah folder ke dalam keturunannya sendiri.
    const cyc = await query(
      `WITH RECURSIVE desc AS (
         SELECT id FROM nodes WHERE id = $1
         UNION ALL
         SELECT n.id FROM nodes n JOIN desc d ON n.parent_id = d.id
       ) SELECT 1 FROM desc WHERE id = $2`,
      [req.params.id, newParent]
    );
    if (cyc.rowCount) return res.status(400).json({ error: "tidak bisa pindah ke dalam subfolder" });
  }

  await query(
    `UPDATE nodes SET
       name = COALESCE($1, name),
       parent_id = $2
     WHERE id=$3 AND owner_id=$4`,
    [newName ?? null, newParent !== undefined ? newParent : node.rows[0].parent_id, req.params.id, uid]
  );
  const r = await query(`SELECT ${nodeCols} FROM nodes WHERE id=$1`, [req.params.id]);
  res.json(toDto(r.rows[0]));
});

// Soft delete → trash.
nodesRouter.delete("/:id", async (req, res) => {
  const uid = req.user!.id;
  // trash seluruh subtree dengan CTE rekurif
  const r = await query(
    `WITH RECURSIVE sub AS (
       SELECT id FROM nodes WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL
       UNION ALL
       SELECT n.id FROM nodes n JOIN sub s ON n.parent_id = s.id
     )
     UPDATE nodes SET deleted_at = now() WHERE id IN (SELECT id FROM sub) RETURNING id, size`,
    [req.params.id, uid]
  );
  if (!r.rowCount) return res.status(404).json({ error: "tidak ada" });
  const top = await query<{ parent_id: string | null; size: string }>(
    "SELECT parent_id, size FROM nodes WHERE id=$1",
    [req.params.id]
  );
  // Ukuran folder tetap kita anggap termasuk yang di-trash? Google Drive menghitung ulang;
  // simpel: kurangi leluhur dengan size node (folder ancestor tidak menghitung item trashed).
  await addAncestorSizes(uid, top.rows[0].parent_id, -Number(top.rows[0].size));
  res.json({ ok: true });
});

// Restore dari trash (beserta subtree-nya tetap ter-restore bareng karena subtree hanya ditandai).
nodesRouter.post("/:id/restore", async (req, res) => {
  const uid = req.user!.id;
  const info = await query<{ parent_id: string | null; size: string }>(
    `UPDATE nodes SET deleted_at = NULL WHERE id=$1 AND owner_id=$2 RETURNING parent_id, size`,
    [req.params.id, uid]
  );
  if (!info.rows[0]) return res.status(404).json({ error: "tidak ada" });
  await addAncestorSizes(uid, info.rows[0].parent_id, Number(info.rows[0].size));
  // Kalau parent-nya juga masih di trash, keluarkan ke root biar visible.
  await query(
    `UPDATE nodes SET parent_id = NULL
     WHERE id=$1 AND parent_id IN (SELECT id FROM nodes WHERE deleted_at IS NOT NULL)`,
    [req.params.id]
  );
  res.json({ ok: true });
});

// Purge permanen dari trash: hapus metadata; GC chunk yatim ditangani jobs.ts.
nodesRouter.delete("/:id/purge", async (req, res) => {
  const uid = req.user!.id;
  const r = await query(
    `DELETE FROM nodes WHERE id=$1 AND owner_id=$2 AND deleted_at IS NOT NULL`,
    [req.params.id, uid]
  );
  if (!r.rowCount) return res.status(404).json({ error: "harus di trash dulu" });
  res.json({ ok: true });
});
