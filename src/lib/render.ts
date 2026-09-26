// Célestime — moteur de rendu.
// La composition reproduit le produit Célestime : fond du poster en dégradé
// (Saphir / Rubis / Émeraude), ciel nocturne réel dans la forme choisie
// (Medaillon ou Cœur), nom, date, lieu et message.
// La preview et le fichier d'impression sont deux représentations du même
// état de configuration, rendus par cette même fonction.

import {
  CONSTELLATIONS,
  formatFrenchDate,
  formatFrenchTime,
  kToRgb,
  projectXY,
  type ComputedSky,
} from "./astro";
import { backgroundById, productBySlug, sizeById } from "./options";
import type { CreationConfig } from "./types";

const RAD = Math.PI / 180;

export function posterPixelSize(config: CreationConfig, dpi = 300): { w: number; h: number } {
  const s = sizeById(config.size);
  const px = (cm: number) => Math.round((cm / 2.54) * dpi);
  return { w: px(s.w), h: px(s.h) };
}

function isLandscape(config: CreationConfig): boolean {
  return sizeById(config.size).landscape;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function shapePath(ctx: CanvasRenderingContext2D, shape: string, cx: number, cy: number, s: number) {
  // s = demi-largeur de référence
  if (shape === "coeur") {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.95);
    ctx.bezierCurveTo(cx - s * 1.38, cy + s * 0.16, cx - s * 1.08, cy - s * 0.92, cx, cy - s * 0.34);
    ctx.bezierCurveTo(cx + s * 1.08, cy - s * 0.92, cx + s * 1.38, cy + s * 0.16, cx, cy + s * 0.95);
    ctx.closePath();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
  }
}

