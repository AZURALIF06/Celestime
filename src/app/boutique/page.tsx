import type { Metadata } from "next";
import Link from "next/link";
import { BoutiqueCmsLayout } from "@/components/page/boutique-cms-layout";
import { getProducts } from "@/lib/catalog";
import { getPublishedBoutique } from "@/lib/boutique-cms";
import { eur } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "La collection Célestime : cartes du ciel de naissance, Étoiles de Rencontre, Étoiles de Nous Deux, Notre journée à nous, calendrier, carnet et recueil de poèmes cosmiques. Livrés avec certificat d'authenticité.",
};

export default async function BoutiquePage() {
  const [all, editorialPage] = await Promise.all([getProducts(), getPublishedBoutique()]);
  const PRODUCTS = all.filter((p) => p.status === "active");

  if (editorialPage) return <BoutiqueCmsLayout page={editorialPage} products={PRODUCTS} />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] tracking-[0.3em] text-gold uppercase">La collection</p>
        <h1 className="mt-3 font-display text-5xl text-ink">La boutique Célestime</h1>
        <p className="mt-4 text-muted">
          Chaque création est personnalisée à partir de votre moment précis, imprimée sur papier
          satiné 250 g et livrée avec son certificat d'authenticité.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => (
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

      <div className="mt-16 rounded-3xl border border-line bg-surface/50 px-6 py-10 text-center">
        <h2 className="font-display text-3xl text-ink">Un moment particulier en tête ?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Naissance, rencontre, mariage, anniversaire : indiquez le prénom, la date, l'heure et le
          lieu — nous recomposons le ciel de cet instant précis.
        </p>
        <Link
          href="/create"
          className="mt-6 inline-block rounded-full bg-gold px-8 py-3.5 text-sm font-medium tracking-[0.16em] text-night uppercase transition-all hover:bg-goldsoft"
        >
          Personnaliser ma carte
        </Link>
      </div>
    </div>
  );
}
