// Célestime — état unique du configurateur + persistance locale.
// Les options disponibles sont déterminées par le PRODUIT CÉLESTIME
// (formats, formes, fonds, cadre) — jamais par une grille étrangère.

import { productBySlug } from "./options";
import { applyRules } from "./rules";
import type { CreationConfig, RuleNote } from "./types";

export const DRAFT_KEY = "celestime:draft";
export const CREATIONS_KEY = "celestime:creations";
export const CART_ID_KEY = "celestime:cart";
export const ORDERS_KEY = "celestime:orders";

export function defaultConfig(productId = "etoiles-de-naissance"): CreationConfig {
  const p = productBySlug(productId) ?? productBySlug("etoiles-de-naissance")!;
  const base: CreationConfig = {
    productId: p.slug,
    occasion: p.occasion,
    name: "",
    message: "",
    day: "",
    month: "",
    year: "",
    hour: "",
    minute: "",
    timeApprox: false,
    location: null,
    background: p.backgrounds[0] ?? "saphir",
    shape: p.shapes[0] ?? "medaillon",
    framed: false,
    size: p.sizes[0] ?? "A4",
    quantity: 1,
  };
  return applyRules(base).config;
}

export type EditorAction =
  | { type: "PATCH"; patch: Partial<CreationConfig> }
  | { type: "LOCATION"; location: CreationConfig["location"] }
  | { type: "LOAD"; config: CreationConfig }
  | { type: "RESET"; productId?: string };

export interface EditorState {
  config: CreationConfig;
  notes: RuleNote[];
  dirty: boolean;
}

export function initEditorState(): EditorState {
  return { config: defaultConfig(), notes: [], dirty: false };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "PATCH": {
      const result = applyRules({ ...state.config, ...action.patch });
      return { config: result.config, notes: result.notes, dirty: true };
    }
    case "LOCATION": {
      const result = applyRules({ ...state.config, location: action.location });
      return { config: result.config, notes: result.notes, dirty: true };
    }
    case "LOAD": {
      const result = applyRules(action.config);
      return { config: result.config, notes: result.notes, dirty: false };
    }
    case "RESET": {
      return { config: defaultConfig(action.productId ?? "etoiles-de-naissance"), notes: [], dirty: false };
    }
    default:
      return state;
  }
}

export interface SavedCreation {
  id: string;
  name: string;
  config: CreationConfig;
  updatedAt: string;
}

export function loadDraft(): SavedCreation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d && d.config) return d as SavedCreation;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveDraft(config: CreationConfig) {
  if (typeof window === "undefined") return;
  try {
    const name = config.name.trim() || "Création sans nom";
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ id: "draft", name, config, updatedAt: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function listCreations(): SavedCreation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CREATIONS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCreation(config: CreationConfig): SavedCreation {
  const item: SavedCreation = {
    id: crypto.randomUUID(),
    name: config.name.trim() || "Création sans nom",
    config,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    const list = listCreations().filter((c) => c.id !== item.id);
    localStorage.setItem(CREATIONS_KEY, JSON.stringify([item, ...list].slice(0, 30)));
  }
  return item;
}

export function deleteCreation(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CREATIONS_KEY, JSON.stringify(listCreations().filter((c) => c.id !== id)));
}

export function getCartId(): string {
  if (typeof window === "undefined") return "anon";
  let id = localStorage.getItem(CART_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CART_ID_KEY, id);
  }
  return id;
}
