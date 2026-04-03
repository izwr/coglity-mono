CREATE TYPE "public"."bug_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."bug_reproducibility" AS ENUM('always', 'sometimes', 'rare', 'unable');--> statement-breakpoint
CREATE TYPE "public"."bug_resolution" AS ENUM('unresolved', 'fixed', 'wont_fix', 'duplicate', 'cannot_reproduce', 'by_design');--> statement-breakpoint
CREATE TYPE "public"."bug_severity" AS ENUM('blocker', 'critical', 'major', 'minor', 'trivial');--> statement-breakpoint
CREATE TYPE "public"."bug_state" AS ENUM('new', 'open', 'in_progress', 'resolved', 'closed', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."bug_type" AS ENUM('functional', 'performance', 'security', 'usability', 'compatibility', 'regression', 'other');--> statement-breakpoint
CREATE TABLE "bugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"comments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_to" uuid,
	"bug_type" "bug_type" DEFAULT 'functional' NOT NULL,
	"created_by" uuid,
	"priority" "bug_priority" DEFAULT 'medium' NOT NULL,
	"severity" "bug_severity" DEFAULT 'major' NOT NULL,
	"resolution" "bug_resolution" DEFAULT 'unresolved' NOT NULL,
	"state" "bug_state" DEFAULT 'new' NOT NULL,
	"reproducibility" "bug_reproducibility" DEFAULT 'always' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;