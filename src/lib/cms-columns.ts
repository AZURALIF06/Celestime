// Célestime — Phase 3C : résolution de cible structurelle et déplacements.
//
// Module pur, sans dépendance runtime : la cible d'un ajout ou d'un dépôt est
// dérivée de l'ARBRE lui-même (Section → Row → Column → Element), jamais d'une
// simple variable de sélection globale. Aucun `parentId` n'est réécrit : la
// topologie Phase 3B (enfants dans `children[]`) est préservée à l'identique.

import type { CmsColumn, CmsContainer, CmsElement, CmsGroup, CmsPage, CmsRow, CmsSection, CmsSectionNode } from "./cms";

export type CmsBreakpointName = "desktop" | "tablet" | "mobile";

/** Où une feuille est actuellement rangée. */
export type CmsLeafParent =
  | { kind: "section" }
  | { kind: "container"; id: string }
  | { kind: "group"; id: string }
  | { kind: "column"; id: string; rowId: string };

export type CmsAddTarget =
  | { kind: "column"; columnId: string; rowId: string }
  | { kind: "container"; id: string }
  | { kind: "group"; id: string }
  | { kind: "section" };

export type CmsMoveFailure =
  | "leaf-not-found"
  | "target-not-found"
  | "locked"
  | "column-full"
  | "unchanged";

export type CmsMoveResult =
  | { ok: true; section: CmsSection; from: CmsLeafParent }
  | { ok: false; reason: CmsMoveFailure };

export const CMS_COLUMN_LIMITS = { childrenPerColumn: 100, totalNodesPerPage: 1000 } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isLeaf(value: unknown): value is CmsElement {
  return isRecord(value) && !("nodeType" in value) && !("children" in value);
}

function isRow(value: unknown): value is CmsRow {
  return isRecord(value) && value.nodeType === "row";
}

function isColumn(value: unknown): value is CmsColumn {
  return isRecord(value) && value.nodeType === "column";
}

function isContainer(value: unknown): value is CmsContainer {
  return isRecord(value) && value.nodeType === "container";
}

function isGroup(value: unknown): value is CmsGroup {
  return isRecord(value) && value.nodeType === "group";
}

function isLockedNode(value: unknown): boolean {
  return isRecord(value) && value.locked === true;
}

/** Nombre de nœuds structurels + feuilles, comme `countCmsNodes` côté CMS. */
export function countCmsTreeNodes(page: Pick<CmsPage, "sections">): number {
  return page.sections.reduce((total, section) => total + section.elements.reduce((sum, node) => {
    if (isRow(node)) return sum + 1 + node.children.reduce((inner, column) => inner + 1 + column.children.length, 0);
    if (isContainer(node) || isGroup(node)) return sum + 1 + node.children.length;
    return sum + 1;
  }, 0), 0);
}

/** Parcourt la topologie Section → Row → Column → Element. */
function eachNode(section: CmsSection, visit: (node: CmsSectionNode | CmsColumn | CmsElement, parent: CmsLeafParent) => void): void {
  for (const node of section.elements) {
    visit(node, { kind: "section" });
    if (isRow(node)) {
      for (const column of node.children) {
        visit(column, { kind: "column", id: column.id, rowId: node.id });
        for (const child of column.children) visit(child, { kind: "column", id: column.id, rowId: node.id });
      }
    } else if (isContainer(node) || isGroup(node)) {
      for (const child of node.children) {
        visit(child, isContainer(node) ? { kind: "container", id: node.id } : { kind: "group", id: node.id });
      }
    }
  }
}

export function findCmsLeaf(section: CmsSection, leafId: string): CmsElement | null {
  let found: CmsElement | null = null;
  eachNode(section, (node) => {
    if (!found && isLeaf(node) && node.id === leafId) found = node;
  });
  return found;
}

export function findCmsLeafParent(section: CmsSection, leafId: string): CmsLeafParent | null {
  let found: CmsLeafParent | null = null;
  eachNode(section, (node, parent) => {
    if (found) return;
    if (isColumn(node)) return; // une colonne n'est pas une feuille
    if (isLeaf(node) && node.id === leafId) found = parent;
  });
  return found;
}

export function findCmsColumn(section: CmsSection, columnId: string): { column: CmsColumn; row: CmsRow } | null {
  for (const node of section.elements) {
    if (!isRow(node)) continue;
    for (const column of node.children) if (column.id === columnId) return { column, row: node };
  }
  return null;
}

/**
 * Cible d'insertion d'un nouvel élément, dérivée de l'élément sélectionné :
 *  - colonne sélectionnée            → cette colonne ;
 *  - feuille située dans une colonne → la colonne qui la contient (le cas
 *    d'ambiguïté Phase 3B) ;
 *  - feuille / conteneur / groupe    → ce conteneur ;
 *  - rangée sélectionnée             → racine de section (une rangée ne désigne
 *    aucune colonne en particulier :deviner serait ambigu).
 */
