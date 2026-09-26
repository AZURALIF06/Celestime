import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, customers, orders, stripeTransactions } from "@/db/schema";
import { getProduct } from "@/lib/catalog";
import { markCouponUsed, validateCoupon } from "@/lib/coupons";
import { unitPriceOf } from "@/lib/pricing";
import { getShippingZones, shippingCost, zoneForCountry } from "@/lib/shipping";
import { normalizeConfig, validateConfig } from "@/lib/rules";
import type { CartItem, CustomerInfo, Order } from "@/lib/types";

export const runtime = "nodejs";

// Le serveur revalide la configuration, recalcule le prix, la livraison,
// le coupon et la TVA. Le prix envoyé par le navigateur n'est jamais trusté.
export async function POST(req: Request) {
  let body: { cartId?: string; customer?: CustomerInfo; coupon?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const cartId = body.cartId;
  if (!cartId || cartId.length > 64) return Response.json({ error: "Panier invalide." }, { status: 400 });

  const c = body.customer;
  if (
    !c ||
    !c.fullName || c.fullName.trim().length < 2 ||
    !c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email) ||
    !c.address || c.address.trim().length < 5 ||
    !c.city || !c.zip || !c.country
  ) {
    return Response.json({ error: "Veuillez compléter toutes les coordonnées de livraison." }, { status: 400 });
  }

  const rows = await db.select().from(cartItems).where(eq(cartItems.cartId, cartId));
  if (rows.length === 0) return Response.json({ error: "Votre panier est vide." }, { status: 400 });

  const items: CartItem[] = [];
  for (const row of rows) {
    const config = normalizeConfig(row.config);
    if (!config) return Response.json({ error: "Une configuration de votre panier est illisible. Merci de la retirer." }, { status: 400 });
    const errors = validateConfig(config);
    if (Object.keys(errors).length > 0) {
      return Response.json({ error: "Certaine création du panier est incomplète. Modifiez-la depuis le panier.", errors }, { status: 400 });
    }
    const product = await getProduct(config.productId);
    const unitPrice = unitPriceOf(config, product ?? null);
    const quantity = Math.min(20, Math.max(1, row.quantity));
    items.push({ id: row.id, cartId, config, unitPrice, quantity, createdAt: row.createdAt?.toISOString?.() ?? "" });
  }

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const coupon = body.coupon
    ? await validateCoupon(body.coupon, subtotal, [...new Set(items.map((i) => i.config.productId))])
    : { ok: false, discount: 0 };
  const discount = coupon.ok ? coupon.discount : 0;
  const zones = await getShippingZones();
  const shipping = shippingCost(zones, zoneForCountry(c.country), subtotal - discount);
  const total = Math.max(0, subtotal - discount) + shipping;

  // TVA (taux France 20 % par défaut, séparée proprement HT / TVA / TTC)
  const taxRate = 2000;
  const ht = Math.round(total / (1 + taxRate / 1000));
  const taxCents = total - ht;

  // Client (upsert)
  const existing = (await db.select().from(customers).where(eq(customers.email, c.email.trim().toLowerCase())))[0];
  if (!existing) {
    await db.insert(customers).values({
      fullName: c.fullName.trim(),
      email: c.email.trim().toLowerCase(),
      phone: (c.phone ?? "").trim(),
    });
  }

  const id = crypto.randomUUID();
  const orderNumber = `CLT-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const createdAt = new Date();

  await db.insert(orders).values({
    id,
    orderNumber,
    customer: {
      fullName: c.fullName.trim(), email: c.email.trim(), phone: (c.phone ?? "").trim(),
      address: c.address.trim(), zip: c.zip.trim(), city: c.city.trim(),
      country: c.country.trim(), notes: (c.notes ?? "").trim(),
    },
    items: items as never,
    subtotal,
    discount,
    couponCode: coupon.ok ? body.coupon!.trim().toUpperCase() : null,
    shipping,
    htCents: ht,
    taxCents: taxCents,
    total,
    status: "payee",
    paymentStatus: "demo",
    stripeSessionId: null,
    createdAt,
  });
  if (coupon.ok) await markCouponUsed(body.coupon!);
  await db.insert(stripeTransactions).values({
    id: crypto.randomUUID(),
    orderId: id,
    sessionOrIntentId: `demo-${id.slice(0, 8)}`,
    amountCents: total,
    status: "succeeded",
  });
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));

  const order: Order = {
    id, orderNumber,
    customer: { fullName: c.fullName.trim(), email: c.email.trim(), phone: (c.phone ?? "").trim(), address: c.address.trim(), zip: c.zip.trim(), city: c.city.trim(), country: c.country.trim(), notes: (c.notes ?? "").trim() },
    items, subtotal, shipping, total, status: "payee", createdAt: createdAt.toISOString(),
  };

  return Response.json({ orderNumber, order, coupon, ht, taxCents }, { status: 201 });
}
