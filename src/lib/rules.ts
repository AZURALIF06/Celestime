// Célestime — moteur de règles centralisé.
// Seules les options réellement vendues par Célestime sont exposées ;
// chaque produit définit ses propres formats, formes et fonds.

import { LIMITS, YEAR_MIN, YEAR_MAX, productBySlug } from "./options";
import type { BackgroundId, CreationConfig, GeocodeResult, RuleNote, ShapeId, SizeId } from "./types";

export interface RuleResult {
  config: CreationConfig;
  notes: RuleNote[];
}

function firstOf<T>(list: T[]): T {
  return list[0];
}

/** Applique les contraintes du produit (formats, formes, fonds, cadre). */
export function applyRules(config: CreationConfig): RuleResult {
  const notes: RuleNote[] = [];
  const c: CreationConfig = { ...config };
  const p = productBySlug(c.productId);

  if (p) {
    if (p.sizes.length > 0 && !p.sizes.includes(c.size)) {
      c.size = firstOf(p.sizes);
      notes.push({ type: "info", message: `Ce produit est proposé des formats ${p.sizes.join(" à ")} — format ${c.size} appliqué.` });
    }
    if (p.shapes.length > 0 && !p.shapes.includes(c.shape)) {
      c.shape = firstOf(p.shapes);
      notes.push({ type: "info", message: `Forme « ${c.shape === "medaillon" ? "Medaillon" : "Cœur"} » appliquée, disponible pour ce produit.` });
    }
    if (p.backgrounds.length > 0 && !p.backgrounds.includes(c.background)) {
      c.background = firstOf(p.backgrounds);
      notes.push({ type: "info", message: "Fond ajusté aux fonds proposés pour ce produit." });
    }
    if (!p.framed && c.framed) {
      c.framed = false;
      notes.push({ type: "info", message: "Le cadre n'est pas disponible pour ce produit." });
    }
    c.occasion = p.occasion;
  }

  // Longueurs — zone imprimable
  c.name = (c.name ?? "").slice(0, LIMITS.name);
  c.message = (c.message ?? "").slice(0, LIMITS.message);
  c.quantity = Math.min(20, Math.max(1, Math.round(c.quantity || 1)));

  return { config: c, notes };
}

/** Validation complète avant ajout au panier / checkout. */
export function validateConfig(config: CreationConfig): Record<string, string> {
  const errors: Record<string, string> = {};
  const d = parseInt(config.day, 10);
  const m = parseInt(config.month, 10);
  const y = parseInt(config.year, 10);

  if (!config.day || !config.month || !config.year) {
    errors.date = "Veuillez renseigner la date complète.";
  } else if (isNaN(d) || isNaN(m) || isNaN(y) || y < YEAR_MIN || y > YEAR_MAX) {
    errors.date = `Cette date est hors de la plage supportée (${YEAR_MIN} – ${YEAR_MAX}).`;
  } else {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      errors.date = "Cette date est impossible. Vérifiez le jour et le mois.";
    }
    if (dt > new Date()) {
      errors.date = "Votre Célestime reconstitue un ciel déjà passé. Choisissez une date antérieure à aujourd'hui.";
    }
  }

  if (!config.timeApprox) {
    if (config.hour === "" || config.minute === "") {
      errors.time = "Veuillez renseigner l'heure, ou cocher « Je ne connais pas l'heure exacte ».";
    } else {
      const h = parseInt(config.hour, 10);
      const mi = parseInt(config.minute, 10);
      if (isNaN(h) || isNaN(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) {
        errors.time = "Cette heure est invalide. Utilisez le format HH:MM.";
      }
    }
  }

  if (!config.location) errors.location = "Veuillez rechercher et choisir une ville.";
  if (!config.name.trim()) errors.name = "Indiquez un nom, un prénom ou un surnom.";
  return errors;
}

/** Normalise un config reçu (panier/checkout/édition), tolérant aux brouillons
 *  d'anciennes versions. Retourne null si illisible. */
export function normalizeConfig(raw: unknown): CreationConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const str = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
  const num = (v: unknown, min: number, max: number, fallback: number) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
    return isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
  };
  const pick = (v: unknown, list: string[], fallback: string) =>
    typeof v === "string" && list.includes(v) ? v : fallback;

  const loc = (r.location ?? null) as GeocodeResult | null;
  const location: GeocodeResult | null =
    loc &&
    typeof loc === "object" &&
    typeof loc.name === "string" &&
    typeof loc.country === "string" &&
    typeof loc.latitude === "number" &&
    typeof loc.longitude === "number" &&
    Math.abs(loc.latitude) <= 90 &&
    Math.abs(loc.longitude) <= 180
      ? {
          name: loc.name.slice(0, 60),
          country: loc.country.slice(0, 60),
          latitude: loc.latitude,
          longitude: loc.longitude,
          timezone: typeof loc.timezone === "string" && loc.timezone.length <= 40 ? loc.timezone : "UTC",
        }
      : null;

  const p = productBySlug(str(r.productId, 60));
  const config: CreationConfig = {
    productId: p ? p.slug : "etoiles-de-naissance",
    occasion: p?.occasion ?? "naissance",
    name: str(r.name ?? r.recipient, LIMITS.name),
    message: str(r.message, LIMITS.message),
    day: str(r.day, 2),
    month: str(r.month, 2),
    year: str(r.year, 4),
    hour: str(r.hour, 2),
    minute: str(r.minute, 2),
    timeApprox: r.timeApprox === true || r.timeUnknown === true,
    location,
    background: pick(r.background, ["saphir", "rubis", "emeraude"], "saphir") as BackgroundId,
    shape: (pick(r.shape, ["medaillon", "coeur"], r.shape === "round" ? "medaillon" : "medaillon") as ShapeId),
    framed: r.framed === true || r.support === "framed",
    size: pick(r.size, ["A4", "A3", "A2", "A1", "A0"], "A4") as SizeId,
    quantity: num(r.quantity, 1, 20, 1),
  };
  return applyRules(config).config;
}
