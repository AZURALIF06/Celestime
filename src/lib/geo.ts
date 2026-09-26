// Célestime — service de géocodage (serveur).
// 1) Jeu de données local (GeoNames, 11 000 villes, fuseau IANA exact).
// 2) Repli : Nominatim (OpenStreetMap) si la ville n'est pas locale.

import { CITIES } from "@/data/cities";
import type { GeocodeResult } from "./types";

export interface CityHit extends GeocodeResult {
  score: number;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const localCache = new Map<string, CityHit[]>();

export function searchCitiesLocal(query: string, limit = 5): CityHit[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const cached = localCache.get(q);
  if (cached) return cached;

  const hits: CityHit[] = [];
  for (const [name, cc, lat, lon, tz] of CITIES) {
    const n = normalize(name);
    let score = 0;
    if (n === q) score = 100;
    else if (n.startsWith(q)) score = 70 - Math.min(10, n.length - q.length);
    else if (n.includes(` ${q}`)) score = 42;
    else if (q.length >= 4 && n.includes(q)) score = 30;
    if (score > 0) {
      hits.push({ name, country: COUNTRY_NAMES[cc] ?? cc, latitude: lat, longitude: lon, timezone: tz, score });
      if (hits.length > 400) break;
    }
  }
  hits.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  const top = hits.slice(0, limit);
  localCache.set(q, top);
  return top;
}

const COUNTRY_NAMES: Record<string, string> = {
  FR: "France", ES: "Espagne", IT: "Italie", BE: "Belgique", CH: "Suisse", DE: "Allemagne",
  NL: "Pays-Bas", PT: "Portugal", GB: "Royaume-Uni", IE: "Irlande", IS: "Islande",
  US: "États-Unis", CA: "Canada", MX: "Mexique", BR: "Brésil", AR: "Argentine", CL: "Chili",
  CO: "Colombie", PE: "Pérou", EC: "Équateur", UY: "Uruguay", BO: "Bolivie", VE: "Venezuela",
  MA: "Maroc", DZ: "Algérie", TN: "Tunisie", LY: "Libye", SN: "Sénégal", CI: "Côte d'Ivoire",
  ML: "Mali", NE: "Niger", TD: "Tchad", SD: "Soudan", ET: "Éthiopie", EG: "Égypte",
  ZA: "Afrique du Sud", KE: "Kenya", NG: "Nigéria", GH: "Ghana", CM: "Cameroun",
  JP: "Japon", KR: "Corée du Sud", CN: "Chine", IN: "Inde", TH: "Thaïlande", VN: "Viêt Nam",
  ID: "Indonésie", PH: "Philippines", MY: "Malaisie", SG: "Singapour", AU: "Australie", NZ: "Nouvelle-Zélande",
  AT: "Autriche", PL: "Pologne", CZ: "Tchéquie", SK: "Slovaquie", HU: "Hongrie", RO: "Roumanie",
  BG: "Bulgarie", RS: "Serbie", HR: "Croatie", SI: "Slovénie", GR: "Grèce", TR: "Turquie",
  NO: "Norvège", SE: "Suède", DK: "Danemark", FI: "Finlande", EE: "Estonie", LV: "Lettonie", LT: "Lituanie",
  RU: "Russie", UA: "Ukraine", MD: "Moldavie", GE: "Géorgie", IL: "Israël", SA: "Arabie saoudite",
  AE: "Émirats arabes unis", QA: "Qatar", KW: "Koweït", BH: "Bahreïn", OM: "Oman", IQ: "Irak",
  IR: "Iran", LB: "Liban", JO: "Jordanie", PK: "Pakistan", BD: "Bangladesh", LK: "Sri Lanka",
  MM: "Myanmar", KH: "Cambodge", LA: "Laos", MN: "Mongolie", KP: "Corée du Nord", TW: "Taïwan", HK: "Hong Kong",
  PT2: "Portugal",
};

/** Repli : Nominatim (OpenStreetMap) pour les villes hors du jeu de données local. */
async function nominatimSearch(query: string): Promise<GeocodeResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=fr&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Celestine/1.0 (cartes du ciel personnalisées ; contact@celestime.fr)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      name: string;
      lat: string;
      lon: string;
      display_name: string;
      addresstype?: string;
    }[];
    return data
      .filter((d) => d.addresstype !== "neighbourhood")
      .map((d) => {
        const parts = d.display_name.split(", ").map((s) => s.trim());
        const country = parts[parts.length - 1];
        const lat = parseFloat(d.lat);
        const lon = parseFloat(d.lon);
        return {
          name: d.name,
          country,
          latitude: lat,
          longitude: lon,
          timezone: guessTimezone(country, lat, lon),
        };
      });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Estimation du fuseau IANA quand la source ne l'indique pas. */
