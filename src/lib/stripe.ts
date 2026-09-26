// Célestime — intégration Stripe (API REST directe, sans SDK).
// Active uniquement si STRIPE_SECRET_KEY est configurée ; sinon le site
// fonctionne en mode démonstration (aucune donnée bancaire n'est collectée).
// Jamais de donnée de carte stockée : Stripe gère le paiement côté Stripe.

import { createHmac, timingSafeEqual } from "crypto";

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function headers() {
  return { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" };
}

export async function createCheckoutSession(params: {
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  lineItems: { description: string; amount: number; quantity: number }[];
}): Promise<{ id: string; url: string | null }> {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", params.successUrl);
  body.set("cancel_url", params.cancelUrl);
  body.set("metadata", JSON.stringify(params.metadata));
  body.set("automatic_payment_methods", "true"); // Apple Pay / Google Pay / Link si dispo
  params.lineItems.forEach((li, i) => {
    body.set(`line_items[${i}][amount]`, String(li.amount));
    body.set(`line_items[${i}][currency]`, params.currency);
    body.set(`line_items[${i}][quantity]`, String(li.quantity));
    body.set(`line_items[${i}][price_data][unit_amount]`, String(li.amount));
    body.set(`line_items[${i}][price_data][currency]`, params.currency);
    body.set(`line_items[${i}][price_data][product_data][name]`, li.description.slice(0, 200));
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: headers(),
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Erreur Stripe");
  return { id: data.id, url: data.url };
}

export async function createRefund(paymentIntentId: string): Promise<{ id: string }> {
  const body = new URLSearchParams();
  body.set("payment_intent", paymentIntentId);
  const res = await fetch("https://api.stripe.com/v1/refunds", { method: "POST", headers: headers(), body });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Erreur de remboursement Stripe");
  return { id: data.id };
}

/** Vérifie la signature d'un webhook Stripe (t=,v1=). */
export function verifyWebhookSignature(payload: string, sigHeader: string, secret: string, toleranceSec = 300): boolean {
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")) as [string, string][]);
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
