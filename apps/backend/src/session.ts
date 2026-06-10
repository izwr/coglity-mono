import session from 'express-session';
import type { RequestHandler } from 'express';
import connectPgSimple from 'connect-pg-simple';

const PgStore = connectPgSimple(session);

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/coglity';

const isProduction = process.env.NODE_ENV === 'production';

// Fail fast rather than silently signing sessions with a public, well-known secret (which
// would let anyone forge a session cookie). A dev fallback is only allowed outside production.
const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && !sessionSecret) {
  throw new Error('SESSION_SECRET must be set in production');
}

export const sessionMiddleware: RequestHandler = session({
  store: new PgStore({
    conString: connectionString,
    createTableIfMissing: true,
  }),
  secret: sessionSecret || 'coglity-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Only send the cookie over HTTPS in production (the app runs behind a TLS-terminating
    // proxy with `trust proxy` set). Left off in dev so http://localhost still works.
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
});
