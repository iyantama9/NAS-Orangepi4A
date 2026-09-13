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

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<Record<string, UploadItem>>({});
  const [isExpanded, setIsExpanded] = useState(true);
  const qc = useQueryClient();
  const queueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;
    isProcessingRef.current = true;

    while (queueRef.current.length > 0) {
      const uploadId = queueRef.current.shift();
      if (!uploadId) continue;

      let currentItem: UploadItem | undefined;
      setUploads((prev) => {
        currentItem = prev[uploadId];
        return prev;
      });

      if (!currentItem || currentItem.state === "done") continue;

      try {
        const item = currentItem;
        await uploadFile(
          item.file,
          item.parentId,
          (p: UploadProgress) => {
            setUploads((prev) => {
              if (!prev[uploadId]) return prev;
              return {
                ...prev,
                [uploadId]: {
                  ...prev[uploadId],
                  uploadedBytes: p.uploadedBytes,
                  totalBytes: p.totalBytes,
                  state: p.state,
                  error: p.error,
                },
              };
            });
          }
        );

        // Upload sukses
        qc.invalidateQueries({ queryKey: ["nodes"] });
        qc.invalidateQueries({ queryKey: ["systemInfo"] });
      } catch (err: any) {
        setUploads((prev) => {
          if (!prev[uploadId]) return prev;
          return {
            ...prev,
            [uploadId]: {
              ...prev[uploadId],
              state: "error",
              error: err.message || "Gagal mengunggah",
            },
          };
        });
      }
    }

    isProcessingRef.current = false;
  }, [qc]);

  const startUploads = useCallback(
    (files: FileList | File[], parentId: string | null = null) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      const newIds: string[] = [];
      setUploads((prev) => {
        const next = { ...prev };
        fileList.forEach((file) => {
          const id = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          next[id] = {
            id,
            file,
            parentId,
            uploadedBytes: 0,
            totalBytes: file.size,
            state: "queued",
          };
          newIds.push(id);
        });
        return next;
      });

      queueRef.current.push(...newIds);
      setIsExpanded(true);
      setTimeout(processQueue, 50);
    },
    [processQueue]
  );

  const cancelUpload = useCallback((id: string) => {
    queueRef.current = queueRef.current.filter((item) => item !== id);
    setUploads((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => {
      const next: Record<string, UploadItem> = {};
      Object.entries(prev).forEach(([id, item]) => {
        if (item.state !== "done" && item.state !== "error") {
          next[id] = item;
        }
      });
      return next;
    });
  }, []);

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
