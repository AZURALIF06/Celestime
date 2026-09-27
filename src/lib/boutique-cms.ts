import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { newId, type CmsElement, type CmsPage, type CmsSection } from "@/lib/cms";

function textElement({
  text,
  variant,
  x,
  y,
  w,
  h,
  size,
  color,
  fontFamily = "sans",
}: {
  text: string;
  variant: string;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  color: string;
  fontFamily?: string;
}): CmsElement {
  return {
    id: newId(),
    type: "text",
    x,
    y,
    w,
    h,
    z: 1,
    rotation: 0,
    opacity: 1,
    content: { text, variant },
    style: { fontFamily, size, weight: variant === "h1" || variant === "h2" ? 600 : 400, color, align: "center" },
  };
}

/** CMS Boutique contains editorial sections only; product data never belongs here. */
export function createBoutiqueCmsPage(): CmsPage {
  const before: CmsSection = {
    id: newId(),
    h: 390,
    bg: "transparent",
    elements: [
      textElement({ text: "La collection", variant: "sub", x: 100, y: 32, w: 1000, h: 28, size: 12, color: "#c9a86a" }),
      textElement({ text: "La boutique Célestime", variant: "h1", x: 70, y: 82, w: 1060, h: 76, size: 52, color: "#ece9e2", fontFamily: "serif" }),
      textElement({
        text: "Chaque création est personnalisée à partir de votre moment précis, imprimée sur papier satiné 250 g et livrée avec son certificat d'authenticité.",
        variant: "p",
        x: 160,
        y: 190,
        w: 880,
        h: 100,
        size: 18,
        color: "#9a98a8",
      }),
    ],
  };

  const after: CmsSection = {
    id: newId(),
    h: 350,
    bg: "transparent",
    elements: [
      textElement({ text: "Un moment particulier en tête ?", variant: "h2", x: 80, y: 48, w: 1040, h: 58, size: 36, color: "#ece9e2", fontFamily: "serif" }),
      textElement({
        text: "Naissance, rencontre, mariage, anniversaire : indiquez le prénom, la date, l'heure et le lieu — nous recomposons le ciel de cet instant précis.",
        variant: "p",
        x: 180,
        y: 126,
        w: 840,
        h: 66,
        size: 15,
        color: "#9a98a8",
      }),
      {
        id: newId(),
        type: "button",
        x: 430,
        y: 228,
        w: 340,
        h: 60,
        z: 1,
        rotation: 0,
        opacity: 1,
        content: { text: "Personnaliser ma carte", href: "/create" },
        style: { bg: "#c9a86a", color: "#06070c", hoverBg: "#e3cfa4", radius: 999, size: 15 },
      },
    ],
  };

  return { sections: [before, after] };
}

/** Reject product blocks recursively so catalogue data cannot be persisted in the Boutique CMS page. */
export function hasBoutiqueProductBlocks(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasBoutiqueProductBlocks);
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.type === "product" || record.type === "productGrid") return true;
  return Object.values(record).some(hasBoutiqueProductBlocks);
}

export function isValidBoutiqueCmsPage(value: unknown): value is CmsPage {
  if (!value || typeof value !== "object") return false;
  const sections = (value as CmsPage).sections;
  if (!Array.isArray(sections) || sections.length === 0 || hasBoutiqueProductBlocks(value)) return false;
  return sections.every((section) => {
    if (!section || typeof section.id !== "string" || !Number.isFinite(section.h) || !Array.isArray(section.elements)) return false;
    return section.elements.every((element) =>
      element &&
      typeof element.id === "string" &&
      typeof element.type === "string" &&
      [element.x, element.y, element.w, element.h, element.z, element.rotation, element.opacity].every(Number.isFinite) &&
      element.content && typeof element.content === "object" &&
      element.style && typeof element.style === "object"
    );
  });
}

export function resolvePublishedBoutique(status: string, published: unknown): CmsPage | null {
  return status === "published" && isValidBoutiqueCmsPage(published) ? published : null;
}

/** Only an explicit CMS publication is returned. Drafts and invalid data leave the code page intact. */
export async function getPublishedBoutique(): Promise<CmsPage | null> {
  try {
    const row = (await db.select().from(pages).where(eq(pages.slug, "boutique")).limit(1))[0];
    return row ? resolvePublishedBoutique(row.status, row.published) : null;
  } catch {
    return null;
  }
}
