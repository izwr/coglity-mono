ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "language" varchar(10) DEFAULT 'en-US' NOT NULL;
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "environment" varchar(50) DEFAULT 'quiet' NOT NULL;
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "batch_id" uuid;
