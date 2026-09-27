"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CmsBlogRecord, CmsPageRecord, InspectedMedia } from "@/lib/cms-inspect";
import { routeIsDynamic, routeLabel, type SiteMapRoute } from "@/lib/site-map";

interface Props {
  routes: SiteMapRoute[];
  cmsPages: CmsPageRecord[];
  blogPosts: CmsBlogRecord[];
  media: InspectedMedia[];
  generatedAt: string;
  warning: string | null;
}

type Filter = "public" | "admin" | "all";

function formatDate(value: string | null | undefined) {
  if (!value) return "Date indisponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date indisponible" : date.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function statusLabel(status: string) {
  if (status === "published") return "Publiée";
  if (status === "draft") return "Brouillon";
  if (status === "archived") return "Archivée";
  if (status === "scheduled") return "Programmée";
  return status || "Statut inconnu";
}

export default function SiteMapClient(initial: Props) {
  const [filter, setFilter] = useState<Filter>("public");
  const [inspection, setInspection] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const entries = useMemo(() => {
    const routeEntries = inspection.routes.map((route) => {
      const isAdmin = route.kind === "admin";
      const isBlog = route.path === "/blog" || route.path.startsWith("/blog/");
      const isCmsPattern = route.path === "/p/[slug]";
      const dynamic = routeIsDynamic(route.path);
      let type = isAdmin ? "Administration" : route.kind === "static" ? "Codée en dur" : "Route dynamique";
      let status = isAdmin ? "Page administrative" : route.kind === "static" ? "Non connectée au CMS" : "Modèle de route";
      let href: string | null = isAdmin ? route.path : !dynamic ? route.path : null;
      let action = isAdmin ? "Ouvrir" : !dynamic ? "Voir la page" : null;

      if (isCmsPattern) {
        type = "Route CMS dynamique";
        status = "Pages CMS listées séparément";
        href = "/admin/pages";
        action = "Gérer les pages";
      } else if (isBlog) {
        type = dynamic ? "Modèle de contenu CMS" : "Index de contenu CMS";
        status = "Contenu géré dans le blog";
        href = "/admin/blog";
        action = "Gérer le blog";
      } else if (route.path === "/produit/[slug]") {
        type = "Route dynamique — catalogue";
        status = "Données produit ; pas une page éditable dans cet éditeur";
        href = null;
        action = null;
      }

      return {
        key: `route:${route.path}`,
        path: route.path,
        name: routeLabel(route.path),
        type,
        status,
        date: route.lastModified,
        href,
        action,
        media: route.media,
        admin: isAdmin,
      };
    });

    const cmsEntries = [
      ...inspection.cmsPages.map((page) => ({
        key: `cms:${page.id}`,
        path: page.path,
        name: page.name,
        type: "Page CMS",
        status: statusLabel(page.status),
        date: page.updatedAt,
        href: page.editHref,
        action: "Éditer",
        media: page.media,
        admin: false,
      })),
      ...inspection.blogPosts.map((post) => ({
        key: `blog:${post.id}`,
        path: post.path,
        name: post.title,
        type: "Article CMS",
        status: statusLabel(post.status),
        date: post.updatedAt,
        href: post.editHref,
        action: "Gérer dans le blog",
        media: post.media,
        admin: false,
      })),
    ];

    return [...routeEntries, ...cmsEntries].filter((entry) =>
      filter === "all" || (filter === "admin" ? entry.admin : !entry.admin)
    );
  }, [filter, inspection]);

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const response = await fetch("/api/admin/site-map", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "La cartographie n’a pas pu être actualisée.");
      setInspection(data as Props);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Erreur lors de l’actualisation.");
    } finally {
      setRefreshing(false);
    }
  }

  const publicPages = inspection.routes.filter((route) => route.kind !== "admin").length + inspection.cmsPages.length + inspection.blogPosts.length;
  const hardcodedPages = inspection.routes.filter((route) => route.kind === "static" && !route.path.startsWith("/blog")).length;
  const dynamicRoutes = inspection.routes.filter((route) => route.kind === "dynamic").length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.2em] text-gold uppercase">Cartographie du projet</p>
            <h2 className="mt-2 font-display text-2xl text-ink">Pages réellement détectées</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Les routes sont lues depuis les fichiers <code>page.tsx</code> présents dans <code>src/app</code>.
              Les pages CMS et les contenus du blog sont ajoutés depuis les données existantes. Une route codée en dur
              n’est pas présentée comme éditable dans l’éditeur.
            </p>
          </div>
          <button onClick={refresh} disabled={refreshing} className="rounded-full border border-line px-4 py-2 text-xs tracking-wide text-ink hover:border-gold disabled:opacity-50">
            {refreshing ? "Actualisation…" : "Actualiser les données CMS"}
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Entrées cartographiées" value={String(publicPages)} />
          <Metric label="Routes codées en dur" value={String(hardcodedPages)} />
          <Metric label="Modèles dynamiques" value={String(dynamicRoutes)} />
          <Metric label="Pages CMS" value={String(inspection.cmsPages.length + inspection.blogPosts.length)} />
        </div>
        <p className="mt-4 text-[11px] text-faint">Cartographie du code générée le {formatDate(inspection.generatedAt)}.</p>
      </section>

      {(inspection.warning || refreshError) && (
        <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
          {refreshError ?? inspection.warning} Les routes du code restent visibles ; les données CMS indisponibles ne sont pas inventées.
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div>
            <h3 className="font-display text-xl text-ink">Carte du site</h3>
            <p className="mt-1 text-xs text-muted">Les pages sans connexion CMS restent en lecture seule ici.</p>
          </div>
          <div className="flex gap-1 rounded-full border border-line p-1" aria-label="Filtrer les pages">
            {([ ["public", "Pages du site"], ["admin", "Administration"], ["all", "Tout"] ] as [Filter, string][]).map(([value, label]) => (
              <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-[11px] ${filter === value ? "bg-gold text-night" : "text-muted hover:text-ink"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-[10px] tracking-[0.16em] text-faint uppercase">
              <tr><th className="px-4 py-3">Page / route</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">État</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Action</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.key} className="border-b border-line/50 last:border-0 hover:bg-raised/30">
                  <td className="px-4 py-3">
                    <p className="text-ink">{entry.name}</p>
                    <code className="mt-1 block text-[11px] text-muted">{entry.path}</code>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{entry.type}</td>
                  <td className="px-4 py-3"><span className={`inline-block rounded-full px-2.5 py-1 text-[10px] ${entry.type.includes("CMS") || entry.type === "Page CMS" || entry.type === "Article CMS" ? "bg-emerald-900/30 text-emerald-200" : "bg-raised text-muted"}`}>{entry.status}</span></td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDate(entry.date)}</td>
                  <td className="px-4 py-3 text-right">
                    {entry.href && entry.action ? (
                      <Link href={entry.href} target={entry.action === "Voir la page" ? "_blank" : undefined} rel={entry.action === "Voir la page" ? "noreferrer" : undefined} className="inline-block rounded-full border border-line px-3 py-1.5 text-[11px] text-ink hover:border-gold hover:text-gold">
                        {entry.action}
                      </Link>
                    ) : <span className="text-[11px] text-faint">Aucune édition disponible</span>}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">Aucune route détectée pour ce filtre.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-display text-xl text-ink">Médias repérés dans les contenus</h3>
            <p className="mt-1 text-xs text-muted">Références littérales du code et médias retrouvés dans les pages CMS/blog existantes.</p>
          </div>
          <span className="text-xs text-faint">{inspection.media.length} référence(s)</span>
        </div>
        {inspection.media.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inspection.media.map((item) => (
              <article key={item.url} className="flex min-w-0 gap-3 rounded-xl border border-line bg-night/60 p-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-raised">
                  {item.url.match(/\.(?:png|jpe?g|webp|gif|avif|svg)(?:\?.*)?$/i) || item.url.startsWith("/api/media/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : <span className="text-2xl text-gold">◇</span>}
                </div>
                <div className="min-w-0 self-center">
                  <a href={item.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-ink hover:text-gold">{item.url}</a>
                  <p className="mt-1 line-clamp-2 text-[10px] text-faint">Repéré dans : {item.sources.join(", ")}</p>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Aucune référence média détectée.</p>}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-night/60 p-3"><p className="text-[10px] tracking-wider text-faint uppercase">{label}</p><p className="mt-1 font-display text-2xl text-gold">{value}</p></div>;
}
