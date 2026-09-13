// Share link publik: token di path, opsional expiry.
import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { ShareDto } from "@nas/shared";
import { query } from "./db.js";
import { requireUser } from "./auth.js";
import { streamNode } from "./download.js";

export const sharesRouter = Router();
sharesRouter.use(requireUser);

// Buat share link.
sharesRouter.post("/", async (req, res) => {
  const uid = req.user!.id;
  const nodeId = String(req.body?.nodeId ?? "");
  const expiresInDays = req.body?.expiresInDays ? Number(req.body.expiresInDays) : null;
  const owns = await query(
    "SELECT 1 FROM nodes WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL",
    [nodeId, uid]
  );
  if (!owns.rowCount) return res.status(404).json({ error: "tidak ada" });
  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO share_links(token, node_id, created_by, expires_at)
     VALUES ($1,$2,$3, CASE WHEN $4::int IS NULL THEN NULL ELSE now() + ($4::int || ' days')::interval END)`,
    [token, nodeId, uid, expiresInDays]
  );
  res.status(201).json({ token, urlPath: `/s/${token}` });
});

// Daftar share milik user.
sharesRouter.get("/", async (req, res) => {
  const uid = req.user!.id;
  const r = await query<{ token: string; node_id: string; node_name: string; expires_at: Date | null }>(
    `SELECT sl.token, sl.node_id, n.name AS node_name, sl.expires_at
     FROM share_links sl JOIN nodes n ON n.id = sl.node_id
     WHERE sl.created_by=$1 ORDER BY sl.created_at DESC`,
    [uid]
  );
  const body: ShareDto[] = r.rows.map((row: any) => ({
    token: row.token,
    nodeId: row.node_id,
    nodeName: row.node_name,
    expiresAt: row.expires_at?.toISOString?.() ?? null,
    urlPath: `/s/${row.token}`,
  }));
  res.json(body);
});

// Cabut share.
sharesRouter.delete("/:token", async (req, res) => {
  const r = await query(
    "DELETE FROM share_links WHERE token=$1 AND created_by=$2",
    [req.params.token, req.user!.id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "tidak ada" });
  res.json({ ok: true });
});

// ---- Publik (tanpa login): akses via share token ----

export const publicShareRouter = Router();

// Metadata file yang di-share (untuk viewer ringan).
publicShareRouter.get("/s/:token/meta", async (req, res) => {
  const r = await query(
    `SELECT n.id, n.name, n.mime, n.size FROM share_links sl
     JOIN nodes n ON n.id = sl.node_id
     WHERE sl.token=$1 AND (sl.expires_at IS NULL OR sl.expires_at > now())
       AND n.deleted_at IS NULL`,
    [req.params.token]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "link tidak valid/kedaluwarsa" });
  const row = r.rows[0];
  res.json({
    name: row.name,
    mime: row.mime ?? "application/octet-stream",
    size: Number(row.size),
  });
});

publicShareRouter.get("/s/:token", async (req, res) => {
  const r = await query<{ node_id: string }>(
    `SELECT node_id FROM share_links sl
     WHERE sl.token=$1 AND (sl.expires_at IS NULL OR sl.expires_at > now())`,
    [req.params.token]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "link tidak valid/kedaluwarsa" });
  await streamNode(req, res, r.rows[0].node_id, {});
});
