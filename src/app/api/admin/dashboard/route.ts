// Célestime — dashboard : agrégats ventes, commandes, stock, clients.

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders, productVariants, products, stripeTransactions } from "@/db/schema";
import { guard } from "@/lib/admin-guard";

export const runtime = "nodejs";

export async function GET() {
  const g = await guard();
  if (g.denied) return g.denied;

  const all = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const paid = all.filter((o) => o.paymentStatus === "succeeded" || o.paymentStatus === "demo");
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const pending = all.filter((o) => o.status === "en_attente").length;
  const avg = paid.length ? Math.round(revenue / paid.length) : 0;

  const prods = await db.select().from(products);
  const variants = await db.select().from(productVariants);
  const lowStock = variants.filter((v) => !v.oversell && v.stock - v.reserved <= 5);

  // CA des 8 dernières semaines
  const weeks: number[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = Date.now() - (i + 1) * 7 * 86400000;
    const end = Date.now() - i * 7 * 86400000;
    weeks.push(paid.filter((o) => +o.createdAt > start && +o.createdAt <= end).reduce((s, o) => s + o.total, 0));
  }

  // Meilleures ventes (items est jsonb : on compte côté mémoire)
  const salesByProduct: Record<string, number> = {};
  for (const o of paid) {
    for (const it of (o.items ?? []) as any[]) {
      salesByProduct[it.config?.productId ?? "?"] = (salesByProduct[it.config?.productId ?? "?"] ?? 0) + it.quantity;
    }
  }
  const topProducts = Object.entries(salesByProduct)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([slug, qty]) => ({ name: prods.find((p) => p.slug === slug)?.name ?? slug, slug, qty }));

  const customerRows = (await db.execute(sql`SELECT COUNT(*)::int AS c FROM customers`)) as any;
  const payments = (await db.select().from(stripeTransactions).orderBy(desc(stripeTransactions.createdAt)).limit(8)) as any[];

  return Response.json({
    revenue,
    ordersCount: all.length,
    pending,
    avg,
    productsCount: prods.length,
    customersCount: customerRows?.rows?.[0]?.c ?? customerRows?.[0]?.c ?? 0,
    lowStock: lowStock.map((v) => ({ ...v })),
    weeks,
    topProducts,
    payments,
    recentOrders: all.slice(0, 8).map((o) => ({
      id: o.id, orderNumber: o.orderNumber, total: o.total, status: o.status, customer: o.customer, createdAt: o.createdAt,
    })),
  });
}
