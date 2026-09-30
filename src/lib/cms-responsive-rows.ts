// Célestime — Phase 3C : comportement responsive des rangées et des colonnes.
//
// Module pur. Principe de compatibilité Phase 3B : une rangée SANS clé
// `responsive` se comporte exactement comme avant (horizontale, gap d'origine,
// largeurs d'origine, hauteur d'origine). L'empilement est une capacité
// explicite, activée par l'éditeur, jamais appliquée d'office à du contenu
// existant — sinon chaque page publiée changerait de rendu sur mobile.

import type { CmsColumn, CmsElement, CmsRow, CmsSection, CmsSectionNode } from "./cms";

export type CmsRowBreakpoint = "desktop" | "tablet" | "mobile";

export interface CmsColumnLayout {
  column: CmsColumn;
  /** Part en pourcentage de la largeur de contenu de la rangée. */
  width: number;
  hidden: boolean;
  /** Ordre d'affichage ; l'index d'origine en cas d'égalité. */
  order: number;
  index: number;
}

export interface CmsRowLayout {
  breakpoint: CmsRowBreakpoint;
  stacked: boolean;
  gap: number;
  columns: CmsColumnLayout[];
}

export const CMS_ROW_RESPONSIVE_LIMITS = { gap: 128, width: 100, minWidth: 1 } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isRow(value: unknown): value is CmsRow {
  return isRecord(value) && value.nodeType === "row";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Lit l'override d'un appareil sans jamais faire confiance à sa forme. */
function overrideOf(container: unknown, breakpoint: CmsRowBreakpoint): Record<string, unknown> {
  if (!isRecord(container)) return {};
  const responsive = container.responsive;
  if (!isRecord(responsive)) return {};
  const value = responsive[breakpoint];
  return isRecord(value) ? value : {};
}

function hiddenFlag(column: CmsColumn, breakpoint: CmsRowBreakpoint): boolean {
  if (breakpoint === "desktop") return column.hidden === true;
  const value = overrideOf(column, breakpoint).hidden;
  return typeof value === "boolean" ? value : column.hidden === true;
}

/**
 * Résolution déterministe de la mise en page d'une rangée pour un appareil.
 * L'ordre returned suit l'ordre d'AFFICHAGE (ordre responsive appliqué) ;
 * `index` conserve la position d'origine, celle du tableau `children[]`.
 */
export function resolveCmsRowLayout(row: CmsRow, breakpoint: CmsRowBreakpoint): CmsRowLayout {
  const override = overrideOf(row, breakpoint);
  const stackRequested = override.stack === true;
  const columns = row.children.length;
  // L'empillage n'a de sens qu'en dessous du desktop ET avec plusieurs colonnes.
  const stacked = breakpoint !== "desktop" && stackRequested && columns > 1;
  const rawGap = typeof override.gap === "number" && Number.isFinite(override.gap) ? override.gap : row.gap;
  const gap = clamp(rawGap, 0, CMS_ROW_RESPONSIVE_LIMITS.gap);
  const layout: CmsColumnLayout[] = row.children.map((column, index) => {
    const columnOverride = overrideOf(column, breakpoint);
    const width = stacked
      ? 100
      : clamp(typeof columnOverride.width === "number" && Number.isFinite(columnOverride.width) ? columnOverride.width : column.width, CMS_ROW_RESPONSIVE_LIMITS.minWidth, CMS_ROW_RESPONSIVE_LIMITS.width);
    const order = typeof columnOverride.order === "number" && Number.isFinite(columnOverride.order) ? columnOverride.order : index;
    return { column, width, hidden: hiddenFlag(column, breakpoint), order, index };
  });
  // Tri stable : à ordre égal, l'ordre du tableau Phase 3B est conservé.
  const sorted = layout
    .map((entry, position) => ({ entry, position }))
    .sort((left, right) => left.entry.order - right.entry.order || left.position - right.position)
    .map(({ entry }) => entry);
  return { breakpoint, stacked, gap, columns: sorted };
}

/** Hauteur naturelle d'une colonne : somme des hauteurs d'enfants + écarts. */
export function resolveCmsColumnContentHeight(column: CmsColumn): number {
  const visible = column.children.filter((child: CmsElement) => child.hidden !== true);
  if (!visible.length) return 0;
  return visible.reduce((sum, child) => sum + child.h, 0) + Math.max(0, visible.length - 1) * column.gap;
}

/**
 * Hauteur occupée par la rangée. En disposition horizontale c'est la hauteur
 * d'origine ; empilée, c'est la somme des colonnes plus les écarts.
 */
export function resolveCmsRowHeight(row: CmsRow, breakpoint: CmsRowBreakpoint, layout = resolveCmsRowLayout(row, breakpoint)): number {
  if (!layout.stacked) return row.h;
  const visible = layout.columns.filter((entry) => !entry.hidden);
  if (!visible.length) return 0;
  return visible.reduce((sum, entry) => sum + resolveCmsColumnContentHeight(entry.column), 0) + Math.max(0, visible.length - 1) * layout.gap;
}

/**
 * Hauteur de section requise. Le document reste maître de sa hauteur : on ne
 * fait QUE grandir la section si l'empilement déborde, jamais rétrécir.
 */
export function resolveCmsSectionHeight(section: CmsSection, breakpoint: CmsRowBreakpoint): number {
  let required = section.h;
  for (const node of section.elements as CmsSectionNode[]) {
    if (!isRow(node) || node.hidden) continue;
    const layout = resolveCmsRowLayout(node, breakpoint);
    required = Math.max(required, node.y + resolveCmsRowHeight(node, breakpoint, layout));
  }
  return Math.max(1, Math.round(required));
}

export interface CmsColumnFrame { x: number; y: number; w: number; h: number }

/**
 * Frames de colonnes dans l'espace canonique 1200 px. Reproduit la résolution
 * Phase 3B (écart soustrait avant pourcentages, alignements respectés) et ajoute
 * l'empilement vertical, l'ordre et la masquage.
 */
export function resolveCmsColumnFrames(row: CmsRow, breakpoint: CmsRowBreakpoint, layout = resolveCmsRowLayout(row, breakpoint)): CmsColumnFrame[] {
  const visible = layout.columns.filter((entry) => !entry.hidden);
  if (!visible.length) return [];
  if (layout.stacked) {
    let cursorY = row.y;
    return layout.columns.map((entry) => {
      // Une colonne masquée ne prend aucune place et n'avance pas le curseur.
      if (entry.hidden) return { x: row.x, y: cursorY, w: 0, h: 0 };
      const height = resolveCmsColumnContentHeight(entry.column);
      const frame = { x: row.x, y: cursorY, w: row.w, h: height };
      cursorY += height + layout.gap;
      return frame;
    });
  }
  const contentWidth = Math.max(0, row.w - layout.gap * Math.max(0, visible.length - 1));
  const totalPercent = visible.reduce((sum, entry) => sum + entry.width, 0);
  const leftover = Math.max(0, contentWidth - (contentWidth * totalPercent) / 100);
  const justify = row.alignX === "center" ? leftover / 2 : row.alignX === "end" ? leftover : 0;
  const extraBetween = row.alignX === "between" && visible.length > 1 ? leftover / (visible.length - 1) : 0;
  let cursor = row.x + justify;
  return layout.columns.map((entry) => {
    if (entry.hidden) return { x: cursor, y: row.y, w: 0, h: row.h };
    const width = (contentWidth * entry.width) / 100;
    const frame = { x: cursor, y: row.y, w: width, h: row.h };
    cursor += width + layout.gap + extraBetween;
    return frame;
  });
}

/** Résumé déterministe, utilisé par les tests et par l'infobulle de l'éditeur. */
export function describeCmsRowLayout(row: CmsRow, breakpoint: CmsRowBreakpoint): string {
  const layout = resolveCmsRowLayout(row, breakpoint);
  const parts = layout.columns.map((entry) => {
    const label = `${entry.index + 1}:${Math.round(entry.width * 100) / 100}%`;
    return entry.hidden ? `${label} (masquée)` : label;
  });
  return `${layout.stacked ? "empilée" : "horizontale"} · ${parts.join(" / ")} · gap ${layout.gap}px · hauteur ${Math.round(resolveCmsRowHeight(row, breakpoint, layout))}px`;
}

/**
 * Position verticale d'insertion, exprimée depuis le haut de la rangée.
 * Utilisée pour dessiner l'indicateur de dépôt dans l'éditeur.
 */
export function resolveCmsColumnInsertionY(column: CmsColumn, index: number): number {
  const bounded = Math.max(0, Math.min(index, column.children.length));
  let offset = 0;
  for (let position = 0; position < bounded; position += 1) {
    offset += column.children[position].h;
    if (position < bounded - 1) offset += column.gap;
  }
  return offset;
}
