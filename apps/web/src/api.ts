// Klien API + uploader chunked dengan resume.
import type {
  NodeDto,
  SessionUser,
  ShareDto,
  UploadInitResponse,
  UploadStatusResponse,
  SystemInfo,
} from "@nas/shared";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  me: () => fetch("/api/auth/me").then((r) => (r.ok ? j<SessionUser>(r) : Promise.reject(new Error("unauth")))),
  register: (email: string, password: string, rememberMe = true) =>
    fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
    }).then((r) => j<SessionUser>(r)),
  login: (email: string, password: string, rememberMe = true) =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
    }).then((r) => j<SessionUser>(r)),
  logout: () => fetch("/api/auth/logout", { method: "POST" }),

  list: (opts: { parentId?: string | null; q?: string; trash?: boolean }) => {
    const u = new URL("/api/nodes", location.origin);
    if (opts.q) u.searchParams.set("q", opts.q);
    else if (opts.trash) u.searchParams.set("parentId", "trash");
    else if (opts.parentId) u.searchParams.set("parentId", opts.parentId);
    return fetch(u).then((r) => j<NodeDto[]>(r));
  },
  createFolder: (name: string, parentId: string | null) =>
    fetch("/api/nodes/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    }).then((r) => j<NodeDto>(r)),
  rename: (id: string, name: string) =>
    fetch(`/api/nodes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => j<NodeDto>(r)),
  move: (id: string, parentId: string | null) =>
    fetch(`/api/nodes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId }),
    }).then((r) => j<NodeDto>(r)),
  trash: (id: string) => fetch(`/api/nodes/${id}`, { method: "DELETE" }),
  restore: (id: string) => fetch(`/api/nodes/${id}/restore`, { method: "POST" }),
  purge: (id: string) => fetch(`/api/nodes/${id}/purge`, { method: "DELETE" }),

  shares: () => fetch("/api/shares").then((r) => j<ShareDto[]>(r)),
  createShare: (nodeId: string, expiresInDays?: number) =>
    fetch("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, expiresInDays }),
    }).then((r) => j<{ token: string; urlPath: string }>(r)),
  revokeShare: (token: string) => fetch(`/api/shares/${token}`, { method: "DELETE" }),

  systemInfo: () => fetch("/api/system").then((r) => j<SystemInfo>(r)),
};

export const contentUrl = (nodeId: string, download?: boolean) =>
  `/api/nodes/${nodeId}/content${download ? "?download=1" : ""}`;

import { sha256Hex } from "./sha256";

export interface UploadProgress {
  file: File;
  uploadedBytes: number;
  totalBytes: number;
  state: "hashing" | "uploading" | "done" | "error";
  error?: string;
}

/**
 * Upload satu file: hash per-chunk (dedup + integritas), kirim yang belum diterima.
 * Gagal di tengah → panggil lagi fungsi ini dengan uploadId lama untuk lanjut.
 */
export async function uploadFile(
  file: File,
  parentId: string | null,
  onProgress: (p: UploadProgress) => void,
  existingUploadId?: string
): Promise<{ nodeId: string } | { uploadId: string }> {
  const CHUNK = 8 * 1024 * 1024;
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK));

  let uploadId = existingUploadId;
  let received = new Set<number>();

  if (!uploadId) {
    const init = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        parentId,
      }),
    }).then((r) => j<UploadInitResponse>(r));
    uploadId = init.uploadId;
  } else {
    // Resume: tanya chunk mana yang sudah ada pada sesi sebelumnya.
    const status = await fetch(`/api/uploads/${uploadId}`).then((r) =>
      j<UploadStatusResponse>(r)
    );
    received = new Set(status.receivedChunks);
  }

  for (let i = 0; i < totalChunks; i++) {
    onProgress({
      file,
      uploadedBytes: received.size * CHUNK > file.size ? file.size : received.size * CHUNK,
      totalBytes: file.size,
      state: "hashing",
    });
    const blob = file.slice(i * CHUNK, Math.min((i + 1) * CHUNK, file.size));
    const buf = await blob.arrayBuffer();
    const sha = sha256Hex(buf);

    if (!received.has(i)) {
      // Server mungkin sudah punya chunk sama (dedup) — kirim tetap, server skip kalau punya.
      const put = await fetch(`/api/uploads/${uploadId}/chunks/${i}`, {
        method: "PUT",
        headers: { "X-Chunk-Sha256": sha, "Content-Type": "application/octet-stream" },
        body: buf,
      });
      if (!put.ok) throw new Error(`chunk ${i} gagal: ${await put.text()}`);
    }
    received.add(i);
    onProgress({
      file,
      uploadedBytes: Math.min(received.size * CHUNK, file.size),
      totalBytes: file.size,
      state: "uploading",
    });
  }

  const done = await fetch(`/api/uploads/${uploadId}/complete`, { method: "POST" });
  if (!done.ok) {
    const e = await done.json().catch(() => ({ error: "complete gagal" }));
    if ((e as any).missing?.length)
      return { uploadId }; // belum lengkap → client bisa lanjut nanti
    throw new Error((e as any).error);
  }
  const node = await done.json();
  onProgress({ file, uploadedBytes: file.size, totalBytes: file.size, state: "done" });
  return { nodeId: node.id };
}
