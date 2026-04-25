import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@coglity/shared/schema";

const connectionString = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/coglity";

const client = postgres(connectionString, {
  ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});

/**
 * Raw DB client. DO NOT import directly from `apps/backend/src/routes/**`.
 * Route handlers must use `req.db` (set by withScopedTx middleware) so queries
 * run inside a transaction with app.user_id / app.org_id / app.project_id
 * session variables set the RLS policies in 0012_rls_policies.sql depend
 * on those. Queries run via this raw client have no RLS context and return
 * zero rows from any tenant-scoped table.
 *
 * Importing it from middleware/services is fine they run before the scoped
 * transaction is opened and need unrestricted access.
 */
export const db = drizzle(client, { schema });
