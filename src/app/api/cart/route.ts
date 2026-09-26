import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cartItems } from "@/db/schema";
import { getProduct } from "@/lib/catalog";
import { SHIPPING_COST } from "@/lib/options";
import { unitPriceOf } from "@/lib/pricing";
import { normalizeConfig } from "@/lib/rules";

export const runtime = "nodejs";

function rowToItem(row: typeof cartItems.$inferSelect) {
  return {
    id: row.id,
    cartId: row.cartId,
    config: row.config as never,
    unitPrice: row.unitPrice,
    quantity: row.quantity,
    createdAt: row.createdAt?.toISOString?.() ?? "",
  };
}

function cartTotals(items: { unitPrice: number; quantity: number }[]) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const shipping = items.length === 0 ? 0 : SHIPPING_COST; // Célestime : livraison offerte
  return { subtotal, shipping, total: subtotal + shipping };
}

export async function POST(req: Request) {
  let body: { cartId?: string; config?: unknown; quantity?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const cartId = typeof body.cartId === "string" && body.cartId.length <= 64 ? body.cartId : null;
  if (!cartId) return Response.json({ error: "Panier invalide." }, { status: 400 });

  const config = normalizeConfig(body.config);
  if (!config) return Response.json({ error: "Configuration illisible." }, { status: 400 });

  const quantity = Math.min(20, Math.max(1, Math.round(body.quantity ?? 1)));
  const product = await getProduct(config.productId);
  const unitPrice = unitPriceOf(config, product ?? null);
  const id = crypto.randomUUID();
  const createdAt = new Date();

  await db.insert(cartItems).values({ id, cartId, config: config as never, unitPrice, quantity, createdAt });
  const item = rowToItem({ id, cartId, config: config as never, unitPrice, quantity, createdAt });
  const price = cartTotals([item]);
  return Response.json({ item, price }, { status: 201 });
}

export async function GET(req: Request) {
  const cartId = new URL(req.url).searchParams.get("cartId");
  if (!cartId) return Response.json({ error: "Panier invalide." }, { status: 400 });
  const rows = await db.select().from(cartItems).where(eq(cartItems.cartId, cartId)).orderBy(desc(cartItems.createdAt));
  const items = rows.map(rowToItem);
  return Response.json({ items, price: cartTotals(items) });
}
