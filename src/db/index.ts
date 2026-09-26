import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

// Permet le build Next.js sans DATABASE_URL (ex: CI sans env). Les fonctions qui utilisent db
// gèrent déjà l'absence de connexion via try/catch et fallback catalogue statique.
const fallbackUrl = "postgresql://postgres:postgres@127.0.0.1:5432/app_db";
const connectionString = databaseUrl || fallbackUrl;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

// Helper pour savoir si on est en mode sans DB réelle
export const isDbConfigured = () => Boolean(databaseUrl);
