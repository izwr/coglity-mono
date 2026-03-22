CREATE TYPE "public"."test_case_status" AS ENUM('draft', 'active');--> statement-breakpoint
CREATE TYPE "public"."ai_session_status" AS ENUM('gathering_info', 'scenarios_generated', 'test_cases_created');--> statement-breakpoint
CREATE TABLE "ai_generation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_suite_id" uuid NOT NULL,
	"user_story" text NOT NULL,
	"follow_up_qa" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_scenarios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selected_scenario_indices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "ai_session_status" DEFAULT 'gathering_info' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_cases" ADD COLUMN "status" "test_case_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_generation_sessions" ADD CONSTRAINT "ai_generation_sessions_test_suite_id_test_suites_id_fk" FOREIGN KEY ("test_suite_id") REFERENCES "public"."test_suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generation_sessions" ADD CONSTRAINT "ai_generation_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;