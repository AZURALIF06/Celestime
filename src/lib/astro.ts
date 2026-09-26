// Célestime — moteur astronomique (isolé de l'interface, section 42).
// Chaîne : USER INPUT → GÉOCODAGE → DONNÉES ASTRONOMIQUES → CALCUL DU CIEL → RENDU.
//
// Données : Yale Bright Star Catalogue (BSC5) — 1 433 étoiles réelles (V ≤ 4,9),
// positions J2000. Calculs : temps sidéral moyen (formule IAU/Meeus),
// conversion équinostale → horizontale, projection stéréographique.
// Aucune donnée n'est inventée : chaque étoile affichée est une entrée du catalogue.

import { STARS } from "@/data/stars";

const RAD = Math.PI / 180;

export interface SkyStar {
  alt: number; // degrés
  az: number; // degrés, 0 = Nord, sens horaire (Est)
  mag: number;
  k: number; // température de couleur
}

export interface MilkyWaySegment {
  alt1: number;
  az1: number;
  alt2: number;
  az2: number;
  w: number; // pondération de luminosité (centre galactique)
}

export interface ComputedSky {
  stars: SkyStar[];
  milkyWay: MilkyWaySegment[];
  sunAlt: number;
  jd: number;
  lst: number;
  lat: number;
  lon: number;
  timestamp: number;
}

export function julianDate(ms: number): number {
  return ms / 86400000 + 2440587.5;
}

export function gmstDeg(jd: number): number {
  const d = jd - 2451545.0;
  const T = d / 36525;
  let g = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000;
  g %= 360;
  if (g < 0) g += 360;
  return g;
}

/** Décalage (minutes) du fuseau IANA à l'instant donné.
 *  wallMs = heure locale codée comme si c'était l'UTC. */
export function tzOffsetMinutes(wallMs: number, timezone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(new Date(wallMs))) p[part.type] = part.value;
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return (asUtc - wallMs) / 60000;
  } catch {
    return 0;
  }
}

function altAz(jd: number, lat: number, lon: number, ra: number, dec: number): { alt: number; az: number } {
  const lst = (gmstDeg(jd) + lon) % 360;
  const H = (lst - ra) * RAD;
  const phi = lat * RAD;
  const d = dec * RAD;
  const sinAlt = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H);
  const alt = Math.asin(Math.min(1, Math.max(-1, sinAlt)));
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(phi) - Math.cos(d) * Math.sin(phi) * Math.cos(H));
  const azDeg = ((az / RAD) % 360 + 360) % 360;
  return { alt: alt / RAD, az: azDeg };
}

/** Altitude du Soleil (approximation standard, précision ~0,01°). */
export function sunAltitude(jd: number, lat: number, lon: number): number {
  const n = jd - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = 23.439 * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda)) / RAD;
  return altAz(jd, lat, lon, ra, dec).alt;
}

// Base orthonormale du repère galactique (ICRS) :
// X̂ = centre galactique (l=0, b=0), Ŷ = (l=90°, b=0), Ẑ = pôle galactique nord.
const GX = [-0.048028, -0.873437, -0.483835];
const GY = [0.494109, -0.444988, 0.746982];

/** Plan galactique échantillonné (l de 0 à 357°, b=0) en RA/Dec équinostaux. */
export const GALACTIC_PLANE: { l: number; ra: number; dec: number }[] = (() => {
  const pts: { l: number; ra: number; dec: number }[] = [];
  for (let l = 0; l < 360; l += 3) {
    const lr = l * RAD;
    const x = GX[0] * Math.cos(lr) + GY[0] * Math.sin(lr);
    const y = GX[1] * Math.cos(lr) + GY[1] * Math.sin(lr);
    const z = GX[2] * Math.cos(lr) + GY[2] * Math.sin(lr);
    const ra = (Math.atan2(y, x) / RAD + 360) % 360;
    const dec = Math.asin(Math.min(1, Math.max(-1, z))) / RAD;
    pts.push({ l, ra, dec });
  }
  return pts;
})();

