import Link from "next/link";
import { PageCanvas } from "@/app/p/[slug]/page-canvas";
import { eur } from "@/lib/pricing";
import type { CmsPage } from "@/lib/cms";
import type { DbProduct } from "@/lib/catalog";

/** Hybrid layout: CMS editorial sections surround, but never replace, the live product catalog. */
export function BoutiqueCmsLayout({ page, products }: { page: CmsPage; products: DbProduct[] }) {
  const beforeProducts = page.sections.slice(0, 1);
  const afterProducts = page.sections.slice(1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      {beforeProducts.length > 0 && <PageCanvas page={{ sections: beforeProducts }} products={[]} />}
      <BoutiqueProductGrid products={products} />
      {afterProducts.length > 0 && <PageCanvas page={{ sections: afterProducts }} products={[]} />}
    </div>
  );
}

export function BoutiqueProductGrid({ products }: { products: DbProduct[] }) {
  return (
    <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <Link
          key={p.slug}
          href={`/produit/${p.slug}`}
          className="group overflow-hidden rounded-2xl border border-line bg-surface/60 transition-all hover:-translate-y-1 hover:border-gold/60"
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image}
              alt={p.fullName}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <span className="absolute top-3 left-3 rounded-full border border-line bg-night/70 px-2.5 py-0.5 text-[10px] tracking-[0.16em] text-muted uppercase backdrop-blur-sm">
              {p.kind === "starmap" ? "Personnalisable" : "Bientôt personnalisable"}
            </span>
          </div>
          <div className="p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl text-ink">{p.name}</h2>
              <span className="shrink-0 text-sm text-gold">dès {eur(p.priceFrom)}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{p.tagline}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-faint">
              <span>
                ★ {p.rating}/5 · {p.reviewsCount} avis
              </span>
              <span className="tracking-[0.14em] text-gold uppercase opacity-0 transition-opacity group-hover:opacity-100">
                Découvrir →
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
