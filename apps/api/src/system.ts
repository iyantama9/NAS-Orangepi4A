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

function getHostOs(): string {
  if (process.env.HOST_OS) return process.env.HOST_OS;
  const paths = ["/etc/host-os-release", "/etc/os-release"];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf-8");
        const prettyMatch = content.match(/^PRETTY_NAME=["']?([^"'\n]+)["']?/m);
        if (prettyMatch?.[1]) {
          return prettyMatch[1].replace("GNU/Linux ", "");
        }
      }
    } catch {
      // ignore
    }
  }
  const platform = os.platform() === "linux" ? "Linux" : os.platform();
  const release = os.release().split(".").slice(0, 2).join(".");
  return `${platform} ${release}`;
}

function getHostHostname(): string {
  if (process.env.HOST_HOSTNAME) return process.env.HOST_HOSTNAME;
  try {
    if (fs.existsSync("/etc/host-hostname")) {
      const h = fs.readFileSync("/etc/host-hostname", "utf-8").trim();
      if (h) return h;
    }
  } catch {
    // ignore
  }
  const defaultHost = os.hostname();
  if (/^[a-f0-9]{12}$/i.test(defaultHost)) {
    return "orangepi4a";
  }
  return defaultHost;
}

function getHostIp(): string {
  const lanIp = process.env.HOST_IP;
  const tailscaleIp = process.env.TAILSCALE_IP;
  if (lanIp && tailscaleIp) {
    return `${lanIp} · ${tailscaleIp}`;
  }
  if (lanIp) return lanIp;
  if (tailscaleIp) return tailscaleIp;

  try {
    const ifs = os.networkInterfaces();
    for (const iface of Object.values(ifs)) {
      for (const info of iface ?? []) {
        if (info.family === "IPv4" && !info.internal && !info.address.startsWith("172.")) {
          return info.address;
        }
      }
    }
    // Fallback if inside docker bridge on Orange Pi
    return "192.168.1.14 · 100.82.5.51";
  } catch {
    return "192.168.1.14";
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

  const hostname = getHostHostname();
  const osStr = getHostOs();
  const uptime = formatUptime(os.uptime());
  const ip = getHostIp();
  const { used, total } = getStorage();

  const data: SystemInfo = { hostname, os: osStr, uptime, ip, storageUsed: used, storageTotal: total };
  cache = { data, ts: now };
  return data;
}

export const systemRouter = express.Router();

systemRouter.get("/system", requireUser, (_req: Request, res: Response) => {
  res.json(getSystemInfo());
});
