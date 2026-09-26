-- Migration: médiathèque stockée en PostgreSQL (bytea), sans Vercel Blob.
-- Additive et réversible : aucune colonne supprimée, aucune donnée modifiée.
-- Les lignes existantes (storage 'blob'/'local', path /images/… ou /media/…)
-- continuent d'être servies telles quelles ; seule la colonne "data" est ajoutée.
ALTER TABLE "media" ALTER COLUMN "storage" SET DEFAULT 'db';--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "data" "bytea";
