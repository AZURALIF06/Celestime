import type { Metadata } from "next";
import Link from "next/link";
import { HeroCanvas, ShowcaseGallery } from "@/components/showcase";
import { PRODUCTS } from "@/lib/options";
import { eur } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Célestime — Cartes du ciel personnalisées",
  description:
    "Chaque naissance a son étoile, chaque instant son ciel. Célestime recompose le ciel exact du moment de votre choix : prénom, date, heure, lieu. Coffret avec certificat d'authenticité, papier satiné 250 g, livraison offerte.",
};

const FAQ = [
  {
    q: "Que représente la carte du ciel ?",
    a: "La carte du ciel représente les étoiles et les constellations visibles à la date, à l'heure et au lieu indiqués. Elle permet de garder un souvenir symbolique d'un moment important. Notre moteur recompose ce firmament à partir du catalogue des étoiles réelles : aucune image générique.",
  },
  {
    q: "Quelles informations dois-je fournir ?",
    a: "Vous devez renseigner le prénom, la date de naissance, l'heure de naissance et le lieu de naissance. Vous pouvez également ajouter un message personnalisé, qui apparaît sur la carte et sur le carton d'accompagnement du coffret.",
  },
  {
    q: "Dois-je connaître l'heure exacte de naissance ?",
    a: "L'heure exacte est recommandée pour créer une carte la plus précise possible. Si vous ne la connaissez pas, vous pouvez indiquer une heure approximative : elle sera estimée à midi local et clairement signalée comme telle sur la carte. Nous ne présentons jamais une heure estimée comme exacte.",
  },
  {
    q: "Puis-je ajouter un message personnalisé ?",
    a: "Oui, vous pouvez ajouter un prénom, une date, une phrase ou un message personnel afin de rendre votre création encore plus unique.",
  },
  {
    q: "Cette création est-elle réservée aux enfants ?",
    a: "Non. Elle peut être créée pour un bébé ou un enfant, mais aussi pour un adulte, un couple ou toute personne importante. Elle convient pour une naissance, un anniversaire, un baptême, un mariage, une rencontre ou toute autre occasion spéciale.",
  },
  {
    q: "Est-ce une bonne idée de cadeau ?",
    a: "Oui. La carte du ciel est un cadeau original, personnalisé et rempli de sens. Le coffret — carte, certificat d'authenticité et carton d'accompagnement avec votre message — en fait une attention idéale pour une naissance, un mariage ou une rencontre.",
  },
  {
    q: "Où puis-je l'installer ?",
    a: "Vous pouvez l'encadrer et l'installer dans une chambre d'enfant, une chambre parentale, un salon, un bureau ou tout autre espace de votre intérieur. Chaque pièce peut être encadrée, présentée et offerte comme un véritable objet d'art.",
  },
  {
    q: "Comment choisir ma carte ?",
    a: "Choisissez le fond du poster (saphir, rubis ou émeraude), la forme du ciel (medaillon ou cœur) et le format (A4 à A0), avec ou sans cadre. Renseignez ensuite le prénom, la date, l'heure et le lieu, puis validez votre commande. La prévisualisation se met à jour en temps réel.",
  },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Célestime",
            url: "https://www.celestime.fr",
            description:
              "Cartes du ciel personnalisées : le ciel exact de votre moment, prénom, date, heure et lieu. Coffret avec certificat d'authenticité, papier satiné 250 g, cadre en option.",
            sameAs: [
              "https://www.instagram.com/celestimecreation/",
              "https://facebook.com/profile.php?id=61593742990020",
              "https://tiktok.com/@celestime_astro",
            ],
          }),
        }}
      />

      {/* HERO — accroche réelle Célestime */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 70% 10%, rgba(35,42,90,0.5) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 15% 85%, rgba(201,168,106,0.07) 0%, transparent 60%)",
          }}
        />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div className="anim-fade-up">
            <p className="text-[11px] tracking-[0.3em] text-gold uppercase">Célestime · cartes du ciel personnalisées</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] text-ink sm:text-6xl lg:text-[4.2rem]">
              Chaque naissance a son étoile,
              <span className="block text-goldsoft italic">chaque instant son ciel.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              Avec Célestime, offrez la beauté du moment où tout a commencé. Indiquez le prénom, la
              date, l'heure et le lieu : nous recomposons le ciel exact de cet instant, sur papier
              satiné 250 g, dans un medaillon ou un cœur saphir, rubis ou émeraude.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/create"
                className="rounded-full bg-gold px-8 py-4 text-sm font-medium tracking-[0.18em] text-night uppercase transition-all hover:bg-goldsoft"
              >
                Personnaliser ma carte
              </Link>
              <Link
                href="/boutique"
                className="rounded-full border border-line px-8 py-4 text-sm tracking-[0.18em] text-ink uppercase transition-colors hover:border-gold"
              >
                Découvrir la boutique
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-xs tracking-[0.14em] text-faint uppercase">
              <span>★ 4,8/5 — avis vérifiés</span>
              <span>Offert : certificat d'authenticité</span>
              <span>Livraison rapide et gratuite</span>
            </div>
          </div>
          <div className="anim-fade-up relative mx-auto w-full max-w-sm" style={{ animationDelay: "0.15s" }}>
            <div
              className="absolute -inset-6 rounded-[2rem] opacity-60 blur-2xl"
              style={{ background: "radial-gradient(circle at 50% 40%, rgba(35,48,110,0.55), transparent 70%)" }}
              aria-hidden="true"
            />
            <div className="relative rounded-2xl border border-line bg-surface p-3 shadow-2xl shadow-black/60">
              <HeroCanvas />
              <div className="flex items-center justify-between px-2 pt-3 pb-1">
                <p className="text-[11px] tracking-[0.2em] text-muted uppercase">Cannes · 25 février 2025</p>
                <p className="text-[11px] tracking-[0.14em] text-gold uppercase">Aperçu réel</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMMENT ÇA FONCTIONNE (texte Célestime) */}
      <section className="border-y border-line bg-surface/50">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-4">
          {[
            ["01", "Votre moment", "Indiquez le prénom, la date, l'heure et le lieu : naissance, rencontre, mariage, anniversaire…"],
            ["02", "Votre ciel", "Nous créons une représentation personnalisée du ciel correspondant à cet instant précis. Étoiles et constellations réelles."],
            ["03", "Votre création", "Choisissez le fond (saphir, rubis, émeraude), la forme (medaillon ou cœur), le format A4 à A0 et le cadre."],
            ["04", "Votre coffret", "Carte sur papier satiné 250 g, certificat d'authenticité A4, carton d'accompagnement A6 avec votre message."],
          ].map(([n, t, d]) => (
            <div key={n} className="group">
              <p className="font-display text-3xl text-gold/50 transition-colors group-hover:text-gold">{n}</p>
              <h2 className="mt-2 text-sm font-medium tracking-[0.18em] text-ink uppercase">{t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUITS (images & prix Célestime) */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.3em] text-gold uppercase">La collection</p>
            <h2 className="mt-2 font-display text-4xl text-ink">Des cieux pour chaque moment</h2>
          </div>
          <Link href="/boutique" className="text-sm tracking-[0.14em] text-muted uppercase transition-colors hover:text-gold">
            Tout voir →
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <Link
              key={p.slug}
              href={`/produit/${p.slug}`}
              className="group overflow-hidden rounded-2xl border border-line bg-surface/60 transition-all hover:-translate-y-1 hover:border-gold/50"
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
                  {p.kind === "starmap" ? "Personnalisable" : "Bientôt"}
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-display text-xl text-ink">{p.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{p.tagline}</p>
                <p className="mt-3 text-sm text-gold">
                  dès {eur(p.priceFrom)} <span className="text-xs text-faint">· {p.rating}/5</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* COFFRET (image Célestime réelle) */}
      <section className="border-y border-line bg-surface/40 py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/naissance.jpg" alt="Le coffret Célestime : carte du ciel encadrée, certificat d'authenticité et carton d'accompagnement" className="w-full object-cover" />
          </div>
          <div>
            <p className="text-[11px] tracking-[0.3em] text-gold uppercase">Le coffret cadeau</p>
            <h2 className="mt-3 font-display text-4xl leading-tight text-ink">
              Offert : un coffret, <span className="italic text-goldsoft">pas juste une affiche.</span>
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                ["Une carte céleste personnalisée", "Le ciel exact du moment choisi, sous une forme ronde comme un œil tourné vers l'univers — ou en cœur — sur papier satiné 250 g, format A4 à A0, en option dans un cadre."],
                ["Un certificat d'authenticité", "Format A4 (29,7 × 21 cm), avec le nom, la date, le lieu et le numéro d'enregistrement de votre création."],
                ["Un carton d'accompagnement", "Format A6 (10,5 × 14,8 cm) portant votre message personnalisé, pour marquer ce moment unique."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <svg viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-ink">{t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/produit/etoiles-de-naissance"
              className="mt-8 inline-block rounded-full border border-line px-7 py-3 text-sm tracking-[0.16em] text-ink uppercase transition-colors hover:border-gold"
            >
              Voir la carte de naissance
            </Link>
          </div>
        </div>
      </section>

      {/* GALERIE — calculée en direct */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-[11px] tracking-[0.3em] text-gold uppercase">Exemples de créations</p>
          <h2 className="mt-2 font-display text-4xl text-ink">Composés en direct par le configurateur</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
            Ces trois cartes sont recomposées en ce moment même par le moteur Célestime, à partir du
            catalogue des étoiles réelles de chaque date et lieu.
          </p>
        </div>
        <ShowcaseGallery />
      </section>

      {/* AVIS (avis réels Célestime) */}
      <section className="border-y border-line bg-surface/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-center text-[11px] tracking-[0.3em] text-gold uppercase">Ils ont trouvé leur ciel</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ["« Le site est clair, la livraison a été rapide et les produits correspondent parfaitement aux photos. Je recommande sans hésiter. »", "Cliente vérifiée"],
              ["« Belle qualité d'impression et livraison rapide. Le cadre est un peu plus clair que sur les photos, mais le résultat reste superbe. »", "Client vérifié"],
              ["« Très joli rendu, bien emballé. Petit délai supplémentaire à cause de la personnalisation, mais ça valait la peine d'attendre. »", "Cliente vérifiée"],
            ].map(([quote, who], i) => (
              <figure key={i} className="rounded-2xl border border-line bg-night/60 p-6">
                <div className="text-gold" aria-label="5 étoiles">★★★★★</div>
                <blockquote className="mt-3 font-display text-lg leading-relaxed text-ink italic">{quote}</blockquote>
                <figcaption className="mt-4 text-xs tracking-[0.16em] text-muted uppercase">{who}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ (réponses Célestime) */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <p className="text-center text-[11px] tracking-[0.3em] text-gold uppercase">Questions fréquentes</p>
        <h2 className="mt-2 mb-10 text-center font-display text-4xl text-ink">Avant de créer votre ciel</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-line bg-surface/50">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-ink">
                {f.q}
                <span className="text-gold transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-line px-6 py-16 text-center"
          style={{ background: "radial-gradient(ellipse 70% 100% at 50% 0%, #16204a 0%, #0a0d1c 60%, #06070c 100%)" }}
        >
          <h2 className="font-display text-4xl text-ink sm:text-5xl">
            Un moment unique, <span className="italic text-goldsoft">un ciel unique.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Transformez une date importante en un souvenir unique à conserver ou à offrir — avec son
            certificat d'authenticité et votre message.
          </p>
          <Link
            href="/create"
            className="mt-8 inline-block rounded-full bg-gold px-10 py-4 text-sm font-medium tracking-[0.18em] text-night uppercase transition-all hover:bg-goldsoft"
          >
            Personnaliser ma carte
          </Link>
        </div>
      </section>
    </>
  );
}
