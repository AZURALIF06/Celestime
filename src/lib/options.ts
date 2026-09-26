// Célestime — catalogue commercial RÉEL (audit de www.celestime.fr).
// Produits, prix, formats et options vendus par Célestime.
// Momenterie sert uniquement de référence UX à l'éditeur : aucun de ses
// prix, formats, produits ou textes n'est repris ici.

import type {
  BackgroundId,
  OccasionId,
  ShapeId,
  SizeId,
} from "./types";

export const OCCASIONS: Record<OccasionId, { label: string; placeholder: string }> = {
  naissance: { label: "Naissance", placeholder: "Sous ce ciel, tout a commencé…" },
  rencontre: { label: "Rencontre", placeholder: "Sous ce ciel, nos chemins se sont trouvés…" },
  mariage: { label: "Mariage", placeholder: "Ce ciel-là, nous l'avons choisi pour toujours." },
  anniversaire: { label: "Anniversaire", placeholder: "Une année de plus sous le même ciel." },
  bapteme: { label: "Baptême", placeholder: "Une étoile de plus pour te guider." },
  souvenir: { label: "Souvenir", placeholder: "Ce ciel n'existera plus jamais deux fois." },
  autre: { label: "Moment précieux", placeholder: "Un moment unique, un ciel unique." },
};

export const SHAPES: { id: ShapeId; label: string; desc: string }[] = [
  { id: "medaillon", label: "Medaillon (rond)", desc: "Comme un œil tourné vers l'univers" },
  { id: "coeur", label: "Cœur", desc: "Pour les histoires d'amour" },
];

export interface BackgroundDef {
  id: BackgroundId;
  label: string;
  swatch: string;
  stops: string[]; // dégradé du poster
  skyStops: string[]; // ciel intérieur
  accent: string;
  textColor: string;
}

export const BACKGROUNDS: BackgroundDef[] = [
  {
    id: "saphir",
    label: "Saphir (bleu)",
    swatch: "linear-gradient(165deg,#16295a 0%,#0d1836 55%,#060b1c 100%)",
    stops: ["#0b1226", "#152a55", "#274b8f"],
    skyStops: ["#111c3e", "#05070f"],
    accent: "#8fb3e8",
    textColor: "#f2efe6",
  },
  {
    id: "rubis",
    label: "Rubis (rouge)",
    swatch: "linear-gradient(165deg,#b0552f 0%,#5a3028 45%,#141a2e 100%)",
    stops: ["#141a2e", "#5a3028", "#b0552f"],
    skyStops: ["#131a33", "#05070e"],
    accent: "#e8a06a",
    textColor: "#f6efe2",
  },
  {
    id: "emeraude",
    label: "Émeraude (vert)",
    swatch: "linear-gradient(165deg,#2e5c48 0%,#1d3a34 45%,#0d1a20 100%)",
    stops: ["#0d1a20", "#1d3a34", "#2e5c48"],
    skyStops: ["#0f2029", "#04090d"],
    accent: "#9fd0b5",
    textColor: "#eff6ee",
  },
];

export const SIZES: { id: SizeId; label: string; w: number; h: number; tag: string; landscape: boolean }[] = [
  { id: "A4", label: "A4", w: 21, h: 29.7, tag: "M", landscape: false },
  { id: "A3", label: "A3", w: 29.7, h: 42, tag: "L", landscape: false },
  { id: "A2", label: "A2", w: 42, h: 60, tag: "XL", landscape: false },
  { id: "A1", label: "A1", w: 80, h: 60, tag: "XXL", landscape: true },
  { id: "A0", label: "A0", w: 120, h: 80, tag: "XXXL", landscape: true },
];

export const FRAME = { label: "Cadre bois naturel", desc: "Votre création présentée avec soin, encadrée" };

export const LIMITS = { name: 40, message: 160 };
export const YEAR_MIN = 1900;
export const YEAR_MAX = 2100;
export const SHIPPING_COST = 0; // Célestime : livraison rapide et gratuite
export const FREE_SHIPPING_FROM = 0;

export interface ProductPriceTables {
  base: Partial<Record<SizeId, number>>;
  frame: Partial<Record<SizeId, number>>;
  shapeExtra?: Partial<Record<ShapeId, Partial<Record<SizeId, number>>>>;
}

