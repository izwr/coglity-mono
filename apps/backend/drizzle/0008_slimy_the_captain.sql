CREATE TYPE "public"."scheduled_test_case_state" AS ENUM('not_started', 'in_progress', 'passed', 'failed', 'blocked', 'skipped');--> statement-breakpoint
CREATE TABLE "scheduled_test_suites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_suite_id" uuid NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_test_suite_id" uuid NOT NULL,
	"test_case_id" uuid NOT NULL,
	"assigned_to" uuid,
	"actual_results" text DEFAULT '' NOT NULL,
	"state" "scheduled_test_case_state" DEFAULT 'not_started' NOT NULL,
	"linked_bug_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_test_suites" ADD CONSTRAINT "scheduled_test_suites_test_suite_id_test_suites_id_fk" FOREIGN KEY ("test_suite_id") REFERENCES "public"."test_suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_test_suites" ADD CONSTRAINT "scheduled_test_suites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_test_cases" ADD CONSTRAINT "scheduled_test_cases_scheduled_test_suite_id_scheduled_test_suites_id_fk" FOREIGN KEY ("scheduled_test_suite_id") REFERENCES "public"."scheduled_test_suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_test_cases" ADD CONSTRAINT "scheduled_test_cases_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_test_cases" ADD CONSTRAINT "scheduled_test_cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;