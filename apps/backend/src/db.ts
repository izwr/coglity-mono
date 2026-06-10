import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@coglity/shared/schema';

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/coglity';

const client = postgres(connectionString, {
  ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

/**
 * Raw DB client. Route handlers should use `req.db` (set by the withScopedTx middleware)
 * so all of a request's queries run inside ONE transaction and commit/roll back together.
 *
 * IMPORTANT — there is NO row-level security. RLS policies were added in
 * 0012_rls_policies.sql and then dropped again in 0013_disable_rls.sql, so the
 * app.user_id / app.org_id / app.project_id session variables withScopedTx sets are inert
 * and do NOT filter any rows. Tenant isolation depends entirely on every query carrying an
 * explicit `where project_id = …` (or equivalent) clause — a handler that omits it will
 * read or write across tenants. Audit new handlers accordingly.
 *
 * Importing this raw client from middleware/services is fine they run before the scoped
 * transaction is opened and legitimately need cross-tenant access.
 */
export const db = drizzle(client, { schema });