function guessTimezone(country: string, lat: number, lon: number): string {
  const byCountry: Record<string, string> = {
    France: "Europe/Paris", Espagne: "Europe/Madrid", Italie: "Europe/Rome", Belgique: "Europe/Brussels",
    "Pays-Bas": "Europe/Amsterdam", Suisse: "Europe/Zurich", Allemagne: "Europe/Berlin", Portugal: "Europe/Lisbon",
    "Royaume-Uni": "Europe/London", Irlande: "Europe/Dublin", "Nouvelle-Zélande": "Pacific/Auckland",
    Australie: "Australia/Sydney", "États-Unis": "America/New_York", Canada: "America/Toronto",
    "Afrique du Sud": "Africa/Johannesburg", Maroc: "Africa/Casablanca", Algérie: "Africa/Algiers",
    Tunisie: "Africa/Tunis", Sénégal: "Africa/Dakar", Japon: "Asia/Tokyo", "Corée du Sud": "Asia/Seoul",
    Inde: "Asia/Kolkata", "Arabie saoudite": "Asia/Riyadh", "Émirats arabes unis": "Asia/Dubai",
    Brésil: "America/Sao_Paulo", Argentine: "America/Argentina/Buenos_Aires", Chili: "America/Santiago",
    Mexique: "America/Mexico_City", Turquie: "Europe/Istanbul",
  };
  const base = byCountry[country] ?? "UTC";
  // Raffinement par longitude pour les grands fuseaux
  if (country === "États-Unis") {
    if (lon < -154) return "Pacific/Honolulu";
    if (lon < -141) return "America/Anchorage";
    if (lon < -114) return "America/Los_Angeles";
    if (lon < -102) return "America/Denver";
    if (lon < -84) return "America/Chicago";
    return "America/New_York";
  }
  if (country === "Canada") {
    if (lon < -130) return "America/Pacific_Pacific";
    if (lon < -110) return "America/Vancouver";
    if (lon < -95) return "America/Edmonton";
    return "America/Toronto";
  }
  if (country === "Australie") {
    if (lon < 131) return "Australia/Adelaide";
    if (lon < 136.5) return "Australia/Darwin";
    if (lat > -24) return "Australia/Brisbane";
    return "Australia/Sydney";
  }
  if (country === "Russie") {
    if (lon < 30) return "Europe/Kaliningrad";
    if (lon < 60) return "Europe/Moscow";
    if (lon < 85) return "Europe/Samara";
    if (lon < 105) return "Asia/Yekaterinburg";
    if (lon < 135) return "Asia/Novosibirsk";
    if (lon < 165) return "Asia/Krasnoyarsk";
    return "Asia/Vladivostok";
  }
  if (country === "Brésil") {
    if (lon < -63) return "America/Manaus";
    if (lon < -44) return "America/Cuiaba";
    return "America/Sao_Paulo";
  }
  return base;
}

export interface GeocodeResponse {
  results: (GeocodeResult & { via: "local" | "nominatim" })[];
}

export async function geocode(query: string): Promise<GeocodeResponse> {
  const local = searchCitiesLocal(query).map((h) => ({
    name: h.name,
    country: h.country,
    latitude: h.latitude,
    longitude: h.longitude,
    timezone: h.timezone,
    via: "local" as const,
  }));
  if (local.length > 0) return { results: local };
  const remote = await nominatimSearch(query);
  return { results: remote.map((r) => ({ ...r, via: "nominatim" as const })) };
}
