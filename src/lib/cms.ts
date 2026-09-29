// Célestime — modèle de contenu : PAGE → SECTIONS → ÉLÉMENTS.
// Chaque élément est positionné librement (x, y, w, h, z, rotation, opacité)
// avec des overrides responsive (desktop / tablette / mobile).

import type { Metadata } from "next";

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

export interface CmsContainer {
  id: string;
  nodeType: "container";
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  layout: "free";
  children: CmsElement[];
}

export type CmsRowJustify = "start" | "center" | "end" | "between";
export type CmsRowAlign = "start" | "center" | "end";

/** A horizontal flow row; child widths are percentages of the post-gap content width. */
export interface CmsRow {
  id: string;
  nodeType: "row";
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  layout: "horizontal";
  gap: number;
  alignX: CmsRowJustify;
  alignY: CmsRowAlign;
  children: CmsColumn[];
}

/** Columns participate in their row's horizontal flow; their leaves stack vertically. */
export interface CmsColumn {
  id: string;
  nodeType: "column";
  width: number;
  z: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  layout: "vertical";
  gap: number;
  children: CmsElement[];
}

/** A persisted free-positioned group; children keep group-local frames. */
export interface CmsGroup {
  id: string;
  nodeType: "group";
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  layout: "free";
  children: CmsElement[];
}

export interface CmsLayoutFrame { x: number; y: number; w: number; h: number }

/** Resize a free-positioned group while preserving child proportions, typography and device overrides. */
export function resizeCmsGroupToFrame(group: CmsGroup, frame: CmsLayoutFrame): CmsGroup {
  const scaleX = frame.w / group.w;
  const scaleY = frame.h / group.h;
  const scaleFont = Math.sqrt(scaleX * scaleY);
  return {
    ...group,
    ...frame,
    children: group.children.map((child) => ({
      ...child,
      x: child.x * scaleX,
      y: child.y * scaleY,
      w: Math.max(1, child.w * scaleX),
      h: Math.max(1, child.h * scaleY),
      style: typeof child.style.size === "number"
        ? { ...child.style, size: Math.max(1, child.style.size * scaleFont) }
        : child.style,
      responsive: child.responsive ? Object.fromEntries(Object.entries(child.responsive).map(([key, override]) => [key, {
        ...override,
        ...(override.x !== undefined ? { x: override.x * scaleX } : {}),
        ...(override.y !== undefined ? { y: override.y * scaleY } : {}),
        ...(override.w !== undefined ? { w: Math.max(1, override.w * scaleX) } : {}),
        ...(override.h !== undefined ? { h: Math.max(1, override.h * scaleY) } : {}),
        ...(override.fontSize !== undefined ? { fontSize: Math.max(1, override.fontSize * scaleFont) } : {}),
      }])) : undefined,
    })),
  };
}

/** Shared deterministic desktop flow resolver: gap is subtracted before percent widths are applied. */
export function resolveCmsRowColumnFrames(row: CmsRow): Array<{ column: CmsColumn; frame: CmsLayoutFrame }> {
  const columns = row.children;
  if (!columns.length) return [];
  const baseGap = row.gap;
  const contentWidth = Math.max(0, row.w - baseGap * Math.max(0, columns.length - 1));
  const totalPercent = columns.reduce((sum, column) => sum + column.width, 0);
  const leftover = Math.max(0, contentWidth - contentWidth * totalPercent / 100);
  const justify = row.alignX === "center" ? leftover / 2 : row.alignX === "end" ? leftover : 0;
  const extraBetween = row.alignX === "between" && columns.length > 1 ? leftover / (columns.length - 1) : 0;
  let cursor = row.x + justify;
  return columns.map((column) => {
    const width = contentWidth * column.width / 100;
    const frame = { x: cursor, y: row.y, w: width, h: row.h };
    cursor += width + baseGap + extraBetween;
    return { column, frame };
  });
}

/** Child order, not stored x/y/w, determines vertical flow; h and the parent gap are preserved. */
export function resolveCmsColumnChildFrames(row: CmsRow, column: CmsColumn): Array<{ child: CmsElement; frame: CmsLayoutFrame }> {
  const columnFrame = resolveCmsRowColumnFrames(row).find((entry) => entry.column.id === column.id)?.frame;
  if (!columnFrame) return [];
  const totalHeight = column.children.reduce((sum, child) => sum + child.h, 0) + Math.max(0, column.children.length - 1) * column.gap;
  const offsetY = row.alignY === "center" ? (row.h - totalHeight) / 2 : row.alignY === "end" ? row.h - totalHeight : 0;
  let cursorY = columnFrame.y + offsetY;
  return column.children.map((child) => {
    const frame = { x: columnFrame.x, y: cursorY, w: columnFrame.w, h: child.h };
    cursorY += child.h + column.gap;
    return { child, frame };
  });
}

/** Legacy leaves are not decorated; only explicit structure carries children. */
export type CmsNode = CmsElement | CmsContainer | CmsRow | CmsColumn | CmsGroup;
export type CmsSectionNode = CmsElement | CmsContainer | CmsRow | CmsGroup;
export type CmsStructuralNode = CmsContainer | CmsRow | CmsColumn | CmsGroup;

export function isCmsContainer(value: unknown): value is CmsContainer {
  return !!value && typeof value === "object" && !Array.isArray(value) && (value as { nodeType?: unknown }).nodeType === "container";
}
export function isCmsRow(value: unknown): value is CmsRow {
  return !!value && typeof value === "object" && !Array.isArray(value) && (value as { nodeType?: unknown }).nodeType === "row";
}
export function isCmsColumn(value: unknown): value is CmsColumn {
  return !!value && typeof value === "object" && !Array.isArray(value) && (value as { nodeType?: unknown }).nodeType === "column";
}
export function isCmsGroup(value: unknown): value is CmsGroup {
  return !!value && typeof value === "object" && !Array.isArray(value) && (value as { nodeType?: unknown }).nodeType === "group";
}
export function isCmsStructuralNode(value: unknown): value is CmsStructuralNode {
  return isCmsContainer(value) || isCmsRow(value) || isCmsColumn(value) || isCmsGroup(value);
}

export function findCmsNode(section: CmsSection, id: string): CmsNode | undefined {
  for (const node of section.elements) {
    if (node.id === id) return node;
    if ((isCmsContainer(node) || isCmsGroup(node)) && node.children.some((child) => child.id === id)) {
      return node.children.find((child) => child.id === id);
    }
    if (isCmsRow(node)) {
      for (const column of node.children) {
        if (column.id === id) return column;
        const child = column.children.find((candidate) => candidate.id === id);
        if (child) return child;
      }
    }
  }
  return undefined;
}

export function findCmsParentNode(section: CmsSection, childId: string): CmsStructuralNode | undefined {
  for (const node of section.elements) {
    if ((isCmsContainer(node) || isCmsGroup(node)) && node.children.some((child) => child.id === childId)) return node;
    if (isCmsRow(node)) {
      const column = node.children.find((candidate) => candidate.id === childId || candidate.children.some((child) => child.id === childId));
      if (column) return column.id === childId ? node : column;
    }
  }
  return undefined;
}

