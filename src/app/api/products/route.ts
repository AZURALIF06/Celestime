// Célestime — catalogue public (produits gérés par l'administration).

import { getProduct, getProducts } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (slug) {
    const p = await getProduct(slug);
    if (!p) return Response.json({ error: "Produit introuvable." }, { status: 404 });
    return Response.json({ product: p });
  }
  const products = await getProducts();
  return Response.json({ products: products.filter((p) => p.status === "active") });
}
