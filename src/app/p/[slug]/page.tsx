import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCmsPageMetadata, isValidGenericCmsPage, safelyReadCmsPage } from "@/lib/cms";
import { PageCanvas } from "./page-canvas";

export const dynamic = "force-dynamic";

type RouteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "accueil") return {};

  const rows = await safelyReadCmsPage(() => db.select().from(pages).where(eq(pages.slug, slug)).limit(1));
  const page = rows?.[0];
  if (!page || page.status !== "published" || !page.published) return {};
  if (!isValidGenericCmsPage(page.published, { forRendering: true })) return {};
  return getCmsPageMetadata(page.seo);
}

export default async function CmsPage({ params }: RouteProps) {
  const { slug } = await params;
  if (slug === "accueil") redirect("/");

  const rows = await safelyReadCmsPage(() => db.select().from(pages).where(eq(pages.slug, slug)).limit(1));
  const page = rows?.[0];
  if (!page || page.status !== "published" || !page.published) notFound();

  // Invalid persisted JSON, including old commerce blocks, is never allowed into the canvas.
  if (!isValidGenericCmsPage(page.published, { forRendering: true })) notFound();

  return (
    <main>
      <PageCanvas page={page.published} products={[]} bp="auto" genericSafety />
    </main>
  );
}
