// Célestime — admin commerce : catégories, collections, coupons, clients, paiements.

import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  collectionItems,
  collections,
  coupons,
  stripeTransactions,
} from "@/db/schema";
import { audit } from "@/lib/auth";
import { guard, jsonError } from "@/lib/admin-guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied;
  const q = new URL(req.url).searchParams.get("scope") ?? "all";
  if (q === "categories") {
    return Response.json({ categories: (await db.select().from(categories)).sort((a, b) => a.sortOrder - b.sortOrder) });
  }
  if (q === "collections") {
    const colls = await db.select().from(collections);
    const items = await db.select().from(collectionItems);
    return Response.json({
      collections: colls.map((c) => ({ ...c, items: items.filter((i) => i.collectionId === c.id).map((i) => i.productId) })),
    });
  }
  if (q === "coupons") {
    return Response.json({ coupons: await db.select().from(coupons).orderBy(desc(coupons.createdAt)) });
  }
  if (q === "payments") {
    return Response.json({ payments: (await db.select().from(stripeTransactions).orderBy(desc(stripeTransactions.createdAt))).slice(0, 200) });
  }
  if (q === "customers") {
    const rows = await db.execute(
      sql`SELECT c.email, c.full_name, c.phone, COUNT(o.id) AS orders, COALESCE(SUM(o.total),0)::int AS spent, MAX(o.created_at) AS last
          FROM customers c LEFT JOIN orders o ON o.customer->>'email' = c.email
          GROUP BY c.email, c.full_name, c.phone ORDER BY last DESC NULLS LAST LIMIT 200`
    );
    return Response.json({ customers: (rows as any).rows ?? rows });
  }
  return Response.json({ ok: true });
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

  switch (body.action) {
    case "category.create": {
      const slug = (body.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug) return jsonError("Nom de catégorie invalide.");
      const existing = (await db.select().from(categories).where(eq(categories.slug, slug)))[0];
      if (existing) return jsonError("Cette catégorie existe déjà.");
      const [row] = await db.insert(categories).values({ slug, name: body.name.trim(), sortOrder: Number(body.sortOrder) || 0 }).returning();
      return Response.json({ id: row.id }, { status: 201 });
    }
    case "category.update": {
      await db.update(categories)
        .set({ name: body.name, sortOrder: Number(body.sortOrder) || 0 })
        .where(eq(categories.id, body.id));
      return Response.json({ ok: true });
    }
    case "category.delete": {
      await db.delete(categories).where(eq(categories.id, body.id));
      return Response.json({ ok: true });
    }
    case "collection.create": {
      const slug = (body.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const [row] = await db.insert(collections).values({ slug, name: body.name.trim(), description: body.description || "" }).returning();
      return Response.json({ id: row.id }, { status: 201 });
    }
    case "collection.update": {
      await db.update(collections).set({ name: body.name, description: body.description || "" }).where(eq(collections.id, body.id));
      if (Array.isArray(body.items)) {
        await db.delete(collectionItems).where(eq(collectionItems.collectionId, body.id));
        for (let i = 0; i < body.items.length; i++) {
          await db.insert(collectionItems).values({ collectionId: body.id, productId: body.items[i], sortOrder: i });
        }
      }
      return Response.json({ ok: true });
    }
    case "collection.delete": {
      await db.delete(collectionItems).where(eq(collectionItems.collectionId, body.id));
      await db.delete(collections).where(eq(collections.id, body.id));
      return Response.json({ ok: true });
    }
    case "coupon.create":
    case "coupon.update": {
      const code = (body.code || "").toUpperCase().trim();
      if (!code) return jsonError("Code requis.");
      if (body.action === "coupon.create") {
        const dup = (await db.select().from(coupons).where(eq(coupons.code, code)))[0];
        if (dup) return jsonError("Ce code existe déjà.");
        const [row] = await db.insert(coupons).values({
          code,
          type: body.type === "fixed" ? "fixed" : "pct",
          value: Number(body.value) || 0,
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          minAmount: Number(body.minAmount) || 0,
          maxUses: Number(body.maxUses) || 0,
          productSlugs: body.productSlugs || [],
          categorySlugs: body.categorySlugs || [],
          active: body.active !== false,
        }).returning();
        await audit(g.email!, "coupon.create", code);
        return Response.json({ id: row.id }, { status: 201 });
      }
      await db.update(coupons)
        .set({
          type: body.type === "fixed" ? "fixed" : "pct",
          value: Number(body.value) || 0,
          minAmount: Number(body.minAmount) || 0,
          maxUses: Number(body.maxUses) || 0,
          active: body.active !== false,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
        })
        .where(eq(coupons.id, body.id));
      return Response.json({ ok: true });
    }
    case "coupon.delete": {
      await db.delete(coupons).where(eq(coupons.id, body.id));
      return Response.json({ ok: true });
    }
    default:
      return jsonError("Action inconnue.");
  }
}
