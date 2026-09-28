export interface CanvasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasGuide {
  axis: "x" | "y";
  position: number;
}

export interface CanvasSnapOptions {
  enabled: boolean;
  gridEnabled: boolean;
  gridSize?: number;
  threshold?: number;
  canvasWidth: number;
  canvasHeight: number;
  otherFrames: CanvasFrame[];
}

export function screenDeltaToCanvas(delta: number, scale: number): number {
  return scale > 0 && Number.isFinite(scale) ? delta / scale : 0;
}

export function canvasFitZoom(availableWidth: number, logicalWidth: number, baseScale: number): number {
  if (availableWidth <= 0 || logicalWidth <= 0 || baseScale <= 0) return 25;
  const rawZoom = (availableWidth / (logicalWidth * baseScale)) * 100;
  return Math.min(150, Math.max(25, Math.round(rawZoom / 5) * 5));
}

export function appendHistorySnapshot(
  history: string[],
  index: number,
  snapshot: string,
  limit = 50,
): { history: string[]; index: number; changed: boolean } {
  if (history[index] === snapshot) return { history, index, changed: false };
  const next = [...history.slice(0, index + 1), snapshot].slice(-Math.max(1, limit));
  return { history: next, index: next.length - 1, changed: true };
}

export function clampFrame(frame: CanvasFrame, canvasWidth: number, canvasHeight: number): CanvasFrame {
  const maxX = Math.max(0, canvasWidth - Math.min(frame.w, canvasWidth));
  const maxY = Math.max(0, canvasHeight - Math.min(frame.h, canvasHeight));
  return {
    ...frame,
    x: Math.min(maxX, Math.max(0, frame.x)),
    y: Math.min(maxY, Math.max(0, frame.y)),
  };
}

export function resizeFrame(
  initial: CanvasFrame,
  direction: string,
  dx: number,
  dy: number,
  canvasWidth: number,
  canvasHeight: number,
  minSize: number,
): CanvasFrame {
  const boundedInitial = clampFrame({
    ...initial,
    w: Math.min(canvasWidth, Math.max(minSize, initial.w)),
    h: Math.min(canvasHeight, Math.max(minSize, initial.h)),
  }, canvasWidth, canvasHeight);
  let { x, y, w, h } = boundedInitial;
  if (direction.includes("e")) w = Math.min(canvasWidth - x, Math.max(minSize, w + dx));
  if (direction.includes("s")) h = Math.min(canvasHeight - y, Math.max(minSize, h + dy));
  if (direction.includes("w")) {
    const right = x + w;
    x = Math.min(right - minSize, Math.max(0, x + dx));
    w = right - x;
  }
  if (direction.includes("n")) {
    const bottom = y + h;
    y = Math.min(bottom - minSize, Math.max(0, y + dy));
    h = bottom - y;
  }
  w = Math.max(minSize, Math.min(w, canvasWidth - x));
  h = Math.max(minSize, Math.min(h, canvasHeight - y));
  return { x, y, w, h };
}

function snapAxis(
  start: number,
  size: number,
  targets: number[],
  threshold: number,
): { value: number; guide: number | null } {
  const anchors = [start, start + size / 2, start + size];
  let bestDistance = Number.POSITIVE_INFINITY;
  let value = start;
  let guide: number | null = null;
  for (const anchor of anchors) {
    for (const target of targets) {
      const distance = Math.abs(target - anchor);
      if (distance <= threshold && distance < bestDistance) {
        bestDistance = distance;
        value = start + target - anchor;
        guide = target;
      }
    }
  }
  return { value, guide };
}

export function snapFrame(
  frame: CanvasFrame,
  options: CanvasSnapOptions,
): { frame: CanvasFrame; guides: CanvasGuide[] } {
  if (!options.enabled) return { frame: clampFrame(frame, options.canvasWidth, options.canvasHeight), guides: [] };
  const threshold = Math.max(0, options.threshold ?? 8);
  const gridSize = Math.max(1, options.gridSize ?? 20);
  const xTargets = [0, options.canvasWidth / 2, options.canvasWidth];
  const yTargets = [0, options.canvasHeight / 2, options.canvasHeight];
  for (const other of options.otherFrames) {
    xTargets.push(other.x, other.x + other.w / 2, other.x + other.w);
    yTargets.push(other.y, other.y + other.h / 2, other.y + other.h);
  }
  let xResult = snapAxis(frame.x, frame.w, xTargets, threshold);
  let yResult = snapAxis(frame.y, frame.h, yTargets, threshold);
  if (options.gridEnabled) {
    const gridX = Math.round(frame.x / gridSize) * gridSize;
    const gridY = Math.round(frame.y / gridSize) * gridSize;
    if (Math.abs(gridX - frame.x) <= threshold && (xResult.guide === null || Math.abs(gridX - frame.x) < Math.abs(xResult.value - frame.x))) {
      xResult = { value: gridX, guide: gridX };
    }
    if (Math.abs(gridY - frame.y) <= threshold && (yResult.guide === null || Math.abs(gridY - frame.y) < Math.abs(yResult.value - frame.y))) {
      yResult = { value: gridY, guide: gridY };
    }
  }
  return {
    frame: clampFrame({ ...frame, x: xResult.value, y: yResult.value }, options.canvasWidth, options.canvasHeight),
    guides: [
      ...(xResult.guide === null ? [] : [{ axis: "x" as const, position: xResult.guide }]),
      ...(yResult.guide === null ? [] : [{ axis: "y" as const, position: yResult.guide }]),
    ],
  };
}

export function alignFrame(
  frame: CanvasFrame,
  alignment: "left" | "centerX" | "right" | "top" | "centerY" | "bottom",
  canvasWidth: number,
  canvasHeight: number,
): CanvasFrame {
  switch (alignment) {
    case "left": return { ...frame, x: 0 };
    case "centerX": return { ...frame, x: (canvasWidth - frame.w) / 2 };
    case "right": return { ...frame, x: canvasWidth - frame.w };
    case "top": return { ...frame, y: 0 };
    case "centerY": return { ...frame, y: (canvasHeight - frame.h) / 2 };
    case "bottom": return { ...frame, y: canvasHeight - frame.h };
  }
}