export function resolveCmsAddTarget(section: CmsSection, selectedId: string | null | undefined): CmsAddTarget {
  if (!selectedId) return { kind: "section" };
  for (const node of section.elements) {
    if (node.id === selectedId) {
      if (isRow(node)) return { kind: "section" };
      if (isContainer(node)) return { kind: "container", id: node.id };
      if (isGroup(node)) return { kind: "group", id: node.id };
      if (isLeaf(node)) return { kind: "section" };
    }
    if (isRow(node)) {
      for (const column of node.children) {
        if (column.id === selectedId) return { kind: "column", columnId: column.id, rowId: node.id };
        if (column.children.some((child) => child.id === selectedId)) {
          return { kind: "column", columnId: column.id, rowId: node.id };
        }
      }
    }
    if ((isContainer(node) || isGroup(node)) && node.children.some((child) => child.id === selectedId)) {
      return isContainer(node) ? { kind: "container", id: node.id } : { kind: "group", id: node.id };
    }
  }
  return { kind: "section" };
}

/** Identifiant du nœud structurel visé, ou null pour la racine de section. */
export function cmsAddTargetNodeId(target: CmsAddTarget): string | null {
  if (target.kind === "column") return target.columnId;
  if (target.kind === "section") return null;
  return target.id;
}

/** Identifiant de colonne à survoler pour un élément donné (pour l'affichage). */
export function resolveCmsOwningColumnId(section: CmsSection, selectedId: string | null | undefined): string | null {
  const target = resolveCmsAddTarget(section, selectedId);
  return target.kind === "column" ? target.columnId : null;
}

function removeLeafFromParent(section: CmsSection, leafId: string): CmsSection {
  return {
    ...section,
    elements: section.elements
      // Feuille posée à la racine de la section : elle sort du tableau des éléments.
      .filter((node) => !(isLeaf(node) && node.id === leafId))
      .map((node) => {
        if (isLeaf(node)) return node;
        if (isRow(node)) {
          return { ...node, children: node.children.map((column) =>
            column.children.some((child) => child.id === leafId)
              ? { ...column, children: column.children.filter((child) => child.id !== leafId) }
              : column) };
        }
        if (isContainer(node) || isGroup(node)) {
          return node.children.some((child) => child.id === leafId)
            ? { ...node, children: node.children.filter((child) => child.id !== leafId) }
            : node;
        }
        return node;
      // Le map conserve la nature de chaque nœud (ligne / conteneur / groupe
      // / feuille) : le cast ne fait qu'exprimer cela au type-systeme.
      }) as CmsSectionNode[],
  };
}

function insertLeafIntoColumn(section: CmsSection, leaf: CmsElement, columnId: string, index: number): CmsSection | null {
  let inserted = false;
  const elements = section.elements.map((node) => {
    if (!isRow(node) || inserted) return node;
    const children = node.children.map((column) => {
      if (column.id !== columnId) return column;
      inserted = true;
      const bounded = Math.max(0, Math.min(index, column.children.length));
      const next = [...column.children];
      next.splice(bounded, 0, leaf);
      return { ...column, children: next };
    });
    return inserted ? { ...node, children } : node;
  });
  return inserted ? { ...section, elements } : null;
}

/** La feuille ET tous ses parents structurels doivent être déverrouillés. */
function isCmsLeafLocked(section: CmsSection, leafId: string): boolean {
  const leaf = findCmsLeaf(section, leafId);
  if (!leaf || isLockedNode(leaf)) return true;
  const parent = findCmsLeafParent(section, leafId);
  if (!parent) return true;
  if (parent.kind === "section") return false;
  if (parent.kind === "column") {
    const found = findCmsColumn(section, parent.id);
    return !!found && (isLockedNode(found.row) || isLockedNode(found.column));
  }
  const owner = section.elements.find((node) => node.id === parent.id);
  return !!owner && isLockedNode(owner);
}

/** Une feuille est-elle déplaçable vers cette colonne ? (verrouillages + capacité) */
export function canMoveCmsLeafToColumn(section: CmsSection, leafId: string, columnId: string): CmsMoveFailure | null {
  const leaf = findCmsLeaf(section, leafId);
  if (!leaf) return "leaf-not-found";
  const target = findCmsColumn(section, columnId);
  if (!target) return "target-not-found";
  if (isCmsLeafLocked(section, leafId)) return "locked";
  if (isLockedNode(target.row) || isLockedNode(target.column)) return "locked";
  const from = findCmsLeafParent(section, leafId);
  const alreadyThere = from?.kind === "column" && from.id === columnId;
  if (!alreadyThere && target.column.children.length >= CMS_COLUMN_LIMITS.childrenPerColumn) return "column-full";
  return null;
}

export interface CmsColumnDropRequest {
  leafId: string;
  columnId: string;
  /** Position d'insertion dans `children[]`, bornée par l'appelant. */
  index: number;
}

/**
 * Déplace une feuille vers une colonne et une position données.
 * Cas A (même colonne), B (autre colonne), C (autre rangée), D (position précise).
 * L'identifiant, le contenu, les propriétés et les overrides responsive de la
 * feuille sont conservés à l'identique : seule sa position change.
 */