/** Compatibility helper for existing Phase 3A callers. */
export function findCmsParentContainer(section: CmsSection, childId: string): CmsContainer | undefined {
  const parent = findCmsParentNode(section, childId);
  return parent && isCmsContainer(parent) ? parent : undefined;
}

export function resolveCmsChildSectionFrame(container: CmsContainer, child: CmsElement) {
  return { x: container.x + child.x, y: container.y + child.y, w: child.w, h: child.h };
}
export function resolveCmsGroupChildSectionFrame(group: CmsGroup, child: CmsElement) {
  return { x: group.x + child.x, y: group.y + child.y, w: child.w, h: child.h };
}

function cloneCmsElement(element: CmsElement, createId: () => string): CmsElement {
  return { ...JSON.parse(JSON.stringify(element)) as CmsElement, id: createId() };
}

export function duplicateCmsNode(node: CmsNode, createId: () => string = newId): CmsNode {
  if (isCmsContainer(node) || isCmsGroup(node)) {
    return { ...JSON.parse(JSON.stringify(node)) as CmsContainer | CmsGroup, id: createId(), children: node.children.map((child) => cloneCmsElement(child, createId)) } as CmsContainer | CmsGroup;
  }
  if (isCmsRow(node)) {
    return { ...JSON.parse(JSON.stringify(node)) as CmsRow, id: createId(), children: node.children.map((column) => ({
      ...column, id: createId(), children: column.children.map((child) => cloneCmsElement(child, createId)),
    })) };
  }
  if (isCmsColumn(node)) return { ...node, id: createId(), children: node.children.map((child) => cloneCmsElement(child, createId)) };
  return cloneCmsElement(node, createId);
}

function normalizedWidths(columns: CmsColumn[]): CmsColumn[] {
  if (!columns.length) return columns;
  const sum = columns.reduce((total, column) => total + column.width, 0);
  if (sum <= 0) return columns.map((column) => ({ ...column, width: 100 / columns.length }));
  let used = 0;
  return columns.map((column, index) => {
    const width = index === columns.length - 1 ? 100 - used : Math.round(column.width / sum * 10000) / 100;
    used += width;
    return { ...column, width };
  });
}

export function removeCmsNodeFromSection(section: CmsSection, id: string): CmsSection {
  const root = section.elements.find((node) => node.id === id);
  if (root) return { ...section, elements: section.elements.filter((node) => node.id !== id) };
  const elements: CmsSectionNode[] = [];
  for (const node of section.elements) {
    if ((isCmsContainer(node) || isCmsGroup(node)) && node.children.some((child) => child.id === id)) {
      const children = node.children.filter((child) => child.id !== id);
      if (!(isCmsGroup(node) && !children.length)) elements.push({ ...node, children });
    } else if (isCmsRow(node)) {
      if (node.children.some((column) => column.id === id)) {
        const columns = node.children.filter((column) => column.id !== id);
        if (columns.length) elements.push({ ...node, children: normalizedWidths(columns) });
      } else {
        const children = node.children.map((column) => column.children.some((child) => child.id === id)
          ? { ...column, children: column.children.filter((child) => child.id !== id) } : column);
        elements.push({ ...node, children });
      }
    } else elements.push(node);
  }
  return { ...section, elements };
}

/** Convert selected root leaves into local coordinates without discarding breakpoint overrides. */
export function createCmsGroupFromElements(elements: CmsElement[], id = newId()): CmsGroup {
  if (elements.length < 2) throw new Error("Un groupe nécessite au moins deux feuilles.");
  const x = Math.min(...elements.map((element) => element.x));
  const y = Math.min(...elements.map((element) => element.y));
  const right = Math.max(...elements.map((element) => element.x + element.w));
  const bottom = Math.max(...elements.map((element) => element.y + element.h));
  const children = elements.map((element) => {
    const child: CmsElement = { ...JSON.parse(JSON.stringify(element)), x: element.x - x, y: element.y - y };
    if (element.responsive) {
      const responsive = { ...element.responsive };
      for (const breakpoint of ["tablet", "mobile"] as const) {
        const override = responsive[breakpoint];
        if (!override) continue;
        const factor = breakpoint === "tablet" ? 768 / PAGE_WIDTH : 390 / PAGE_WIDTH;
        responsive[breakpoint] = {
          ...override,
          ...(override.x !== undefined ? { x: override.x - x * factor } : {}),
          ...(override.y !== undefined ? { y: override.y - y * factor } : {}),
        };
      }
      child.responsive = responsive;
    }
    return child;
  });
  return {
    id,
    nodeType: "group",
    x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y),
    z: Math.min(...elements.map((element) => element.z)),
    rotation: 0,
    opacity: 1,
    layout: "free",
    children,
  };
}

export function moveCmsColumnChild(column: CmsColumn, childId: string, direction: -1 | 1): CmsColumn {
  const index = column.children.findIndex((child) => child.id === childId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= column.children.length) return column;
  const children = [...column.children];
  [children[index], children[nextIndex]] = [children[nextIndex], children[index]];
  return { ...column, children };
}

export function cmsAncestors(section: CmsSection, id: string): CmsStructuralNode[] {
  for (const node of section.elements) {
    if (node.id === id) return [];
    if ((isCmsContainer(node) || isCmsGroup(node)) && node.children.some((child) => child.id === id)) return [node];
    if (isCmsRow(node)) {
      for (const column of node.children) {
        if (column.id === id) return [node];
        if (column.children.some((child) => child.id === id)) return [node, column];
      }
    }
  }
  return [];
}

export function isCmsNodeEditable(section: CmsSection, id: string): boolean {
  const node = findCmsNode(section, id);
  return !!node && !node.locked && !cmsAncestors(section, id).some((parent) => parent.locked);
}
export function isCmsNodeVisible(node: CmsNode, parent?: CmsStructuralNode): boolean {
  return !node.hidden && !parent?.hidden;
}
export function isCmsNodeVisibleInSection(section: CmsSection, id: string): boolean {
  const node = findCmsNode(section, id);
  return !!node && !node.hidden && !cmsAncestors(section, id).some((parent) => parent.hidden);
}

export function updateCmsNodeInSection(section: CmsSection, id: string, update: (node: CmsNode) => CmsNode): CmsSection {
  return { ...section, elements: section.elements.map((node) => {
    if (node.id === id) return update(node) as CmsSectionNode;
    if ((isCmsContainer(node) || isCmsGroup(node)) && node.children.some((child) => child.id === id)) {
      return { ...node, children: node.children.map((child) => child.id === id ? update(child) as CmsElement : child) };
    }
    if (isCmsRow(node)) {
      return { ...node, children: node.children.map((column) => {
        if (column.id === id) return update(column) as CmsColumn;
        if (column.children.some((child) => child.id === id)) return { ...column, children: column.children.map((child) => child.id === id ? update(child) as CmsElement : child) };
        return column;
      }) };
    }
    return node;
  }) };
}

