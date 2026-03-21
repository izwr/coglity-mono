import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@coglity/shared/schema";

const connectionString = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/coglity";

const client = postgres(connectionString, {
  ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(client, { schema });
