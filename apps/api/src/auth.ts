import { randomBytes } from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { hash, verify } from "@node-rs/argon2";
import { loginSchema, registerSchema, type SessionUser } from "@nas/shared";
import { pool, query } from "./db.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const SESSION_LONG_DAYS = 30;
const SESSION_SHORT_DAYS = 1;

export async function createSession(userId: string, rememberMe = true): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const ttlDays = rememberMe ? SESSION_LONG_DAYS : SESSION_SHORT_DAYS;
  const expires = new Date(Date.now() + ttlDays * 86400_000);
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

function setSessionCookie(res: Response, token: string, expires: Date, rememberMe = true) {
  res.cookie("nas_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(rememberMe ? { expires } : {}),
  });
}

export const authRouter = Router();

const ownerBootstrapEnabled = () =>
  process.env.NAS_ALLOW_OWNER_BOOTSTRAP?.toLowerCase() === "true";

authRouter.get("/registration-status", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!ownerBootstrapEnabled()) {
    return res.json({ available: false });
  }
  const existing = await query("SELECT 1 FROM users LIMIT 1");
  return res.json({ available: !existing.rowCount });
});

authRouter.post("/register", async (req, res) => {
  if (!ownerBootstrapEnabled()) {
    return res.status(403).json({
      error: "Registrasi ditutup. NAS ini hanya untuk akun pemilik.",
    });
  }
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Format input tidak valid (password min 8 karakter)" });
  const { email, password, rememberMe = true } = parsed.data;
  const existingOwner = await query("SELECT 1 FROM users LIMIT 1");
  if (existingOwner.rowCount) {
    return res.status(403).json({
      error: "Registrasi ditutup. Akun pemilik sudah tersedia.",
    });
  }
  const passwordHash = await hash(password);
  const client = await pool.connect();
  let userId: string;
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('nas_owner_bootstrap'))"
    );
    const existing = await client.query("SELECT 1 FROM users LIMIT 1");
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Registrasi ditutup. Akun pemilik sudah tersedia.",
      });
    }
    const created = await client.query<{ id: string }>(
      "INSERT INTO users(email, password_hash) VALUES ($1,$2) RETURNING id",
      [email, passwordHash]
    );
    userId = created.rows[0].id;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const { token, expires } = await createSession(userId, rememberMe);
  setSessionCookie(res, token, expires, rememberMe);
  res.status(201).json({ id: userId, email });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email dan password wajib diisi" });
  const { email, password, rememberMe = true } = parsed.data;
  const r = await query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email]
  );
  const row = r.rows[0];
  if (!row || !(await verify(row.password_hash, password))) {
    return res.status(401).json({ error: "Email atau password salah" });
  }
  const { token, expires } = await createSession(row.id, rememberMe);
  setSessionCookie(res, token, expires, rememberMe);
  res.json({ id: row.id, email });
});

authRouter.post("/logout", requireUser, async (req, res) => {
  const token = (req as any).cookies["nas_session"];
  await query("DELETE FROM sessions WHERE id = $1", [token]);
  res.clearCookie("nas_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ ok: true });
});

authRouter.get("/me", requireUser, (req, res) => {
  res.json(req.user);
});
