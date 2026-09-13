import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      if (mode === "login") await api.login(email, password);
      else await api.register(email, password);
      nav("/");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <div className="brand-badge">🍊</div>
          <div>
            <h1>NAS Pi</h1>
            <div className="sub">homelab storage</div>
          </div>
        </div>

        <div className="led-row">
          <span className="led" />
          <span className="led o" />
          online — 100.82.5.51
        </div>

        <form onSubmit={submit}>
          <input
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="username"
          />
          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {err && <div className="err">{err}</div>}
          <div className="row">
            <button className="btn primary" type="submit">
              {mode === "login" ? "Masuk" : "Daftar"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setErr("");
              }}
            >
              {mode === "login" ? "Buat akun" : "Sudah punya akun"}
            </button>
          </div>
        </form>

        <div className="auth-foot">
          self-hosted di <b>Orange Pi 4A</b> · akses via Tailscale
        </div>
      </div>
    </div>
  );
}
