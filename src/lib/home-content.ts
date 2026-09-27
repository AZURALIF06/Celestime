import { newId, type CmsElement, type CmsPage } from "@/lib/cms";

export interface HomeEditorialContent {
  heroEyebrow: string;
  heroTitle: [string, string];
  heroParagraph: string;
  heroPrimaryButton: string;
  heroSecondaryButton: string;
  trustMentions: [string, string, string];
  heroLocationCaption: string;
  heroPreviewCaption: string;
  steps: [{ title: string; body: string }, { title: string; body: string }, { title: string; body: string }, { title: string; body: string }];
  collectionEyebrow: string;
  collectionTitle: string;
  collectionLinkLabel: string;
  giftEyebrow: string;
  giftTitle: [string, string];
  giftItems: [{ title: string; body: string }, { title: string; body: string }, { title: string; body: string }];
  giftImage: string;
  giftImageAlt: string;
  giftButtonLabel: string;
  examplesEyebrow: string;
  examplesTitle: string;
  examplesParagraph: string;
  testimonialsTitle: string;
  testimonials: [{ quote: string; author: string }, { quote: string; author: string }, { quote: string; author: string }];
  faqEyebrow: string;
  faqTitle: string;
  faq: { question: string; answer: string }[];
  finalTitle: [string, string];
  finalParagraph: string;
  finalButtonLabel: string;
}

