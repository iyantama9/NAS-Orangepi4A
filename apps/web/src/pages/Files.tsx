import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Package,
  Plus,
  Trash2,
  ChevronRight,
  Home,
  ArrowUp,
  Download,
  Eye,
  RotateCcw,
  Search,
  X,
  LayoutGrid,
  List as ListIcon,
  Copy,
  CloudUpload,
  Share2,
  FolderInput,
  Menu,
  Monitor,
  Box,
  Clock,
  Wifi,
  Activity,
  CheckSquare,
} from "lucide-react";
import PreviewModal from "../components/PreviewModal";
import ConfirmModal from "../components/ConfirmModal";
import PromptModal from "../components/PromptModal";
import Sidebar from "../components/Sidebar";
import { useUploadManager } from "../context/UploadContext";
import { api, contentUrl } from "../api";
import type { NodeDto } from "@nas/shared";

function fmtSize(n: number): string {
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

function getFileIcon(n: NodeDto) {
  if (n.type === "FOLDER") return { icon: Folder, color: "text-amber" };
  const top = (n.mime ?? "").split("/")[0];
  if (top === "image") return { icon: ImageIcon, color: "text-plasma" };
  if (top === "video") return { icon: Film, color: "text-copper" };
  if (top === "audio") return { icon: Music, color: "text-pink" };
  if (top === "application") return { icon: Package, color: "text-iron" };
  return { icon: FileText, color: "text-muted" };
}

// Donut Chart Component
function StorageDonut({ percentage }: { percentage: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="donut-chart-wrap">
      <svg width="120" height="120" viewBox="0 0 120 120" className="donut-svg">
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="donut-ring-bg"
          strokeWidth="11"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="donut-ring-fg"
          strokeWidth="11"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="donut-center-text">
        <span className="donut-pct-text">{percentage}%</span>
        <span className="donut-sub-text">Terpakai</span>
      </div>
    </div>
  );
}

export default function Files({
  trash = false,
  search = false,
}: {
  trash?: boolean;
  search?: boolean;
}) {
  const { folderId } = useParams();
  const [sp] = useSearchParams();
  const q = search ? sp.get("q") ?? "" : "";
  const nav = useNavigate();
  const qc = useQueryClient();

  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const { startUploads } = useUploadManager();
  const [previewNode, setPreviewNode] = useState<NodeDto | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(q);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Modals state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [shareModalData, setShareModalData] = useState<{ node: NodeDto; link: string } | null>(null);

  // In-app Confirm & Prompt Dialog States
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: "danger" | "warning" | "primary";
    onConfirm: () => void;
  } | null>(null);

  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    initialValue: string;
    onConfirm: (val: string) => void;
  } | null>(null);

  // Move Modal State
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  useEffect(() => {
    if (me.isError) nav("/login");
  }, [me.isError, nav]);

  const list = useQuery({
    queryKey: ["nodes", trash ? "trash" : folderId ?? "root", q],
    queryFn: () =>
      api.list(
        q
          ? { q }
          : trash
          ? { trash: true }
          : { parentId: folderId ?? null }
      ),
    enabled: !!me.data,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["nodes"] });

  // Query folders for Move dialog
  const allFolders = useQuery({
    queryKey: ["allFolders"],
    queryFn: async (): Promise<NodeDto[]> => {
      const rootNodes = await api.list({ parentId: null });
      return rootNodes.filter((n) => n.type === "FOLDER");
    },
    enabled: moveModalOpen,
  });

  const crumbs = useQuery({
    queryKey: ["crumbs", folderId],
    queryFn: async (): Promise<NodeDto[]> => {
      const out: NodeDto[] = [];
      let cur = folderId;
      while (cur) {
        const res = await fetch(`/api/nodes/${cur}`);
        if (!res.ok) break;
        const n = await res.json();
        out.unshift(n);
        cur = n.parentId;
      }
      return out;
    },
    enabled: !!folderId,
  });

  const sysInfo = useQuery({
    queryKey: ["systemInfo"],
    queryFn: api.systemInfo,
    refetchInterval: 30000,
    enabled: !!me.data,
  });

  // Clear selections when route changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [folderId, trash, search]);

  // Drag & drop handlers
  useEffect(() => {
    const over = (e: DragEvent) => {
      e.preventDefault();
      if (!trash && !search) setDragOver(true);
    };
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragOver(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (trash || search) return;
      if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [trash, search, folderId]);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    startUploads(arr, folderId ?? null);
    triggerToast(`Memulai unggah ${arr.length} file di latar belakang...`);
  }

  function triggerToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Selection handlers
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const currentNodes = list.data ?? [];
    if (selectedIds.size === currentNodes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentNodes.map((n) => n.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Batch actions
  function handleBatchTrash() {
    if (selectedIds.size === 0) return;
    setConfirmState({
      isOpen: true,
      title: "Pindahkan ke Sampah",
      message: `Pindahkan ${selectedIds.size} item terpilih ke tempat sampah?`,
      confirmText: "Pindahkan ke Sampah",
      variant: "danger",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await Promise.all(Array.from(selectedIds).map((id) => api.trash(id)));
          invalidate();
          triggerToast(`${selectedIds.size} item dipindahkan ke sampah`);
          clearSelection();
        } catch (err: any) {
          triggerToast(err.message || "Gagal membuang item terpilih");
        }
      },
    });
  }

  async function handleBatchRestore() {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.restore(id)));
      invalidate();
      triggerToast(`${selectedIds.size} item dipulihkan`);
      clearSelection();
    } catch (err: any) {
      triggerToast(err.message || "Gagal memulihkan item terpilih");
    }
  }

  function handleBatchPurge() {
    if (selectedIds.size === 0) return;
    setConfirmState({
      isOpen: true,
      title: "Hapus Permanen",
      message: `Hapus permanen ${selectedIds.size} item? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: "Hapus Permanen",
      variant: "danger",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await Promise.all(Array.from(selectedIds).map((id) => api.purge(id)));
          invalidate();
          triggerToast(`${selectedIds.size} item dihapus permanen`);
          clearSelection();
        } catch (err: any) {
          triggerToast(err.message || "Gagal menghapus permanen");
        }
      },
    });
  }

  function handleBatchDownload() {
    const currentNodes = list.data ?? [];
    const selectedFiles = currentNodes.filter(
      (n) => selectedIds.has(n.id) && n.type === "FILE"
    );
    if (selectedFiles.length === 0) {
      triggerToast("Hanya file yang dapat diunduh (folder tidak didukung)");
      return;
    }
    selectedFiles.forEach((file, idx) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = contentUrl(file.id, true);
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 300);
    });
    triggerToast(`Mengunduh ${selectedFiles.length} file...`);
  }

  async function handleBatchMove() {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => api.move(id, targetFolderId))
      );
      invalidate();
      qc.invalidateQueries({ queryKey: ["allFolders"] });
      triggerToast(`${selectedIds.size} item berhasil dipindahkan`);
      clearSelection();
      setMoveModalOpen(false);
    } catch (err: any) {
      triggerToast(err.message || "Gagal memindahkan file");
    }
  }

  // Single file actions
  async function handleCreateFolder() {
    if (!folderNameInput.trim()) return;
    try {
      await api.createFolder(folderNameInput.trim(), folderId ?? null);
      setFolderNameInput("");
      setFolderModalOpen(false);
      invalidate();
      triggerToast("Folder berhasil dibuat");
    } catch (e: any) {
      triggerToast(e.message || "Gagal membuat folder");
    }
  }

  async function handleShare(node: NodeDto) {
    try {
      const { urlPath } = await api.createShare(node.id, 7);
      const fullUrl = `${location.origin}${urlPath}`;
      setShareModalData({ node, link: fullUrl });
    } catch (e: any) {
      triggerToast(e.message || "Gagal membuat link share");
    }
  }

  function handleRename(node: NodeDto) {
    setPromptState({
      isOpen: true,
      title: `Ubah Nama`,
      initialValue: node.name,
      onConfirm: async (next: string) => {
        setPromptState(null);
        if (!next || next === node.name) return;
        try {
          await api.rename(node.id, next);
          invalidate();
          triggerToast("Nama berhasil diubah");
        } catch (e: any) {
          triggerToast(e.message || "Gagal mengubah nama");
        }
      },
    });
  }

  function handleTrash(node: NodeDto) {
    setConfirmState({
      isOpen: true,
      title: "Pindahkan ke Sampah",
      message: `Pindahkan "${node.name}" ke sampah?`,
      confirmText: "Pindahkan",
      variant: "danger",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.trash(node.id);
          invalidate();
          triggerToast(`"${node.name}" dipindahkan ke sampah`);
        } catch (e: any) {
          triggerToast(e.message || "Gagal membuang file");
        }
      },
    });
  }

  async function handleRestore(node: NodeDto) {
    try {
      await api.restore(node.id);
      invalidate();
      triggerToast(`"${node.name}" dikembalikan`);
    } catch (e: any) {
      triggerToast(e.message || "Gagal memulihkan file");
    }
  }

  function handlePurge(node: NodeDto) {
    setConfirmState({
      isOpen: true,
      title: "Hapus Permanen",
      message: `Hapus permanen "${node.name}"? Aksi ini tidak dapat dibatalkan.`,
      confirmText: "Hapus Permanen",
      variant: "danger",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.purge(node.id);
          invalidate();
          triggerToast(`"${node.name}" dihapus permanen`);
        } catch (e: any) {
          triggerToast(e.message || "Gagal menghapus file");
        }
      },
    });
  }

  function handleCopyHostname() {
    const host = sysInfo.data?.hostname || "NAS-Pi.local";
    navigator.clipboard.writeText(host).catch(() => {});
    triggerToast(`Hostname "${host}" disalin!`);
  }

  if (me.isLoading || !me.data) return null;

  const userLabel = me.data.email.split("@")[0];
  const storageUsedGb = (sysInfo.data?.storageUsed ?? 0) / 1024 ** 3;
  const storageTotalGb = (sysInfo.data?.storageTotal ?? 1) / 1024 ** 3;
  const storageFreeGb = Math.max(0, storageTotalGb - storageUsedGb);
  const storagePct = Math.min(100, Math.max(0, Math.round((storageUsedGb / storageTotalGb) * 100)));

  const nodes = list.data ?? [];
  const isRootDashboard = !trash && !search && !folderId;
  const isAllSelected = nodes.length > 0 && selectedIds.size === nodes.length;

  // Recent activities list
  const recentActivities = [
    {
      type: "folder",
      action: "Folder baru dibuat",
      target: nodes.find((n) => n.type === "FOLDER")?.name || "Dokumen",
      time: "10 menit lalu",
      color: "amber",
      icon: Folder,
    },
    {
      type: "upload",
      action: "File diupload",
      target: nodes.find((n) => n.type === "FILE")?.name || "Laporan_Q2_2024.pdf",
      time: "1 jam lalu",
      color: "green",
      icon: CloudUpload,
    },
    {
      type: "share",
      action: "File dibagikan",
      target: "Presentasi.pptx",
      time: "3 jam lalu",
      color: "blue",
      icon: Share2,
    },
  ];

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        userName={userLabel}
        userEmail={me.data.email}
        storageUsed={storageUsedGb}
        storageTotal={storageTotalGb}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onLogout={async () => {
          await api.logout();
          nav("/login");
        }}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Mobile Top Header Bar */}
        <div className="mobile-header-bar">
          <button
            className="btn-mobile-menu"
            onClick={() => setMobileMenuOpen(true)}
            title="Buka menu"
          >
            <Menu size={20} />
          </button>
          <div className="mobile-brand" onClick={() => nav("/")}>
            <span className="mobile-logo-emoji">🍊</span>
            <span className="mobile-brand-title">NAS Pi</span>
          </div>
          <div className="mobile-avatar-badge" onClick={() => setMobileMenuOpen(true)}>
            {userLabel.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInput}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Top Header Bar */}
        <header className="dashboard-top-bar">
          <div className="dashboard-greeting">
            {isRootDashboard ? (
              <>
                <h1>Halo, {userLabel} 👋</h1>
                <p>Selamat datang di NAS Pi</p>
              </>
            ) : (
              <div className="breadcrumbs-bar">
                <Link to="/" className="crumb-link">
                  <Home size={16} />
                  <span>File saya</span>
                </Link>
                {trash && (
                  <>
                    <ChevronRight size={14} className="crumb-arrow" />
                    <span className="crumb-current">Trash</span>
                  </>
                )}
                {search && (
                  <>
                    <ChevronRight size={14} className="crumb-arrow" />
                    <span className="crumb-current">Pencarian: "{q}"</span>
                  </>
                )}
                {crumbs.data?.map((c) => (
                  <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <ChevronRight size={14} className="crumb-arrow" />
                    {c.id === folderId ? (
                      <span className="crumb-current">{c.name}</span>
                    ) : (
                      <Link to={`/f/${c.id}`} className="crumb-link">
                        {c.name}
                      </Link>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="dashboard-actions-right">
            <div className="search-input-box">
              <Search size={15} />
              <input
                type="search"
                placeholder="Cari file atau folder..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    nav(searchInput.trim() ? `/search?q=${encodeURIComponent(searchInput.trim())}` : "/");
                  }
                }}
              />
            </div>

            {!trash && (
              <>
                <button
                  className="btn-header-action secondary"
                  onClick={() => setFolderModalOpen(true)}
                >
                  <Plus size={16} />
                  <span>Folder</span>
                </button>

                <button
                  className="btn-header-action primary"
                  onClick={() => fileInput.current?.click()}
                >
                  <CloudUpload size={16} />
                  <span>Upload</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Center Section: Dropzone or File Explorer */}
        <section className="center-content-section">
          {list.isLoading ? (
            <div className="dropzone-dashed-box">
              <p style={{ color: "var(--text-muted)" }}>Memuat file...</p>
            </div>
          ) : nodes.length === 0 ? (
            /* Dashed Empty State Card (Exact Mockup Match) */
            <div
              className={`dropzone-dashed-box ${dragOver ? "drag-hover" : ""}`}
              onClick={() => {
                if (!trash) fileInput.current?.click();
              }}
            >
              <div className="dropzone-cloud-circle">
                <CloudUpload size={32} strokeWidth={1.8} />
              </div>
              <h2 className="dropzone-title">
                {trash
                  ? "Tempat sampah kosong"
                  : search
                  ? `Tidak ada file untuk "${q}"`
                  : "Belum ada file di sini"}
              </h2>
              <p className="dropzone-desc">
                {trash
                  ? "File yang Anda buang akan muncul di sini sebelum dihapus permanen."
                  : search
                  ? "Coba gunakan kata kunci pencarian yang lain."
                  : "Tarik dan lepas file ke area ini atau klik tombol Upload untuk memulai."}
              </p>
              {!trash && !search && (
                <button
                  className="btn-upload-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInput.current?.click();
                  }}
                >
                  <CloudUpload size={18} />
                  <span>Upload File</span>
                </button>
              )}
            </div>
          ) : (
            /* Table or Grid View with Checkboxes */
            <>
              <div className="file-view-controls">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="file-count-badge">{nodes.length} item</span>
                  {selectedIds.size > 0 && (
                    <span style={{ fontSize: 12, color: "var(--amber)", fontWeight: 600 }}>
                      ({selectedIds.size} dipilih)
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className={`select-mode-toggle-btn ${isSelectMode ? "active" : ""}`}
                    onClick={() => {
                      const next = !isSelectMode;
                      setIsSelectMode(next);
                      if (!next) setSelectedIds(new Set());
                    }}
                    title={isSelectMode ? "Selesai memilih" : "Pilih banyak file"}
                  >
                    <CheckSquare size={15} />
                    <span>{isSelectMode ? "Selesai" : "Pilih"}</span>
                  </button>

                  <div className="view-toggle">
                    <button
                      className={`toggle-btn ${viewMode === "list" ? "active" : ""}`}
                      onClick={() => setViewMode("list")}
                      title="Tampilan Tabel"
                    >
                      <ListIcon size={16} />
                    </button>
                    <button
                      className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                      onClick={() => setViewMode("grid")}
                      title="Tampilan Grid"
                    >
                      <LayoutGrid size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === "list" ? (
                <div className="file-table-wrap">
                  <table className="file-table">
                    <thead>
                      <tr>
                        {(isSelectMode || selectedIds.size > 0) && (
                          <th className="th-check">
                            <input
                              type="checkbox"
                              className="custom-checkbox"
                              checked={isAllSelected}
                              onChange={toggleSelectAll}
                              title={isAllSelected ? "Lepas semua" : "Pilih semua"}
                            />
                          </th>
                        )}
                        <th className="th-name">Nama</th>
                        <th className="th-size">Ukuran</th>
                        <th className="th-date">Tanggal Dibuat</th>
                        <th className="th-actions">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map((n) => {
                        const { icon: Icon, color } = getFileIcon(n);
                        const isSelected = selectedIds.has(n.id);
                        return (
                          <tr
                            key={n.id}
                            className={`file-row ${isSelected ? "selected" : ""}`}
                          >
                            {(isSelectMode || selectedIds.size > 0) && (
                              <td className="td-check">
                                <input
                                  type="checkbox"
                                  className="custom-checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleSelect(n.id);
                                  }}
                                />
                              </td>
                            )}
                            <td className="td-name">
                              <div
                                className="name-cell"
                                onClick={() => {
                                  if (n.type === "FOLDER") nav(`/f/${n.id}`);
                                  else setPreviewNode(n);
                                }}
                              >
                                <div className={`icon-badge ${color}`}>
                                  <Icon size={18} strokeWidth={1.8} />
                                </div>
                                <span className="name-text" title={n.name}>
                                  {n.name}
                                </span>
                              </div>
                            </td>
                            <td className="td-size">{n.type === "FOLDER" ? "—" : fmtSize(n.size)}</td>
                            <td className="td-date">
                              {new Date(n.createdAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="td-actions">
                              <div className="action-button-group">
                                {trash ? (
                                  <>
                                    <button
                                      className="action-btn"
                                      title="Pulihkan"
                                      onClick={() => handleRestore(n)}
                                    >
                                      <RotateCcw size={14} />
                                    </button>
                                    <button
                                      className="action-btn danger"
                                      title="Hapus Permanen"
                                      onClick={() => handlePurge(n)}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {n.type === "FILE" && (
                                      <>
                                        <button
                                          className="action-btn"
                                          title="Preview"
                                          onClick={() => setPreviewNode(n)}
                                        >
                                          <Eye size={14} />
                                        </button>
                                        <a
                                          className="action-btn"
                                          title="Download"
                                          href={contentUrl(n.id, true)}
                                        >
                                          <Download size={14} />
                                        </a>
                                        <button
                                          className="action-btn"
                                          title="Bagikan Tautan"
                                          onClick={() => handleShare(n)}
                                        >
                                          <Share2 size={14} />
                                        </button>
                                      </>
                                    )}
                                    <button
                                      className="action-btn"
                                      title="Ubah Nama"
                                      onClick={() => handleRename(n)}
                                    >
                                      <ArrowUp size={14} style={{ transform: "rotate(45deg)" }} />
                                    </button>
                                    <button
                                      className="action-btn danger"
                                      title="Hapus ke Sampah"
                                      onClick={() => handleTrash(n)}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="file-grid-wrap">
                  {nodes.map((n) => {
                    const { icon: Icon, color } = getFileIcon(n);
                    const isSelected = selectedIds.has(n.id);
                    return (
                      <div
                        key={n.id}
                        className={`file-card ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          if (n.type === "FOLDER") nav(`/f/${n.id}`);
                          else setPreviewNode(n);
                        }}
                      >
                        {(isSelectMode || selectedIds.size > 0) && (
                          <div
                            className="card-check-box"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="custom-checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(n.id)}
                            />
                          </div>
                        )}
                        <div className="card-preview">
                          <Icon size={32} strokeWidth={1.5} className={color} />
                        </div>
                        <div className="card-info">
                          <span className="card-name" title={n.name}>
                            {n.name}
                          </span>
                          <span className="card-meta">
                            {n.type === "FOLDER" ? "Folder" : fmtSize(n.size)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* Bottom 3 Summary Dashboard Cards */}
        <section className="dashboard-summary-grid">
          {/* Card 1: Ringkasan Penyimpanan */}
          <div className="summary-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Ringkasan Penyimpanan</span>
              <span className="summary-card-link" onClick={() => nav("/")}>
                Lihat Detail &gt;
              </span>
            </div>

            <div className="storage-card-body">
              <StorageDonut percentage={storagePct} />
              <div className="donut-legend">
                <span className="legend-total-val">
                  {storageUsedGb.toFixed(1)} GB / {storageTotalGb.toFixed(1)} GB
                </span>
                <span className="legend-total-lbl">Total Penyimpanan</span>

                <div className="legend-item-row">
                  <span className="dot dot-amber" />
                  <span className="legend-name">Terpakai</span>
                  <span className="legend-val">{storageUsedGb.toFixed(1)} GB</span>
                </div>

                <div className="legend-item-row">
                  <span className="dot dot-muted" />
                  <span className="legend-name">Tersedia</span>
                  <span className="legend-val">{storageFreeGb.toFixed(1)} GB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Aktivitas Terbaru */}
          <div className="summary-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Aktivitas Terbaru</span>
            </div>

            <div className="activity-list">
              {recentActivities.map((act, i) => {
                const Icon = act.icon;
                return (
                  <div key={i} className="activity-item">
                    <div className={`activity-icon-squircle ${act.color}`}>
                      <Icon size={18} strokeWidth={1.8} />
                    </div>
                    <div className="activity-details">
                      <span className="activity-action">{act.action}</span>
                      <span className="activity-target" title={act.target}>
                        {act.target}
                      </span>
                    </div>
                    <span className="activity-timestamp">{act.time}</span>
                  </div>
                );
              })}
            </div>

            <button className="btn-all-activity" onClick={() => nav("/")}>
              Lihat semua aktivitas &gt;
            </button>
          </div>

          {/* Card 3: Informasi Sistem */}
          <div className="summary-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Informasi Sistem</span>
            </div>

            <div className="sysinfo-list">
              <div className="sysinfo-row">
                <div className="sysinfo-left">
                  <Monitor size={15} />
                  <span>Hostname</span>
                </div>
                <div className="sysinfo-right">
                  <span>{sysInfo.data?.hostname || "NAS-Pi.local"}</span>
                  <button
                    className="btn-copy-mini"
                    onClick={handleCopyHostname}
                    title="Salin Hostname"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              <div className="sysinfo-row">
                <div className="sysinfo-left">
                  <Box size={15} />
                  <span>OS</span>
                </div>
                <div className="sysinfo-right">
                  <span>{sysInfo.data?.os || "Orange Pi OS"}</span>
                </div>
              </div>

              <div className="sysinfo-row">
                <div className="sysinfo-left">
                  <Clock size={15} />
                  <span>Uptime</span>
                </div>
                <div className="sysinfo-right">
                  <span>{sysInfo.data?.uptime || "5 hari 12 jam"}</span>
                </div>
              </div>

              <div className="sysinfo-row">
                <div className="sysinfo-left">
                  <Wifi size={15} />
                  <span>IP Address</span>
                </div>
                <div className="sysinfo-right" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                  <span>{sysInfo.data?.ip || "192.168.1.10"}</span>
                </div>
              </div>

              <div className="sysinfo-row">
                <div className="sysinfo-left">
                  <Activity size={15} />
                  <span>Status</span>
                </div>
                <div className="sysinfo-right online">
                  <span className="status-indicator-dot" />
                  <span>Online</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Floating Batch Action Toolbar */}
        {selectedIds.size > 0 && (
          <div className="floating-batch-bar">
            <div className="batch-count-badge">
              <span className="batch-count-num">{selectedIds.size}</span>
              <span>item dipilih</span>
            </div>

            <div className="batch-divider" />

            <div className="batch-actions-list">
              {trash ? (
                <>
                  <button className="btn-batch primary" onClick={handleBatchRestore}>
                    <RotateCcw size={14} />
                    <span>Pulihkan</span>
                  </button>
                  <button className="btn-batch danger" onClick={handleBatchPurge}>
                    <Trash2 size={14} />
                    <span>Hapus Permanen</span>
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-batch" onClick={handleBatchDownload}>
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                  <button
                    className="btn-batch"
                    onClick={() => {
                      setTargetFolderId(null);
                      setMoveModalOpen(true);
                    }}
                  >
                    <FolderInput size={14} />
                    <span>Pindahkan</span>
                  </button>
                  <button className="btn-batch danger" onClick={handleBatchTrash}>
                    <Trash2 size={14} />
                    <span>Hapus</span>
                  </button>
                </>
              )}
            </div>

            <div className="batch-divider" />

            <button
              className="btn-batch-close"
              onClick={clearSelection}
              title="Batal Pilihan"
            >
              <X size={15} />
            </button>
          </div>
        )}



        {/* Create Folder Modal */}
        {folderModalOpen && (
          <div className="modal-backdrop" onClick={() => setFolderModalOpen(false)}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Buat Folder Baru</h3>
                <button className="close-btn" onClick={() => setFolderModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body">
                <label className="input-label">Nama Folder</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="Contoh: Dokumen Kerja"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                  }}
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setFolderModalOpen(false)}>
                  Batal
                </button>
                <button className="btn-primary" onClick={handleCreateFolder}>
                  Buat Folder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Move to Folder Modal */}
        {moveModalOpen && (
          <div className="modal-backdrop" onClick={() => setMoveModalOpen(false)}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Pindahkan {selectedIds.size} Item</h3>
                <button className="close-btn" onClick={() => setMoveModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body">
                <label className="input-label">Pilih Folder Tujuan</label>
                <div className="folder-picker-wrap">
                  {/* Option: Root (File Saya) */}
                  <div
                    className={`folder-picker-item ${targetFolderId === null ? "selected" : ""}`}
                    onClick={() => setTargetFolderId(null)}
                  >
                    <Home size={16} />
                    <span>File saya (Utama / Root)</span>
                  </div>

                  {/* List of subfolders excluding selected folders */}
                  {(allFolders.data ?? [])
                    .filter((f) => !selectedIds.has(f.id))
                    .map((f) => (
                      <div
                        key={f.id}
                        className={`folder-picker-item ${targetFolderId === f.id ? "selected" : ""}`}
                        onClick={() => setTargetFolderId(f.id)}
                      >
                        <Folder size={16} />
                        <span>{f.name}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setMoveModalOpen(false)}>
                  Batal
                </button>
                <button className="btn-primary" onClick={handleBatchMove}>
                  Pindahkan ke Sini
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {shareModalData && (
          <div className="modal-backdrop" onClick={() => setShareModalData(null)}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Bagikan "{shareModalData.node.name}"</h3>
                <button className="close-btn" onClick={() => setShareModalData(null)}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body">
                <label className="input-label">Tautan Publik (Berlaku 7 Hari)</label>
                <input
                  type="text"
                  readOnly
                  className="modal-input"
                  value={shareModalData.link}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShareModalData(null)}>
                  Tutup
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    navigator.clipboard.writeText(shareModalData.link);
                    triggerToast("Tautan berhasil disalin!");
                    setShareModalData(null);
                  }}
                >
                  <Copy size={14} style={{ marginRight: 4 }} />
                  <span>Salin Tautan</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {previewNode && (
          <PreviewModal node={previewNode} onClose={() => setPreviewNode(null)} />
        )}

        {/* Custom Confirmation Modal */}
        {confirmState && (
          <ConfirmModal
            isOpen={confirmState.isOpen}
            title={confirmState.title}
            message={confirmState.message}
            confirmText={confirmState.confirmText}
            variant={confirmState.variant}
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(null)}
          />
        )}

        {/* Custom Prompt Modal (Rename) */}
        {promptState && (
          <PromptModal
            isOpen={promptState.isOpen}
            title={promptState.title}
            initialValue={promptState.initialValue}
            onConfirm={promptState.onConfirm}
            onCancel={() => setPromptState(null)}
          />
        )}

        {/* Toast Alert */}
        {toast && (
          <div className="app-toast">
            <span>{toast}</span>
          </div>
        )}
      </main>
    </div>
  );
}
