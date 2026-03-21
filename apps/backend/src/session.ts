import session from "express-session";
import type { RequestHandler } from "express";
import connectPgSimple from "connect-pg-simple";

const PgStore = connectPgSimple(session);

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/coglity";

export const sessionMiddleware: RequestHandler = session({
  store: new PgStore({
    conString: connectionString,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || "coglity-dev-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: "lax",
  },
});