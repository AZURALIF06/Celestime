import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { resolvePublishedHome } from "@/lib/home-content";
import type { HomeEditorialContent } from "@/lib/home-content";

/** CMS errors and incomplete/draft content intentionally leave the current coded homepage in use. */
export async function getPublishedHome(): Promise<HomeEditorialContent | null> {
  try {
    const row = (await db.select().from(pages).where(eq(pages.slug, "accueil")).limit(1))[0];
    return row ? resolvePublishedHome(row.status, row.published) : null;
  } catch {
    return null;
  }
}
