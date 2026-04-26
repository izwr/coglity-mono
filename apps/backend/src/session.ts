import session from "express-session";
import type { RequestHandler } from "express";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

const PgStore = connectPgSimple(session);

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/coglity";

const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_URL?.includes("azure") ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => console.error("Session store pool error:", err));

export const sessionMiddleware: RequestHandler = session({
  store: new PgStore({
    pool,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || "coglity-dev-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
});