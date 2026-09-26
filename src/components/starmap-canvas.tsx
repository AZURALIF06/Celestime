"use client";

// Célestime — prévisualisation temps réel du produit Célestime.
// Le même moteur de rendu dessine la preview ET le fichier imprimable.

import { useEffect, useMemo, useRef, useState } from "react";
import { computeSky, type ComputedSky } from "@/lib/astro";
import { posterPixelSize, renderPoster } from "@/lib/render";
import { sizeById } from "@/lib/options";
import type { CreationConfig } from "@/lib/types";

export function skyInputsComplete(config: CreationConfig): boolean {
  return Boolean(
    config.day &&
      config.month &&
      config.year &&
      config.location &&
      (config.timeApprox || (config.hour !== "" && config.minute !== ""))
  );
}

/** Rendu haute résolution (300 DPI) du même état de configuration. */
export function renderHighRes(config: CreationConfig, sky: ComputedSky): { dataUrl: string; wPx: number; hPx: number; dpi: number } {
  let { w, h } = posterPixelSize(config, 300);
  let dpi = 300;
  const MAX_AREA = 68_000_000;
  if (w * h > MAX_AREA) {
    const f = Math.sqrt(MAX_AREA / (w * h));
    w = Math.floor(w * f);
    h = Math.floor(h * f);
    dpi = Math.round(300 * f);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  renderPoster(ctx, w, h, config, sky);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), wPx: w, hPx: h, dpi };
}

export function StarMapCanvas({
  config,
  sky,
  className,
  maxRenderPx = 1400,
}: {
  config: CreationConfig;
  sky: ComputedSky | null;
  className?: string;
  maxRenderPx?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    document.fonts?.ready?.then(() => alive && setFontsReady(true)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const landscape = sizeById(config.size).landscape;
  const aspect = landscape ? 4 / 3 : 3 / 4;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !size || size.w < 20) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = size.w;
    let h = Math.round(size.w / aspect);
    if (h > size.h) {
      h = size.h;
      w = Math.round(size.h * aspect);
    }
    const scale = Math.min(1, maxRenderPx / Math.max(w, h));
    canvas.width = Math.round(w * dpr * scale);
    canvas.height = Math.round(h * dpr * scale);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderPoster(ctx, canvas.width, canvas.height, config, sky);
  }, [config, sky, size, aspect, fontsReady, maxRenderPx]);

  return (
    <div ref={wrapRef} className={className} style={{ position: "relative" }}>
      <canvas ref={ref} style={{ position: "absolute", inset: 0, margin: "auto" }} aria-label="Aperçu de votre création Célestime" role="img" />
    </div>
  );
}

/** Hook de calcul du ciel (mémoïsé sur date/heure/lieu). */
export function useSky(config: CreationConfig): { sky: ComputedSky | null; computing: boolean; computeMs: number } {
  const [state, setState] = useState<{ sky: ComputedSky | null; computing: boolean; computeMs: number }>({
    sky: null,
    computing: false,
    computeMs: 0,
  });
  const key = useMemo(() => {
    if (!skyInputsComplete(config)) return "";
    const loc = config.location!;
    const h = config.timeApprox ? 12 : +config.hour;
    const m = config.timeApprox ? 0 : +config.minute;
    return `${config.day}/${config.month}/${config.year} ${h}:${m} ${loc.latitude.toFixed(4)} ${loc.longitude.toFixed(4)} ${loc.timezone}`;
  }, [config]);

  useEffect(() => {
    if (!key) {
      setState({ sky: null, computing: false, computeMs: 0 });
      return;
    }
    const t0 = performance.now();
    const sky = computeSky(
      +config.day,
      +config.month,
      +config.year,
      config.timeApprox ? 12 : +config.hour,
      config.timeApprox ? 0 : +config.minute,
      config.location!.latitude,
      config.location!.longitude,
      config.location!.timezone
    );
    const ms = performance.now() - t0;
    setState({ sky, computing: false, computeMs: ms });
  }, [key, config.day, config.month, config.year, config.hour, config.minute, config.timeApprox, config.location]);

  return state;
}
