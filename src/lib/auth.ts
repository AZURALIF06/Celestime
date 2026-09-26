// Célestime — authentification administrateur (scrypt + session cookie httpOnly).

import { createHash, randomBytes, scryptSync } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";

export const ADMIN_COOKIE = "cl_admin";
const SESSION_DAYS = 14;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64).toString("hex");
  try {
    return createHash("sha256").update(candidate).digest("hex") === createHash("sha256").update(hash).digest("hex");
  } catch {
    return false;
  }
}

export async function adminLogin(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const rows = await db.select().from(adminUsers).where(eq(adminUsers.email, email.trim().toLowerCase()));
  if (rows.length === 0) return { ok: false, error: "E-mail inconnu." };
  const user = rows[0];
  if (!verifyPassword(password, user.passwordHash)) return { ok: false, error: "Mot de passe incorrect." };
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(adminSessions).values({ token, userId: user.id, expiresAt });
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return { ok: true };
}

export async function adminLogout() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) {
    try {
      await db.delete(adminSessions).where(eq(adminSessions.token, token));
    } catch {
      /* ignore */
    }
  }
  store.delete(ADMIN_COOKIE);
}

export async function currentAdminEmail(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const rows = await db
      .select({ email: adminUsers.email, expires: adminSessions.expiresAt })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
      .where(eq(adminSessions.token, token));
    if (rows.length === 0) return null;
    if (rows[0].expires.getTime() < Date.now()) return null;
    return rows[0].email;
  } catch {
    return null;
  }
}

/** Protection des routes admin (appelé en haut des pages admin). */
export async function requireAdmin() {
  const email = await currentAdminEmail();
  if (!email) redirect("/admin/login");
  return email;
}

export async function audit(actor: string, action: string, target: string, detail?: unknown) {
  try {
    await db.insert(auditLog).values({ actor, action, target, detail: (detail ?? {}) as never });
  } catch {
    /* silencieux */
  }
}

import { auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
