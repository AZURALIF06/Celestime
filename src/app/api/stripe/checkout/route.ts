// Célestime — création de session Stripe Checkout (si Stripe est configuré).

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cartItems } from "@/db/schema";
import { guard } from "@/lib/admin-guard";
import { createCheckoutSession, stripeEnabled } from "@/lib/stripe";
import { unitPriceOf } from "@/lib/pricing";
import { normalizeConfig } from "@/lib/rules";
import { productBySlug } from "@/lib/options";

export const runtime = "nodejs";

// Usage admin : simuler une transaction test
export async function GET() {
  const g = await guard();
  if (g.denied) return g.denied;
  return Response.json({ enabled: stripeEnabled() });
}

export async function POST(req: Request) {
  if (!stripeEnabled()) {
    return Response.json({ error: "Stripe n'est pas configuré sur cet environnement." }, { status: 400 });
  }
  let body: { cartId?: string; customer?: { email?: string } };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const cartId = body.cartId;
  if (!cartId) return Response.json({ error: "Panier invalide." }, { status: 400 });

  const rows = await db.select().from(cartItems).where(eq(cartItems.cartId, cartId));
  if (rows.length === 0) return Response.json({ error: "Votre panier est vide." }, { status: 400 });

  const lines = rows.map((r) => {
    const config = normalizeConfig(r.config)!;
    const p = productBySlug(config.productId);
    const name = config.name || p?.name || "Création Célestime";
    return {
      description: `${p?.name ?? "Création"} — ${name} · ${config.size}${config.framed ? " encadré" : ""}`,
      amount: unitPriceOf(config) * r.quantity,
      quantity: r.quantity,
    };
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await createCheckoutSession({
    amountCents: lines.reduce((s, l) => s + l.amount, 0),
    currency: "eur",
    successUrl: `${base}/confirmation/stripe?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/cart`,
    metadata: { cartId },
    lineItems: lines,
  });
  return Response.json({ url: session.url, sessionId: session.id });
}
