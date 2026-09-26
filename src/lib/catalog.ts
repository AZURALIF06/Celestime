// Célestime — service catalogue : produits gérés en base (admin),
// repli sur le catalogue statique Célestime si la base est vide.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, productVariants } from "@/db/schema";
import { PRODUCTS as STATIC_PRODUCTS, type ProductDef } from "./options";

export type { ProductDef };
export type { ProductPriceTables } from "./options";

export interface DbProduct extends Omit<ProductDef, "kind"> {
  id: string;
  kind: string; // starmap (configurateur) | static
  oldPrice: number | null;
  onPromo: boolean;
  reference: string;
  status: string;
  taxRate: number;
  seo: Record<string, unknown>;
  engine?: Record<string, unknown> | null;
}

function rowToProduct(row: typeof products.$inferSelect): DbProduct {
  const engine = (row.engine ?? {}) as Record<string, unknown>;
  const fallback = STATIC_PRODUCTS.find((p) => p.slug === row.slug);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    fullName: row.fullName || row.name,
    tagline: row.tagline,
    description: row.description,
    kind: row.kind || "static",
    occasion: ((engine.occasion as ProductDef["occasion"] | undefined)) ?? "souvenir",
    priceFrom: row.oldPrice ?? (engine.priceFrom as number | undefined) ?? 0,
    image: ((row.images as unknown as string[])?.[0]) ?? "/images/naissance.jpg",
    prices: (engine.prices as ProductDef["prices"]) ?? fallback?.prices ?? { base: {}, frame: {} },
    sizes: (engine.sizes as ProductDef["sizes"] | undefined) ?? fallback?.sizes ?? [],
    shapes: (engine.shapes as ProductDef["shapes"] | undefined) ?? fallback?.shapes ?? [],
    backgrounds: (engine.backgrounds as ProductDef["backgrounds"] | undefined) ?? fallback?.backgrounds ?? [],
    framed: (engine.framed as boolean | undefined) ?? fallback?.framed ?? false,
    box: (row.box as unknown as string[]) ?? fallback?.box ?? [],
    rating: row.rating / 10,
    reviewsCount: row.reviewsCount,
    oldPrice: row.oldPrice,
    onPromo: row.onPromo,
    reference: row.reference,
    status: row.status,
    taxRate: row.taxRate,
    seo: (row.seo ?? {}) as Record<string, unknown>,
    engine: (row.engine as Record<string, unknown> | null) ?? null,
  };
}

export async function getProducts(): Promise<DbProduct[]> {
  try {
    const rows = await db.select().from(products).orderBy(desc(products.createdAt));
    if (rows.length === 0) return STATIC_PRODUCTS.map((p) => rowToProduct({ ...fallbackRow(p) }));
    return rows.map(rowToProduct);
  } catch {
    return STATIC_PRODUCTS.map((p) => rowToProduct({ ...fallbackRow(p) }));
  }
}

function fallbackRow(p: ProductDef) {
  return {
    id: p.slug,
    slug: p.slug,
    name: p.name,
    fullName: p.name,
    tagline: p.tagline,
    description: p.description,
    categoryId: null,
    reference: "",
    weight: "",
    dims: "",
    taxRate: 2000,
    oldPrice: null,
    onPromo: false,
    images: [p.image],
    status: "active",
    kind: p.kind,
    engine: {
      occasion: p.occasion,
      prices: p.prices,
      sizes: p.sizes,
      shapes: p.shapes,
      backgrounds: p.backgrounds,
      framed: p.framed,
      priceFrom: p.priceFrom,
    },
    box: p.box,
    seo: {},
    rating: Math.round(p.rating * 10),
    reviewsCount: p.reviewsCount,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as typeof products.$inferSelect;
}

export async function getProduct(slug: string): Promise<DbProduct | null> {
  const all = await getProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

/** Définition moteur (configurateur) pour un produit — utilisée par les API
 *  de prix/checkout afin que les prix administrés s'appliquent partout. */
export async function getProductPriceTables(slug: string): Promise<import("./options").ProductPriceTables | null> {
  const p = await getProduct(slug);
  return p ? p.prices : null;
}

export async function getCategories() {
  try {
    return await db.select().from(categories);
  } catch {
    return [];
  }
}

export async function getVariants(productId: string) {
  try {
    return await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  } catch {
    return [];
  }
}
