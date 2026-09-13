import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  AlertCircle,
  HardDrive,
  Cpu,
} from "lucide-react";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Password strength calculation for registration
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score === 1) return { score: 1, label: "Lemah", color: "var(--scarlet)" };
    if (score === 2) return { score: 2, label: "Cukup", color: "var(--copper)" };
    if (score === 3) return { score: 3, label: "Baik", color: "var(--amber)" };
    if (score >= 4) return { score: 4, label: "Sangat Kuat", color: "var(--plasma)" };
    return { score: 1, label: "Terlalu Pendek (Min 8)", color: "var(--scarlet)" };
  }, [password]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!email.trim() || !password.trim()) {
      setErr("Email dan password wajib diisi.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setErr("Password harus terdiri dari minimal 8 karakter.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await api.login(email.trim(), password, rememberMe);
      } else {
        await api.register(email.trim(), password, rememberMe);
      }
      nav("/");
    } catch (e: any) {
      setErr(e.message || "Terjadi kesalahan saat otentikasi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="brand">
          <div className="brand-badge">🍊</div>
          <div>
            <h1>NAS Pi</h1>
            <div className="sub">Personal Cloud Storage</div>
          </div>
        </div>

        {/* Server & Tunnel Status Indicator */}
        <div className="led-row">
          <span className="led pulse" />
          <span className="led o" />
          <span className="led-text">online — {window.location.hostname}</span>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="auth-tabs-wrap">
          <button
            type="button"
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setErr("");
            }}
          >
            Masuk
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setErr("");
            }}
          >
            Daftar Akun Baru
          </button>
        </div>

        {/* Error Alert Box */}
        {err && (
          <div className="auth-alert-box">
            <AlertCircle size={16} className="text-scarlet flex-shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={submit} className="auth-form-modern">
          {/* Email Input Field */}
          <div className="input-group-modern">
            <label className="input-field-label">Alamat Email</label>
            <div className="input-icon-wrap">
              <Mail size={16} className="input-lead-icon" />
              <input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Password Input Field with Eye Toggle */}
          <div className="input-group-modern">
            <label className="input-field-label">Kata Sandi</label>
            <div className="input-icon-wrap">
              <Lock size={16} className="input-lead-icon" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder={mode === "login" ? "Masukkan kata sandi" : "Min. 8 karakter"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="btn-eye-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Sembunyikan sandi" : "Lihat sandi"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Password Strength Meter (Register Mode) */}
            {mode === "register" && password.length > 0 && (
              <div className="password-strength-container">
                <div className="strength-bars-row">
                  {[1, 2, 3, 4].map((step) => (
                    <span
                      key={step}
                      className="strength-bar-step"
                      style={{
                        backgroundColor:
                          step <= passwordStrength.score
                            ? passwordStrength.color
                            : "var(--border-subtle)",
                      }}
                    />
                  ))}
                </div>
                <div className="strength-label-row">
                  <span>Kekuatan:</span>
                  <span style={{ color: passwordStrength.color, fontWeight: 600 }}>
                    {passwordStrength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Remember Me Checkbox */}
          <div className="auth-remember-row">
            <label className="custom-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="custom-checkbox"
              />
              <span>Ingat saya di perangkat ini (30 hari)</span>
            </label>
          </div>

          {/* Submit Action Button */}
          <button
            className="btn-auth-submit primary"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin-icon" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={17} />
                <span>{mode === "login" ? "Masuk ke NAS" : "Daftarkan Akun"}</span>
              </>
            )}
          </button>
        </form>

        {/* Hardware & Cloudflare Homelab Footer Badge */}
        <div className="auth-foot">
          <div className="homelab-badge-row">
            <div className="homelab-chip">
              <Cpu size={12} className="text-amber" />
              <span>Orange Pi 4A</span>
            </div>
            <div className="homelab-chip">
              <HardDrive size={12} className="text-plasma" />
              <span>NVMe Storage</span>
            </div>
          </div>
          <div className="homelab-sub-footer">
            Terenkripsi end-to-end via <b>Cloudflare Tunnel</b> & <b>Tailscale</b>
          </div>
        </div>
      </div>
    </div>
  );
}
