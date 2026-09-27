import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { newId, type CmsElement, type CmsPage } from "@/lib/cms";
import { FAQ_CONTENT } from "@/lib/faq-content";

export interface CmsFaqItem {
  question: string;
  answer: string;
}

export function createFaqCmsPage(): CmsPage {
  const faq: CmsElement = {
    id: newId(),
    type: "faq",
    x: 90,
    y: 60,
    w: 1020,
    h: 2700,
    z: 1,
    rotation: 0,
    opacity: 1,
    content: {
      eyebrow: "Aide Célestime",
      title: "Questions fréquentes",
      items: FAQ_CONTENT.map(({ q, a }) => ({ question: q, answer: a } satisfies CmsFaqItem)),
      contactTitle: "Une autre question ?",
      contactText: "Notre équipe vous répond sous 24 h ouvrées, sous le même ciel que vous.",
      contactLabel: "Nous contacter",
      contactHref: "/contact",
    },
    style: {},
  };

  return {
    sections: [{ id: newId(), h: 2820, bg: "transparent", elements: [faq] }],
  };
}

export function findFaqElement(data: unknown): CmsElement | null {
  if (!data || typeof data !== "object" || !Array.isArray((data as CmsPage).sections)) return null;
  for (const section of (data as CmsPage).sections) {
    if (!Array.isArray(section.elements)) continue;
    const faq = section.elements.find((element) => element.type === "faq");
    if (faq && Array.isArray(faq.content?.items)) return faq;
  }
  return null;
}

export function resolvePublishedFaq(status: string, published: unknown): { page: CmsPage; element: CmsElement } | null {
  if (status !== "published" || !published) return null;
  const page = published as CmsPage;
  const element = findFaqElement(page);
  return element ? { page, element } : null;
}

/** Retourne uniquement une version publiée et exploitable ; tout autre cas garde le fallback statique. */
export async function getPublishedFaq(): Promise<{ page: CmsPage; element: CmsElement } | null> {
  try {
    const row = (await db.select().from(pages).where(eq(pages.slug, "faq")).limit(1))[0];
    if (!row) return null;
    return resolvePublishedFaq(row.status, row.published);
  } catch {
    // La route publique doit toujours rester disponible même si PostgreSQL est indisponible.
    return null;
  }
}
