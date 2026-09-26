// Célestime — paramètres du site : header, menu, footer, livraison, TVA, Stripe.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { audit } from "@/lib/auth";
import { guard, jsonError } from "@/lib/admin-guard";

export const runtime = "nodejs";

export async function GET() {
  const g = await guard();
  if (g.denied) return g.denied;
  const rows = await db.select().from(siteSettings).limit(1);
  return Response.json({ settings: rows[0]?.data ?? null });
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Requête invalide.");
  }
  if (body.action === "save") {
    if (!body.data || typeof body.data !== "object") return jsonError("Données invalides.");
    const rows = await db.select().from(siteSettings).limit(1);
    if (rows.length > 0) {
      await db.update(siteSettings).set({ data: body.data, updatedAt: new Date() }).where(eq(siteSettings.id, rows[0].id));
    } else {
      await db.insert(siteSettings).values({ data: body.data });
    }
    await audit(g.email!, "settings.save", "site");
    return Response.json({ ok: true });
  }
  return jsonError("Action inconnue.");
}
