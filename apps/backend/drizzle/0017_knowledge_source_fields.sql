-- Reconcile knowledge_sources with the Drizzle schema. These fields were added to the
-- schema (and applied to running DBs via `db:push`) but never captured as a migration, so a
-- clean `drizzle-kit migrate` produced a table missing the 'docx' enum value, the status
-- enum/column, and the indexing-metadata columns — making every DOCX upload and every read
-- of the status fields throw. All statements are idempotent so this is a no-op on DBs that
-- already received the changes via db:push.
ALTER TYPE "public"."knowledge_source_type" ADD VALUE IF NOT EXISTS 'docx';--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."knowledge_source_status" AS ENUM('pending', 'processing', 'indexed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "status" "knowledge_source_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "chunk_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "indexed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "error_message" text;
