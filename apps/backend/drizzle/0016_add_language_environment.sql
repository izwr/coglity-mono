ALTER TABLE "test_runs" ADD COLUMN "language" varchar(10) DEFAULT 'en-US' NOT NULL;
ALTER TABLE "test_runs" ADD COLUMN "environment" varchar(50) DEFAULT 'quiet' NOT NULL;
ALTER TABLE "test_runs" ADD COLUMN "batch_id" uuid;
