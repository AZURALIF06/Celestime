// Célestime — webhook Stripe : synchronise automatiquement les statuts.
// Événements gérés : checkout.session.completed, checkout.session.expired,
// payment_intent.succeeded, payment_intent.payment_failed, charge.refunded.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, stripeTransactions } from "@/db/schema";
import { audit } from "@/lib/auth";
import { verifyWebhookSignature } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Mode démo : webhook non configuré — on refuse proprement.
    return Response.json({ error: "Webhook Stripe non configuré." }, { status: 400 });
  }
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  if (!verifyWebhookSignature(payload, sig, secret)) {
    return Response.json({ error: "Signature invalide." }, { status: 400 });
  }
  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Payload invalide." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await db.update(orders)
            .set({ status: "payee", paymentStatus: "succeeded", stripeSessionId: session.id })
            .where(eq(orders.id, orderId));
          await db.insert(stripeTransactions).values({
            id: crypto.randomUUID(),
            orderId,
            sessionOrIntentId: session.payment_intent ? String(session.payment_intent) : session.id,
            amountCents: session.amount_total ?? 0,
            status: "succeeded",
          });
          await audit("stripe", "payment.succeeded", String(session.id));
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(20);
        const match = rows.find((o) => o.stripeSessionId === pi.id || o.stripeSessionId === pi.latest_charge);
        if (match) await db.update(orders).set({ paymentStatus: "succeeded" }).where(eq(orders.id, match.id));
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        await db.insert(stripeTransactions).values({
          id: crypto.randomUUID(),
          orderId: null as unknown as string,
          sessionOrIntentId: pi.id,
          amountCents: 0,
          status: "failed",
        });
        await audit("stripe", "payment.failed", pi.id);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const rows = await db.select().from(stripeTransactions).limit(200);
        const tx = rows.find((t) => t.sessionOrIntentId === charge.id || t.sessionOrIntentId === charge.payment_intent);
        if (tx) {
          await db.update(stripeTransactions).set({ status: "refunded", refundedAt: new Date() }).where(eq(stripeTransactions.id, tx.id));
          if (tx.orderId) {
            await db.update(orders).set({ status: "remboursee", paymentStatus: "refunded" }).where(eq(orders.id, tx.orderId));
            await audit("stripe", "refund", tx.orderId);
          }
        }
        break;
      }
      case "checkout.session.expired": {
        await audit("stripe", "checkout.expired", event.data.object?.id ?? "");
        break;
      }
    }
  } catch (e) {
    console.error("stripe webhook error", e);
  }
  return Response.json({ received: true });
}
