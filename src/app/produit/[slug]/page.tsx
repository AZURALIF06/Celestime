import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductPreview from "./product-preview";
import { getProducts, type DbProduct } from "@/lib/catalog";
import { sizeById } from "@/lib/options";
import { eur } from "@/lib/pricing";
import type { CreationConfig } from "@/lib/types";

const PREVIEW_BY_SLUG: Record<string, CreationConfig> = {
  "etoiles-de-naissance": {
    productId: "etoiles-de-naissance", occasion: "naissance", name: "Camille", message: "",
    day: "25", month: "02", year: "2025", hour: "12", minute: "00", timeApprox: false,
    location: { name: "Cannes", country: "France", latitude: 43.5513, longitude: 7.0127, timezone: "Europe/Paris" },
    background: "saphir", shape: "medaillon", framed: false, size: "A4", quantity: 1,
  },
  "etoiles-de-nous-deux": {
    productId: "etoiles-de-nous-deux", occasion: "mariage", name: "Louise & Arnaud", message: "",
    day: "14", month: "09", year: "2024", hour: "17", minute: "30", timeApprox: false,
    location: { name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris" },
    background: "rubis", shape: "coeur", framed: false, size: "A4", quantity: 1,
  },
  "etoiles-de-rencontre": {
    productId: "etoiles-de-rencontre", occasion: "rencontre", name: "Élise", message: "",
    day: "14", month: "02", year: "2020", hour: "19", minute: "45", timeApprox: false,
    location: { name: "New York City", country: "États-Unis", latitude: 40.7143, longitude: -74.006, timezone: "America/New_York" },
    background: "emeraude", shape: "coeur", framed: false, size: "A4", quantity: 1,
  },
  "notre-journee-a-nous": {
    productId: "notre-journee-a-nous", occasion: "souvenir", name: "Notre été", message: "",
    day: "15", month: "07", year: "2023", hour: "21", minute: "30", timeApprox: false,
    location: { name: "Lyon", country: "France", latitude: 45.764, longitude: 4.8357, timezone: "Europe/Paris" },
    background: "saphir", shape: "medaillon", framed: false, size: "A3", quantity: 1,
  },
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = (await getProducts()).find((x) => x.slug === slug);
  if (!p) return { title: "Produit introuvable" };
  const seo = (p.seo as { title?: string; description?: string; noindex?: boolean } | null) ?? {};
  return {
    title: seo.title ?? p.name,
    description: seo.description ?? p.tagline,
    robots: seo.noindex ? { index: false } : undefined,
    openGraph: { title: `${p.name} — Célestime`, description: p.tagline },
  };
}

const REVIEWS = [
  { who: "Cliente vérifiée", text: "Le site est clair, la livraison a été rapide et les produits correspondent parfaitement aux photos. Je recommande sans hésiter." },
  { who: "Client vérifié", text: "Belle qualité d'impression et livraison rapide. Le cadre est un peu plus clair que sur les photos, mais le résultat reste superbe." },
  { who: "Cliente vérifiée", text: "Très joli rendu, bien emballé. Petit délai supplémentaire à cause de la personnalisation, mais ça valait la peine d'attendre." },
];

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await getProducts();
  const p: DbProduct | undefined = all.find((x) => x.slug === slug);
  if (!p || p.status !== "active") notFound();
  const related = all.filter((x) => x.slug !== slug && x.status === "active").slice(0, 3);
  const preview = PREVIEW_BY_SLUG[slug];
  const sizes = p.sizes.length > 0 ? p.sizes.map((id) => sizeById(id)) : [];
  const configuratorReady = p.kind === "starmap" && Boolean(p.engine);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.fullName,
            description: p.description,
            brand: { "@type": "Brand", name: "Célestime" },
            image: `https://www.celestime.fr${p.image}`,
            offers: {
              "@type": "Offer",
              priceCurrency: "EUR",
              price: (p.priceFrom / 100).toFixed(2),
              availability: "https://schema.org/InStock",
              url: `https://www.celestime.fr/produit/${p.slug}`,
            },
            aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviewsCount },
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Accueil", item: "https://www.celestime.fr" },
                { "@type": "ListItem", position: 2, name: "Boutique", item: "https://www.celestime.fr/boutique" },
                { "@type": "ListItem", position: 3, name: p.name },
              ],
            },
          }),
        }}
      />

      <nav aria-label="Fil d'Ariane" className="mb-8 flex flex-wrap items-center gap-2 text-xs tracking-[0.14em] text-faint uppercase">
        <Link href="/" className="hover:text-ink">Accueil</Link>
        <span aria-hidden="true">/</span>
        <Link href="/boutique" className="hover:text-ink">Boutique</Link>
        <span aria-hidden="true">/</span>
        <span className="text-muted">{p.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="sticky top-24">
            <div className="overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={p.fullName} className="aspect-[4/3] w-full object-cover" />
            </div>
            {preview && (
              <div className="mt-4 rounded-2xl border border-line bg-surface p-3 shadow-2xl shadow-black/40">
                <ProductPreview config={preview} />
                <p className="px-2 pt-3 pb-1 text-center text-[11px] tracking-[0.16em] text-faint uppercase">
                  Aperçu recomposé en direct par le moteur Célestime
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] tracking-[0.3em] text-gold uppercase">Création Célestime</p>
          <h1 className="mt-2 font-display text-5xl text-ink">{p.name}</h1>
          <p className="mt-3 font-display text-xl text-goldsoft italic">{p.tagline}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gold" aria-label={`${p.rating} sur 5`}>
              {"★".repeat(Math.round(p.rating))}
              <span className="text-faint">{"★".repeat(5 - Math.round(p.rating))}</span>
            </span>
            <span className="text-faint">{p.rating}/5 · {p.reviewsCount} avis vérifiés</span>
          </div>
          <p className="mt-5 font-display text-3xl text-ink">
            dès <span className="text-gold">{eur(p.priceFrom)}</span>
            {p.onPromo && p.oldPrice ? (
              <span className="ml-3 align-middle font-sans text-base text-faint line-through">{eur(p.oldPrice)}</span>
            ) : null}
            <span className="ml-2 font-sans text-xs text-faint">TTC · livraison offerte</span>
            {p.onPromo && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 align-middle font-sans text-[11px] text-gold">Promo</span>}
          </p>
          <p className="mt-5 leading-relaxed text-muted">{p.description}</p>

          {configuratorReady ? (
            <div className="mt-8">
              <Link
                href={`/create?product=${p.slug}`}
                className="inline-block w-full rounded-full bg-gold px-8 py-4 text-center text-sm font-medium tracking-[0.18em] text-night uppercase transition-all hover:bg-goldsoft sm:w-auto"
              >
                Personnaliser ma carte
              </Link>
              <p className="mt-3 text-xs text-faint">
                Preview en temps réel · Prix Célestime · Modifiable depuis le panier · Coffret avec certificat d'authenticité
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-line p-5">
              <p className="text-sm text-ink">{p.kind === "starmap" ? "Configurateur en préparation pour ce produit." : "Bientôt dans le configurateur Célestime."}</p>
              <p className="mt-1 text-xs text-muted">
                Ce produit rejoint le configurateur Célestime : son image, son prix et ses options actuels restent inchangés.
              </p>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-8 rounded-2xl border border-line bg-surface/50 p-6">
              <h2 className="text-xs tracking-[0.22em] text-gold uppercase">Formats disponibles</h2>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {sizes.map((s) => (
                  <li key={s.id} className="rounded-lg border border-line px-3 py-2">
                    <span className="text-ink">{s.label} — {s.tag}</span>
                    <span className="block text-xs tabular-nums text-faint">
                      {s.w.toLocaleString("fr-FR")} × {s.h.toLocaleString("fr-FR")} cm
                    </span>
                  </li>
                ))}
              </ul>
              {p.framed && (
                <p className="mt-3 text-xs text-muted">
                  Présentée avec soin et, en option, dans un cadre. Chaque pièce peut être encadrée,
                  présentée et offerte comme un véritable objet d'art.
                </p>
              )}
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-xs tracking-[0.22em] text-gold uppercase">Le coffret cadeau contient</h2>
            <ul className="mt-3 space-y-2">
              {p.box.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-ink">
                  <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8">
            <h2 className="text-xs tracking-[0.22em] text-gold uppercase">Avis clients</h2>
            <div className="mt-4 space-y-4">
              {REVIEWS.map((r, i) => (
                <div key={i} className="rounded-xl border border-line bg-surface/40 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-ink">{r.who}</p>
                    <span className="text-xs text-gold">★★★★★</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-20">
        <h2 className="mb-6 font-display text-3xl text-ink">Vous aimerez aussi</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {related.map((r) => (
            <Link key={r.slug} href={`/produit/${r.slug}`} className="group overflow-hidden rounded-2xl border border-line bg-surface/50 transition-all hover:-translate-y-0.5 hover:border-gold/50">
              <div className="aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.image} alt={r.fullName} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="p-5">
                <h3 className="font-display text-xl text-ink">{r.name}</h3>
                <p className="mt-1 line-clamp-1 text-sm text-muted">{r.tagline}</p>
                <p className="mt-2 text-sm text-gold">dès {eur(r.priceFrom)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
