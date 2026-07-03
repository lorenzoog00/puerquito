import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { pool } from "./db";
import { loginInput } from "@shared/validators";
import { verifyCredentials } from "./user";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export function buildSession(): RequestHandler {
  const base: session.SessionOptions = {
    secret: process.env.SESSION_SECRET ?? "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  };
  // Tests (and any run without a pg pool) use the in-memory store.
  if (process.env.NODE_ENV === "test" || !pool) return session(base);
  const PgStore = connectPgSimple(session);
  return session({ ...base, store: new PgStore({ pool, createTableIfMissing: true }) });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
};

export function mountAuth(app: Express) {
  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid" });
    const ok = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!ok) return res.status(401).json({ error: "bad credentials" });
    req.session.userId = parsed.data.email;
    res.json({ ok: true });
  });
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });
  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "unauthorized" });
    res.json({ email: req.session.userId });
  });
}
