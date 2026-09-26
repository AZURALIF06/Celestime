import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProducts, type DbProduct } from "@/lib/catalog";
import { PageCanvas } from "./page-canvas";
import type { CmsPage } from "@/lib/cms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page Célestime" };

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  const page = rows[0];
  if (!page || page.status !== "published" || !page.published) notFound();
  const data = page.published as unknown as CmsPage;
  const seo = (page.seo ?? {}) as { title?: string; description?: string; noindex?: boolean; ogImage?: string };
  const products: DbProduct[] = await getProducts();

  return (
    <main>
      <PageCanvas page={data} products={products} />
    </main>
  );
}
