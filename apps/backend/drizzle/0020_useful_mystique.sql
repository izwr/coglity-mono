-- Part 1 reconciles drift: 0015–0018 were hand-written without snapshot updates, so the
-- generator re-emits those changes when diffing from the 0014 snapshot. Everything is
-- idempotent (matching the 0015–0017 pattern) so this is a no-op on databases that already
-- received them via earlier migrations or db:push.
DO $$ BEGIN
 CREATE TYPE "public"."knowledge_source_status" AS ENUM('pending', 'processing', 'indexed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TYPE "public"."knowledge_source_type" ADD VALUE IF NOT EXISTS 'docx' BEFORE 'screen';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"provider" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "status" "knowledge_source_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "chunk_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "indexed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "error_message" text;--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "properties" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "language" varchar(10) DEFAULT 'en-US' NOT NULL;--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "environment" varchar(50) DEFAULT 'quiet' NOT NULL;--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "batch_id" uuid;--> statement-breakpoint
-- Part 2: composite + trigram indexes for keyset pagination, stats GROUP BYs, tag reverse
-- lookups, and ILIKE search at scale. On an already-large production table, build these
-- by hand with CREATE INDEX CONCURRENTLY outside a transaction instead of via migrate.
CREATE INDEX IF NOT EXISTS "test_cases_project_created_idx" ON "test_cases" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_cases_project_updated_idx" ON "test_cases" USING btree ("project_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_cases_suite_idx" ON "test_cases" USING btree ("test_suite_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_cases_title_trgm_idx" ON "test_cases" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_tags_tag_type_idx" ON "entity_tags" USING btree ("tag_id","entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bugs_project_created_idx" ON "bugs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bugs_project_state_created_idx" ON "bugs" USING btree ("project_id","state","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bugs_title_trgm_idx" ON "bugs" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_test_cases_suite_state_idx" ON "scheduled_test_cases" USING btree ("scheduled_test_suite_id","state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_project_created_idx" ON "test_runs" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_project_state_created_idx" ON "test_runs" USING btree ("project_id","state","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_test_case_created_idx" ON "test_runs" USING btree ("test_case_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_batch_idx" ON "test_runs" USING btree ("batch_id") WHERE "test_runs"."batch_id" is not null;
