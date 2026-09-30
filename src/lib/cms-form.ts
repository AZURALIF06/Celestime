// Célestime — Phase 3C : modèle de formulaire CMS et validation serveur.
//
// Ce module est volontairement dépourvu de toute dépendance runtime (ni "@/…",
// ni package externe) afin d'être importable tel quel par le runner de tests
// Node (`node --experimental-strip-types`) comme par le bundle Next.js.
// Les types Phase 3B ne sont importés qu'en `import type`, effacé à la
// compilation : le document CMS reste la source de vérité unique.

import type { CmsElement, CmsPage } from "./cms";

export const CMS_FORM_FIELD_KEYS = ["name", "email", "phone", "subject", "message"] as const;
export type CmsFormFieldKey = (typeof CMS_FORM_FIELD_KEYS)[number];

export type CmsFormFieldType = "name" | "email" | "phone" | "subject" | "message";

export interface CmsFormFieldConfig {
  key: CmsFormFieldKey;
  type: CmsFormFieldType;
  label: string;
  enabled: boolean;
  required: boolean;
  placeholder: string;
  rows: number;
}

export interface CmsFormConfig {
  title: string;
  description: string;
  fields: CmsFormFieldConfig[];
  submitLabel: string;
  successMessage: string;
  errorMessage: string;
}

/** Limites serveur. Toute valeur qui les dépasse est refusée, jamais tronquée en silence. */
export const CMS_FORM_LIMITS = {
  name: { min: 2, max: 120 },
  email: { max: 254 },
  phone: { max: 32 },
  subject: { max: 200 },
  message: { min: 1, max: 5000 },
  title: { max: 200 },
  description: { max: 2000 },
  label: { max: 120 },
  placeholder: { max: 200 },
  messageRows: { min: 3, max: 20 },
} as const;

const DEFAULT_FIELDS: CmsFormFieldConfig[] = [
  { key: "name", type: "name", label: "Votre nom", enabled: true, required: true, placeholder: "Camille Dupont", rows: 1 },
  { key: "email", type: "email", label: "Votre e-mail", enabled: true, required: true, placeholder: "camille@exemple.fr", rows: 1 },
  { key: "phone", type: "phone", label: "Téléphone", enabled: false, required: false, placeholder: "06 00 00 00 00", rows: 1 },
  { key: "subject", type: "subject", label: "Sujet", enabled: false, required: false, placeholder: "Votre demande", rows: 1 },
  { key: "message", type: "message", label: "Votre message", enabled: true, required: true, placeholder: "Racontez-nous votre moment…", rows: 5 },
];

export const CMS_FORM_DEFAULTS: Readonly<CmsFormConfig> = Object.freeze({
  title: "Écrivez-nous",
  description: "",
  submitLabel: "Envoyer",
  successMessage: "Merci ! Votre message a bien été envoyé.",
  errorMessage: "Votre message n’a pas pu être envoyé. Merci de réessayer.",
  fields: DEFAULT_FIELDS,
});

