// Célestime — modèle de contenu : PAGE → SECTIONS → ÉLÉMENTS.
// Chaque élément est positionné librement (x, y, w, h, z, rotation, opacité)
// avec des overrides responsive (desktop / tablette / mobile).

export interface CmsElement {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  content: Record<string, any>;
  style: Record<string, any>;
  link?: string;
  responsive?: {
    tablet?: Partial<{ x: number; y: number; w: number; h: number; hidden: boolean; fontSize: number }>;
    mobile?: Partial<{ x: number; y: number; w: number; h: number; hidden: boolean; fontSize: number }>;
  };
}

export interface CmsSection {
  id: string;
  h: number;
  bg?: string;
  elements: CmsElement[];
}

export interface CmsPage {
  sections: CmsSection[];
}

export const PAGE_WIDTH = 1200;
export const MIN_SIZE = 40;

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyPage(): CmsPage {
  return {
    sections: [
      { id: newId(), h: 560, bg: "radial-gradient(ellipse 90% 100% at 50% 0%, #141c3c 0%, #0a0d1c 55%, #06070c 100%)", elements: [] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Bibliothèque d'éléments (libellés, catégories, valeurs par défaut)
// ---------------------------------------------------------------------------

export interface LibraryItem {
  type: string;
  label: string;
  category: string;
  def: Omit<CmsElement, "id">;
}

const t = (
  type: string,
  label: string,
  category: string,
  def: Partial<Omit<CmsElement, "id">> = {}
): LibraryItem => ({
  type,
  label,
  category,
  def: {
    type,
    x: 60,
    y: 40,
    w: 480,
    h: 120,
    z: 1,
    rotation: 0,
    opacity: 1,
    content: {},
    style: {},
    ...def,
  } as Omit<CmsElement, "id">,
});

export const LIBRARY: LibraryItem[] = [
  // Texte
  t("text", "Titre", "Texte", { content: { text: "Votre titre Célestime", variant: "h1" }, style: { fontFamily: "serif", size: 56, weight: 600, color: "#ece9e2", align: "center" }, w: 720, h: 90 }),
  t("text", "Sous-titre", "Texte", { content: { text: "Un sous-titre élégant pour introduire votre section.", variant: "sub" }, style: { fontFamily: "sans", size: 18, weight: 400, color: "#9a98a8", align: "center" }, w: 560, h: 50 }),
  t("text", "Paragraphe", "Texte", { content: { text: "Indiquez le prénom, la date, l'heure et le lieu : nous recomposons le ciel exact de cet instant, étoiles et constellations comprises.", variant: "p" }, style: { fontFamily: "sans", size: 16, weight: 400, color: "#c9c7d2", align: "left" }, w: 520, h: 90 }),
  t("text", "Citation", "Texte", { content: { text: "« Ce ciel n'existera plus jamais exactement comme cela. »", variant: "quote" }, style: { fontFamily: "serif", size: 26, weight: 400, color: "#e3cfa4", align: "center", italic: true }, w: 640, h: 80 }),
  t("text", "Liste", "Texte", { content: { text: "Papier satiné 250 g\nCertificat d'authenticité\nCarton avec votre message", variant: "list" }, style: { fontFamily: "sans", size: 16, weight: 400, color: "#ece9e2", align: "left" }, w: 420, h: 130 }),
  // Média
  t("image", "Image", "Média", { content: { src: "/images/naissance.jpg", alt: "Création Célestime", fit: "cover", radius: 16, shadow: true, border: false }, w: 480, h: 360 }),
  t("image", "Logo", "Média", { content: { src: "/images/coffret.jpg", alt: "Célestime", fit: "contain", radius: 8, shadow: false, border: false }, w: 200, h: 80 }),
  t("video", "Vidéo YouTube", "Média", { content: { url: "https://www.youtube.com/embed/dQw4w9WgXcQ", aspect: 16 / 9 }, style: { radius: 16 }, w: 640, h: 360 }),
  t("icon", "Icône étoile", "Média", { content: { icon: "star", size: 48, color: "#c9a86a" }, w: 60, h: 60 }),
  // E-commerce
  t("product", "Produit", "E-commerce", { content: { slug: "etoiles-de-naissance" }, w: 340, h: 420 }),
  t("productGrid", "Grille de produits", "E-commerce", { content: { category: "", count: 4, title: "La collection" }, w: 1120, h: 480 }),
  t("productGrid", "Produits par catégorie", "E-commerce", { content: { category: "naissance", count: 3, title: "Naissance" }, w: 1120, h: 480 }),
  t("productGrid", "Produits similaires", "E-commerce", { content: { category: "", count: 3, title: "Vous aimerez aussi" }, w: 1120, h: 420 }),
  t("text", "Prix", "E-commerce", { content: { text: "dès 9 €", variant: "price" }, style: { fontFamily: "serif", size: 32, weight: 600, color: "#c9a86a", align: "left" }, w: 220, h: 60 }),
  t("button", "Bouton acheter", "E-commerce", { content: { text: "Personnaliser ma carte", href: "/create" }, style: { bg: "#c9a86a", color: "#06070c", hoverBg: "#e3cfa4", radius: 999, size: 15 }, w: 260, h: 56 }),
  t("text", "Avis clients", "E-commerce", { content: { text: "★★★★★ — Belle qualité d'impression et livraison rapide.", variant: "review" }, style: { fontFamily: "serif", size: 18, weight: 400, color: "#ece9e2", align: "left", italic: true }, w: 420, h: 90 }),
  t("promo", "Promotion", "E-commerce", { content: { text: "-20 % sur votre envoi", badge: "Jusqu'au 31/08" }, style: { bg: "#1d2547", radius: 20 }, w: 420, h: 120 }),
  // Navigation
  t("button", "Bouton", "Navigation", { content: { text: "Découvrir", href: "/boutique" }, style: { bg: "#c9a86a", color: "#06070c", hoverBg: "#e3cfa4", radius: 999, size: 15 }, w: 220, h: 56 }),
  t("text", "Lien", "Navigation", { content: { text: "En savoir plus", variant: "link" }, link: "/comment-ca-marche", style: { fontFamily: "sans", size: 15, weight: 500, color: "#c9a86a", align: "left" }, w: 240, h: 40 }),
  t("breadcrumb", "Fil d'Ariane", "Navigation", { content: { text: "Accueil / Boutique / Étoiles de Naissance", variant: "breadcrumb" }, style: { size: 12, color: "#6d6c7d", align: "left" }, w: 480, h: 30 }),
  // Structure
  t("divider", "Séparateur", "Structure", { content: { color: "#22263a", width: 2 }, w: 320, h: 2 }),
  t("spacer", "Espace", "Structure", { content: {}, w: 100, h: 60, hidden: false }),
  t("section", "Colonne gauche", "Structure", { content: { variant: "column", side: "left" }, w: 540, h: 100, style: { bg: "rgba(255,255,255,0.02)", radius: 20 }, x: 40 }),
  t("section", "Colonne droite", "Structure", { content: { variant: "column", side: "right" }, w: 540, h: 100, style: { bg: "rgba(255,255,255,0.02)", radius: 20 }, x: 620 }),
  t("section", "Conteneur", "Structure", { content: { variant: "container" }, w: 1120, h: 160, x: 40, style: { bg: "rgba(255,255,255,0.03)", radius: 24, border: true }, hidden: false }),
  // Marketing
  t("text", "Bannière titre", "Marketing", { content: { text: "Une parcelle de ciel, avec un message de votre choix", variant: "h2" }, style: { fontFamily: "serif", size: 42, weight: 600, color: "#ece9e2", align: "center" }, w: 900, h: 110 }),
  t("countdown", "Compte à rebours", "Marketing", { content: { date: "2026-02-14T00:00:00", label: "Saint-Valentin — -20 % jusqu'à" }, style: { size: 28, color: "#ece9e2" }, w: 560, h: 140 }),
  t("newsletter", "Newsletter", "Marketing", { content: { text: "La lettre céleste, une fois par mois." }, style: { bg: "#0c0e16", radius: 20 }, w: 520, h: 140 }),
  t("form", "Formulaire de contact", "Marketing", { content: { text: "Écrivez-nous" }, style: { bg: "#0c0e16", radius: 20 }, w: 480, h: 340 }),
  t("testimonials", "Témoignages", "Marketing", { content: { title: "Ils ont trouvé leur ciel" }, w: 1120, h: 220, x: 40 }),
  t("faq", "FAQ", "Marketing", { content: { title: "Questions fréquentes" }, w: 760, h: 320, x: 40 }),
];

export function makeElement(item: LibraryItem, x?: number, y?: number, z?: number): CmsElement {
  return { id: newId(), ...item.def, x: x ?? item.def.x, y: y ?? item.def.y, z: z ?? (item.def.z || 1) } as CmsElement;
}