export interface ProductDef {
  slug: string;
  name: string;
  fullName: string;
  tagline: string;
  description: string;
  kind: "starmap" | "coming";
  occasion: OccasionId;
  priceFrom: number;
  image: string;
  prices: ProductPriceTables;
  sizes: SizeId[];
  shapes: ShapeId[];
  backgrounds: BackgroundId[];
  framed: boolean;
  box: string[];
  rating: number;
  reviewsCount: number;
}

export const PRODUCTS: ProductDef[] = [
  {
    slug: "etoiles-de-naissance",
    name: "Étoiles de Naissance",
    fullName: "Carte du ciel de naissance personnalisée",
    tagline: "Chaque naissance a son étoile, chaque instant son ciel.",
    description:
      "Immortalisez le ciel présent au moment d'une naissance grâce à une création céleste unique et personnalisée. Indiquez le prénom, la date, l'heure et le lieu de naissance pour créer une affiche symbolique et pleine de sens. Nous créons ensuite une représentation personnalisée du ciel correspondant à cet instant précis.",
    kind: "starmap",
    occasion: "naissance",
    priceFrom: 900,
    image: "/images/naissance.jpg",
    prices: {
      base: { A4: 900, A3: 1400, A2: 3900, A1: 4900, A0: 5900 },
      frame: { A4: 2000, A3: 2000, A2: 2000, A1: 2000, A0: 3000 },
    },
    sizes: ["A4", "A3", "A2", "A1", "A0"],
    shapes: ["medaillon", "coeur"],
    backgrounds: ["saphir", "rubis", "emeraude"],
    framed: true,
    box: [
      "Carte céleste personnalisée — papier satiné 250 g",
      "Certificat d'authenticité format A4",
      "Carton d'accompagnement A6 avec votre message personnalisé",
    ],
    rating: 4.8,
    reviewsCount: 96,
  },
  {
    slug: "etoiles-de-nous-deux",
    name: "Étoiles de Nous Deux",
    fullName: "Étoiles de Nous Deux",
    tagline: "Le ciel de votre plus belle histoire, sous forme de cœur ou de medaillon.",
    description:
      "Transformez une date importante en un souvenir unique à conserver ou à offrir. Mariage, rencontre, anniversaire de couple : la carte des Étoiles de Nous Deux représente les étoiles et les constellations visibles à la date, à l'heure et au lieu indiqués, dans un cœur ou un medaillon saphir, rubis ou émeraude.",
    kind: "starmap",
    occasion: "mariage",
    priceFrom: 1400,
    image: "/images/nous-deux.jpg",
    prices: {
      base: { A4: 1400, A3: 1600 },
      frame: { A4: 2000, A3: 2000 },
      shapeExtra: { coeur: { A3: 300 } },
    },
    sizes: ["A4", "A3"],
    shapes: ["medaillon", "coeur"],
    backgrounds: ["saphir", "rubis", "emeraude"],
    framed: true,
    box: [
      "Carte céleste personnalisée — papier satiné 250 g",
      "Certificat d'authenticité format A4",
      "Carton d'accompagnement A6 avec votre message personnalisé",
    ],
    rating: 4.7,
    reviewsCount: 61,
  },
  {
    slug: "etoiles-de-rencontre",
    name: "Étoiles de Rencontre",
    fullName: "Étoiles de Rencontre",
    tagline: "Le ciel du moment où nos chemins se sont croisés.",
    description:
      "Offrez une parcelle de ciel avec un message de votre choix. La carte des Étoiles de Rencontre représente le ciel exact de votre rencontre : date, heure et lieu. Une attention idéale pour célébrer une rencontre, une demande en mariage ou un anniversaire de couple.",
    kind: "starmap",
    occasion: "rencontre",
    priceFrom: 900,
    image: "/images/rencontre.jpg",
    prices: {
      base: { A4: 900, A3: 1400 },
      frame: { A4: 2000, A3: 2000 },
    },
    sizes: ["A4", "A3"],
    shapes: ["medaillon", "coeur"],
    backgrounds: ["saphir", "rubis", "emeraude"],
    framed: true,
    box: [
      "Carte céleste personnalisée — papier satiné 250 g",
      "Certificat d'authenticité format A4",
      "Carton d'accompagnement A6 avec votre message personnalisé",
    ],
    rating: 4.9,
    reviewsCount: 44,
  },
  {
    slug: "notre-journee-a-nous",
    name: "Notre journée à nous",
    fullName: "Notre journée à nous",
    tagline: "Un jour qui vous appartient, gravé dans le ciel.",
    description:
      "Un voyage, un concert, un dîner inoubliable : transformez une date importante en un souvenir unique à conserver ou à offrir. Notre journée à nous représente le ciel de ce jour-là, à l'heure qui comptait, dans un medaillon ou un cœur saphir, rubis ou émeraude.",
    kind: "starmap",
    occasion: "souvenir",
    priceFrom: 900,
    image: "/images/journee.jpg",
    prices: {
      base: { A4: 900, A3: 1400, A2: 3900, A1: 4900, A0: 5900 },
      frame: { A4: 2000, A3: 2000, A2: 2000, A1: 2000, A0: 3000 },
    },
    sizes: ["A4", "A3", "A2", "A1", "A0"],
    shapes: ["medaillon", "coeur"],
    backgrounds: ["saphir", "rubis", "emeraude"],
    framed: true,
    box: [
      "Carte céleste personnalisée — papier satiné 250 g",
      "Certificat d'authenticité format A4",
      "Carton d'accompagnement A6 avec votre message personnalisé",
    ],
    rating: 4.8,
    reviewsCount: 27,
  },
  {
    slug: "calendrier-2027",
    name: "Calendrier 2027",
    fullName: "Calendrier Célestime 2027",
    tagline: "Les cieux de l'année, mois après mois.",
    description:
      "Le calendrier Célestime 2027 accompagne chaque mois avec les cieux et les constellations de la saison. Disponible en 29 € ou 35 € selon la version. Il rejoindra le configurateur Célestime pour une personnalisation complète.",
    kind: "coming",
    occasion: "souvenir",
    priceFrom: 2900,
    image: "/images/calendrier.jpg",
    prices: { base: {}, frame: {} },
    sizes: [],
    shapes: [],
    backgrounds: [],
    framed: false,
    box: ["Calendrier Célestime 2027", "Guide des constellations"],
    rating: 4.6,
    reviewsCount: 12,
  },
  {
    slug: "carnet-personnalise",
    name: "Carnet personnalisé",
    fullName: "Carnet personnalisé Célestime – Reliure spirale métallique",
    tagline: "Votre histoire, sous les étoiles.",
    description:
      "Le carnet personnalisé Célestime, à la reliure spirale métallique, s'accompagne d'une couverture céleste à votre nom. Dès 9 €. La personnalisation complète rejoindra le configurateur Célestime.",
    kind: "coming",
    occasion: "souvenir",
    priceFrom: 900,
    image: "/images/carnet.jpg",
    prices: { base: {}, frame: {} },
    sizes: [],
    shapes: [],
    backgrounds: [],
    framed: false,
    box: ["Carnet Célestime personnalisé", "Reliure spirale métallique"],
    rating: 4.7,
    reviewsCount: 19,
  },
  {
    slug: "recueil-de-poemes-cosmiques",
    name: "Recueil de poèmes cosmiques",
    fullName: "Recueil de poèmes cosmiques",
    description:
      "Des vers gravés dans la lumière des étoiles : le recueil de poèmes cosmiques Célestime accompagne votre carte du ciel. Dès 7 €. La personnalisation complète rejoindra le configurateur Célestime.",
    tagline: "Des vers gravés dans la lumière des étoiles.",
    kind: "coming",
    occasion: "souvenir",
    priceFrom: 700,
    image: "/images/poemes.jpg",
    prices: { base: {}, frame: {} },
    sizes: [],
    shapes: [],
    backgrounds: [],
    framed: false,
    box: ["Recueil de poèmes cosmiques", "Accordez-le à votre carte du ciel"],
    rating: 4.9,
    reviewsCount: 9,
  },
];

export function productBySlug(slug: string): ProductDef | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}
export function sizeById(id: string) {
  return SIZES.find((s) => s.id === id) ?? SIZES[0];
}
export function shapeById(id: string) {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0];
}
export function backgroundById(id: string): BackgroundDef {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