export function cmsNodeSectionFrame(node: Exclude<CmsNode, CmsColumn>, parent?: CmsContainer | CmsGroup) {
  return { x: node.x + (parent?.x ?? 0), y: node.y + (parent?.y ?? 0), w: node.w, h: node.h };
}

export function countCmsNodes(page: Pick<CmsPage, "sections">): number {
  return page.sections.reduce((total, section) => total + section.elements.reduce((subtotal, node) => {
    if (isCmsContainer(node) || isCmsGroup(node)) return subtotal + 1 + node.children.length;
    if (isCmsRow(node)) return subtotal + 1 + node.children.reduce((sum, column) => sum + 1 + column.children.length, 0);
    return subtotal + 1;
  }, 0), 0);
}

/** Generate IDs unique against every section and structural descendant in this document. */
export function createCmsIdFactory(page: Pick<CmsPage, "sections">, generate: () => string = newId): () => string {
  const used = new Set<string>();
  for (const section of page.sections) {
    used.add(section.id);
    for (const node of section.elements) {
      used.add(node.id);
      if (isCmsContainer(node) || isCmsGroup(node)) node.children.forEach((child) => used.add(child.id));
      if (isCmsRow(node)) node.children.forEach((column) => {
        used.add(column.id);
        column.children.forEach((child) => used.add(child.id));
      });
    }
  }
  return () => {
    let id = generate();
    while (used.has(id)) id = generate();
    used.add(id);
    return id;
  };
}

export function hasCmsStructuralNodes(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.sections)) return false;
  return value.sections.some((section) => isRecord(section) && Array.isArray(section.elements) && section.elements.some((node) =>
    isRecord(node) && (Object.prototype.hasOwnProperty.call(node, "nodeType") || Object.prototype.hasOwnProperty.call(node, "children"))
  ));
}

export interface CmsSection {
  id: string;
  h: number;
  bg?: string;
  elements: CmsSectionNode[];
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

/** Shared allowlist for CMS-managed editorial images. Remote sources must use HTTPS. */
export function isValidCmsImageSource(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim() || value.length > 2048) return false;
  if (value.startsWith("/")) {
    return !value.startsWith("//") && /^\/(?:images|media|api\/media)\/[a-zA-Z0-9._~!$&'()*+,;=:@%/-]+(?:\?[a-zA-Z0-9._~!$&'()*+,;=:@%/?-]*)?$/.test(value);
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

const CMS_SITE_ORIGIN = "https://www.celestime.fr";
const CMS_PROTECTED_PATH = /^\/(?:api|admin|cart|checkout|confirmation|account|orders?)(?:\/|$)/i;
const CMS_VIDEO_HOSTS = new Set(["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasSafeInternalPath(pathname: string): boolean {
  let decoded = pathname;
  try {
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return false;
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || /[\u0000-\u001f\u007f]/.test(decoded)) return false;
  try {
    decoded = new URL(decoded, CMS_SITE_ORIGIN).pathname;
  } catch {
    return false;
  }
  return !CMS_PROTECTED_PATH.test(decoded);
}

/** Safe editorial hrefs: relative same-site paths or HTTPS URLs only. */
export function isValidCmsLink(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim() || !value || value.length > 2048) return false;
  if (value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f\s]/.test(value)) return false;

  let url: URL;
  try {
    url = new URL(value, CMS_SITE_ORIGIN);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;

  const isRelative = !/^[a-z][a-z0-9+.-]*:/i.test(value);
  if (isRelative && url.origin !== CMS_SITE_ORIGIN) return false;
  const isCelestimeHost = url.hostname === "www.celestime.fr" || url.hostname === "celestime.fr";
  if (isCelestimeHost && !hasSafeInternalPath(url.pathname)) return false;
  return true;
}

/** Normalize accepted YouTube URLs to a narrow, safe iframe embed URL. */
export function getCmsVideoEmbedUrl(value: unknown): string | null {
  if (typeof value !== "string" || value !== value.trim() || !value || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !CMS_VIDEO_HOSTS.has(url.hostname) || url.username || url.password || url.port) return null;

  const host = url.hostname.includes("youtube-nocookie.com") ? "www.youtube-nocookie.com" : "www.youtube.com";
  const embedMatch = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{6,20})\/?$/);
  if (embedMatch) return `https://${host}/embed/${embedMatch[1]}${url.search}${url.hash}`;
  const shortMatch = url.hostname === "youtu.be" && url.pathname.match(/^\/([A-Za-z0-9_-]{6,20})\/?$/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}${url.search}${url.hash}`;
  if ((url.pathname === "/watch" || url.pathname === "/watch/") && url.searchParams.get("v")) {
    const id = url.searchParams.get("v")!;
    if (/^[A-Za-z0-9_-]{6,20}$/.test(id)) {
      const parameters = new URLSearchParams(url.searchParams);
      parameters.delete("v");
      const query = parameters.toString();
      return `https://${host}/embed/${id}${query ? `?${query}` : ""}${url.hash}`;
    }
  }
  return null;
}

const GENERIC_CMS_BLOCK_TYPES = new Set([
  "text", "image", "video", "icon", "button", "divider", "spacer", "section", "promo",
  "countdown", "newsletter", "form", "testimonials", "faq", "breadcrumb",
  "gallery", "carousel", "imageMarquee", "panorama", "article", "hero", "menu", "cart",
]);
export const MAX_CMS_SECTIONS = 100;
export const MAX_CMS_ELEMENTS = 300;
export const MAX_CMS_TOTAL_ELEMENTS = 1000;
// Structural limits: bounded branching and a maximum section→row→column→leaf depth of four.
export const MAX_CMS_CONTAINERS_PER_SECTION = 20;
export const MAX_CMS_CONTAINER_CHILDREN = 100;
export const MAX_CMS_ROWS_PER_SECTION = 20;
export const MAX_CMS_COLUMNS_PER_ROW = 4;
export const MAX_CMS_COLUMN_CHILDREN = 100;
export const MAX_CMS_GROUPS_PER_SECTION = 50;
export const MAX_CMS_GROUP_CHILDREN = 100;
export const MAX_CMS_TOTAL_NODES = 1000;
export const MAX_CMS_STRUCTURE_DEPTH = 4;
const MAX_CMS_COORDINATE = 100_000;
const CMS_FREE_KEYS = ["id", "nodeType", "x", "y", "w", "h", "z", "rotation", "opacity", "locked", "hidden", "layout", "children"] as const;
const CMS_ROW_KEYS = ["id", "nodeType", "x", "y", "w", "h", "z", "rotation", "opacity", "locked", "hidden", "layout", "gap", "alignX", "alignY", "children"] as const;
const CMS_COLUMN_KEYS = ["id", "nodeType", "width", "z", "opacity", "locked", "hidden", "layout", "gap", "children"] as const;
const CMS_ELEMENT_KEYS = [
  "id", "type", "x", "y", "w", "h", "z", "rotation", "opacity",
  "locked", "hidden", "content", "style", "link", "responsive",
] as const;

