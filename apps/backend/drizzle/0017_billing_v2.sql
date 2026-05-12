-- Drop old billing tables (unused, no data)
DROP TABLE IF EXISTS "cu_usage_events" CASCADE;
DROP TABLE IF EXISTS "cu_transactions" CASCADE;
DROP TABLE IF EXISTS "cu_pricing_tiers" CASCADE;
DROP TABLE IF EXISTS "cu_accounts" CASCADE;
DROP TABLE IF EXISTS "resource_types" CASCADE;

-- Drop old billing enums
DROP TYPE IF EXISTS "billing_mode";
DROP TYPE IF EXISTS "transaction_type";
DROP TYPE IF EXISTS "usage_event_status";

-- New billing enums
DO $$ BEGIN
  CREATE TYPE "billing_account_type" AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "reservation_status" AS ENUM ('pending', 'settled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- billing_account
CREATE TABLE IF NOT EXISTS "billing_account" (
  "account_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id" UUID NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "account_type" "billing_account_type" NOT NULL,
  "consumption_limit" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  "balance" NUMERIC(14, 2) NOT NULL DEFAULT 0
);

-- sku
CREATE TABLE IF NOT EXISTS "sku" (
  "sku_id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT
);

-- pricing
CREATE TABLE IF NOT EXISTS "pricing" (
  "pricing_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sku_id" TEXT NOT NULL REFERENCES "sku"("sku_id"),
  "name" TEXT NOT NULL,
  "unit_price" NUMERIC(14, 6) NOT NULL,
  "valid_from" TIMESTAMPTZ NOT NULL,
  "valid_till" TIMESTAMPTZ
);

-- run_type_limits
CREATE TABLE IF NOT EXISTS "run_type_limits" (
  "run_type" TEXT PRIMARY KEY,
  "min_balance" NUMERIC(14, 2) NOT NULL
);

-- billing_events (partitioned by timestamp)
CREATE TABLE IF NOT EXISTS "billing_events" (
  "event_id" TEXT NOT NULL,
  "correlation_id" TEXT NOT NULL,
  "project_id" UUID NOT NULL,
  "organisation_id" UUID NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "sku" TEXT NOT NULL,
  "consumption_qty" NUMERIC(14, 4) NOT NULL,
  PRIMARY KEY ("event_id", "timestamp")
) PARTITION BY RANGE ("timestamp");

-- Initial partitions
CREATE TABLE IF NOT EXISTS "billing_events_2026_05"
  PARTITION OF "billing_events"
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS "billing_events_2026_06"
  PARTITION OF "billing_events"
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS "billing_events_2026_07"
  PARTITION OF "billing_events"
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- Indexes on billing_events
CREATE INDEX IF NOT EXISTS "idx_billing_events_org_time"
  ON "billing_events" ("organisation_id", "timestamp");

CREATE INDEX IF NOT EXISTS "idx_billing_events_correlation"
  ON "billing_events" ("correlation_id");

-- reservations
CREATE TABLE IF NOT EXISTS "reservations" (
  "reservation_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "correlation_id" TEXT NOT NULL UNIQUE,
  "organisation_id" UUID NOT NULL,
  "run_type" TEXT NOT NULL REFERENCES "run_type_limits"("run_type"),
  "estimated_cost" NUMERIC(14, 2) NOT NULL,
  "actual_cost" NUMERIC(14, 2),
  "status" "reservation_status" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_reservations_org_status"
  ON "reservations" ("organisation_id", "status");

-- Seed initial SKUs
INSERT INTO "sku" ("sku_id", "name", "description") VALUES
  ('llm-gpt4.1-mini', 'GPT-4.1 Mini LLM Call', 'Azure OpenAI GPT-4.1 mini chat completion'),
  ('stt-azure-speech', 'Azure Speech STT', 'Azure Cognitive Services speech-to-text'),
  ('tts-azure-speech', 'Azure Speech TTS', 'Azure Cognitive Services text-to-speech'),
  ('llm-gpt4.1-mini-eval', 'GPT-4.1 Mini Eval Call', 'LLM evaluation call at end of test run')
ON CONFLICT ("sku_id") DO NOTHING;

-- Seed initial pricing (unit prices - adjust as needed)
INSERT INTO "pricing" ("sku_id", "name", "unit_price", "valid_from") VALUES
  ('llm-gpt4.1-mini', 'GPT-4.1 Mini per call', 0.005, '2026-01-01'),
  ('stt-azure-speech', 'Azure STT per call', 0.003, '2026-01-01'),
  ('tts-azure-speech', 'Azure TTS per call', 0.004, '2026-01-01'),
  ('llm-gpt4.1-mini-eval', 'GPT-4.1 Mini eval per call', 0.005, '2026-01-01')
ON CONFLICT DO NOTHING;

-- Seed run type limits
INSERT INTO "run_type_limits" ("run_type", "min_balance") VALUES
  ('voice_test', 0.50)
ON CONFLICT ("run_type") DO NOTHING;