export function renderPoster(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  config: CreationConfig,
  sky: ComputedSky | null
) {
  const bg = backgroundById(config.background);
  const landscape = isLandscape(config);
  const unit = W;

  ctx.clearRect(0, 0, W, H);
  ctx.save();

  // ---- Fond du poster (dégradé) -------------------------------------------
  const stops = bg.stops;
  const g = ctx.createLinearGradient(0, 0, landscape ? W * 0.5 : 0, H);
  const n = stops.length;
  stops.forEach((s, i) => g.addColorStop(n === 1 ? 1 : i / (n - 1), s));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // voile douce en haut (profondeur)
  const topShade = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  topShade.addColorStop(0, "rgba(0,0,0,0.34)");
  topShade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, W, H * 0.5);

  // ---- Géométrie du ciel ----------------------------------------------------
  let cx: number, cy: number, s: number; // s = rayon (medaillon) ou demi-largeur (cœur)
  if (landscape) {
    cx = W * 0.285;
    cy = H * 0.5;
    s = H * 0.315;
  } else {
    cx = W / 2;
    cy = H * (config.shape === "coeur" ? 0.4 : 0.41);
    s = W * (config.shape === "coeur" ? 0.31 : 0.33);
  }
  const R = config.shape === "coeur" ? s * 0.92 : s * 0.97; // rayon de projection

  // ---- Ciel dans la forme ----------------------------------------------------
  ctx.save();
  shapePath(ctx, config.shape, cx, cy, s);
  ctx.clip();

  const sg = ctx.createRadialGradient(cx, cy - s * 0.3, s * 0.1, cx, cy, s * 1.35);
  sg.addColorStop(0, bg.skyStops[0]);
  sg.addColorStop(1, bg.skyStops[1]);
  ctx.fillStyle = sg;
  ctx.fillRect(cx - s * 1.5, cy - s * 1.5, s * 3, s * 3);

  // Voie lactée discrète (élément du rendu Célestime)
  if (sky) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(196,208,238,1)";
    ctx.filter = `blur(${unit / 55}px)`;
    for (const seg of sky.milkyWay) {
      if (seg.alt1 < 0 && seg.alt2 < 0) continue;
      const p1 = projectXY(Math.max(seg.alt1, -2), seg.az1, R, cx, cy);
      const p2 = projectXY(Math.max(seg.alt2, -2), seg.az2, R, cx, cy);
      const d1 = Math.hypot(p1.x - cx, p1.y - cy);
      const d2 = Math.hypot(p2.x - cx, p2.y - cy);
      if (d1 > R * 1.05 && d2 > R * 1.05) continue;
      ctx.globalAlpha = 0.04 + 0.1 * seg.w;
      ctx.lineWidth = (unit / 900) * 34;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Constellations (élément du produit : « les étoiles et les constellations »)
  if (sky) {
    const lineCol = hexToRgb(bg.accent);
    ctx.save();
    ctx.strokeStyle = rgba(lineCol, 0.42);
    ctx.lineWidth = Math.max(0.5, unit / 1300);
    const lst = sky.lst;
    for (const con of CONSTELLATIONS) {
      let any = false;
      for (const [ra1, dec1, ra2, dec2] of con.lines) {
        const h1 = (lst - ra1) * RAD;
        const h2 = (lst - ra2) * RAD;
        const phi = sky.lat * RAD;
        const d1 = dec1 * RAD;
        const d2 = dec2 * RAD;
        const alt1 = Math.asin(Math.sin(phi) * Math.sin(d1) + Math.cos(phi) * Math.cos(d1) * Math.cos(h1)) / RAD;
        const alt2 = Math.asin(Math.sin(phi) * Math.sin(d2) + Math.cos(phi) * Math.cos(d2) * Math.cos(h2)) / RAD;
        if (alt1 < -1.5 || alt2 < -1.5) continue;
        const az1 = normAz(Math.atan2(-Math.cos(d1) * Math.sin(h1), Math.sin(d1) * Math.cos(phi) - Math.cos(d1) * Math.sin(phi) * Math.cos(h1)));
        const az2 = normAz(Math.atan2(-Math.cos(d2) * Math.sin(h2), Math.sin(d2) * Math.cos(phi) - Math.cos(d2) * Math.sin(phi) * Math.cos(h2)));
        const p1 = projectXY(Math.max(alt1, -1), az1, R, cx, cy);
        const p2 = projectXY(Math.max(alt2, -1), az2, R, cx, cy);
        if (Math.hypot(p1.x - cx, p1.y - cy) > R * 1.05 && Math.hypot(p2.x - cx, p2.y - cy) > R * 1.05) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        any = true;
      }
      if (any) {
        const [lra, ldec] = con.label;
        const h = (lst - lra) * RAD;
        const d = ldec * RAD;
        const phi = sky.lat * RAD;
        const alt = Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h)) / RAD;
        if (alt > 10) {
          const az = normAz(Math.atan2(-Math.cos(d) * Math.sin(h), Math.sin(d) * Math.cos(phi) - Math.cos(d) * Math.sin(phi) * Math.cos(h)));
          const p = projectXY(alt, az, R, cx, cy);
          ctx.fillStyle = rgba([226, 230, 244], 0.4);
          ctx.font = `${Math.max(5, unit / 210)}px 'Jost', sans-serif`;
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.max(0.5, unit / 500)}px`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(con.name.toUpperCase(), p.x, p.y - unit / 210);
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
        }
      }
    }
    ctx.restore();
  }

  // Étoiles du catalogue (réelles)
  if (sky) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const st of sky.stars) {
      if (st.alt < 0) continue;
      const p = projectXY(st.alt, st.az, R, cx, cy);
      if (Math.hypot(p.x - cx, p.y - cy) > R * 1.02) continue;
      const base = Math.max(0.8, 4.6 - st.mag * 0.6) * (unit / 700);
      const col = kToRgb(st.k);
      const glow = base * 3;
      const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
      gg.addColorStop(0, rgba(col, 0.95));
      gg.addColorStop(0.35, rgba(col, 0.3));
      gg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(col, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, base * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore(); // fin clip forme

  // Anneau du medaillon
  if (config.shape === "medaillon") {
    ctx.save();
    ctx.strokeStyle = rgba(hexToRgb(bg.accent), 0.55);
    ctx.lineWidth = Math.max(0.8, unit / 900);
    ctx.beginPath();
    ctx.arc(cx, cy, s + unit / 260, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---- Textes ----------------------------------------------------------------
  const tcol = bg.textColor;
  const accent = hexToRgb(bg.accent);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const setLS = (px: number) => {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`;
  };

  const nameY = landscape ? H * 0.145 : H * 0.105;
  const nameX = landscape ? cx : W / 2;
  const nameSize = unit * (landscape ? 0.052 : 0.062);
  if (config.name.trim()) {
    ctx.fillStyle = tcol;
    ctx.font = `${nameSize}px 'Cormorant Garamond', Georgia, serif`;
    setLS(nameSize * 0.02);
    ctx.fillText(config.name.trim(), nameX, nameY + nameSize);
    setLS(0);
  }

  // Bloc date / lieu / message
  const blockX = landscape ? W * 0.715 : W / 2;
  const maxW = landscape ? W * 0.44 : W * 0.8;
  let y = landscape ? H * 0.3 : H * (config.shape === "coeur" ? 0.755 : 0.745);

  const hasMeta = sky && config.day && config.month && config.year;
  if (hasMeta) {
    const d = +config.day, mo = +config.month, yr = +config.year;
    const timePart =
      config.timeApprox || (config.hour !== "" && config.minute !== "")
        ? ` · ${formatFrenchTime(config.timeApprox ? 12 : +config.hour, config.timeApprox ? 0 : +config.minute)}${config.timeApprox ? " (heure approximative)" : ""}`
        : "";
    // séparateur
    const sepY = y - unit * 0.018;
    ctx.strokeStyle = rgba(accent, 0.55);
    ctx.lineWidth = Math.max(0.5, unit / 2600);
    const lw = unit * 0.05;
    ctx.beginPath();
    ctx.moveTo(blockX - lw, sepY);
    ctx.lineTo(blockX - unit * 0.007, sepY);
    ctx.moveTo(blockX + unit * 0.007, sepY);
    ctx.lineTo(blockX + lw, sepY);
    ctx.stroke();
    const ds = unit * 0.008;
    ctx.fillStyle = rgba(accent, 0.8);
    ctx.save();
    ctx.translate(blockX, sepY);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-ds / 2, -ds / 2, ds, ds);
    ctx.restore();

    const size = unit * (landscape ? 0.024 : 0.026);
    ctx.font = `400 ${size}px 'Jost', sans-serif`;
    setLS(size * 0.1);
    ctx.fillStyle = tcol;
    ctx.globalAlpha = 0.92;
    wrapText(ctx, `${formatFrenchDate(d, mo, yr)}${timePart}`, blockX, y + size * 1.6, maxW, size * 1.5);
    ctx.globalAlpha = 1;
    setLS(0);
    y += size * 1.7;
  }

  if (sky && config.location) {
    const size = unit * (landscape ? 0.022 : 0.024);
    ctx.font = `400 ${size}px 'Jost', sans-serif`;
    setLS(size * 0.12);
    ctx.globalAlpha = 0.8;
    ctx.fillText(`${config.location.name}, ${config.location.country}`.toUpperCase(), blockX, y + size * 1.5);
    ctx.globalAlpha = 1;
    setLS(0);
    y += size * 1.75;
  }

  if (config.message.trim()) {
    const size = unit * (landscape ? 0.026 : 0.029);
    ctx.font = `${size * 1.15}px 'Parisienne', cursive`;
    ctx.globalAlpha = 0.95;
    wrapText(ctx, config.message.trim(), blockX, y + size * 1.6, maxW, size * 1.7);
    ctx.globalAlpha = 1;
    y += size * 2.1;
  }

  // Marque Célestime
  const wordY = landscape ? H * 0.94 : H * 0.955;
  const wordSize = unit * 0.016;
  ctx.font = `500 ${wordSize}px 'Jost', sans-serif`;
  setLS(wordSize * 0.42);
  ctx.fillStyle = rgba([236, 233, 226], 0.62);
  ctx.fillText("CÉLESTIME", landscape ? W * 0.5 : W / 2, wordY);
  setLS(0);

  ctx.restore();
}

function normAz(rad: number): number {
  return ((rad / RAD) % 360 + 360) % 360;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxW: number,
  lineH: number
) {
  const words = text.split(/\s+/);
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}

// Moteur de produits : le rendu est piloté par le catalogue Célestime.
export { productBySlug };
