import { PAGE_WIDTH, type CmsElement } from "@/lib/cms";

export type CmsBreakpoint = "desktop" | "tablet" | "mobile";
export type ResponsiveFrameKey = "x" | "y" | "w" | "h";
export type ResponsiveFrame = Pick<CmsElement, ResponsiveFrameKey>;

export const CMS_BREAKPOINT_WIDTH: Record<CmsBreakpoint, number> = {
  desktop: PAGE_WIDTH,
  tablet: 768,
  mobile: 390,
};

export function getCmsBreakpointForWidth(width: number): CmsBreakpoint {
  if (width <= 600) return "mobile";
  if (width <= 1023) return "tablet";
  return "desktop";
}

function responsiveScale(breakpoint: CmsBreakpoint): number {
  return CMS_BREAKPOINT_WIDTH[breakpoint] / PAGE_WIDTH;
}

/** Frame in the editor's canonical 1200px coordinate space. Responsive overrides
 * are stored in the selected device's reference-pixel space and mapped here. */
export function resolveCmsElementFrame(element: CmsElement, breakpoint: CmsBreakpoint): ResponsiveFrame {
  const override = breakpoint === "desktop" ? undefined : element.responsive?.[breakpoint];
  const scale = breakpoint === "desktop" ? 1 : PAGE_WIDTH / CMS_BREAKPOINT_WIDTH[breakpoint];
  return {
    x: override?.x === undefined ? element.x : override.x * scale,
    y: override?.y === undefined ? element.y : override.y * scale,
    w: override?.w === undefined ? element.w : override.w * scale,
    h: override?.h === undefined ? element.h : override.h * scale,
  };
}

/** Frame displayed in the selected device's reference-pixel coordinate space. */
export function getCmsElementFrameInBreakpoint(element: CmsElement, breakpoint: CmsBreakpoint): ResponsiveFrame {
  if (breakpoint === "desktop") return { x: element.x, y: element.y, w: element.w, h: element.h };
  const override = element.responsive?.[breakpoint];
  const scale = responsiveScale(breakpoint);
  return {
    x: override?.x ?? element.x * scale,
    y: override?.y ?? element.y * scale,
    w: override?.w ?? element.w * scale,
    h: override?.h ?? element.h * scale,
  };
}

/** Convert canonical canvas geometry into device-local responsive values. */
export function toCmsBreakpointFramePatch(
  frame: Partial<ResponsiveFrame>,
  breakpoint: CmsBreakpoint,
): Partial<ResponsiveFrame> {
  if (breakpoint === "desktop") return frame;
  const scale = responsiveScale(breakpoint);
  return Object.fromEntries(
    (Object.keys(frame) as ResponsiveFrameKey[]).map((key) => [key, frame[key] === undefined ? undefined : frame[key]! * scale]),
  ) as Partial<ResponsiveFrame>;
}

export function resolveCmsElementForBreakpoint(element: CmsElement, breakpoint: CmsBreakpoint) {
  const frame = resolveCmsElementFrame(element, breakpoint);
  const override = breakpoint === "desktop" ? undefined : element.responsive?.[breakpoint];
  const scale = breakpoint === "desktop" ? 1 : PAGE_WIDTH / CMS_BREAKPOINT_WIDTH[breakpoint];
  return {
    ...frame,
    hidden: breakpoint === "desktop" ? !!element.hidden : override?.hidden ?? !!element.hidden,
    fontSize: override?.fontSize === undefined ? undefined : override.fontSize * scale,
  };
}

export function getCmsElementFontSizeInBreakpoint(element: CmsElement, breakpoint: CmsBreakpoint): number {
  const baseSize = typeof element.style?.size === "number" ? element.style.size : 16;
  if (breakpoint === "desktop") return baseSize;
  return element.responsive?.[breakpoint]?.fontSize ?? baseSize * responsiveScale(breakpoint);
}

export function getCmsElementForBreakpoint(element: CmsElement, breakpoint: CmsBreakpoint): CmsElement {
  const resolved = resolveCmsElementForBreakpoint(element, breakpoint);
  return {
    ...element,
    ...resolved,
    style: resolved.fontSize === undefined ? element.style : { ...element.style, size: resolved.fontSize },
  };
}

export type CmsBreakpointPatch = Partial<Record<ResponsiveFrameKey, number | null> & { hidden: boolean | null; fontSize: number | null }>;

export function applyCmsElementBreakpointPatch(
  element: CmsElement,
  breakpoint: CmsBreakpoint,
  patch: CmsBreakpointPatch,
): CmsElement {
  if (breakpoint === "desktop") {
    const next: CmsElement = { ...element };
    for (const key of ["x", "y", "w", "h"] as const) {
      const value = patch[key];
      if (typeof value === "number") next[key] = value;
    }
    if (typeof patch.hidden === "boolean") next.hidden = patch.hidden;
    if (typeof patch.fontSize === "number") next.style = { ...element.style, size: patch.fontSize };
    return next;
  }
  const responsive = { ...element.responsive };
  const override: Record<string, unknown> = { ...(responsive[breakpoint] ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete override[key];
    else if (value !== undefined) override[key] = value;
  }
  if (Object.keys(override).length) responsive[breakpoint] = override as NonNullable<NonNullable<CmsElement["responsive"]>["tablet"]>;
  else delete responsive[breakpoint];
  return { ...element, responsive: Object.keys(responsive).length ? responsive : undefined };
}
