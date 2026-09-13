import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { authRouter } from "./auth.js";
import { nodesRouter } from "./nodes.js";
import { uploadRouter } from "./upload.js";
import { sharesRouter, publicShareRouter } from "./shares.js";
import { streamNode } from "./download.js";
import { query } from "./db.js";
import { requireUser } from "./auth.js";
import { startJobs } from "./jobs.js";
import { systemRouter } from "./system.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/nodes", nodesRouter);
app.use("/api/uploads", uploadRouter);
app.use("/api/shares", sharesRouter);
app.use("/api", systemRouter);

// Download/preview milik sendiri.
app.get("/api/nodes/:id/content", requireUser, async (req, res) => {
  await streamNode(req, res, String(req.params.id), {});
});
app.head("/api/nodes/:id/content", requireUser, async (req, res) => {
  await streamNode(req, res, String(req.params.id), {});
});

app.use(publicShareRouter); // /s/:token[/meta] publik

// ---- Serve web build statis di produksi ----
const webDist = process.env.WEB_DIST ?? path.join(process.cwd(), "web-dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  // SPA fallback untuk route non-API/non-assets.
  app.get(/^(?!\/api\/|\/s\/|\/assets\/).*/, (req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

startJobs();

app.listen(PORT, () => {
  console.log(`nas api listening on :${PORT}`);
});
