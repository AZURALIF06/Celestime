import { asc } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, pages } from "@/db/schema";
import { SITE_MAP_ROUTES, SITE_MAP_SHARED_MEDIA, type SiteMapRoute } from "@/lib/site-map";

export interface CmsPageRecord {
  id: string;
  name: string;
  slug: string;
  path: string;
  status: string;
  updatedAt: string | null;
  editHref: string;
  media: string[];
}

export interface CmsBlogRecord {
  id: string;
  title: string;
  slug: string;
  path: string;
  status: string;
  updatedAt: string | null;
  editHref: string;
  media: string[];
}

export interface InspectedMedia {
  url: string;
  sources: string[];
}

export interface SiteMapInspection {
  routes: SiteMapRoute[];
  cmsPages: CmsPageRecord[];
  blogPosts: CmsBlogRecord[];
  media: InspectedMedia[];
  generatedAt: string;
  warning: string | null;
}

const MEDIA_URL = /^(?:\/images\/|\/media\/|\/api\/media\/|https?:\/\/.*\.(?:png|jpe?g|webp|gif|avif|svg)(?:\?.*)?$)/i;

function collectMedia(value: unknown, result = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    const candidate = value.trim();
    if (MEDIA_URL.test(candidate)) result.add(candidate);
  } else if (Array.isArray(value)) {
    for (const item of value) collectMedia(item, result);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectMedia(item, result);
  }
  return result;
}

function asIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function inspectSiteMap(): Promise<SiteMapInspection> {
  const warningParts: string[] = [];
  let pageRows: (typeof pages.$inferSelect)[] = [];
  let blogRows: (typeof blogPosts.$inferSelect)[] = [];

  try {
    pageRows = await db.select().from(pages).orderBy(asc(pages.slug));
  } catch (error) {
    warningParts.push(`Pages CMS indisponibles : ${error instanceof Error ? error.message : "erreur de base de données"}`);
  }

  try {
    blogRows = await db.select().from(blogPosts).orderBy(asc(blogPosts.slug));
  } catch (error) {
    warningParts.push(`Articles du blog indisponibles : ${error instanceof Error ? error.message : "erreur de base de données"}`);
  }

  const cmsPages: CmsPageRecord[] = pageRows.map((page) => ({
    id: page.id,
    name: page.name,
    slug: page.slug,
    path: page.slug === "faq" ? "/faq" : `/p/${page.slug}`,
    status: page.status,
    updatedAt: asIso(page.updatedAt),
    editHref: `/admin/editor/${encodeURIComponent(page.id)}`,
    media: [...collectMedia(page.status === "published" && page.published ? page.published : page.draft)],
  }));

  const blogRecords: CmsBlogRecord[] = blogRows.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    path: `/blog/${post.slug}`,
    status: post.status,
    updatedAt: asIso(post.updatedAt),
    editHref: "/admin/blog",
    media: [...collectMedia(post.cover)],
  }));

  const references = new Map<string, Set<string>>();
  const addMedia = (url: string, source: string) => {
    const sources = references.get(url) ?? new Set<string>();
    sources.add(source);
    references.set(url, sources);
  };

  for (const route of SITE_MAP_ROUTES) {
    for (const url of route.media) addMedia(url, route.path);
  }
  for (const item of SITE_MAP_SHARED_MEDIA) addMedia(item.url, item.source);
  for (const page of cmsPages) for (const url of page.media) addMedia(url, page.path);
  for (const post of blogRecords) for (const url of post.media) addMedia(url, post.path);

  const media = [...references.entries()]
    .map(([url, sources]) => ({ url, sources: [...sources].sort() }))
    .sort((a, b) => a.url.localeCompare(b.url, "fr"));

  return {
    routes: SITE_MAP_ROUTES,
    cmsPages,
    blogPosts: blogRecords,
    media,
    generatedAt: new Date().toISOString(),
    warning: warningParts.length ? warningParts.join(" · ") : null,
  };
}
