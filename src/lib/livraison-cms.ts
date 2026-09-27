import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { newId, type CmsElement, type CmsPage, type CmsSection } from "@/lib/cms";

export const LIVRAISON_CONTENT_ROLES = [
  { headingRole: "shippingHeading", bodyRole: "shippingBody" },
  { headingRole: "delaysHeading", bodyRole: "delaysBody" },
  { headingRole: "packagingHeading", bodyRole: "packagingBody" },
  { headingRole: "damagedHeading", bodyRole: "damagedBody" },
] as const;

function textElement(
  role: string,
  text: string,
  variant: string,
  x: number,
  y: number,
  w: number,
  h: number,
  style: Record<string, unknown>,
  link?: string,
): CmsElement {
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
    content: { role, text, variant },
    style,
    ...(link ? { link } : {}),
  };
}

function section(h: number, elements: CmsElement[]): CmsSection {
  return { id: newId(), h, bg: "transparent", elements };
}

/** Initial content is copied verbatim from the existing Livraison page. */
export function createLivraisonCmsPage(): CmsPage {
  const content = [
    {
      headingRole: "shippingHeading",
      heading: "Livraison",
      bodyRole: "shippingBody",
      body: "Livraison rapide et gratuite. Chaque création est préparée avec soin dans son coffret — carte, certificat d'authenticité et carton d'accompagnement — et expédiée avec numéro de suivi. Des points de retrait (Chronopost) peuvent être proposés à l'expédition.",
    },
    {
      headingRole: "delaysHeading",
      heading: "Délais",
      bodyRole: "delaysBody",
      body: "Petite délai supplémentaire possible à cause de la personnalisation : chaque carte est réalisée à la main à partir de votre moment précis, puis vérifiée avant expédition. Formats A1 et A0 : transport rigide surdimensionné.",
    },
    {
      headingRole: "packagingHeading",
      heading: "Emballage",
      bodyRole: "packagingBody",
      body: "Colis rigide adapté au format, calage soigné. Le coffret cadeau (carte, certificat d'authenticité A4, carton d'accompagnement A6 avec votre message) est inclus.",
    },
    {
      headingRole: "damagedHeading",
      heading: "Colis endommagé",
      bodyRole: "damagedBody",
      body: "Signalez tout dommage sous 48 h avec photos : refabrication prioritaire, sans frais.",
    },
  ];

  const sections = content.map(({ headingRole, heading, bodyRole, body }, index) =>
    section(index === 0 ? 370 : index === content.length - 1 ? 225 : 190, [
      ...(index === 0
        ? [
            textElement("legalEyebrow", "Informations légales", "sub", 0, 0, 1120, 24, {
              fontFamily: "sans", size: 11, weight: 400, color: "#c9a86a", align: "left", letterSpacing: 3.3,
            }),
            textElement("legalTitle", "Livraison", "h1", 0, 34, 1120, 60, {
              fontFamily: "serif", size: 48, weight: 600, color: "#ece9e2", align: "left",
            }),
            textElement("updatedLabel", "Dernière mise à jour :", "p", 0, 98, 1120, 22, {
              fontFamily: "sans", size: 12, weight: 400, color: "#6d6c7d", align: "left",
            }),
            textElement("updatedValue", "janvier 2025", "p", 0, 122, 1120, 22, {
              fontFamily: "sans", size: 12, weight: 400, color: "#6d6c7d", align: "left",
            }),
          ]
        : []),
      textElement(headingRole, heading, "h2", 0, index === 0 ? 164 : 10, 1120, 40, {
        fontFamily: "serif", size: 24, weight: 600, color: "#ece9e2", align: "left",
      }),
      textElement(bodyRole, body, "p", 0, index === 0 ? 216 : 58, 1120, index === 0 ? 140 : 112, {
        fontFamily: "sans", size: 14, weight: 400, color: "#9a98a8", align: "left", lineHeight: 1.625,
      }),
      ...(index === content.length - 1
        ? [textElement("legalContact", "Une question sur ces conditions ? Contactez-nous.", "link", 0, 178, 1120, 34, {
            fontFamily: "sans", size: 14, weight: 400, color: "#c9a86a", align: "left",
          }, "/contact")]
        : []),
    ]),
  );

  return { sections };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function livraisonRole(page: CmsPage, role: string): CmsElement | null {
  const matches = page.sections.flatMap((item) => item.elements).filter((element) => element.content?.role === role);
  return matches.length === 1 ? matches[0] : null;
}

/** Only a complete, structurally valid legal page is eligible for public CMS rendering. */
export function isValidLivraisonCmsPage(value: unknown): value is CmsPage {
  if (!isRecord(value) || !Array.isArray(value.sections) || value.sections.length === 0) return false;
  for (const section of value.sections) {
    if (!isRecord(section) || typeof section.id !== "string" || !Number.isFinite(section.h) || !Array.isArray(section.elements)) return false;
    for (const element of section.elements) {
      if (!isRecord(element) || typeof element.id !== "string" || element.type !== "text") return false;
      if (![element.x, element.y, element.w, element.h, element.z, element.rotation, element.opacity].every(Number.isFinite)) return false;
      if (!isRecord(element.content) || !isRecord(element.style)) return false;
    }
  }

  const page = value as unknown as CmsPage;
  const textRoles = [
    "legalEyebrow",
    "legalTitle",
    "updatedLabel",
    "updatedValue",
    "legalContact",
    ...LIVRAISON_CONTENT_ROLES.flatMap(({ headingRole, bodyRole }) => [headingRole, bodyRole]),
  ];
  for (const role of textRoles) {
    const element = livraisonRole(page, role);
    if (element?.type !== "text" || typeof element.content.text !== "string" || !element.content.text.trim()) return false;
    const expectedVariant = role === "legalTitle" ? "h1"
      : role === "legalEyebrow" ? "sub"
      : role === "legalContact" ? "link"
      : LIVRAISON_CONTENT_ROLES.some(({ headingRole }) => headingRole === role) ? "h2" : "p";
    if (element.content.variant !== expectedVariant) return false;
  }
  const contact = livraisonRole(page, "legalContact");
  return typeof contact?.link === "string" && contact.link.startsWith("/");
}

export function resolvePublishedLivraison(status: string, published: unknown): CmsPage | null {
  return status === "published" && isValidLivraisonCmsPage(published) ? published : null;
}

/** Database errors, drafts, and incomplete documents preserve the original legal page. */
export async function getPublishedLivraison(): Promise<CmsPage | null> {
  try {
    const row = (await db.select().from(pages).where(eq(pages.slug, "livraison")).limit(1))[0];
    return row ? resolvePublishedLivraison(row.status, row.published) : null;
  } catch {
    return null;
  }
}
