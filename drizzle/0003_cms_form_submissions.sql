-- Migration: Phase 3C — stockage des soumissions de formulaires CMS.
-- Strictement additive : une seule instruction CREATE TABLE IF NOT EXISTS.
-- Aucune donnée existante n'est lue, modifiée ou supprimée. Aucun index
-- n'est créé sur une table préexistante. La migration est réversible par
-- un simple DROP TABLE (aucune autre table n'en dépend).
CREATE TABLE IF NOT EXISTS "cms_form_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_slug" text NOT NULL,
	"element_id" text NOT NULL,
	"form_name" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"ip_hash" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cms_form_submissions_created_at_idx" ON "cms_form_submissions" ("created_at");