const FIELD_TYPE_BY_KEY: Readonly<Record<CmsFormFieldKey, CmsFormFieldType>> = Object.freeze({
  name: "name",
  email: "email",
  phone: "phone",
  subject: "subject",
  message: "message",
});

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z]{2,}$/;
const PHONE_PATTERN = /^[0-9+][0-9 ().\/\-\u00a0]{4,}$/;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const ZERO_WIDTH = /[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g;
const HTML_LIKE = /<[^>]*>/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFormFieldKey(value: unknown): value is CmsFormFieldKey {
  return typeof value === "string" && (CMS_FORM_FIELD_KEYS as readonly string[]).includes(value);
}

/**
 * Normalise une saisie utilisateur : Unicode NFKC, suppression des caractères
 * de contrôle / largeur nulle, neutralisation des balises, espaces compactés.
 * Le résultat est du texte brut : le CMS ne l'injecte jamais en HTML.
 */
export function sanitizeCmsFormText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(ZERO_WIDTH, "")
    .replace(HTML_LIKE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Variante multi-ligne : conserve les retours à la ligne, retire les espaces en bout de ligne. */
export function sanitizeCmsFormMultiline(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, " ")
    .replace(ZERO_WIDTH, "")
    .replace(HTML_LIKE, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

export function normalizeCmsFormField(value: unknown): CmsFormFieldConfig | null {
  const fallback = CMS_FORM_DEFAULTS.fields.find((field) => field.key === (isRecord(value) ? value.key : undefined));
  if (!isRecord(value) || !isFormFieldKey(value.key)) return null;
  const label = typeof value.label === "string" ? sanitizeCmsFormText(value.label, CMS_FORM_LIMITS.label.max) : fallback!.label;
  const placeholder = typeof value.placeholder === "string"
    ? sanitizeCmsFormText(value.placeholder, CMS_FORM_LIMITS.placeholder.max)
    : fallback!.placeholder;
  const rows = Number.isFinite(value.rows)
    ? Math.max(CMS_FORM_LIMITS.messageRows.min, Math.min(CMS_FORM_LIMITS.messageRows.max, Math.round(Number(value.rows))))
    : fallback!.rows;
  return {
    key: value.key,
    // Le type est dérivé de la clé : un éditeur ne peut pas déclarer « email » comme « name ».
    type: FIELD_TYPE_BY_KEY[value.key],
    label: label || fallback!.label,
    enabled: value.enabled !== false,
    required: value.required === true,
    placeholder,
    rows,
  };
}

/**
 * Configuration rendue par le renderer et appliquée par le serveur.
 * Un champ `required` est toujours `enabled` : une contrainte sans champ est
 * ignorée plutôt que rendue impossible à satisfaire.
 */
export function normalizeCmsFormConfig(content: unknown): CmsFormConfig {
  const source = isRecord(content) ? content : {};
  const fields = Array.isArray(source.fields)
    ? source.fields.map(normalizeCmsFormField).filter((field): field is CmsFormFieldConfig => field !== null)
    : [];
  const deduped: CmsFormFieldConfig[] = [];
  for (const field of fields) {
    if (deduped.some((existing) => existing.key === field.key)) continue;
    deduped.push(field);
  }
  // L'ordre du tableau EST l'ordre d'affichage : aucune clé `order` concurrente.
  const ordered: CmsFormFieldConfig[] = deduped.length ? deduped : DEFAULT_FIELDS.map((field) => ({ ...field }));
  return {
    // `text` est la propriété Phase 3B d'origine : conservée comme repli du titre.
    title: sanitizeCmsFormText(source.title ?? source.text, CMS_FORM_LIMITS.title.max) || CMS_FORM_DEFAULTS.title,
    description: sanitizeCmsFormText(source.description, CMS_FORM_LIMITS.description.max),
    fields: ordered.map((field) => (field.required && !field.enabled ? { ...field, required: false } : field)),
    submitLabel: sanitizeCmsFormText(source.submitLabel, CMS_FORM_LIMITS.label.max) || CMS_FORM_DEFAULTS.submitLabel,
    successMessage: sanitizeCmsFormText(source.successMessage, 1000) || CMS_FORM_DEFAULTS.successMessage,
    errorMessage: sanitizeCmsFormText(source.errorMessage, 1000) || CMS_FORM_DEFAULTS.errorMessage,
  };
}

/** Liste exacte des clés `content` acceptées à l'enregistrement CMS. */
export const CMS_FORM_CONTENT_KEYS = [
  "text", "title", "description", "fields", "submitLabel", "successMessage", "errorMessage",
] as const;

/**
 * Validation stricte à l'enregistrement / publication, alignée sur les
 * conventions fail-closed des autres blocs (`hasOnlyKeys` + bornes).
 */
export function isValidCmsFormContent(content: unknown): boolean {
  if (!isRecord(content)) return false;
  if (Object.keys(content).some((key) => !(CMS_FORM_CONTENT_KEYS as readonly string[]).includes(key))) return false;
  for (const key of ["text", "title", "description"] as const) {
    const value = content[key];
    if (value === undefined) continue;
    if (typeof value !== "string") return false;
    // `text` garde la borne Phase 3B (4000) : un ancien document reste valide.
    const bound = key === "text" ? 4000 : key === "description" ? CMS_FORM_LIMITS.description.max : CMS_FORM_LIMITS.title.max;
    if (value.length > bound) return false;
  }
  for (const key of ["submitLabel", "successMessage", "errorMessage"] as const) {
    const value = content[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > 1000) return false;
  }
  if (content.fields !== undefined) {
    if (!Array.isArray(content.fields) || content.fields.length > CMS_FORM_FIELD_KEYS.length) return false;
    const seen = new Set<string>();
    for (const raw of content.fields) {
      if (!isRecord(raw)) return false;
      if (Object.keys(raw).some((key) => !["key", "type", "label", "enabled", "required", "placeholder", "rows"].includes(key))) return false;
      if (!isFormFieldKey(raw.key) || seen.has(raw.key)) return false;
      if (raw.type !== undefined && raw.type !== FIELD_TYPE_BY_KEY[raw.key]) return false;
      seen.add(raw.key);
      if (raw.label !== undefined && (typeof raw.label !== "string" || raw.label.length > CMS_FORM_LIMITS.label.max)) return false;
      if (raw.placeholder !== undefined && (typeof raw.placeholder !== "string" || raw.placeholder.length > CMS_FORM_LIMITS.placeholder.max)) return false;
      if (raw.enabled !== undefined && typeof raw.enabled !== "boolean") return false;
      if (raw.required !== undefined && typeof raw.required !== "boolean") return false;
      if (raw.rows !== undefined && (typeof raw.rows !== "number" || !Number.isInteger(raw.rows) || raw.rows < CMS_FORM_LIMITS.messageRows.min || raw.rows > CMS_FORM_LIMITS.messageRows.max)) return false;
    }
  }
  return true;
}

export interface CmsFormSubmission {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

export type CmsFormSubmissionResult =
  | { ok: true; data: CmsFormSubmission }
  | { ok: false; errors: Record<string, string> };

/**
 * Validation serveur autoritaire. `config` provient de la version **publiée**
 * de la page (chargée en base), jamais d'un corps de requête : un client ne
 * peut pas assouplir les contraintes en réécrivant sa propre configuration.
 */
export function validateCmsFormSubmission(config: CmsFormConfig, values: unknown): CmsFormSubmissionResult {
  if (!isRecord(values)) return { ok: false, errors: { form: "Requête invalide." } };
  const submittedKeys = Object.keys(values);
  const allowedKeys = new Set<string>(config.fields.filter((field) => field.enabled).map((field) => field.key));
  // Champ-piège et clés inattendues : rejet global plutôt que filtrage silencieux.
  for (const key of submittedKeys) {
    if (key === "formKey" || key === "startedAt" || key === "_hp") continue;
    if (!allowedKeys.has(key)) return { ok: false, errors: { form: "Champ inattendu dans la soumission." } };
  }
  const errors: Record<string, string> = {};
  const data: CmsFormSubmission = { name: "", email: "", phone: "", subject: "", message: "" };
  for (const field of config.fields) {
    if (!field.enabled) continue;
    const raw = values[field.key];
    if (field.type === "message") {
      // Surlargeur = garde-fou mémoire uniquement. Une valeur réellement trop
      // longue est REFUSÉE, jamais tronquée : on ne perd pas la donnée en silence.
      const value = sanitizeCmsFormMultiline(raw, CMS_FORM_LIMITS.message.max * 8);
      if (value.length > CMS_FORM_LIMITS.message.max) { errors.message = "Le message est trop long."; continue; }
      if (field.required && value.length < CMS_FORM_LIMITS.message.min) { errors.message = "Le message est obligatoire."; continue; }
      data.message = value;
      continue;
    }
    const limits = CMS_FORM_LIMITS[field.type] as { min?: number; max: number };
    const value = sanitizeCmsFormText(raw, limits.max * 8);
    if (value.length > limits.max) { errors[field.key] = "Ce champ est trop long."; continue; }
    if (field.required && value.length < (limits.min ?? 1)) {
      errors[field.key] = field.type === "email" ? "L’adresse e-mail est obligatoire." : "Ce champ est obligatoire.";
      continue;
    }
    if (!value) continue;
    if (field.type === "email") {
      if (!EMAIL_PATTERN.test(value)) { errors.email = "L’adresse e-mail est invalide."; continue; }
      data.email = value.toLowerCase();
      continue;
    }
    if (field.type === "phone" && !PHONE_PATTERN.test(value)) {
      errors.phone = "Le numéro de téléphone est invalide.";
      continue;
    }
    data[field.type] = value;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

/** Détecte un formulaire CMS dans un document publié, par identifiant stable. */
export function findCmsFormElement(page: unknown, elementId: string): CmsElement | null {
  if (!isRecord(page) || !Array.isArray(page.sections)) return null;
  const visit = (node: unknown): CmsElement | null => {
    if (!isRecord(node)) return null;
    if (node.nodeType !== undefined || node.children !== undefined) {
      if (!Array.isArray(node.children)) return null;
      for (const child of node.children) {
        const found = visit(child);
        if (found) return found;
      }
      return null;
    }
    if (node.id === elementId && node.type === "form") return node as unknown as CmsElement;
    return null;
  };
  for (const section of page.sections) {
    if (!isRecord(section) || !Array.isArray(section.elements)) continue;
    for (const node of section.elements) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return null;
}

/** Un formulaire sans aucun champ actif ne peut rien traiter : inutile de l'afficher comme actif. */
export function isCmsFormUsable(config: CmsFormConfig): boolean {
  return config.fields.some((field) => field.enabled);
}

export type { CmsPage };
