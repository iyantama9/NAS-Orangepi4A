import { randomBytes } from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { hash, verify } from "@node-rs/argon2";
import { loginSchema, registerSchema, type SessionUser } from "@nas/shared";
import { query } from "./db.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const SESSION_TTL_DAYS = 30;

export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  await query(
    "INSERT INTO sessions(id, user_id, expires_at) VALUES ($1,$2,$3)",
    [token, userId, expires]
  );
  return { token, expires };
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = (req as any).cookies?.["nas_session"] as string | undefined;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  const r = await query<{ id: string; email: string }>(
    `SELECT u.id, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now()`,
    [token]
  );
  if (!r.rows[0]) return res.status(401).json({ error: "unauthorized" });
  req.user = { id: r.rows[0].id, email: r.rows[0].email };
  next();
}

function setSessionCookie(res: Response, token: string, expires: Date) {
  res.cookie("nas_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // via Tailscale HTTP; naikkan ke true kalau nanti pakai HTTPS
    expires,
  });
}

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const { email, password } = parsed.data;
  const exists = await query("SELECT 1 FROM users WHERE email = $1", [email]);
  if (exists.rowCount) return res.status(409).json({ error: "email sudah terdaftar" });
  const passwordHash = await hash(password);
  const r = await query<{ id: string }>(
    "INSERT INTO users(email, password_hash) VALUES ($1,$2) RETURNING id",
    [email, passwordHash]
  );
  const { token, expires } = await createSession(r.rows[0].id);
  setSessionCookie(res, token, expires);
  res.json({ id: r.rows[0].id, email });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid input" });
  const { email, password } = parsed.data;
  const r = await query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email]
  );
  const row = r.rows[0];
  if (!row || !(await verify(row.password_hash, password))) {
    return res.status(401).json({ error: "email atau password salah" });
  }
  const { token, expires } = await createSession(row.id);
  setSessionCookie(res, token, expires);
  res.json({ id: row.id, email });
});

authRouter.post("/logout", requireUser, async (req, res) => {
  const token = (req as any).cookies["nas_session"];
  await query("DELETE FROM sessions WHERE id = $1", [token]);
  res.clearCookie("nas_session");
  res.json({ ok: true });
});

authRouter.get("/me", requireUser, (req, res) => {
  res.json(req.user);
});
