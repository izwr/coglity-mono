import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/coglity';

export default defineConfig({
  schema: '../../packages/shared/src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
    // Mirror src/db.ts: TLS only when the connection string asks for it, so
    // local migrations against a plain Postgres work.
    ssl: url.includes('sslmode=require') ? true : undefined,
  },
});
