import generated from "./generated/site-map.json";

export interface SiteMapRoute {
  path: string;
  file: string;
  kind: "admin" | "dynamic" | "static";
  sourceType: "administration" | "code";
  lastModified: string | null;
  media: string[];
}

export interface SharedMediaReference {
  url: string;
  source: string;
}

const manifest = generated as {
  generatedAt: string;
  routes: SiteMapRoute[];
  sharedMedia: SharedMediaReference[];
};

export const SITE_MAP_GENERATED_AT = manifest.generatedAt;
export const SITE_MAP_ROUTES = manifest.routes;
export const SITE_MAP_SHARED_MEDIA = manifest.sharedMedia;

export function routeLabel(path: string): string {
  if (path === "/") return "Accueil";
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/^\[\.\.\.(.*)\]$/, "$1 (tout)").replace(/^\[\[?(.*)\]?\]$/, "$1 (dynamique)").replace(/-/g, " "))
    .join(" / ");
}

export function routeIsDynamic(path: string): boolean {
  return /\[[^\]]+\]/.test(path);
}