/** Calcule le ciel visible (étoiles du catalogue au-dessus de l'horizon)
 *  pour une heure locale, un lieu et son fuseau IANA. */
export function computeSky(
  wallYear: number,
  wallMonth: number,
  wallDay: number,
  wallHour: number,
  wallMinute: number,
  lat: number,
  lon: number,
  timezone: string
): ComputedSky {
  const wallMs = Date.UTC(wallYear, wallMonth - 1, wallDay, wallHour, wallMinute, 0);
  const utcMs = wallMs + tzOffsetMinutes(wallMs, timezone) * 60000;
  const jd = julianDate(utcMs);

  const stars: SkyStar[] = [];
  for (let i = 0; i < STARS.length; i++) {
    const [ra, dec, mag, k] = STARS[i];
    const { alt, az } = altAz(jd, lat, lon, ra, dec);
    if (alt > -0.6) stars.push({ alt, az, mag, k });
  }

  const plane = GALACTIC_PLANE;
  const mw: MilkyWaySegment[] = [];
  for (let i = 0; i < plane.length; i++) {
    const a = plane[i];
    const b = plane[(i + 1) % plane.length];
    const pa = altAz(jd, lat, lon, a.ra, a.dec);
    const pb = altAz(jd, lat, lon, b.ra, b.dec);
    const w = 0.3 + 0.7 * Math.pow((1 + Math.cos((a.l * RAD))) / 2, 1.6);
    mw.push({ alt1: pa.alt, az1: pa.az, alt2: pb.alt, az2: pb.az, w });
  }

  const lst = (gmstDeg(jd) + lon) % 360;
  return {
    stars,
    milkyWay: mw,
    sunAlt: sunAltitude(jd, lat, lon),
    jd,
    lst,
    lat,
    lon,
    timestamp: Date.now(),
  };
}

/** Projection stéréographique : alt/az → rayon normalisé [0..1] (0 = zénith). */
export function projectRadius(alt: number): number {
  if (alt >= 90) return 0;
  if (alt <= -88) return 9;
  return Math.tan(((90 - alt) * RAD) / 2);
}

/** az (0 = N, horaire) + projection → coordonnées écran.
 *  Convention céleste : Nord en haut, Est à gauche (vue depuis l'intérieur du dôme). */
export function projectXY(alt: number, az: number, R: number, cx: number, cy: number): { x: number; y: number } {
  const r = projectRadius(alt) * R;
  const a = az * RAD;
  return { x: cx - r * Math.sin(a), y: cy - r * Math.cos(a) };
}

// ---------------------------------------------------------------------------
// Constellations : figures de bâtonnets sur étoiles réelles (RA/Dec J2000).
// ---------------------------------------------------------------------------

export interface Constellation {
  name: string;
  lines: [number, number, number, number][]; // [ra1, dec1, ra2, dec2]
  label: [number, number]; // ancre du nom (ra, dec)
}

const c = (name: string, label: [number, number], pts: number[][]): Constellation => ({
  name,
  label,
  lines: pts.map((p) => [p[0], p[1], p[2], p[3]] as [number, number, number, number]),
});

