import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { newId, type CmsElement, type CmsPage, type CmsSection } from "@/lib/cms";

export const COMMENT_CA_MARCHE_STEP_ROLES = [
  { number: "01", numberRole: "step01Number", titleRole: "step01Title", bodyRole: "step01Body" },
  { number: "02", numberRole: "step02Number", titleRole: "step02Title", bodyRole: "step02Body" },
  { number: "03", numberRole: "step03Number", titleRole: "step03Title", bodyRole: "step03Body" },
  { number: "04", numberRole: "step04Number", titleRole: "step04Title", bodyRole: "step04Body" },
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
  };
}

function section(h: number, elements: CmsElement[]): CmsSection {
  return { id: newId(), h, bg: "transparent", elements };
}

/** Initial editorial data mirrors the existing /comment-ca-marche page verbatim. */
export function createCommentCaMarcheCmsPage(): CmsPage {
  const steps = [
    {
      number: "01",
      title: "Vous racontez le moment",
      body: "Occasion, date, heure locale, ville. Le géocodeur localise votre lieu avec ses coordonnées exactes et son fuseau horaire (heure d'été comprise). Si vous ignorez l'heure, dites-le nous : elle sera estimée et explicitement présentée comme telle.",
    },
    {
      number: "02",
      title: "Nous recomposons le ciel",
      body: "Le moteur céleste calcule le temps sidéral local, puis la position d'environ 1 400 étoiles réelles du catalogue Yale (V ≤ 4,9) : altitude, azimut, teinte selon la température de chaque étoile. Constellations, plan galactique de la Voie lactée : tout est positionnellement exact pour l'instant choisi.",
    },
    {
      number: "03",
      title: "Vous composez l'œuvre",
      body: "Dix designs, huit fonds, trois formes, typographies, couleurs, message. La prévisualisation se met à jour à chaque clic ; les règles de compatibilité s'appliquent avec explication (finitions métallisées, fonds clairs, etc.).",
    },
    {
      number: "04",
      title: "Nous préparons votre coffret",
      body: "Votre carte est imprimée sur papier satiné 250 g au format exact choisi (A4 à A0), vérifiée à la main, présentée avec soin et, en option, dans un cadre. Le coffret contient aussi le certificat d'authenticité A4 et le carton d'accompagnement A6 avec votre message.",
    },
  ];

  const stepSections = steps.map((step, index) => {
    const roles = COMMENT_CA_MARCHE_STEP_ROLES[index];
    return section(164, [
      textElement(roles.numberRole, step.number, "p", 24, 42, 80, 72, {
        fontFamily: "serif", size: 48, weight: 400, color: "rgba(201,168,106,0.4)", align: "center",
      }),
      textElement(roles.titleRole, step.title, "h2", 120, 34, 1020, 38, {
        fontFamily: "sans", size: 18, weight: 500, color: "#ece9e2", align: "left",
      }),
      textElement(roles.bodyRole, step.body, "p", 120, 78, 1020, 74, {
        fontFamily: "sans", size: 14, weight: 400, color: "#9a98a8", align: "left", lineHeight: 1.625,
      }),
    ]);
  });

  const cta: CmsElement = {
    id: newId(),
    type: "button",
    x: 320,
    y: 18,
    w: 560,
    h: 72,
    z: 1,
    rotation: 0,
    opacity: 1,
    content: { role: "finalCta", text: "Créer ma carte du ciel", href: "/create" },
    style: { bg: "#c9a86a", color: "#06070c", hoverBg: "#e3cfa4", radius: 999, size: 15 },
  };

  return {
    sections: [
      section(184, [
        textElement("kicker", "Comment ça marche", "sub", 100, 10, 1000, 24, {
          fontFamily: "sans", size: 11, weight: 400, color: "#c9a86a", align: "center", letterSpacing: 3.3,
        }),
        textElement("mainTitle", "De votre moment\nà votre œuvre", "h1", 100, 48, 1000, 116, {
          fontFamily: "serif", size: 48, weight: 400, color: "#ece9e2", align: "center",
        }),
      ]),
      ...stepSections,
      section(254, [
        textElement("technicalTitle", "La chaîne technique", "p", 80, 18, 1040, 22, {
          fontFamily: "sans", size: 11, weight: 400, color: "#c9a86a", align: "left", letterSpacing: 2.64,
        }),
        textElement(
          "technicalPrimary",
          "Vos informations (prénom, date, heure, lieu, message) → géocodage (ville, latitude, longitude, fuseau) → données astronomiques (catalogue réel) → calcul du ciel (temps sidéral, alt/az) → moteur de rendu (fond, forme, textes) → prévisualisation → fichier d'impression au format exact",
          "p",
          50,
          62,
          1100,
          110,
          { fontFamily: "sans", size: 12, weight: 400, color: "#9a98a8", align: "center", lineHeight: 1.625 },
        ),
        textElement(
          "technicalSecondary",
          "Les données astronomiques restent strictement séparées de l'interface commerciale : aucune donnée n'est inventée, aucun prix n'est calculé côté navigateur.",
          "p",
          60,
          184,
          1080,
          48,
          { fontFamily: "sans", size: 12, weight: 400, color: "#6d6c7d", align: "center", lineHeight: 1.625 },
        ),
      ]),
      section(112, [cta]),
    ],
  };
}

