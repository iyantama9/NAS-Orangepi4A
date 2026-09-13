import os from "node:os";
import fs from "node:fs";
import express, { type Request, type Response } from "express";
import { requireUser } from "./auth.js";

export interface SystemInfo {
  hostname: string;
  os: string;
  uptime: string;
  ip: string;
  storageUsed: number;
  storageTotal: number;
}

function getStorage(): { used: number; total: number } {
  try {
    const dataPath = process.env.NAS_DATA_DIR ?? ".";
    const stat = fs.statfsSync(dataPath);
    const total = Number(stat.blocks) * Number(stat.bsize);
    const free = Number(stat.bavail) * Number(stat.bsize);
    const used = Math.max(0, total - free);
    if (total > 0) return { used, total };
  } catch {
    // fallback below
  }
  return { used: 0, total: 64 * 1024 * 1024 * 1024 };
}

function getIp(): string {
  try {
    const ifs = os.networkInterfaces();
    for (const iface of Object.values(ifs)) {
      for (const info of iface ?? []) {
        if (info.family === "IPv4" && !info.internal) {
          return info.address;
        }
      }
    }
    return "—";
  } catch {
    return "—";
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d} hari ${h} jam`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} jam ${m} menit`;
}

// Cache 30 detik agar tidak overload device
let cache: { data: SystemInfo; ts: number } | null = null;
const CACHE_TTL = 30_000;

export function getSystemInfo(): SystemInfo {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL) return cache.data;

  const hostname = os.hostname();
  const platform = os.platform() === "linux" ? "Linux" : os.platform();
  const release = os.release().split(".").slice(0, 2).join(".");
  const osStr = `${platform} ${release}`;
  const uptime = formatUptime(os.uptime());
  const ip = getIp();
  const { used, total } = getStorage();

  const data: SystemInfo = { hostname, os: osStr, uptime, ip, storageUsed: used, storageTotal: total };
  cache = { data, ts: now };
  return data;
}

export const systemRouter = express.Router();

systemRouter.get("/system", requireUser, (_req: Request, res: Response) => {
  res.json(getSystemInfo());
});