export const CONSTELLATIONS: Constellation[] = [
  c("Grande Ourse", [200, 57], [
    [165.86, 61.75, 165.46, 56.38], [165.46, 56.38, 232.98, 53.69], [232.98, 53.69, 183.86, 57.03],
    [183.86, 57.03, 165.86, 61.75], [183.86, 57.03, 193.51, 55.96], [193.51, 55.96, 200.98, 54.93],
    [200.98, 54.93, 206.89, 49.31],
  ]),
  c("Petite Ourse", [207, 78], [
    [37.95, 89.26, 17.52, 86.58], [17.52, 86.58, 16.84, 82.04], [16.84, 82.04, 25.37, 77.79],
    [25.37, 77.79, 29.31, 75.75], [29.31, 75.75, 220.1, 74.16], [220.1, 74.16, 209.03, 71.83],
    [209.03, 71.83, 25.37, 77.79],
  ]),
  c("Cassiopée", [345, 60], [
    [2.29, 59.15, 10.13, 56.54], [10.13, 56.54, 28.6, 60.72], [28.6, 60.72, 346.32, 60.24],
    [346.32, 60.24, 344.41, 63.67],
  ]),
  c("Orion", [84.5, 2], [
    [88.79, 7.41, 81.28, 6.35], [81.28, 6.35, 83.24, -0.3], [83.24, -0.3, 84.05, -1.2],
    [84.05, -1.2, 85.19, -1.94], [85.19, -1.94, 86.75, -9.67], [85.19, -1.94, 88.79, 7.41],
    [86.75, -9.67, 78.63, -8.2], [78.63, -8.2, 83.24, -0.3],
  ]),
  c("Cygne", [305, 39.5], [
    [310.36, 45.28, 305.21, 40.26], [305.21, 40.26, 310.01, 33.92],
    [305.21, 40.26, 292.73, 27.96], [305.21, 40.26, 314.94, 45.18],
  ]),
  c("Lyre", [297, 35.5], [
    [279.23, 38.78, 293.99, 37.6], [279.23, 38.78, 296.6, 36.9], [293.99, 37.6, 298.79, 33.36],
    [298.79, 33.36, 300.18, 32.69], [300.18, 32.69, 296.6, 36.9], [296.6, 36.9, 293.99, 37.6],
  ]),
  c("Aigle", [298, 9.5], [
    [297.09, 10.61, 297.69, 8.87], [297.69, 8.87, 298.99, 6.41], [297.69, 8.87, 288.8, -1.85],
  ]),
  c("Taureau", [73, 21], [
    [81.72, 28.61, 68.98, 16.51], [68.98, 16.51, 81.55, 21.14],
  ]),
  c("Gémeaux", [114, 27], [
    [113.65, 31.89, 111.98, 21.98], [111.98, 21.98, 116.33, 28.03], [116.33, 28.03, 99.42, 16.4],
  ]),
  c("Grand Chien", [100, -22], [
    [95.11, -17.96, 98.97, -16.72], [98.97, -16.72, 104.65, -26.39], [104.65, -26.39, 97.52, -28.97],
    [104.65, -26.39, 111.02, -29.3],
  ]),
  c("Petit Chien", [115.5, 7], [[114.83, 5.22, 115.41, 8.27]]),
  c("Bouvier", [212, 25], [
    [213.92, 19.18, 206.23, 27.07], [213.92, 19.18, 217.65, 17.54], [206.23, 27.07, 205.31, 38.31],
  ]),
  c("Pégase", [348, 22.5], [
    [346.22, 15.21, 345.92, 28.02], [345.92, 28.02, 2.09, 29.09],
    [2.09, 29.09, 3.45, 15.31], [3.45, 15.31, 346.22, 15.21],
  ]),
  c("Andromède", [20, 37.5], [[2.09, 29.09, 17.4, 35.59], [17.4, 35.59, 30.97, 42.33]]),
  c("Scorpion", [250, -26.5], [
    [241.36, -19.81, 240.08, -22.62], [240.08, -22.62, 242.38, -19.81],
    [240.08, -22.62, 247.35, -26.43], [247.35, -26.43, 245.77, -34.29],
    [245.77, -34.29, 263.4, -37.1], [263.4, -37.1, 264.33, -37.3],
    [264.33, -37.3, 264.93, -42.99], [264.93, -42.99, 266.56, -43.44],
  ]),
  c("Sagittaire", [280, -30.5], [
    [283.81, -26.3, 280.37, -25.42], [280.37, -25.42, 279.02, -29.83],
    [279.02, -29.83, 276.04, -34.38], [276.04, -34.38, 276.92, -29.87],
    [276.92, -29.87, 279.24, -29.88], [279.24, -29.88, 279.02, -29.83],
  ]),
  c("Lion", [168, 14], [
    [152.09, 11.97, 154.99, 19.84], [154.99, 19.84, 177.36, 23.42],
    [177.36, 23.42, 186.68, 23.77], [186.68, 23.77, 177.32, 14.57],
    [177.32, 14.57, 157.68, -14.57], [157.68, -14.57, 152.09, 11.97],
  ]),
  c("Vierge", [206, 3], [
    [201.3, -11.16, 202.22, -1.43], [202.22, -1.43, 209.42, 10.96],
  ]),
  c("Persée", [54, 47.5], [
    [50.78, 58.97, 55.4, 49.86], [55.4, 49.86, 47.06, 40.96], [55.4, 49.86, 61.68, 40.97],
  ]),
  c("Bélier", [33, 21.5], [[33.17, 23.46, 32.44, 20.81], [32.44, 20.81, 36.1, 19.25]]),
  c("Capricorne", [321, -14], [
    [312.12, -13.28, 318.02, -12.54], [318.02, -12.54, 330.62, -16.13], [318.02, -12.54, 316.85, -14.1],
  ]),
  c("Verseau", [326, -6.5], [[321.5, -0.32, 325.7, -5.57], [325.7, -5.57, 333.83, -15.85]]),
  c("Poisson", [340, 3], [[342.42, 3.57, 337.74, 2.1]]),
  c("Croix du Sud", [196, -61.5], [
    [187.76, -65.33, 187.51, -57.11], [203.48, -59.69, 191.93, -59.7],
  ]),
  c("Dragon", [244, 59], [
    [217.92, 64.38, 249.5, 58.32], [249.5, 58.32, 273.71, 51.49], [273.71, 51.49, 269.15, 52.3],
  ]),
  c("Éridan", [48, -50], [
    [24.43, -57.24, 46.32, -46.68], [46.32, -46.68, 50.72, -52.09],
    [50.72, -52.09, 55.91, -59.8], [55.91, -59.8, 60.94, -54.71], [60.94, -54.71, 71.54, -57.13],
  ]),
  c("Hercule", [264, 27.5], [
    [254.89, 28.08, 269.91, 21.49], [269.91, 21.49, 271.88, 33.41],
  ]),
];

