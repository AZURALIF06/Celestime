import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cartItems } from "@/db/schema";
import { unitPriceOf } from "@/lib/pricing";
import { normalizeConfig } from "@/lib/rules";
import type { CreationConfig } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Article introuvable." }, { status: 404 });
  const rows = await db.select().from(cartItems).where(eq(cartItems.id, id));
  if (rows.length === 0) return Response.json({ error: "Article introuvable." }, { status: 404 });
  const row = rows[0];
  return Response.json({
    id: row.id,
    cartId: row.cartId,
    config: row.config,
    unitPrice: row.unitPrice,
    quantity: row.quantity,
    createdAt: row.createdAt?.toISOString?.() ?? "",
  });
}

// Modification d'une création depuis le panier (section 32) : le prix est
// recalculé côté serveur après toute modification.
export async function PUT(req: Request) {
  let body: { id?: string; config?: unknown; quantity?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const id = body.id;
  if (!id) return Response.json({ error: "Article introuvable." }, { status: 404 });

  const existing = await db.select().from(cartItems).where(eq(cartItems.id, id));
  if (existing.length === 0) return Response.json({ error: "Article introuvable." }, { status: 404 });

  const current = existing[0];
  let config: CreationConfig = current.config as CreationConfig;
  if (body.config !== undefined) {
    const norm = normalizeConfig(body.config);
    if (!norm) return Response.json({ error: "Configuration illisible." }, { status: 400 });
    config = norm;
  }
  const quantity = Math.min(20, Math.max(1, Math.round(body.quantity ?? current.quantity)));
  const unitPrice = unitPriceOf(config);

  const updated = await db
    .update(cartItems)
    .set({ config: config as never, quantity, unitPrice })
    .where(eq(cartItems.id, id))
    .returning();

  const row = updated[0];
  return Response.json({
    id: row.id,
    cartId: row.cartId,
    config: row.config,
    unitPrice: row.unitPrice,
    quantity: row.quantity,
    createdAt: row.createdAt?.toISOString?.() ?? "",
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Article introuvable." }, { status: 404 });
  await db.delete(cartItems).where(and(eq(cartItems.id, id)));
  return Response.json({ ok: true });
}
