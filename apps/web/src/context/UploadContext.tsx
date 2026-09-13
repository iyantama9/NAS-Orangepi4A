import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadFile, type UploadProgress } from "../api";
import {
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  X,
  File as FileIcon,
  Loader2,
  Trash2,
} from "lucide-react";

export interface UploadItem {
  id: string;
  file: File;
  parentId: string | null;
  uploadedBytes: number;
  totalBytes: number;
  state: "queued" | "hashing" | "uploading" | "done" | "error";
  error?: string;
}

interface UploadContextType {
  uploads: Record<string, UploadItem>;
  startUploads: (files: FileList | File[], parentId?: string | null) => void;
  cancelUpload: (id: string) => void;
  clearCompleted: () => void;
  activeCount: number;
}

const UploadContext = createContext<UploadContextType | null>(null);

function fmtBytes(n: number): string {
  if (!n || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(1)} ${u[i]}`;
}

const MAX_CONCURRENT_UPLOADS = 3;

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<Record<string, UploadItem>>({});
  const [isExpanded, setIsExpanded] = useState(true);
  const qc = useQueryClient();

  const itemsMapRef = useRef<Map<string, UploadItem>>(new Map());
  const queueRef = useRef<string[]>([]);
  const activeWorkersRef = useRef(0);

  const syncState = useCallback(() => {
    const next: Record<string, UploadItem> = {};
    for (const [id, item] of itemsMapRef.current.entries()) {
      next[id] = { ...item };
    }
    setUploads(next);
  }, []);

  const runWorker = useCallback(async () => {
    while (queueRef.current.length > 0) {
      const uploadId = queueRef.current.shift();
      if (!uploadId) continue;

      const item = itemsMapRef.current.get(uploadId);
      if (!item || item.state === "done" || item.state === "error") continue;

      try {
        await uploadFile(
          item.file,
          item.parentId,
          (p: UploadProgress) => {
            const current = itemsMapRef.current.get(uploadId);
            if (current) {
              current.uploadedBytes = p.uploadedBytes;
              current.totalBytes = p.totalBytes;
              current.state = p.state;
              current.error = p.error;
              syncState();
            }
          }
        );

        const current = itemsMapRef.current.get(uploadId);
        if (current) {
          current.state = "done";
          current.uploadedBytes = current.totalBytes;
          syncState();
        }

        qc.invalidateQueries({ queryKey: ["nodes"] });
        qc.invalidateQueries({ queryKey: ["systemInfo"] });
      } catch (err: any) {
        const current = itemsMapRef.current.get(uploadId);
        if (current) {
          current.state = "error";
          current.error = err.message || "Gagal mengunggah";
          syncState();
        }
      }
    }
  }, [qc, syncState]);

  const drainQueue = useCallback(() => {
    while (
      activeWorkersRef.current < MAX_CONCURRENT_UPLOADS &&
      queueRef.current.length > 0
    ) {
      activeWorkersRef.current++;
      runWorker().finally(() => {
        activeWorkersRef.current--;
        drainQueue();
      });
    }
  }, [runWorker]);

  const startUploads = useCallback(
    (files: FileList | File[], parentId: string | null = null) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      fileList.forEach((file) => {
        const id = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newItem: UploadItem = {
          id,
          file,
          parentId,
          uploadedBytes: 0,
          totalBytes: file.size,
          state: "queued",
        };
        itemsMapRef.current.set(id, newItem);
        queueRef.current.push(id);
      });

      syncState();
      setIsExpanded(true);
      drainQueue();
    },
    [syncState, drainQueue]
  );

  const cancelUpload = useCallback((id: string) => {
    queueRef.current = queueRef.current.filter((item) => item !== id);
    itemsMapRef.current.delete(id);
    syncState();
  }, [syncState]);

  const clearCompleted = useCallback(() => {
    for (const [id, item] of Array.from(itemsMapRef.current.entries())) {
      if (item.state === "done" || item.state === "error") {
        itemsMapRef.current.delete(id);
      }
    }
    syncState();
  }, [syncState]);

  const uploadList = Object.values(uploads);
  const activeCount = uploadList.filter(
    (u) => u.state === "queued" || u.state === "hashing" || u.state === "uploading"
  ).length;
  const doneCount = uploadList.filter((u) => u.state === "done").length;

  return (
    <UploadContext.Provider
      value={{
        uploads,
        startUploads,
        cancelUpload,
        clearCompleted,
        activeCount,
      }}
    >
      {children}

      {/* Persistent Background Upload Floating Drawer */}
      {uploadList.length > 0 && (
        <aside className="global-upload-drawer" aria-label="Upload Progress">
          {/* Header Bar */}
          <div
            className="upload-drawer-header"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="drawer-header-left">
              <div className="drawer-icon-bubble">
                {activeCount > 0 ? (
                  <Loader2 size={16} className="spin-icon text-amber" />
                ) : (
                  <CheckCircle2 size={16} className="text-plasma" />
                )}
              </div>
              <div className="drawer-title-meta">
                <span className="drawer-title">
                  {activeCount > 0
                    ? `Mengunggah ${activeCount} file...`
                    : `${doneCount} file selesai diunggah`}
                </span>
              </div>
            </div>

            <div className="drawer-header-actions">
              {doneCount > 0 && activeCount === 0 && (
                <button
                  className="btn-drawer-mini"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearCompleted();
                  }}
                  title="Hapus riwayat selesai"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                className="btn-drawer-mini"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                title={isExpanded ? "Kecilkan" : "Perbesar"}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>
          </div>

          {/* Expanded Item List */}
          {isExpanded && (
            <div className="upload-drawer-body">
              {uploadList.map((item) => {
                const pct =
                  item.totalBytes > 0
                    ? Math.min(100, Math.round((item.uploadedBytes / item.totalBytes) * 100))
                    : 0;

                return (
                  <div key={item.id} className={`upload-item-card ${item.state}`}>
                    <div className="upload-item-header">
                      <div className="upload-item-name-wrap">
                        <FileIcon size={15} className="upload-file-icon" />
                        <span className="upload-file-name" title={item.file.name}>
                          {item.file.name}
                        </span>
                      </div>
                      <div className="upload-item-meta">
                        {item.state === "done" && (
                          <span className="badge-done">Selesai</span>
                        )}
                        {item.state === "error" && (
                          <span className="badge-error" title={item.error}>
                            Gagal
                          </span>
                        )}
                        {item.state === "hashing" && (
                          <span className="badge-hashing">Hashing...</span>
                        )}
                        {item.state === "queued" && (
                          <span className="badge-queued">Antrean</span>
                        )}
                        {item.state === "uploading" && (
                          <span className="badge-uploading">{pct}%</span>
                        )}

                        {(item.state === "done" || item.state === "error") && (
                          <button
                            className="btn-item-cancel"
                            onClick={() => cancelUpload(item.id)}
                            title="Hapus dari daftar"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="upload-item-bar-bg">
                      <div
                        className={`upload-item-bar-fill ${item.state}`}
                        style={{
                          width:
                            item.state === "done"
                              ? "100%"
                              : item.state === "error"
                              ? "100%"
                              : `${pct}%`,
                        }}
                      />
                    </div>

                    <div className="upload-item-footer">
                      <span className="upload-bytes-text">
                        {fmtBytes(item.uploadedBytes)} / {fmtBytes(item.totalBytes)}
                      </span>
                      {item.state === "error" && item.error && (
                        <span className="upload-err-text">{item.error}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      )}
    </UploadContext.Provider>
  );
}

export function useUploadManager() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploadManager must be used within UploadProvider");
  return ctx;
}
