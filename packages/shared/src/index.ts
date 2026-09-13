// Tipe & skema API yang dipakai api + web.
import { z } from "zod";

export const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB

export type NodeType = "FILE" | "FOLDER";

/** Node seperti yang dikirim ke client (tanpa kolom internal). */
export interface NodeDto {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null;
  size: number; // folder: total turunannya, file: byte
  mime: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
}

export interface UploadInitRequest {
  filename: string;
  size: number;
  mime?: string;
  parentId: string | null;
}

export interface UploadInitResponse {
  uploadId: string;
  chunkSize: number;
  receivedChunks: number[]; // kosong saat init
}

export interface UploadStatusResponse {
  uploadId: string;
  filename: string;
  size: number;
  chunkSize: number;
  receivedChunks: number[];
  totalChunks: number;
}

export interface ShareDto {
  token: string;
  nodeId: string;
  nodeName: string;
  expiresAt: string | null;
  urlPath: string;
}

export const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  rememberMe: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export interface SystemInfo {
  hostname: string;
  os: string;
  uptime: string;
  ip: string;
  storageUsed: number;
  storageTotal: number;
}
