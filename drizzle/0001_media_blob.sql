-- Migration: add Vercel Blob support to media table (minimal, nullable, backward compatible)
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "url" text;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "width" integer;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "height" integer;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "storage" text DEFAULT 'blob' NOT NULL;
-- Backfill existing rows: url = path if path already looks like http, else null (keep path)
-- No data loss, all columns nullable except storage with default