const TEXT_ROLES = [
  "kicker",
  "mainTitle",
  "technicalTitle",
  "technicalPrimary",
  "technicalSecondary",
  ...COMMENT_CA_MARCHE_STEP_ROLES.flatMap(({ numberRole, titleRole, bodyRole }) => [numberRole, titleRole, bodyRole]),
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function commentCaMarcheRole(page: CmsPage, role: string): CmsElement | null {
  const matches = page.sections.flatMap((item) => item.elements).filter((element) => element.content?.role === role);
  return matches.length === 1 ? matches[0] : null;
}

/** Ensure every essential editorial field is present before allowing the public CMS renderer to use the page. */
export function isValidCommentCaMarcheCmsPage(value: unknown): value is CmsPage {
  if (!isRecord(value) || !Array.isArray(value.sections) || value.sections.length === 0) return false;
  const sections = value.sections;
  for (const item of sections) {
    if (!isRecord(item) || typeof item.id !== "string" || !Number.isFinite(item.h) || !Array.isArray(item.elements)) return false;
    for (const element of item.elements) {
      if (!isRecord(element) || typeof element.id !== "string" || typeof element.type !== "string") return false;
      if (![element.x, element.y, element.w, element.h, element.z, element.rotation, element.opacity].every(Number.isFinite)) return false;
      if (!isRecord(element.content) || !isRecord(element.style)) return false;
    }
  }

  const page = value as unknown as CmsPage;
  for (const role of TEXT_ROLES) {
    const element = commentCaMarcheRole(page, role);
    if (element?.type !== "text" || typeof element.content.text !== "string" || !element.content.text.trim()) return false;
  }
  for (const { number, numberRole } of COMMENT_CA_MARCHE_STEP_ROLES) {
    if (commentCaMarcheRole(page, numberRole)?.content.text !== number) return false;
  }
  const cta = commentCaMarcheRole(page, "finalCta");
  return cta?.type === "button" && typeof cta.content.text === "string" && !!cta.content.text.trim() &&
    typeof cta.content.href === "string" && cta.content.href.startsWith("/");
}

export function resolvePublishedCommentCaMarche(status: string, published: unknown): CmsPage | null {
  return status === "published" && isValidCommentCaMarcheCmsPage(published) ? published : null;
}

/** Query errors, drafts, and malformed pages all leave the current code page as public fallback. */
export async function getPublishedCommentCaMarche(): Promise<CmsPage | null> {
  try {
    const row = (await db.select().from(pages).where(eq(pages.slug, "comment-ca-marche")).limit(1))[0];
    return row ? resolvePublishedCommentCaMarche(row.status, row.published) : null;
  } catch {
    return null;
  }
}