function finiteNumber(value: unknown, min = -MAX_CMS_COORDINATE, max = MAX_CMS_COORDINATE): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function boundedString(value: unknown, maxLength = 10_000, allowEmpty = true): value is string {
  return typeof value === "string" && value.length <= maxLength && (allowEmpty || value.trim().length > 0);
}

function isSafeStyle(value: unknown): value is Record<string, any> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) =>
    entry === null || typeof entry === "boolean" ||
    (typeof entry === "string" && entry.length <= 4096 && !/url\s*\(/i.test(entry)) ||
    (typeof entry === "number" && Number.isFinite(entry))
  );
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function validVisualFrame(content: Record<string, unknown>): boolean {
  if (content.maxWidthPx !== undefined && !finiteNumber(content.maxWidthPx, 160, 2400)) return false;
  if (content.align !== undefined && !["left", "center", "right"].includes(String(content.align))) return false;
  if (content.padding !== undefined && !finiteNumber(content.padding, 0, 128)) return false;
  if (content.marginTop !== undefined && !finiteNumber(content.marginTop, 0, 240)) return false;
  if (content.marginBottom !== undefined && !finiteNumber(content.marginBottom, 0, 240)) return false;
  if (content.radius !== undefined && !finiteNumber(content.radius, 0, 200)) return false;
  return true;
}

function validVisualImages(value: unknown, forRendering: boolean): boolean {
  if (!Array.isArray(value) || value.length > 30) return false;
  return value.every((image) => {
    if (!isRecord(image) || !hasOnlyKeys(image, ["src", "alt", "caption"])) return false;
    if (typeof image.src !== "string" && !forRendering) return false;
    if (typeof image.src === "string" && !forRendering && !isValidCmsImageSource(image.src)) return false;
    if (image.alt !== undefined && !boundedString(image.alt, 1000)) return false;
    if (image.caption !== undefined && !boundedString(image.caption, 2000)) return false;
    return true;
  });
}

function isVisualRatio(value: unknown): boolean {
  return value === undefined || value === "auto" || ["1:1", "4:3", "3:2", "16:9", "21:9"].includes(String(value));
}

export interface GenericCmsValidationOptions {
  /** Allow unsafe media/links through structural checks so the renderer can replace/hide them safely. */
  forRendering?: boolean;
}

/** Runtime schema for generic /p pages. Commerce blocks are deliberately not part of this schema. */
export function isValidGenericCmsPage(value: unknown, options: GenericCmsValidationOptions = {}): value is CmsPage {
  return validateGenericCmsPage(value, options, false);
}

