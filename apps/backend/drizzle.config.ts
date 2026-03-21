import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../../packages/shared/src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/coglity",
    ssl: true,
  },
});
