import type { Metadata } from "next";
import Editor from "@/components/editor";
import { getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Personnaliser ma carte",
  description:
    "Composez votre Célestime en temps réel : date, heure, lieu, fond du poster (saphir, rubis, émeraude), forme du ciel (medaillon ou cœur), format et cadre. Prix Célestime, livraison offerte.",
  openGraph: { title: "Personnaliser ma Célestime" },
};

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.product === "string" ? sp.product : undefined;
  const products = await getProducts();
  const product = raw ? products.find((p) => p.slug === raw && p.kind === "starmap" && p.status === "active") : undefined;
  const productId = product?.slug;
  return <Editor productId={productId} catalog={products} />;
}
