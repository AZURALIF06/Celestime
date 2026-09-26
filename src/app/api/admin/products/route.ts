import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, productVariants } from "@/db/schema";
import { audit } from "@/lib/auth";
import { guard, jsonError } from "@/lib/admin-guard";

export const runtime = "nodejs";

export async function GET() {
  const g = await guard();
  if (g.denied) return g.denied;
  const rows = await db.select().from(products).orderBy(desc(products.createdAt));
  const variants = await db.select().from(productVariants);
  return Response.json({
    products: rows.map((r) => ({
      ...r,
      variants: variants.filter((v) => v.productId === r.id).map((v) => ({ ...v })),
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

  if (body.action === "create") {
    if (!body.name) return jsonError("Le nom du produit est requis.");
    const slug =
      (typeof body.slug === "string" && body.slug.trim()) ||
      body.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!slug) return jsonError("Nom invalide.");
    const taken = (await db.select().from(products).where(eq(products.slug, slug)))[0];
    if (taken) return jsonError("Cette URL (slug) est déjà utilisée.");
    const id = crypto.randomUUID();
    await db.insert(products).values({
      id,
      slug,
      name: body.name.trim(),
      fullName: body.fullName || body.name.trim(),
      tagline: body.tagline || "",
      description: body.description || "",
      categoryId: body.categoryId ?? null,
      reference: body.reference || "",
      weight: body.weight || "",
      dims: body.dims || "",
      taxRate: Number(body.taxRate) || 2000,
      oldPrice: body.oldPrice ? Math.round(Number(body.oldPrice) * 100) : null,
      onPromo: Boolean(body.onPromo),
      images: Array.isArray(body.images) ? body.images : [],
      status: body.status || "draft",
      kind: body.kind || "static",
      engine: body.engine ?? null,
      box: Array.isArray(body.box) ? body.box : [],
      seo: body.seo || {},
      rating: 50,
      reviewsCount: 0,
    });
    if (Array.isArray(body.variants)) {
      for (const v of body.variants) {
        await db.insert(productVariants).values({
          id: crypto.randomUUID(),
          productId: id,
          name: v.name || "Standard",
          priceCents: Math.round(Number(v.priceCents || 0) * 100),
          stock: Number(v.stock) || 0,
          oversell: Boolean(v.oversell),
          reference: v.reference || "",
        });
      }
    }
    await audit(g.email!, "product.create", slug);
    return Response.json({ id, slug }, { status: 201 });
  }

  if (body.action === "update") {
    const row = (await db.select().from(products).where(eq(products.id, body.id)))[0];
    if (!row) return jsonError("Produit introuvable.", 404);
    const patch: any = { updatedAt: new Date() };
    for (const k of ["name", "fullName", "tagline", "description", "reference", "weight", "dims", "kind", "status"]) {
      if (typeof body[k] === "string") patch[k] = body[k];
    }
    if (body.categoryId !== undefined) patch.categoryId = body.categoryId ?? null;
    if (body.taxRate !== undefined) patch.taxRate = Number(body.taxRate) || 2000;
    if (body.oldPrice !== undefined) patch.oldPrice = body.oldPrice ? Math.round(Number(body.oldPrice) * 100) : null;
    if (body.onPromo !== undefined) patch.onPromo = Boolean(body.onPromo);
    if (Array.isArray(body.images)) patch.images = body.images;
    if (body.engine !== undefined) patch.engine = body.engine ?? null;
    if (Array.isArray(body.box)) patch.box = body.box;
    if (body.seo) patch.seo = body.seo;
    await db.update(products).set(patch).where(eq(products.id, row.id));

    // Variantes : remplacement simple et prévisible
    if (Array.isArray(body.variants)) {
      await db.delete(productVariants).where(eq(productVariants.productId, row.id));
      for (const v of body.variants) {
        await db.insert(productVariants).values({
          id: v.id && typeof v.id === "string" && v.id !== "0" ? v.id : crypto.randomUUID(),
          productId: row.id,
          name: v.name || "Standard",
          priceCents: Math.round(Number(v.priceCents || 0) * 100),
          oldPriceCents: v.oldPriceCents ? Math.round(Number(v.oldPriceCents) * 100) : null,
          stock: Number(v.stock) || 0,
          reserved: Number(v.reserved) || 0,
          sold: Number(v.sold) || 0,
          oversell: Boolean(v.oversell),
          reference: v.reference || "",
          image: v.image || ((row.images as unknown as string[] | null)?.[0] ?? null),
        });
      }
    }
    await audit(g.email!, "product.update", row.slug);
    return Response.json({ ok: true });
  }

  if (body.action === "delete") {
    const row = (await db.select().from(products).where(eq(products.id, body.id)))[0];
    if (!row) return jsonError("Produit introuvable.", 404);
    await db.delete(productVariants).where(eq(productVariants.productId, row.id));
    await db.delete(products).where(eq(products.id, row.id));
    await audit(g.email!, "product.delete", row.slug);
    return Response.json({ ok: true });
  }

  return jsonError("Action inconnue.");
}