function validateGenericCmsPage(value: unknown, options: GenericCmsValidationOptions, structureFlattened: boolean): value is CmsPage {
  const forRendering = options.forRendering === true;
  if (!isRecord(value) || !Array.isArray(value.sections) || value.sections.length === 0 || value.sections.length > MAX_CMS_SECTIONS) return false;

  // Validate only the explicitly supported topologies, flatten leaves for the unchanged
  // legacy content/link/media validator, and never mutate the input document.
  if (!structureFlattened) {
    const seenNodeIds = new Set<string>();
    const flattenedSections: Record<string, unknown>[] = [];
    let totalNodes = 0;
    let hasStructure = false;
    const addId = (node: Record<string, unknown>) => {
      if (!boundedString(node.id, 128, false) || seenNodeIds.has(node.id)) return false;
      seenNodeIds.add(node.id);
      return true;
    };
    const addLeaf = (raw: unknown, leaves: Record<string, unknown>[]) => {
      if (!isRecord(raw) || Object.prototype.hasOwnProperty.call(raw, "nodeType") || Object.prototype.hasOwnProperty.call(raw, "children") || !addId(raw)) return false;
      totalNodes += 1;
      if (totalNodes > MAX_CMS_TOTAL_NODES) return false;
      leaves.push(raw);
      return true;
    };
    const validFlagsAndFrame = (node: Record<string, unknown>) =>
      finiteNumber(node.x) && finiteNumber(node.y) && finiteNumber(node.w, 1) && finiteNumber(node.h, 1) &&
      finiteNumber(node.z) && finiteNumber(node.rotation, -360_000, 360_000) && finiteNumber(node.opacity, 0, 1) &&
      (node.locked === undefined || typeof node.locked === "boolean") &&
      (node.hidden === undefined || typeof node.hidden === "boolean");

    for (const rawSection of value.sections) {
      if (!isRecord(rawSection) || !Array.isArray(rawSection.elements) || rawSection.elements.length > MAX_CMS_ELEMENTS) return false;
      const leaves: Record<string, unknown>[] = [];
      let containers = 0;
      let rows = 0;
      let groups = 0;
      for (const rawNode of rawSection.elements) {
        if (!isRecord(rawNode)) return false;
        totalNodes += 1;
        if (totalNodes > MAX_CMS_TOTAL_NODES) return false;
        const structural = Object.prototype.hasOwnProperty.call(rawNode, "nodeType") || Object.prototype.hasOwnProperty.call(rawNode, "children");
        if (!structural) {
          if (!addId(rawNode)) return false;
          leaves.push(rawNode);
          continue;
        }
        hasStructure = true;
        if (!addId(rawNode)) return false;

        if (rawNode.nodeType === "container" || rawNode.nodeType === "group") {
          const isGroup = rawNode.nodeType === "group";
          if (!hasOnlyKeys(rawNode, CMS_FREE_KEYS) || !validFlagsAndFrame(rawNode) || rawNode.layout !== "free" || !Array.isArray(rawNode.children)) return false;
          if (isGroup ? ++groups > MAX_CMS_GROUPS_PER_SECTION : ++containers > MAX_CMS_CONTAINERS_PER_SECTION) return false;
          const childLimit = isGroup ? MAX_CMS_GROUP_CHILDREN : MAX_CMS_CONTAINER_CHILDREN;
          if (rawNode.children.length > childLimit || (isGroup && rawNode.children.length < 1)) return false;
          for (const rawChild of rawNode.children) if (!addLeaf(rawChild, leaves)) return false;
          continue;
        }

        if (rawNode.nodeType === "row") {
          rows += 1;
          if (rows > MAX_CMS_ROWS_PER_SECTION || !hasOnlyKeys(rawNode, CMS_ROW_KEYS) || !validFlagsAndFrame(rawNode) ||
            rawNode.layout !== "horizontal" || !finiteNumber(rawNode.gap, 0, 128) ||
            !["start", "center", "end", "between"].includes(String(rawNode.alignX)) ||
            !["start", "center", "end"].includes(String(rawNode.alignY)) || !Array.isArray(rawNode.children) ||
            rawNode.children.length < 1 || rawNode.children.length > MAX_CMS_COLUMNS_PER_ROW) return false;
          let widthTotal = 0;
          for (const rawColumn of rawNode.children) {
            if (!isRecord(rawColumn) || rawColumn.nodeType !== "column" || !hasOnlyKeys(rawColumn, CMS_COLUMN_KEYS) || !addId(rawColumn)) return false;
            totalNodes += 1;
            if (totalNodes > MAX_CMS_TOTAL_NODES || !finiteNumber(rawColumn.width, 1, 100) || !finiteNumber(rawColumn.z) ||
              !finiteNumber(rawColumn.opacity, 0, 1) || (rawColumn.locked !== undefined && typeof rawColumn.locked !== "boolean") ||
              (rawColumn.hidden !== undefined && typeof rawColumn.hidden !== "boolean") || rawColumn.layout !== "vertical" ||
              !finiteNumber(rawColumn.gap, 0, 128) || !Array.isArray(rawColumn.children) || rawColumn.children.length > MAX_CMS_COLUMN_CHILDREN) return false;
            widthTotal += rawColumn.width;
            for (const rawChild of rawColumn.children) if (!addLeaf(rawChild, leaves)) return false;
          }
          if (widthTotal > 100.0001) return false;
          continue;
        }

        // Columns are legal only as direct row children. Unknown nodeType values fail closed.
        return false;
      }
      flattenedSections.push({ ...rawSection, elements: leaves });
    }
    if (hasStructure) return validateGenericCmsPage({ ...value, sections: flattenedSections }, options, true);
  }

  const sectionIds = new Set<string>();
  const elementIds = new Set<string>();
  let totalElements = 0;

  for (const section of value.sections) {
    if (!isRecord(section) || !boundedString(section.id, 128, false) || sectionIds.has(section.id)) return false;
    if (!finiteNumber(section.h, 1, MAX_CMS_COORDINATE) || (section.bg !== undefined && (!boundedString(section.bg, 4096) || /url\s*\(/i.test(section.bg)))) return false;
    if (!Array.isArray(section.elements) || (!structureFlattened && section.elements.length > MAX_CMS_ELEMENTS)) return false;
    sectionIds.add(section.id);
    totalElements += section.elements.length;
    if (totalElements > MAX_CMS_TOTAL_ELEMENTS) return false;

    for (const element of section.elements) {
      if (!isRecord(element) || !hasOnlyKeys(element, CMS_ELEMENT_KEYS) || !boundedString(element.id, 128, false) || elementIds.has(element.id)) return false;
      if (typeof element.type !== "string" || !GENERIC_CMS_BLOCK_TYPES.has(element.type)) return false;
      if (!finiteNumber(element.x) || !finiteNumber(element.y) || !finiteNumber(element.w, 1) || !finiteNumber(element.h, 1)) return false;
      if (!finiteNumber(element.z) || !finiteNumber(element.rotation, -360_000, 360_000) || !finiteNumber(element.opacity, 0, 1)) return false;
      if (element.locked !== undefined && typeof element.locked !== "boolean") return false;
      if (element.hidden !== undefined && typeof element.hidden !== "boolean") return false;
      if (!isRecord(element.content) || !isSafeStyle(element.style)) return false;
      if (element.link !== undefined && typeof element.link !== "string") return false;
      if (element.link !== undefined && !forRendering && !isValidCmsLink(element.link)) return false;

      const content = element.content;
      if (["gallery", "carousel", "imageMarquee", "panorama", "article"].includes(element.type) && Object.keys(element.style).length > 0) return false;
      switch (element.type) {
        case "text":
          if (!boundedString(content.text, 20_000) || (content.variant !== undefined && typeof content.variant !== "string")) return false;
          if (content.variant === "link" && (typeof element.link !== "string" || (!forRendering && !isValidCmsLink(element.link)))) return false;
          break;
        case "image": {
          const validSource = isValidCmsImageSource(content.src);
          // In rendering mode CmsImage applies the shared validator and shows a neutral placeholder for bad sources.
          if (!validSource && !forRendering) return false;
          if (content.alt !== undefined && !boundedString(content.alt, 1000)) return false;
          if (content.fit !== undefined && (typeof content.fit !== "string" || !["cover", "contain", "fill", "none", "scale-down"].includes(content.fit))) return false;
          if (content.radius !== undefined && !finiteNumber(content.radius, 0, 10_000)) return false;
          if (content.shadow !== undefined && typeof content.shadow !== "boolean") return false;
          if (content.border !== undefined && typeof content.border !== "boolean") return false;
          if (content.caption !== undefined && !boundedString(content.caption, 2000)) return false;
          if (content.widthPercent !== undefined && !finiteNumber(content.widthPercent, 10, 100)) return false;
          if (content.maxWidthPx !== undefined && !finiteNumber(content.maxWidthPx, 160, 2400)) return false;
          if (content.align !== undefined && !["left", "center", "right"].includes(String(content.align))) return false;
          if (!isVisualRatio(content.ratio)) return false;
          break;
        }
        case "gallery":
          if (!hasOnlyKeys(content, ["images", "columns", "gap", "ratio", "radius", "showCaptions", "maxWidthPx", "align", "padding", "marginTop", "marginBottom"])) return false;
          if (!validVisualImages(content.images, forRendering) || !validVisualFrame(content)) return false;
          if (content.columns !== undefined && (!finiteNumber(content.columns, 1, 6) || !Number.isInteger(content.columns))) return false;
          if (content.gap !== undefined && !finiteNumber(content.gap, 0, 64)) return false;
          if (!isVisualRatio(content.ratio)) return false;
          if (content.showCaptions !== undefined && typeof content.showCaptions !== "boolean") return false;
          break;
        case "carousel":
          if (!hasOnlyKeys(content, ["images", "autoplay", "speedMs", "loop", "showArrows", "showIndicators", "maxWidthPx", "align", "padding", "marginTop", "marginBottom", "radius"])) return false;
          if (!validVisualImages(content.images, forRendering) || !validVisualFrame(content)) return false;
          if (content.autoplay !== undefined && typeof content.autoplay !== "boolean") return false;
          if (content.speedMs !== undefined && !finiteNumber(content.speedMs, 1000, 30_000)) return false;
          if (content.loop !== undefined && typeof content.loop !== "boolean") return false;
          if (content.showArrows !== undefined && typeof content.showArrows !== "boolean") return false;
          if (content.showIndicators !== undefined && typeof content.showIndicators !== "boolean") return false;
          break;
        case "imageMarquee":
          if (!hasOnlyKeys(content, ["images", "speedSeconds", "direction", "pauseOnHover", "visibleCount", "gap", "maxWidthPx", "align", "padding", "marginTop", "marginBottom", "radius"])) return false;
          if (!validVisualImages(content.images, forRendering) || !validVisualFrame(content)) return false;
          if (content.speedSeconds !== undefined && !finiteNumber(content.speedSeconds, 5, 120)) return false;
          if (content.direction !== undefined && content.direction !== "left" && content.direction !== "right") return false;
          if (content.pauseOnHover !== undefined && typeof content.pauseOnHover !== "boolean") return false;
          if (content.visibleCount !== undefined && (!finiteNumber(content.visibleCount, 1, 8) || !Number.isInteger(content.visibleCount))) return false;
          if (content.gap !== undefined && !finiteNumber(content.gap, 0, 64)) return false;
          break;
        case "panorama": {
          if (!hasOnlyKeys(content, ["src", "alt", "initialPosition", "autoScroll", "speedPxPerSecond", "loop", "maxWidthPx", "align", "padding", "marginTop", "marginBottom", "radius"])) return false;
          if (typeof content.src !== "string" || (!forRendering && content.src !== "" && !isValidCmsImageSource(content.src))) return false;
          if (content.alt !== undefined && !boundedString(content.alt, 1000)) return false;
          if (!validVisualFrame(content)) return false;
          if (content.initialPosition !== undefined && !finiteNumber(content.initialPosition, 0, 100)) return false;
          if (content.autoScroll !== undefined && typeof content.autoScroll !== "boolean") return false;
          if (content.speedPxPerSecond !== undefined && !finiteNumber(content.speedPxPerSecond, 1, 120)) return false;
          if (content.loop !== undefined && typeof content.loop !== "boolean") return false;
          break;
        }
        case "article":
          if (!hasOnlyKeys(content, ["src", "alt", "title", "subtitle", "paragraphs", "buttonLabel", "buttonHref", "imagePosition", "align", "spacing", "maxWidthPx", "padding", "marginTop", "marginBottom", "radius"])) return false;
          if (!boundedString(content.title, 2000) || !validVisualFrame(content)) return false;
          if (content.subtitle !== undefined && !boundedString(content.subtitle, 4000)) return false;
          if (!Array.isArray(content.paragraphs) || content.paragraphs.length === 0 || content.paragraphs.length > 20 || !content.paragraphs.every((paragraph: unknown) => boundedString(paragraph, 20_000))) return false;
          if (content.src !== undefined && (typeof content.src !== "string" || (!forRendering && content.src !== "" && !isValidCmsImageSource(content.src)))) return false;
          if (content.alt !== undefined && !boundedString(content.alt, 1000)) return false;
          if (content.buttonLabel !== undefined && !boundedString(content.buttonLabel, 1000)) return false;
          if (content.buttonHref !== undefined && (typeof content.buttonHref !== "string" || (!forRendering && content.buttonHref !== "" && !isValidCmsLink(content.buttonHref)))) return false;
          if (content.imagePosition !== undefined && !["top", "left", "right"].includes(String(content.imagePosition))) return false;
          if (content.align !== undefined && !["left", "center", "right"].includes(String(content.align))) return false;
          if (content.spacing !== undefined && !finiteNumber(content.spacing, 0, 96)) return false;
          break;
        case "video":
          if (typeof content.url !== "string" || (!forRendering && !getCmsVideoEmbedUrl(content.url))) return false;
          break;
        case "icon":
          if (content.icon !== undefined && !boundedString(content.icon, 100)) return false;
          if (content.size !== undefined && !finiteNumber(content.size, 1, 2048)) return false;
          if (content.color !== undefined && !boundedString(content.color, 100, false)) return false;
          break;
        case "button":
          if (!boundedString(content.text, 1000) || typeof content.href !== "string" || (!forRendering && !isValidCmsLink(content.href))) return false;
          break;
        case "hero":
          if (!hasOnlyKeys(content, ["eyebrow", "title", "subtitle", "imageSrc", "imageAlt", "buttonLabel", "buttonHref"]) ||
            !boundedString(content.title, 2000, false) ||
            (content.eyebrow !== undefined && !boundedString(content.eyebrow, 500)) ||
            (content.subtitle !== undefined && !boundedString(content.subtitle, 4000)) ||
            (content.imageSrc !== undefined && (typeof content.imageSrc !== "string" || (!forRendering && content.imageSrc !== "" && !isValidCmsImageSource(content.imageSrc)))) ||
            (content.imageAlt !== undefined && !boundedString(content.imageAlt, 1000)) ||
            (content.buttonLabel !== undefined && !boundedString(content.buttonLabel, 500)) ||
            (content.buttonHref !== undefined && (typeof content.buttonHref !== "string" || (!forRendering && content.buttonHref !== "" && !isValidCmsLink(content.buttonHref))))) return false;
          break;
        case "menu":
          if (!hasOnlyKeys(content, ["items", "orientation", "ariaLabel"]) || !Array.isArray(content.items) || content.items.length < 1 || content.items.length > 12 ||
            !content.items.every((item: unknown) => isRecord(item) && hasOnlyKeys(item, ["label", "href"]) && boundedString(item.label, 120, false) &&
              typeof item.href === "string" && (forRendering || isValidCmsLink(item.href))) ||
            (content.orientation !== undefined && !["horizontal", "vertical"].includes(String(content.orientation))) ||
            (content.ariaLabel !== undefined && !boundedString(content.ariaLabel, 120))) return false;
          break;
        case "cart":
          if (!hasOnlyKeys(content, ["label"]) || (content.label !== undefined && !boundedString(content.label, 120, false))) return false;
          break;
        case "divider":
          if (content.width !== undefined && !finiteNumber(content.width, 0, 10_000)) return false;
          if (content.color !== undefined && !boundedString(content.color, 100, false)) return false;
          break;
        case "promo":
          if (!boundedString(content.text, 4000) || (content.badge !== undefined && !boundedString(content.badge, 1000))) return false;
          break;
        case "countdown":
          if (content.date !== undefined && (typeof content.date !== "string" || !Number.isFinite(Date.parse(content.date)))) return false;
          if (content.label !== undefined && !boundedString(content.label, 1000)) return false;
          break;
        case "newsletter":
        case "form":
          if (content.text !== undefined && !boundedString(content.text, 4000)) return false;
          break;
        case "testimonials":
          if (content.title !== undefined && !boundedString(content.title, 1000)) return false;
          break;
        case "faq":
          for (const key of ["title", "eyebrow", "intro", "contactTitle", "contactText", "contactLabel"]) {
            if (content[key] !== undefined && !boundedString(content[key], 4000)) return false;
          }
          if (content.items !== undefined && (!Array.isArray(content.items) || content.items.length > 100 || !content.items.every((item: unknown) =>
            isRecord(item) && boundedString(item.question, 4000) && boundedString(item.answer, 20_000)
          ))) return false;
          if (content.contactHref !== undefined && (typeof content.contactHref !== "string" || (!forRendering && !isValidCmsLink(content.contactHref)))) return false;
          break;
        case "breadcrumb":
          if (!boundedString(content.text, 4000)) return false;
          break;
        case "spacer":
        case "section":
          break;
      }

      if (element.responsive !== undefined) {
        if (!isRecord(element.responsive)) return false;
        for (const key of ["tablet", "mobile"] as const) {
          const override = element.responsive[key];
          if (override === undefined) continue;
          if (!isRecord(override)) return false;
          for (const dimension of ["x", "y"] as const) if (override[dimension] !== undefined && !finiteNumber(override[dimension])) return false;
          for (const dimension of ["w", "h"] as const) if (override[dimension] !== undefined && !finiteNumber(override[dimension], 1)) return false;
          if (override.fontSize !== undefined && !finiteNumber(override.fontSize, 1, 2048)) return false;
          if (override.hidden !== undefined && typeof override.hidden !== "boolean") return false;
        }
      }
      elementIds.add(element.id);
    }
  }
  return true;
}

/** Strictly validate newly introduced visual blocks during draft saves without narrowing the legacy page schema. */
export function areValidNewCmsVisualBlocks(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.sections)) return true;
  if (value.sections.length > MAX_CMS_SECTIONS) return false;
  const newTypes = new Set(["gallery", "carousel", "imageMarquee", "panorama", "article", "hero", "menu", "cart"]);
  let index = 0;
  let visitedLeaves = 0;
  for (const section of value.sections) {
    if (!isRecord(section) || !Array.isArray(section.elements)) continue;
    const leaves: unknown[] = [];
    const pushLeaf = (leaf: unknown) => {
      if (++visitedLeaves > MAX_CMS_TOTAL_NODES) return false;
      leaves.push(leaf);
      return true;
    };
    for (const node of section.elements) {
      if (!isRecord(node)) continue;
      if (node.nodeType === "row" && Array.isArray(node.children)) {
        for (const column of node.children) if (isRecord(column) && Array.isArray(column.children)) {
          for (const child of column.children) if (!pushLeaf(child)) return false;
        }
      } else if (["container", "group"].includes(String(node.nodeType)) && Array.isArray(node.children)) {
        for (const child of node.children) if (!pushLeaf(child)) return false;
      } else if (!pushLeaf(node)) return false;
    }
    for (const element of leaves) {
      if (!isRecord(element) || typeof element.type !== "string" || !newTypes.has(element.type)) continue;
      if (!hasOnlyKeys(element, CMS_ELEMENT_KEYS)) return false;
      const candidate = {
        id: typeof element.id === "string" ? element.id : `visual-${index}`,
        type: element.type,
        x: 0, y: 0, w: 1, h: 1, z: 0, rotation: 0, opacity: 1,
        content: element.content,
        style: element.style,
        ...(element.locked !== undefined ? { locked: element.locked } : {}),
        ...(element.hidden !== undefined ? { hidden: element.hidden } : {}),
        ...(element.link !== undefined ? { link: element.link } : {}),
        ...(element.responsive !== undefined ? { responsive: element.responsive } : {}),
      };
      if (!isValidGenericCmsPage({ sections: [{ id: `visual-section-${index}`, h: 1, elements: [candidate] }] })) return false;
      index += 1;
    }
  }
  return true;
}

