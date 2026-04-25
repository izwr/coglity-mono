-- Seed default organization (stable UUID so tests & runbooks can reference it).
INSERT INTO "organizations" ("id", "name", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', now(), now())
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Promote every existing user to super_admin of the default org.
INSERT INTO "organization_members" ("organization_id", "user_id", "org_role", "joined_via")
SELECT '00000000-0000-0000-0000-000000000001', id, 'super_admin', 'creation' FROM "users"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Seed default project under the default org.
INSERT INTO "projects" ("id", "organization_id", "name", "description", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Default Project', 'Backfilled from pre-RBAC data',
        now(), now())
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Make every existing user admin of the default project (redundant for super_admins but keeps membership rows consistent).
INSERT INTO "project_members" ("project_id", "user_id", "role")
SELECT '00000000-0000-0000-0000-000000000002', id, 'admin' FROM "users"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Backfill project_id on every content table.
UPDATE "test_suites"            SET "project_id"='00000000-0000-0000-0000-000000000002' WHERE "project_id" IS NULL;--> statement-breakpoint
UPDATE "test_cases"             SET "project_id"='00000000-0000-0000-0000-000000000002' WHERE "project_id" IS NULL;--> statement-breakpoint
UPDATE "tags"                   SET "project_id"='00000000-0000-0000-0000-000000000002' WHERE "project_id" IS NULL;--> statement-breakpoint
UPDATE "bugs"                   SET "project_id"='00000000-0000-0000-0000-000000000002' WHERE "project_id" IS NULL;--> statement-breakpoint
UPDATE "scheduled_test_suites"  SET "project_id"='00000000-0000-0000-0000-000000000002' WHERE "project_id" IS NULL;--> statement-breakpoint
UPDATE "scheduled_test_cases"   SET "project_id"='00000000-0000-0000-0000-000000000002' WHERE "project_id" IS NULL;--> statement-breakpoint
UPDATE "ai_generation_sessions" SET "project_id"='00000000-0000-0000-0000-000000000002' WHERE "project_id" IS NULL;--> statement-breakpoint
UPDATE "bot_connections"        SET "project_id"='00000000-0000-0000-0000-000000000002' WHERE "project_id" IS NULL;--> statement-breakpoint
UPDATE "knowledge_sources"      SET "project_id"='00000000-0000-0000-0000-000000000002' WHERE "project_id" IS NULL;--> statement-breakpoint

-- Enforce NOT NULL on every backfilled column.
ALTER TABLE "test_suites"            ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "test_cases"             ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tags"                   ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bugs"                   ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_test_suites"  ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_test_cases"   ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_generation_sessions" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bot_connections"        ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_sources"      ALTER COLUMN "project_id" SET NOT NULL;
