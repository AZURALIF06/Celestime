// Célestime — admin commandes : liste, détail, statuts, remboursement.

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, stripeTransactions } from "@/db/schema";
import { audit } from "@/lib/auth";
import { guard, jsonError } from "@/lib/admin-guard";
import { createRefund, stripeEnabled } from "@/lib/stripe";

export const runtime = "nodejs";

const STATUSES = ["en_attente", "payee", "en_preparation", "expediee", "livree", "annulee", "remboursee"];

export async function GET(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied;
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const row = (await db.select().from(orders).where(eq(orders.id, id)))[0];
    if (!row) return jsonError("Commande introuvable.", 404);
    return Response.json({ order: row });
  }
  const status = new URL(req.url).searchParams.get("status");
  let rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  if (status && STATUSES.includes(status)) {
    rows = rows.filter((o) => o.status === status);
  }
  return Response.json({
    statuses: STATUSES,
    orders: rows.slice(0, 300).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: o.customer,
      total: o.total,
      discount: o.discount,
      couponCode: o.couponCode,
      status: o.status,
      paymentStatus: o.paymentStatus,
      items: o.items,
      createdAt: o.createdAt,
    })),
  });
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

  if (body.action === "status") {
    if (!STATUSES.includes(body.status)) return jsonError("Statut invalide.");
    const row = (await db.select().from(orders).where(eq(orders.id, body.id)))[0];
    if (!row) return jsonError("Commande introuvable.", 404);
    await db.update(orders).set({ status: body.status }).where(eq(orders.id, body.id));
    await audit(g.email!, "order.status", row.orderNumber, { status: body.status });
    return Response.json({ ok: true });
  }

  if (body.action === "refund") {
    const row = (await db.select().from(orders).where(eq(orders.id, body.id)))[0];
    if (!row) return jsonError("Commande introuvable.", 404);
    if (stripeEnabled()) {
      const tx = (await db.select().from(stripeTransactions).where(eq(stripeTransactions.orderId, row.id)))[0];
      if (tx && tx.sessionOrIntentId.startsWith("pi_")) {
        try {
          await createRefund(tx.sessionOrIntentId);
          await db.update(stripeTransactions).set({ status: "refunded", refundedAt: new Date() }).where(eq(stripeTransactions.id, tx.id));
        } catch (e: any) {
          return jsonError(`Échec du remboursement Stripe : ${e?.message ?? "inconnue"}`);
        }
      }
    }
    await db.update(orders).set({ status: "remboursee", paymentStatus: "refunded" }).where(eq(orders.id, row.id));
    await audit(g.email!, "order.refund", row.orderNumber);
    return Response.json({ ok: true });
  }

  return jsonError("Action inconnue.");
}