/** Defensive check used by generic renderers; never changes catalog data or status. */
export function isActiveGenericCmsProduct(value: unknown): boolean {
  return isRecord(value) && value.status === "active";
}

/** Convert an unknown CMS href to a safe href, or null so callers can render it as inert text. */
export function safeCmsHref(value: unknown): string | null {
  return isValidCmsLink(value) ? value : null;
}

/** Canonicals are restricted to the site's own HTTPS origin (or a safe relative path). */
export function getValidCmsCanonical(value: unknown): string | null {
  if (!isValidCmsLink(value)) return null;
  let url: URL;
  try {
    url = new URL(value, CMS_SITE_ORIGIN);
  } catch {
    return null;
  }
  if ((url.hostname !== "www.celestime.fr" && url.hostname !== "celestime.fr") || url.port || url.search || url.hash) return null;
  return url.href;
}

/** Build only page-level SEO overrides; omitted values continue to inherit root metadata. */
export function getCmsPageMetadata(seoValue: unknown): Metadata {
  if (!isRecord(seoValue)) return {};
  const title = boundedString(seoValue.title, 200, false) ? seoValue.title.trim() : undefined;
  const description = boundedString(seoValue.description, 500, false) ? seoValue.description.trim() : undefined;
  const canonical = getValidCmsCanonical(seoValue.canonical);
  const ogImage = isValidCmsImageSource(seoValue.ogImage) ? seoValue.ogImage : undefined;
  const metadata: Metadata = {};
  if (title) metadata.title = title;
  if (description) metadata.description = description;
  if (seoValue.noindex === true) metadata.robots = { index: false, follow: true };
  if (canonical) metadata.alternates = { canonical };
  if (title || description || ogImage) {
    metadata.openGraph = {
      title: title ?? "Célestime — Votre histoire mérite son propre ciel",
      description: description ?? "Des cartes du ciel personnalisées, recomposées à partir de données astronomiques réelles.",
      type: "website",
      locale: "fr_FR",
      siteName: "Célestime",
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    };
  }
  return metadata;
}