export function moveCmsLeafToColumn(page: CmsPage, sectionId: string, request: CmsColumnDropRequest): CmsMoveResult {
  const section = page.sections.find((candidate) => candidate.id === sectionId);
  if (!section) return { ok: false, reason: "target-not-found" };
  const leaf = findCmsLeaf(section, request.leafId);
  if (!leaf) return { ok: false, reason: "leaf-not-found" };
  const failure = canMoveCmsLeafToColumn(section, request.leafId, request.columnId);
  if (failure) return { ok: false, reason: failure };

  const from = findCmsLeafParent(section, request.leafId)!;
  const target = findCmsColumn(section, request.columnId)!;
  const sameColumn = from.kind === "column" && from.id === request.columnId;
  const index = Math.max(0, Math.min(request.index, target.column.children.length));
  // Décalage si l'on retire la feuille de la liste EN AMONT de la cible.
  const sourceIndex = sameColumn ? target.column.children.findIndex((child) => child.id === request.leafId) : -1;
  const adjusted = sameColumn && sourceIndex >= 0 && sourceIndex < index ? index - 1 : index;
  const finalIndex = Math.max(0, Math.min(adjusted, target.column.children.length));
  if (sameColumn && finalIndex === sourceIndex) return { ok: false, reason: "unchanged" };

  const detached = removeLeafFromParent(section, request.leafId);
  const inserted = insertLeafIntoColumn(detached, leaf, request.columnId, finalIndex);
  if (!inserted) return { ok: false, reason: "target-not-found" };
  if (countCmsTreeNodes(page) > CMS_COLUMN_LIMITS.totalNodesPerPage) return { ok: false, reason: "column-full" };
  return {
    ok: true,
    from,
    section: inserted,
  };
}

/** Retire une feuille d'une colonne sans la réinsérer (déplacement annulé). */
export function removeCmsLeaf(section: CmsSection, leafId: string): CmsSection {
  return removeLeafFromParent(section, leafId);
}

export interface CmsColumnFlowFrame { x: number; y: number; w: number; h: number }

/**
 * Reproduit la résolution de frames Phase 3B (écart soustrait avant
 * pourcentages) pour une rangée, afin de tester la géométrie de dépôt.
 */
export function resolveCmsRowColumnGeometry(row: CmsRow): CmsColumnFlowFrame[] {
  const columns = row.children;
  if (!columns.length) return [];
  const contentWidth = Math.max(0, row.w - row.gap * Math.max(0, columns.length - 1));
  let cursor = row.x;
  return columns.map((column) => {
    const width = contentWidth * column.width / 100;
    const frame = { x: cursor, y: row.y, w: width, h: row.h };
    cursor += width + row.gap;
    return frame;
  });
}

/**
 * Détermine la VRAIE cible de dépôt sous le pointeur : la colonne réellement
 * survolée, puis la position d'insertion la plus proche.
 */
export function resolveCmsColumnDropTarget(
  section: CmsSection,
  point: { x: number; y: number },
): { columnId: string; rowId: string; index: number } | null {
  const candidates: Array<{ columnId: string; rowId: string; index: number; distance: number }> = [];
  for (const node of section.elements) {
    if (!isRow(node) || node.hidden) continue;
    const frames = resolveCmsRowColumnGeometry(node);
    node.children.forEach((column, columnIndex) => {
      if (column.hidden) return;
      const frame = frames[columnIndex];
      if (!frame) return;
      const insideX = point.x >= frame.x && point.x <= frame.x + frame.w;
      const insideY = point.y >= frame.y - 12 && point.y <= frame.y + frame.h + 12;
      if (!insideX || !insideY) return;
      // Index d'insertion : premier enfant dont le bas est dépassé par le pointeur.
      let cursor = frame.y;
      let index = column.children.length;
      for (const child of column.children) {
        if (point.y < cursor + child.h / 2) { index = column.children.indexOf(child); break; }
        cursor += child.h + column.gap;
      }
      candidates.push({ columnId: column.id, rowId: node.id, index, distance: Math.abs(point.y - frame.y) });
    });
  }
  if (!candidates.length) return null;
  const best = candidates.reduce((winner, entry) => (entry.distance < winner.distance ? entry : winner));
  return { columnId: best.columnId, rowId: best.rowId, index: best.index };
}

/** Adresse descriptive de la cible, pour l'affichage « Ajouter dans … ». */
export function describeCmsTarget(section: CmsSection, target: CmsAddTarget): string {
  if (target.kind === "section") return "la section";
  if (target.kind === "container") return "le conteneur";
  if (target.kind === "group") return "le groupe";
  for (const node of section.elements) {
    if (!isRow(node)) continue;
    const position = node.children.findIndex((column) => column.id === target.columnId);
    if (position < 0) continue;
    return `la colonne ${position + 1}/${node.children.length} de la rangée`;
  }
  return "la section";
}
