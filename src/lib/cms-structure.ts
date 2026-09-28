import type { CSSProperties } from "react";
import {
  isCmsColumn,
  isCmsContainer,
  isCmsGroup,
  isCmsRow,
  MAX_CMS_COLUMN_CHILDREN,
  MAX_CMS_COLUMNS_PER_ROW,
  MAX_CMS_CONTAINER_CHILDREN,
  MAX_CMS_CONTAINERS_PER_SECTION,
  MAX_CMS_GROUP_CHILDREN,
  MAX_CMS_GROUPS_PER_SECTION,
  MAX_CMS_ELEMENTS,
  MAX_CMS_ROWS_PER_SECTION,
  MAX_CMS_STRUCTURE_DEPTH,
  MAX_CMS_TOTAL_NODES,
  resolveCmsColumnChildFrames,
  resolveCmsRowColumnFrames,
  type CmsColumn,
  type CmsContainer,
  type CmsElement,
  type CmsGroup,
  type CmsNode,
  type CmsRow,
} from "./cms";

export { resolveCmsColumnChildFrames, resolveCmsRowColumnFrames } from "./cms";

/** Documented Phase 3B topology caps. Maximum valid structural depth is four nodes. */
export const CMS_STRUCTURE_LIMITS = {
  containersPerSection: MAX_CMS_CONTAINERS_PER_SECTION,
  childrenPerContainer: MAX_CMS_CONTAINER_CHILDREN,
  rowsPerSection: MAX_CMS_ROWS_PER_SECTION,
  columnsPerRow: MAX_CMS_COLUMNS_PER_ROW,
  childrenPerColumn: MAX_CMS_COLUMN_CHILDREN,
  groupsPerSection: MAX_CMS_GROUPS_PER_SECTION,
  childrenPerGroup: MAX_CMS_GROUP_CHILDREN,
  elementsPerSection: MAX_CMS_ELEMENTS,
  maxDepth: MAX_CMS_STRUCTURE_DEPTH,
  totalNodesPerPage: MAX_CMS_TOTAL_NODES,
  rowGap: 128,
  columnGap: 128,
} as const;

function alignItems(value: CmsRow["alignX"]): CSSProperties["justifyContent"] {
  return value === "between" ? "space-between" : value === "center" ? "center" : value === "end" ? "flex-end" : "flex-start";
}
function alignContent(value: CmsRow["alignY"]): CSSProperties["justifyContent"] {
  return value === "center" ? "center" : value === "end" ? "flex-end" : "flex-start";
}

/** Shared absolute placement for free containers, rows, and groups. */
function absoluteFrame(node: CmsContainer | CmsRow | CmsGroup): CSSProperties {
  return {
    position: "absolute",
    left: node.x,
    top: node.y,
    width: node.w,
    height: node.h,
    zIndex: node.z,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    opacity: node.opacity,
    display: node.hidden ? "none" : undefined,
  };
}
export function cmsContainerRenderStyle(container: CmsContainer): CSSProperties {
  return absoluteFrame(container);
}
export function cmsGroupRenderStyle(group: CmsGroup): CSSProperties {
  return absoluteFrame(group);
}
export function cmsRowRenderStyle(row: CmsRow): CSSProperties {
  return {
    ...absoluteFrame(row),
    display: row.hidden ? "none" : "flex",
    boxSizing: "border-box",
    gap: row.gap,
    justifyContent: alignItems(row.alignX),
    alignItems: "stretch",
    overflow: "visible",
  };
}

export function cmsColumnRenderStyle(column: CmsColumn, row: CmsRow): CSSProperties {
  const frame = resolveCmsRowColumnFrames(row).find((entry) => entry.column.id === column.id)?.frame;
  return {
    position: "relative",
    flex: "0 0 auto",
    width: frame?.w ?? 0,
    height: "100%",
    minWidth: 0,
    zIndex: column.z,
    opacity: column.opacity,
    display: column.hidden ? "none" : "flex",
    flexDirection: "column",
    gap: column.gap,
    justifyContent: alignContent(row.alignY),
    overflow: "visible",
  };
}

export function cmsLeafRenderStyle(element: CmsElement): CSSProperties {
  return {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    zIndex: element.z,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    opacity: element.opacity,
    display: element.hidden ? "none" : undefined,
  };
}

/** Flow leaf geometry is full parent width and fixed stored height; legacy x/y/w are untouched. */
export function cmsFlowLeafRenderStyle(element: CmsElement): CSSProperties {
  return {
    position: "relative",
    inset: "auto",
    width: "100%",
    height: element.h,
    flex: "0 0 auto",
    boxSizing: "border-box",
    zIndex: element.z,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    opacity: element.opacity,
    display: element.hidden ? "none" : undefined,
  };
}

export function cmsNodeLabel(node: CmsNode): string {
  if (isCmsContainer(node)) return "Conteneur libre";
  if (isCmsRow(node)) return "Rangée";
  if (isCmsColumn(node)) return "Colonne";
  if (isCmsGroup(node)) return "Groupe";
  return node.type;
}