/** A failed page read is represented as absence so callers can choose the current 404 behavior. */
export async function safelyReadCmsPage<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Bibliothèque d'éléments (libellés, catégories, valeurs par défaut)
// ---------------------------------------------------------------------------

export interface LibraryItem {
  type: string;
  label: string;
  category: string;
  description?: string;
  def: Omit<CmsElement, "id">;
}

const t = (
  type: string,
  label: string,
  category: string,
  def: Partial<Omit<CmsElement, "id">> = {},
  description?: string
): LibraryItem => ({
  type,
  label,
  category,
  description,
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
  t("text", "Texte", "Texte", { content: { text: "Indiquez le prénom, la date, l'heure et le lieu : nous recomposons le ciel exact de cet instant, étoiles et constellations comprises.", variant: "p" }, style: { fontFamily: "sans", size: 16, weight: 400, color: "#c9c7d2", align: "left" }, w: 520, h: 90 }),
  t("text", "Citation", "Texte", { content: { text: "« Ce ciel n'existera plus jamais exactement comme cela. »", variant: "quote" }, style: { fontFamily: "serif", size: 26, weight: 400, color: "#e3cfa4", align: "center", italic: true }, w: 640, h: 80 }),
  t("text", "Liste", "Texte", { content: { text: "Papier satiné 250 g\nCertificat d'authenticité\nCarton avec votre message", variant: "list" }, style: { fontFamily: "sans", size: 16, weight: 400, color: "#ece9e2", align: "left" }, w: 420, h: 130 }),
  // Média
  t("image", "Image", "Média", { content: { src: "/images/naissance.jpg", alt: "Création Célestime", fit: "cover", radius: 16, shadow: true, border: false }, w: 480, h: 360 }),
  t("image", "Logo", "Média", { content: { src: "/images/coffret.jpg", alt: "Célestime", fit: "contain", radius: 8, shadow: false, border: false }, w: 200, h: 80 }),
  t("video", "Vidéo YouTube", "Média", { content: { url: "https://www.youtube.com/embed/dQw4w9WgXcQ", aspect: 16 / 9 }, style: { radius: 16 }, w: 640, h: 360 }),
  t("gallery", "▦ Galerie", "Média", { content: { images: [], columns: 3, gap: 16, ratio: "4:3", radius: 12, showCaptions: true, maxWidthPx: 1120, align: "center" }, w: 1120, h: 360, x: 40 }, "Plusieurs images en grille, avec ordre et légendes modifiables."),
  t("carousel", "◧ Carrousel", "Média", { content: { images: [], autoplay: false, speedMs: 5000, loop: true, showArrows: true, showIndicators: true, radius: 16, maxWidthPx: 1120, align: "center" }, w: 900, h: 420, x: 150 }, "Images à faire défiler avec commandes, indicateurs et lecture automatique optionnelle."),
  t("imageMarquee", "↔ Image défilante", "Média", { content: { images: [], speedSeconds: 32, direction: "left", pauseOnHover: true, visibleCount: 4, gap: 16, radius: 12, maxWidthPx: 1120, align: "center" }, w: 1120, h: 220, x: 40 }, "Ruban horizontal continu, distinct d’un carrousel, suspendu au survol."),
  t("panorama", "▱ Panorama horizontal", "Média", { content: { src: "", alt: "", initialPosition: 50, autoScroll: false, speedPxPerSecond: 24, loop: false, radius: 12, maxWidthPx: 1120, align: "center" }, w: 1120, h: 320, x: 40 }, "Image panoramique à explorer horizontalement à la souris ou au toucher, sans effet 360°."),
  t("icon", "Icône étoile", "Média", { content: { icon: "star", size: 48, color: "#c9a86a" }, w: 60, h: 60 }),
  t("article", "¶ Article", "Contenu", { content: { src: "", alt: "", title: "Titre de l’article", subtitle: "Sous-titre facultatif", paragraphs: ["Rédigez votre contenu ici."], buttonLabel: "", buttonHref: "", imagePosition: "left", align: "left", spacing: 24, maxWidthPx: 1120, radius: 12 }, w: 1120, h: 420, x: 40 }, "Article éditorial avec image, titre, sous-titre, paragraphes et bouton facultatif."),
  // E-commerce
  t("product", "Produit", "E-commerce", { content: { slug: "etoiles-de-naissance" }, w: 340, h: 420 }),
  t("productGrid", "Grille de produits", "E-commerce", { content: { category: "", count: 4, title: "La collection" }, w: 1120, h: 480 }),
  t("productGrid", "Produits par catégorie", "E-commerce", { content: { category: "naissance", count: 3, title: "Naissance" }, w: 1120, h: 480 }),
  t("productGrid", "Produits similaires", "E-commerce", { content: { category: "", count: 3, title: "Vous aimerez aussi" }, w: 1120, h: 420 }),
  t("text", "Prix", "E-commerce", { content: { text: "dès 9 €", variant: "price" }, style: { fontFamily: "serif", size: 32, weight: 600, color: "#c9a86a", align: "left" }, w: 220, h: 60 }),
  t("button", "Bouton acheter", "E-commerce", { content: { text: "Personnaliser ma carte", href: "/create" }, style: { bg: "#c9a86a", color: "#06070c", hoverBg: "#e3cfa4", radius: 999, size: 15 }, w: 260, h: 56 }),
  t("cart", "Accès panier", "E-commerce", { content: { label: "Voir mon panier" }, style: { bg: "#c9a86a", color: "#06070c", radius: 999, size: 14 }, w: 250, h: 54 }, "Accès direct au panier existant du site ; ne déclenche pas le paiement."),
  t("text", "Avis clients", "E-commerce", { content: { text: "★★★★★ — Belle qualité d'impression et livraison rapide.", variant: "review" }, style: { fontFamily: "serif", size: 18, weight: 400, color: "#ece9e2", align: "left", italic: true }, w: 420, h: 90 }),
  t("promo", "Promotion", "E-commerce", { content: { text: "-20 % sur votre envoi", badge: "Jusqu'au 31/08" }, style: { bg: "#1d2547", radius: 20 }, w: 420, h: 120 }),
  // Navigation
  t("menu", "Menu de navigation", "Navigation", { content: { ariaLabel: "Navigation principale", orientation: "horizontal", items: [{ label: "Accueil", href: "/" }, { label: "Boutique", href: "/boutique" }, { label: "Contact", href: "/contact" }] }, style: { color: "#ece9e2", size: 14, gap: 24 }, w: 680, h: 56 }, "Liens internes réordonnables ; les destinations restent soumises au validateur CMS."),
  t("button", "Bouton", "Contenu", { content: { text: "Découvrir", href: "/boutique" }, style: { bg: "#c9a86a", color: "#06070c", hoverBg: "#e3cfa4", radius: 999, size: 15 }, w: 220, h: 56 }),
  t("text", "Lien", "Navigation", { content: { text: "En savoir plus", variant: "link" }, link: "/comment-ca-marche", style: { fontFamily: "sans", size: 15, weight: 500, color: "#c9a86a", align: "left" }, w: 240, h: 40 }),
  t("breadcrumb", "Fil d'Ariane", "Navigation", { content: { text: "Accueil / Boutique / Étoiles de Naissance", variant: "breadcrumb" }, style: { size: 12, color: "#6d6c7d", align: "left" }, w: 480, h: 30 }),
  // Structure
  t("divider", "Séparateur", "Structure", { content: { color: "#22263a", width: 2 }, w: 320, h: 2 }),
  t("spacer", "Espace", "Structure", { content: {}, w: 100, h: 60, hidden: false }),
  t("section", "Section · colonne gauche", "Structure", { content: { variant: "column", side: "left" }, w: 540, h: 100, style: { bg: "rgba(255,255,255,0.02)", radius: 20 }, x: 40 }),
  t("section", "Section · colonne droite", "Structure", { content: { variant: "column", side: "right" }, w: 540, h: 100, style: { bg: "rgba(255,255,255,0.02)", radius: 20 }, x: 620 }),
  t("section", "Section · conteneur", "Structure", { content: { variant: "container" }, w: 1120, h: 160, x: 40, style: { bg: "rgba(255,255,255,0.03)", radius: 24, border: true }, hidden: false }),
  // Marketing
  t("hero", "Hero marketing", "Marketing", { content: { eyebrow: "UN INSTANT, POUR TOUJOURS", title: "Votre histoire mérite son ciel", subtitle: "Une carte céleste personnalisée, créée pour les moments qui comptent.", imageSrc: "", imageAlt: "", buttonLabel: "Créer ma carte", buttonHref: "/create" }, style: { bg: "#0c0e16", color: "#ece9e2", accent: "#c9a86a", radius: 24, align: "left" }, w: 1120, h: 440, x: 40 }, "Bloc composé, éditable et publiable : image de fond facultative, texte et bouton d’action."),
  t("button", "Appel à l’action", "Marketing", { content: { text: "Découvrir la collection", href: "/boutique" }, style: { bg: "#c9a86a", color: "#06070c", hoverBg: "#e3cfa4", radius: 999, size: 15 }, w: 280, h: 58 }),
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
