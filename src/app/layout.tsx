import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { CartProvider } from "@/components/cart-context";
import { CartButton } from "@/components/cart-button";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.celestime.fr"),
  title: {
    default: "Célestime — Cartes du ciel personnalisées",
    template: "%s · Célestime",
  },
  description:
    "Célestime recompose le ciel exact de votre moment précieux : naissance, rencontre, mariage. Coffret avec certificat d'authenticité, papier satiné 250 g, livraison rapide et gratuite.",
  openGraph: {
    title: "Célestime — Votre histoire mérite son propre ciel",
    description: "Des cartes du ciel personnalisées, recomposées à partir de données astronomiques réelles.",
    type: "website",
    locale: "fr_FR",
    siteName: "Célestime",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#06070c",
  width: "device-width",
  initialScale: 1,
};

interface SiteData {
  announcement: string;
  logoText: string;
  ctaText: string;
  ctaHref: string;
  menu: { label: string; href: string }[];
  footer: {
    about: string;
    contact: string;
    socials: { label: string; href: string }[];
    columns: { title: string; links: [string, string][] }[];
  };
}

const DEFAULTS: SiteData = {
  announcement: "Coffret avec certificat d'authenticité · Papier satiné 250 g · Livraison rapide et gratuite",
  logoText: "CÉLESTIME",
  ctaText: "Créer ma carte",
  ctaHref: "/create",
  menu: [
    { label: "Boutique", href: "/boutique" },
    { label: "Comment ça marche", href: "/comment-ca-marche" },
    { label: "FAQ", href: "/faq" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
  ],
  footer: {
    about: "Des cartes du ciel personnalisées, recomposées à partir de données astronomiques réelles et imprimées avec soin.",
    contact: "bonjour@celestime.fr · Paris, France",
    socials: [
      { label: "Instagram", href: "https://instagram.com/celestimecreation/" },
      { label: "TikTok", href: "https://tiktok.com/@celestime_astro" },
      { label: "YouTube", href: "https://youtube.com/@Celestime06800" },
    ],
    columns: [
      {
        title: "Découvrir",
        links: [
          ["Boutique", "/boutique"],
          ["Étoiles de Naissance", "/produit/etoiles-de-naissance"],
          ["Étoiles de Nous Deux", "/produit/etoiles-de-nous-deux"],
          ["Étoiles de Rencontre", "/produit/etoiles-de-rencontre"],
          ["Personnaliser", "/create"],
        ],
      },
      {
        title: "Aide",
        links: [
          ["Comment ça marche", "/comment-ca-marche"],
          ["FAQ", "/faq"],
          ["Livraison", "/livraison"],
          ["Contact", "/contact"],
        ],
      },
      {
        title: "Légal",
        links: [
          ["CGV", "/cgv"],
          ["Confidentialité", "/confidentialite"],
          ["Mentions légales", "/mentions-legales"],
        ],
      },
    ],
  },
};

async function getSiteData(): Promise<SiteData> {
  try {
    const rows = await db.select().from(siteSettings).limit(1);
    if (rows[0]?.data) return { ...DEFAULTS, ...(rows[0].data as Partial<SiteData>) };
  } catch {
    /* base vide */
  }
  return DEFAULTS;
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 2l2.1 6.6L21 12l-6.9 3.4L12 22l-2.1-6.6L3 12l6.9-3.4L12 2z" fill="currentColor" />
    </svg>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteData();
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Jost:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Great+Vibes&family=Montserrat:wght@400;500;600&family=Parisienne&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-night text-ink antialiased">
        <CartProvider>
          <a
            href="#contenu"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-gold focus:px-4 focus:py-2 focus:text-night"
          >
            Aller au contenu
          </a>
          <div className="border-b border-line bg-surface/80 text-center text-[11px] tracking-[0.22em] text-muted uppercase">
            <p className="mx-auto max-w-7xl px-4 py-2">{site.announcement}</p>
          </div>
          <header className="sticky top-0 z-50 border-b border-line bg-night/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
              <Link href="/" className="group inline-flex items-center gap-2" aria-label="Célestime — accueil">
                <StarIcon className="h-4 w-4 text-gold transition-transform duration-500 group-hover:rotate-90" />
                <span className="font-display text-[1.35rem] font-semibold tracking-[0.28em] text-ink">{site.logoText}</span>
              </Link>
              <nav aria-label="Navigation principale" className="hidden items-center gap-7 md:flex">
                {site.menu.map((n) => (
                  <Link key={n.href + n.label} href={n.href} className="text-[13px] tracking-[0.14em] text-muted uppercase transition-colors hover:text-ink">
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-3">
                <Link
                  href="/account"
                  className="hidden rounded-full border border-line px-4 py-1.5 text-[12px] tracking-[0.14em] text-muted uppercase transition-colors hover:border-gold hover:text-ink sm:block"
                >
                  Mon compte
                </Link>
                <CartButton />
                <Link
                  href={site.ctaHref}
                  className="hidden rounded-full bg-gold px-5 py-2 text-[12px] font-medium tracking-[0.16em] text-night uppercase transition-all hover:bg-goldsoft sm:block"
                >
                  {site.ctaText}
                </Link>
                <MobileMenu menu={site.menu} cta={{ text: site.ctaText, href: site.ctaHref }} />
              </div>
            </div>
          </header>
          <main id="contenu">{children}</main>
          <Footer site={site} />
        </CartProvider>
      </body>
    </html>
  );
}

function MobileMenu({ menu, cta }: { menu: { label: string; href: string }[]; cta: { text: string; href: string } }) {
  return (
    <details className="relative md:hidden">
      <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-line text-ink" aria-label="Ouvrir le menu">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-surface p-3 shadow-2xl shadow-black/50">
        {menu.map((n) => (
          <Link key={n.href + n.label} href={n.href} className="block rounded-lg px-3 py-2.5 text-sm tracking-wide text-muted hover:bg-raised hover:text-ink">
            {n.label}
          </Link>
        ))}
        <Link href="/account" className="block rounded-lg px-3 py-2.5 text-sm tracking-wide text-muted hover:bg-raised hover:text-ink">
          Mon compte
        </Link>
        <Link href={cta.href} className="mt-1 block rounded-lg bg-gold px-3 py-2.5 text-center text-sm font-medium tracking-wide text-night">
          {cta.text}
        </Link>
      </div>
    </details>
  );
}

function Footer({ site }: { site: SiteData }) {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Célestime">
            <StarIcon className="h-4 w-4 text-gold" />
            <span className="font-display text-[1.35rem] font-semibold tracking-[0.28em] text-ink">{site.logoText}</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{site.footer.about}</p>
          <p className="mt-4 text-xs text-faint">{site.footer.contact}</p>
          <div className="mt-4 flex gap-4">
            {site.footer.socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="text-xs tracking-[0.14em] text-muted uppercase hover:text-gold">
                {s.label}
              </a>
            ))}
          </div>
        </div>
        {site.footer.columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-[12px] tracking-[0.22em] text-gold uppercase">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map(([label, href]) => (
                <li key={label + href}>
                  <Link href={href} className="text-sm text-muted transition-colors hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line py-5 text-center text-xs tracking-[0.14em] text-faint uppercase">
        © {new Date().getFullYear()} Célestime — Cartes du ciel personnalisées · Fait avec soin en France
      </div>
    </footer>
  );
}
