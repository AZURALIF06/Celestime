import Link from "next/link";
import { HeroCanvas, ShowcaseGallery } from "@/components/showcase";
import { PRODUCTS } from "@/lib/options";
import { eur } from "@/lib/pricing";
import type { HomeEditorialContent } from "@/lib/home-content";

const STEP_NUMBERS = ["01", "02", "03", "04"] as const;

/** Fixed homepage structure: CMS data supplies copy and the gift image only. */
export function HomePageLayout({ content }: { content: HomeEditorialContent }) {
  return (
    <>
      {/* HERO — le canevas astronomique et ses destinations restent applicatifs */}
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
            <p className="text-[11px] tracking-[0.3em] text-gold uppercase">{content.heroEyebrow}</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] text-ink sm:text-6xl lg:text-[4.2rem]">
              {content.heroTitle[0]}
              <span className="block text-goldsoft italic">{content.heroTitle[1]}</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">{content.heroParagraph}</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/create"
                className="rounded-full bg-gold px-8 py-4 text-sm font-medium tracking-[0.18em] text-night uppercase transition-all hover:bg-goldsoft"
              >
                {content.heroPrimaryButton}
              </Link>
              <Link
                href="/boutique"
                className="rounded-full border border-line px-8 py-4 text-sm tracking-[0.18em] text-ink uppercase transition-colors hover:border-gold"
              >
                {content.heroSecondaryButton}
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-xs tracking-[0.14em] text-faint uppercase">
              {content.trustMentions.map((mention, index) => <span key={index}>{mention}</span>)}
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
                <p className="text-[11px] tracking-[0.2em] text-muted uppercase">{content.heroLocationCaption}</p>
                <p className="text-[11px] tracking-[0.14em] text-gold uppercase">{content.heroPreviewCaption}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ÉTAPES — seul le contenu éditorial provient du CMS */}
      <section className="border-y border-line bg-surface/50">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-4">
          {content.steps.map((step, index) => (
            <div key={STEP_NUMBERS[index]} className="group">
              <p className="font-display text-3xl text-gold/50 transition-colors group-hover:text-gold">{STEP_NUMBERS[index]}</p>
              <h2 className="mt-2 text-sm font-medium tracking-[0.18em] text-ink uppercase">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUITS — données, prix, images et destinations viennent toujours du catalogue */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.3em] text-gold uppercase">{content.collectionEyebrow}</p>
            <h2 className="mt-2 font-display text-4xl text-ink">{content.collectionTitle}</h2>
          </div>
          <Link href="/boutique" className="text-sm tracking-[0.14em] text-muted uppercase transition-colors hover:text-gold">
            {content.collectionLinkLabel}
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

      {/* COFFRET — visuel éditorial modifiable ; contenu produit et lien restent fixes */}
      <section className="border-y border-line bg-surface/40 py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content.giftImage} alt={content.giftImageAlt} className="w-full object-cover" />
          </div>
          <div>
            <p className="text-[11px] tracking-[0.3em] text-gold uppercase">{content.giftEyebrow}</p>
            <h2 className="mt-3 font-display text-4xl leading-tight text-ink">
              {content.giftTitle[0]} <span className="italic text-goldsoft">{content.giftTitle[1]}</span>
            </h2>
            <ul className="mt-6 space-y-4">
              {content.giftItems.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <svg viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/produit/etoiles-de-naissance"
              className="mt-8 inline-block rounded-full border border-line px-7 py-3 text-sm tracking-[0.16em] text-ink uppercase transition-colors hover:border-gold"
            >
              {content.giftButtonLabel}
            </Link>
          </div>
        </div>
      </section>

      {/* GALERIE — véritables rendus du configurateur */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-[11px] tracking-[0.3em] text-gold uppercase">{content.examplesEyebrow}</p>
          <h2 className="mt-2 font-display text-4xl text-ink">{content.examplesTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted">{content.examplesParagraph}</p>
        </div>
        <ShowcaseGallery />
      </section>

      {/* AVIS */}
      <section className="border-y border-line bg-surface/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-center text-[11px] tracking-[0.3em] text-gold uppercase">{content.testimonialsTitle}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.testimonials.map((testimonial, index) => (
              <figure key={index} className="rounded-2xl border border-line bg-night/60 p-6">
                <div className="text-gold" aria-label="5 étoiles">★★★★★</div>
                <blockquote className="mt-3 font-display text-lg leading-relaxed text-ink italic">{testimonial.quote}</blockquote>
                <figcaption className="mt-4 text-xs tracking-[0.16em] text-muted uppercase">{testimonial.author}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ éditoriale de l'accueil */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <p className="text-center text-[11px] tracking-[0.3em] text-gold uppercase">{content.faqEyebrow}</p>
        <h2 className="mt-2 mb-10 text-center font-display text-4xl text-ink">{content.faqTitle}</h2>
        <div className="space-y-3">
          {content.faq.map((item, index) => (
            <details key={`${index}-${item.question}`} className="group rounded-xl border border-line bg-surface/50">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-ink">
                {item.question}
                <span className="text-gold transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL — destination /create verrouillée dans le code */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-line px-6 py-16 text-center"
          style={{ background: "radial-gradient(ellipse 70% 100% at 50% 0%, #16204a 0%, #0a0d1c 60%, #06070c 100%)" }}
        >
          <h2 className="font-display text-4xl text-ink sm:text-5xl">
            {content.finalTitle[0]} <span className="italic text-goldsoft">{content.finalTitle[1]}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">{content.finalParagraph}</p>
          <Link
            href="/create"
            className="mt-8 inline-block rounded-full bg-gold px-10 py-4 text-sm font-medium tracking-[0.18em] text-night uppercase transition-all hover:bg-goldsoft"
          >
            {content.finalButtonLabel}
          </Link>
        </div>
      </section>
    </>
  );
}
