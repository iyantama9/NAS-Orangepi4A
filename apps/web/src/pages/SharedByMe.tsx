import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link2,
  Search,
  ChevronRight,
  Home,
  Copy,
  ExternalLink,
  Trash2,
  Folder,
  Menu,
} from "lucide-react";
import { api } from "../api";
import Sidebar from "../components/Sidebar";
import ConfirmModal from "../components/ConfirmModal";

export default function SharedByMe() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  useEffect(() => {
    if (me.isError) nav("/login");
  }, [me.isError, nav]);

  const shares = useQuery({
    queryKey: ["shares"],
    queryFn: api.shares,
    enabled: !!me.data,
  });

  const sysInfo = useQuery({
    queryKey: ["systemInfo"],
    queryFn: api.systemInfo,
    refetchInterval: 30000,
    enabled: !!me.data,
  });

  if (me.isLoading || !me.data) return null;

  function triggerToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function copyLink(urlPath: string) {
    const fullUrl = `${location.origin}${urlPath}`;
    navigator.clipboard.writeText(fullUrl).catch(() => {});
    triggerToast("Tautan share berhasil disalin!");
  }

  function revokeShare(token: string, name: string) {
    setConfirmState({
      isOpen: true,
      title: "Cabut Akses Berbagi",
      message: `Cabut akses tautan untuk "${name}"? Tautan ini tidak akan dapat diakses lagi.`,
      confirmText: "Cabut Akses",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await api.revokeShare(token);
          qc.invalidateQueries({ queryKey: ["shares"] });
          triggerToast(`Tautan untuk "${name}" dicabut`);
        } catch (err: any) {
          triggerToast(err.message || "Gagal mencabut tautan");
        }
      },
    });
  }

  const list = (shares.data ?? []).filter((s) =>
    s.nodeName.toLowerCase().includes(search.toLowerCase())
  );

  const userLabel = me.data.email.split("@")[0];
  const storageUsedGb = (sysInfo.data?.storageUsed ?? 0) / 1024 ** 3;
  const storageTotalGb = (sysInfo.data?.storageTotal ?? 1) / 1024 ** 3;

  return (
    <div className="app-layout">
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

        {/* Top Header */}
        <header className="dashboard-top-bar">
          <div className="dashboard-greeting">
            <div className="breadcrumbs-bar">
              <Link to="/" className="crumb-link">
                <Home size={16} />
                <span>File saya</span>
              </Link>
              <ChevronRight size={14} className="crumb-arrow" />
              <span className="crumb-current">Dibagikan</span>
            </div>
          </div>

          <div className="dashboard-actions-right">
            <div className="search-input-box">
              <Search size={15} />
              <input
                type="search"
                placeholder="Cari file dibagikan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button className="btn-header-action secondary" onClick={() => nav("/")}>
              <Folder size={15} />
              <span>Kembali ke File saya</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <section className="center-content-section">
          {shares.isLoading ? (
            <div className="dropzone-dashed-box">
              <p style={{ color: "var(--text-muted)" }}>Memuat tautan berbagi...</p>
            </div>
          ) : list.length === 0 ? (
            /* Clean Empty State */
            <div className="dropzone-dashed-box" onClick={() => nav("/")}>
              <div className="dropzone-cloud-circle">
                <Link2 size={32} strokeWidth={1.8} />
              </div>
              <h2 className="dropzone-title">
                {search
                  ? `Tidak ada tautan untuk "${search}"`
                  : "Belum ada file yang dibagikan"}
              </h2>
              <p className="dropzone-desc">
                {search
                  ? "Coba gunakan kata kunci pencarian yang lain."
                  : "File yang Anda buatkan tautan publik akan muncul di sini agar mudah dikelola atau disalin ulang."}
              </p>

              <button
                className="btn-upload-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  nav("/");
                }}
              >
                <Folder size={16} />
                <span>Buka File saya untuk Membagikan</span>
              </button>
            </div>
          ) : (
            /* Table of Shares */
            <div className="file-table-wrap">
              <table className="file-table">
                <thead>
                  <tr>
                    <th className="th-name">File / Folder</th>
                    <th className="th-date">Masa Berlaku</th>
                    <th className="th-size">Tautan</th>
                    <th className="th-actions">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => (
                    <tr key={s.token} className="file-row">
                      <td className="td-name">
                        <div className="name-cell">
                          <div className="icon-badge text-amber">
                            <Link2 size={18} strokeWidth={1.8} />
                          </div>
                          <span className="name-text" title={s.nodeName}>
                            {s.nodeName}
                          </span>
                        </div>
                      </td>
                      <td className="td-date">
                        {s.expiresAt
                          ? `Berakhir ${new Date(s.expiresAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}`
                          : "Selamanya (Permanen)"}
                      </td>
                      <td className="td-size">
                        <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--amber)", fontSize: 12 }}>
                          {s.urlPath}
                        </span>
                      </td>
                      <td className="td-actions">
                        <div className="action-button-group">
                          <button
                            className="action-btn"
                            title="Salin Tautan"
                            onClick={() => copyLink(s.urlPath)}
                          >
                            <Copy size={14} />
                          </button>
                          <a
                            className="action-btn"
                            title="Buka Tautan"
                            href={s.urlPath}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            className="action-btn danger"
                            title="Cabut Akses Tautan"
                            onClick={() => revokeShare(s.token, s.nodeName)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Toast Notification */}
        {toast && (
          <div className="app-toast">
            <span>{toast}</span>
          </div>
        )}

        {/* Custom Confirmation Modal */}
        {confirmState && (
          <ConfirmModal
            isOpen={confirmState.isOpen}
            title={confirmState.title}
            message={confirmState.message}
            confirmText={confirmState.confirmText}
            variant="danger"
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(null)}
          />
        )}
      </main>
    </div>
  );
}