/** The exact editorial copy currently rendered by /, retained as the safe fallback and CMS seed. */
export const DEFAULT_HOME_CONTENT: HomeEditorialContent = {
  heroEyebrow: "Célestime · cartes du ciel personnalisées",
  heroTitle: ["Chaque naissance a son étoile,", "chaque instant son ciel."],
  heroParagraph:
    "Avec Célestime, offrez la beauté du moment où tout a commencé. Indiquez le prénom, la date, l'heure et le lieu : nous recomposons le ciel exact de cet instant, sur papier satiné 250 g, dans un medaillon ou un cœur saphir, rubis ou émeraude.",
  heroPrimaryButton: "Personnaliser ma carte",
  heroSecondaryButton: "Découvrir la boutique",
  trustMentions: ["★ 4,8/5 — avis vérifiés", "Offert : certificat d'authenticité", "Livraison rapide et gratuite"],
  heroLocationCaption: "Cannes · 25 février 2025",
  heroPreviewCaption: "Aperçu réel",
  steps: [
    { title: "Votre moment", body: "Indiquez le prénom, la date, l'heure et le lieu : naissance, rencontre, mariage, anniversaire…" },
    { title: "Votre ciel", body: "Nous créons une représentation personnalisée du ciel correspondant à cet instant précis. Étoiles et constellations réelles." },
    { title: "Votre création", body: "Choisissez le fond (saphir, rubis, émeraude), la forme (medaillon ou cœur), le format A4 à A0 et le cadre." },
    { title: "Votre coffret", body: "Carte sur papier satiné 250 g, certificat d'authenticité A4, carton d'accompagnement A6 avec votre message." },
  ],
  collectionEyebrow: "La collection",
  collectionTitle: "Des cieux pour chaque moment",
  collectionLinkLabel: "Tout voir →",
  giftEyebrow: "Le coffret cadeau",
  giftTitle: ["Offert : un coffret,", "pas juste une affiche."],
  giftItems: [
    { title: "Une carte céleste personnalisée", body: "Le ciel exact du moment choisi, sous une forme ronde comme un œil tourné vers l'univers — ou en cœur — sur papier satiné 250 g, format A4 à A0, en option dans un cadre." },
    { title: "Un certificat d'authenticité", body: "Format A4 (29,7 × 21 cm), avec le nom, la date, le lieu et le numéro d'enregistrement de votre création." },
    { title: "Un carton d'accompagnement", body: "Format A6 (10,5 × 14,8 cm) portant votre message personnalisé, pour marquer ce moment unique." },
  ],
  giftImage: "/images/naissance.jpg",
  giftImageAlt: "Le coffret Célestime : carte du ciel encadrée, certificat d'authenticité et carton d'accompagnement",
  giftButtonLabel: "Voir la carte de naissance",
  examplesEyebrow: "Exemples de créations",
  examplesTitle: "Composés en direct par le configurateur",
  examplesParagraph: "Ces trois cartes sont recomposées en ce moment même par le moteur Célestime, à partir du catalogue des étoiles réelles de chaque date et lieu.",
  testimonialsTitle: "Ils ont trouvé leur ciel",
  testimonials: [
    { quote: "« Le site est clair, la livraison a été rapide et les produits correspondent parfaitement aux photos. Je recommande sans hésiter. »", author: "Cliente vérifiée" },
    { quote: "« Belle qualité d'impression et livraison rapide. Le cadre est un peu plus clair que sur les photos, mais le résultat reste superbe. »", author: "Client vérifié" },
    { quote: "« Très joli rendu, bien emballé. Petit délai supplémentaire à cause de la personnalisation, mais ça valait la peine d'attendre. »", author: "Cliente vérifiée" },
  ],
  faqEyebrow: "Questions fréquentes",
  faqTitle: "Avant de créer votre ciel",
  faq: [
    { question: "Que représente la carte du ciel ?", answer: "La carte du ciel représente les étoiles et les constellations visibles à la date, à l'heure et au lieu indiqués. Elle permet de garder un souvenir symbolique d'un moment important. Notre moteur recompose ce firmament à partir du catalogue des étoiles réelles : aucune image générique." },
    { question: "Quelles informations dois-je fournir ?", answer: "Vous devez renseigner le prénom, la date de naissance, l'heure de naissance et le lieu de naissance. Vous pouvez également ajouter un message personnalisé, qui apparaît sur la carte et sur le carton d'accompagnement du coffret." },
    { question: "Dois-je connaître l'heure exacte de naissance ?", answer: "L'heure exacte est recommandée pour créer une carte la plus précise possible. Si vous ne la connaissez pas, vous pouvez indiquer une heure approximative : elle sera estimée à midi local et clairement signalée comme telle sur la carte. Nous ne présentons jamais une heure estimée comme exacte." },
    { question: "Puis-je ajouter un message personnalisé ?", answer: "Oui, vous pouvez ajouter un prénom, une date, une phrase ou un message personnel afin de rendre votre création encore plus unique." },
    { question: "Cette création est-elle réservée aux enfants ?", answer: "Non. Elle peut être créée pour un bébé ou un enfant, mais aussi pour un adulte, un couple ou toute personne importante. Elle convient pour une naissance, un anniversaire, un baptême, un mariage, une rencontre ou toute autre occasion spéciale." },
    { question: "Est-ce une bonne idée de cadeau ?", answer: "Oui. La carte du ciel est un cadeau original, personnalisé et rempli de sens. Le coffret — carte, certificat d'authenticité et carton d'accompagnement avec votre message — en fait une attention idéale pour une naissance, un mariage ou une rencontre." },
    { question: "Où puis-je l'installer ?", answer: "Vous pouvez l'encadrer et l'installer dans une chambre d'enfant, une chambre parentale, un salon, un bureau ou tout autre espace de votre intérieur. Chaque pièce peut être encadrée, présentée et offerte comme un véritable objet d'art." },
    { question: "Comment choisir ma carte ?", answer: "Choisissez le fond du poster (saphir, rubis ou émeraude), la forme du ciel (medaillon ou cœur) et le format (A4 à A0), avec ou sans cadre. Renseignez ensuite le prénom, la date, l'heure et le lieu, puis validez votre commande. La prévisualisation se met à jour en temps réel." },
  ],
  finalTitle: ["Un moment unique,", "un ciel unique."],
  finalParagraph: "Transformez une date importante en un souvenir unique à conserver ou à offrir — avec son certificat d'authenticité et votre message.",
  finalButtonLabel: "Personnaliser ma carte",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function validImageSource(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (value.startsWith("/")) {
    return !value.startsWith("//") && (/^\/(?:images|media|api\/media)\/[a-zA-Z0-9._~!$&'()*+,;=:@%/-]+(?:\?[a-zA-Z0-9._~!$&'()*+,;=:@%/?-]*)?$/.test(value));
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringTuple(value: unknown, length: number): value is string[] {
  return Array.isArray(value) && value.length === length && value.every(nonEmptyString);
}

function isTextPairArray(value: unknown, length: number): value is { title: string; body: string }[] {
  return Array.isArray(value) && value.length === length && value.every((item) =>
    isRecord(item) && hasKeys(item, ["title", "body"]) && nonEmptyString(item.title) && nonEmptyString(item.body)
  );
}

function hasValidHomeContent(value: unknown): value is HomeEditorialContent {
  if (!isRecord(value)) return false;
  const keys = [
    "heroEyebrow", "heroTitle", "heroParagraph", "heroPrimaryButton", "heroSecondaryButton", "trustMentions",
    "heroLocationCaption", "heroPreviewCaption", "steps", "collectionEyebrow", "collectionTitle", "collectionLinkLabel",
    "giftEyebrow", "giftTitle", "giftItems", "giftImage", "giftImageAlt", "giftButtonLabel", "examplesEyebrow",
    "examplesTitle", "examplesParagraph", "testimonialsTitle", "testimonials", "faqEyebrow", "faqTitle", "faq",
    "finalTitle", "finalParagraph", "finalButtonLabel",
  ];
  if (!hasKeys(value, keys)) return false;

  const simpleStrings = [
    value.heroEyebrow, value.heroParagraph, value.heroPrimaryButton, value.heroSecondaryButton,
    value.heroLocationCaption, value.heroPreviewCaption, value.collectionEyebrow, value.collectionTitle,
    value.collectionLinkLabel, value.giftEyebrow, value.giftImageAlt, value.giftButtonLabel,
    value.examplesEyebrow, value.examplesTitle, value.examplesParagraph, value.testimonialsTitle,
    value.faqEyebrow, value.faqTitle, value.finalParagraph, value.finalButtonLabel,
  ];
  if (!simpleStrings.every(nonEmptyString)) return false;
  if (!validImageSource(value.giftImage)) return false;
  if (!isStringTuple(value.heroTitle, 2) || !isStringTuple(value.giftTitle, 2) || !isStringTuple(value.finalTitle, 2)) return false;
  if (!isStringTuple(value.trustMentions, 3) || !isTextPairArray(value.steps, 4) || !isTextPairArray(value.giftItems, 3)) return false;
  if (!Array.isArray(value.testimonials) || value.testimonials.length !== 3 || !value.testimonials.every((item) =>
    isRecord(item) && hasKeys(item, ["quote", "author"]) && nonEmptyString(item.quote) && nonEmptyString(item.author)
  )) return false;
  if (!Array.isArray(value.faq) || value.faq.length !== DEFAULT_HOME_CONTENT.faq.length || !value.faq.every((item) =>
    isRecord(item) && hasKeys(item, ["question", "answer"]) && nonEmptyString(item.question) && nonEmptyString(item.answer)
  )) return false;
  return true;
}

export function createHomeCmsPage(content: HomeEditorialContent = DEFAULT_HOME_CONTENT): CmsPage {
  const element: CmsElement = {
    id: newId(),
    type: "homeEditorial",
    x: 0,
    y: 0,
    w: 1200,
    h: 1,
    z: 1,
    rotation: 0,
    opacity: 1,
    content: JSON.parse(JSON.stringify(content)) as HomeEditorialContent,
    style: {},
  };
  return { sections: [{ id: newId(), h: 1, bg: "transparent", elements: [element] }] };
}

export function extractHomeContent(value: unknown): HomeEditorialContent | null {
  if (!isRecord(value) || !Array.isArray(value.sections) || value.sections.length !== 1) return null;
  const section = value.sections[0];
  if (!isRecord(section) || !Array.isArray(section.elements) || section.elements.length !== 1) return null;
  const element = section.elements[0];
  if (!isRecord(element) || element.type !== "homeEditorial" || !isRecord(element.content)) return null;
  return hasValidHomeContent(element.content) ? element.content : null;
}

export function isValidHomeCmsPage(value: unknown): value is CmsPage {
  if (!isRecord(value) || !Array.isArray(value.sections) || value.sections.length !== 1) return false;
  const section = value.sections[0];
  if (!isRecord(section) || typeof section.id !== "string" || !Number.isFinite(section.h) || !Array.isArray(section.elements) || section.elements.length !== 1) return false;
  const element = section.elements[0];
  if (!isRecord(element) || typeof element.id !== "string" || element.type !== "homeEditorial") return false;
  if (![element.x, element.y, element.w, element.h, element.z, element.rotation, element.opacity].every(Number.isFinite)) return false;
  if (!isRecord(element.style) || !hasValidHomeContent(element.content)) return false;
  return true;
}

export function resolvePublishedHome(status: string, published: unknown): HomeEditorialContent | null {
  if (status !== "published" || !isValidHomeCmsPage(published)) return null;
  return extractHomeContent(published);
}