// ---------------------------------------------------------------------------
// Utilitaires de formatage (affichés sur la carte)
// ---------------------------------------------------------------------------

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function formatDMS(value: number, isLat: boolean): string {
  const dir = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "O";
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}′ ${dir}`;
}

export function formatDecimal(value: number, isLat: boolean): string {
  const dir = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "O";
  return `${Math.abs(value).toFixed(4)}° ${dir}`;
}

export function formatFrenchDate(day: number, month: number, year: number): string {
  return `${day} ${MONTHS_FR[month - 1]} ${year}`;
}

export function formatFrenchTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}h${String(minute).padStart(2, "0")}`;
}

/** Couleur approx. d'une étoile à partir de sa température (corps noir). */
const kCache = new Map<number, [number, number, number]>();
export function kToRgb(k: number): [number, number, number] {
  const hit = kCache.get(k);
  if (hit) return hit;
  const t = k / 100;
  let r: number, g: number, b: number;
  if (t <= 66) r = 255;
  else r = Math.max(0, 329.698727446 * Math.pow(t - 60, -0.1332047592));
  if (t <= 66) g = Math.max(0, 99.4708025861 * Math.log(t) - 161.1195681661);
  else g = Math.max(0, 288.1221695283 * Math.pow(t - 60, -0.0755148492));
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = Math.max(0, 138.5177312231 * Math.log(t - 10) - 305.0447927307);
  const out: [number, number, number] = [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
  kCache.set(k, out);
  return out;
}
