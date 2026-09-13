import { useState } from 'react';
import {
  Folder,
  Link2,
  Trash2,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  userName?: string;
  userEmail?: string;
  storageUsed?: number;
  storageTotal?: number;
  onLogout?: () => void;
}

export default function Sidebar({
  userName = 'Admin',
  userEmail = 'iyan@admin.com',
  storageUsed = 0,
  storageTotal = 0,
  onLogout,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const menuItems = [
    { icon: Folder, label: 'File saya', path: '/' },
    { icon: Link2, label: 'Dibagikan', path: '/shared' },
    { icon: Trash2, label: 'Trash', path: '/trash' },
  ];

  const hasStorage = storageTotal > 0;
  const storagePercentage = hasStorage
    ? Math.min(100, Math.max(0, Math.round((storageUsed / storageTotal) * 100)))
    : 0;
  const storageUsedGB = storageUsed.toFixed(1);
  const storageTotalGB = storageTotal.toFixed(1);
  const storageFreeGB = Math.max(0, storageTotal - storageUsed).toFixed(1);

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand" onClick={() => navigate('/')}>
          <div className="brand-logo-squircle">
            <span>🍊</span>
          </div>
          <div className="brand-meta">
            <h1 className="brand-name">NAS Pi</h1>
            <span className="brand-tagline">Personal Cloud Storage</span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/f/') || location.pathname === '/files'
              : location.pathname.startsWith(item.path);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.7} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        {/* User Card */}
        <div className="user-profile-card">
          <div
            className="user-profile-main"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <div className="user-avatar-circle">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="user-info-text">
              <span className="user-email-text" title={userEmail}>
                {userEmail}
              </span>
              <span className="user-role-text">Admin</span>
            </div>
            <ChevronDown
              size={15}
              className={`user-chevron ${userMenuOpen ? 'open' : ''}`}
            />
          </div>

          {userMenuOpen && (
            <div className="user-dropdown-menu">
              <button
                className="dropdown-item logout"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout?.();
                }}
              >
                <LogOut size={14} />
                <span>Keluar dari Akun</span>
              </button>
            </div>
          )}
        </div>

        {/* Dedicated Logout Button */}
        <button
          className="btn-sidebar-logout"
          onClick={() => onLogout?.()}
          title="Keluar dari sesi"
        >
          <LogOut size={16} />
          <span>Keluar</span>
        </button>

        {/* Total Storage Widget */}
        {hasStorage && (
          <div className="storage-summary-widget">
            <div className="storage-summary-top">
              <span className="storage-summary-label">Penyimpanan Total</span>
              <span className="storage-summary-pct">{storagePercentage}%</span>
            </div>

            <div className="storage-summary-track">
              <div
                className="storage-summary-bar"
                style={{ width: `${storagePercentage}%` }}
              />
            </div>

            <div className="storage-summary-caption">
              <span>{storageUsedGB} GB / {storageTotalGB} GB</span>
            </div>

            <div className="storage-summary-breakdown">
              <div className="breakdown-row">
                <span className="dot dot-amber" />
                <span className="breakdown-name">Terpakai</span>
                <span className="breakdown-val">{storageUsedGB} GB</span>
              </div>
              <div className="breakdown-row">
                <span className="dot dot-muted" />
                <span className="breakdown-name">Tersedia</span>
                <span className="breakdown-val">{storageFreeGB} GB</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
