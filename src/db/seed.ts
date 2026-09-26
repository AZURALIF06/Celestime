// Célestime — seed initial (idempotent) : admin, catalogue réel, catégories,
// collections, zones de livraison, TVA, paramètres du site.

import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { PRODUCTS } from "@/lib/options";
import { db } from "@/db";
import {
  adminUsers,
  categories,
  collections,
  collectionItems,
  coupons,
  pageTemplates,
  products,
  productVariants,
  shippingZones,
  siteSettings,
  taxRates,
} from "./schema";

export async function ensureSeed() {
  // 1) Admin
  const users = await db.select().from(adminUsers).limit(1);
  if (users.length === 0) {
    await db.insert(adminUsers).values({
      email: "admin@celestime.fr",
      passwordHash: hashPassword("celestime2025"),
      name: "Propriétaire Célestime",
      role: "owner",
    });
  }

  // 2) Catégories
  const cats = [
    ["naissance", "Naissance", 1],
    ["couple", "Couple", 2],
    ["mariage", "Mariage", 3],
    ["anniversaire", "Anniversaire", 4],
    ["cadeaux", "Idées cadeaux", 5],
  ] as const;
  const existingCats = await db.select().from(categories);
  for (const [slug, name, order] of cats) {
    if (!existingCats.some((c) => c.slug === slug)) {
      await db.insert(categories).values({ slug, name, sortOrder: order });
    }
  }
  const catRows = await db.select().from(categories);
  const catId = (slug: string) => catRows.find((c) => c.slug === slug)?.id ?? null;

  // 3) Produits (catalogue Célestime réel)
  const existing = await db.select().from(products);
  if (existing.length === 0) {
    const catBySlug: Record<string, string> = {
      "etoiles-de-naissance": "naissance",
      "etoiles-de-nous-deux": "couple",
      "etoiles-de-rencontre": "mariage",
      "notre-journee-a-nous": "anniversaire",
      "calendrier-2027": "cadeaux",
      "carnet-personnalise": "cadeaux",
      "recueil-de-poemes-cosmiques": "cadeaux",
    };
    for (const p of PRODUCTS) {
      const id = crypto.randomUUID();
      const base: Record<string, number> = {};
      const frame: Record<string, number> = {};
      for (const s of p.sizes) {
        base[s] = p.prices.base[s] ?? 0;
        frame[s] = p.prices.frame[s] ?? 0;
      }
      await db.insert(products).values({
        id,
        slug: p.slug,
        name: p.name,
        fullName: p.name,
        tagline: p.tagline,
        description: p.description,
        categoryId: catId(catBySlug[p.slug] ?? "cadeaux"),
        reference: `CLT-${p.slug.slice(0, 6).toUpperCase()}`,
        weight: "0,4 kg",
        dims: "A4 → A0",
        taxRate: 2000,
        oldPrice: null,
        onPromo: false,
        images: [p.image],
        status: "active",
        kind: p.kind === "starmap" ? "starmap" : "static",
        engine:
          p.kind === "starmap"
            ? {
                occasion: p.occasion,
                prices: p.prices,
                sizes: p.sizes,
                shapes: p.shapes,
                backgrounds: p.backgrounds,
                framed: p.framed,
                priceFrom: p.priceFrom,
              }
            : { occasion: p.occasion, priceFrom: p.priceFrom },
        box: p.box,
        seo: { title: p.name, description: p.tagline, noindex: false },
        rating: Math.round(p.rating * 10),
        reviewsCount: p.reviewsCount,
      });
      // Variantes (sans cadre / avec cadre × formats)
      for (const s of p.sizes) {
        await db.insert(productVariants).values({
          id: crypto.randomUUID(),
          productId: id,
          name: `Sans Cadre / ${s}`,
          priceCents: base[s] ?? 0,
          stock: 100,
          reference: `CLT-${p.slug.slice(0, 4).toUpperCase()}-${s}`,
          image: p.image,
        });
        if (p.framed && frame[s]) {
          await db.insert(productVariants).values({
            id: crypto.randomUUID(),
            productId: id,
            name: `Cadre / ${s}`,
            priceCents: (base[s] ?? 0) + frame[s],
            stock: 40,
            reference: `CLT-${p.slug.slice(0, 4).toUpperCase()}-${s}-CAD`,
            image: p.image,
          });
        }
      }
    }
  }

  // 4) Collections
  const colls = [
    ["saint-valentin", "Saint-Valentin", "Étoiles de Nous Deux, Étoiles de Rencontre"],
    ["best-sellers", "Best-sellers", "Les plus commandés"],
    ["nouveautes", "Nouveautés", "Les dernières arrivées"],
  ] as const;
  const existingColls = await db.select().from(collections);
  const collIds: Record<string, number> = {};
  for (const [slug, name, desc] of colls) {
    let row = existingColls.find((c) => c.slug === slug);
    if (!row) {
      const ins = await db.insert(collections).values({ slug, name, description: desc }).returning();
      row = ins[0];
    }
    collIds[slug] = row.id;
  }
  const allProds = await db.select().from(products);
  const link = async (collSlug: string, prodSlugs: string[]) => {
    const collId = collIds[collSlug];
    if (!collId) return;
    const current = await db.select().from(collectionItems).where(eq(collectionItems.collectionId, collId));
    for (const s of prodSlugs) {
      const prod = allProds.find((p) => p.slug === s);
      if (prod && !current.some((c) => c.productId === prod.id)) {
        await db.insert(collectionItems).values({ collectionId: collId, productId: prod.id });
      }
    }
  };
  await link("saint-valentin", ["etoiles-de-nous-deux", "etoiles-de-rencontre", "notre-journee-a-nous"]);
  await link("best-sellers", ["etoiles-de-naissance", "etoiles-de-nous-deux", "etoiles-de-rencontre"]);
  await link("nouveautes", ["notre-journee-a-nous", "recueil-de-poemes-cosmiques"]);

  // 5) Coupon de bienvenue
  const existingCoupons = await db.select().from(coupons).limit(1);
  if (existingCoupons.length === 0) {
    await db.insert(coupons).values({
      code: "BIENVENUE10",
      type: "pct",
      value: 10,
      minAmount: 2500,
      maxUses: 200,
      startsAt: new Date("2025-01-01"),
      endsAt: new Date("2027-12-31"),
      active: true,
    });
  }

  // 6) Zones de livraison (Célestime : livraison rapide et gratuite en France)
  const zones = await db.select().from(shippingZones);
  if (zones.length === 0) {
    await db.insert(shippingZones).values([
      { code: "fr", label: "France", costCents: 0, freeFromCents: 0, delay: "3 à 5 jours ouvrés" },
      { code: "eu", label: "Europe", costCents: 1290, freeFromCents: 20000, delay: "5 à 8 jours ouvrés" },
      { code: "intl", label: "International", costCents: 1990, freeFromCents: 30000, delay: "8 à 12 jours ouvrés" },
    ]);
  }

  // 7) TVA
  const tax = await db.select().from(taxRates);
  if (tax.length === 0) {
    await db.insert(taxRates).values([
      { code: "fr20", label: "TVA France 20 %", ratePerThousand: 2000, zone: "fr" },
      { code: "eu", label: "TVA Europe", ratePerThousand: 2000, zone: "eu" },
      { code: "intl0", label: "TVA export 0 %", ratePerThousand: 0, zone: "intl" },
    ]);
  }

  // 8) Paramètres du site (header / footer / menu)
  const settings = await db.select().from(siteSettings).limit(1);
  if (settings.length === 0) {
    await db.insert(siteSettings).values({
      data: {
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
        stripeEnabled: false,
      },
    });
  }

  // 9) Template de landing page
  const templates = await db.select().from(pageTemplates).limit(1);
  if (templates.length === 0) {
    await db.insert(pageTemplates).values({
      name: "Landing page promotionnelle",
      description: "Titre, sous-titre, bouton, image et compte à rebours — pour une promo (Saint-Valentin, Noël…).",
      data: {
        sections: [
          {
            id: "sec-1",
            h: 620,
            bg: "radial-gradient(ellipse 90% 100% at 50% 0%, #1a1030 0%, #0d0916 55%, #06070c 100%)",
            elements: [
              { id: "e1", type: "text", x: 200, y: 120, w: 800, h: 110, z: 1, rotation: 0, opacity: 1, content: { text: "Saint-Valentin, sous le même ciel", variant: "h1" }, style: { fontFamily: "serif", size: 56, weight: 600, color: "#ece9e2", align: "center" } },
              { id: "e2", type: "text", x: 260, y: 250, w: 680, h: 60, z: 1, rotation: 0, opacity: 1, content: { text: "-20 % sur les Étoiles de Nous Deux et les Étoiles de Rencontre, jusqu'au 14 février.", variant: "sub" }, style: { fontFamily: "sans", size: 18, weight: 400, color: "#c9c7d2", align: "center" } },
              { id: "e3", type: "button", x: 470, y: 350, w: 260, h: 56, z: 2, rotation: 0, opacity: 1, content: { text: "Personnaliser ma carte", href: "/create?product=etoiles-de-nous-deux" }, style: { bg: "#c9a86a", color: "#06070c", hoverBg: "#e3cfa4", radius: 999, size: 15 } },
              { id: "e4", type: "countdown", x: 320, y: 440, w: 560, h: 140, z: 1, rotation: 0, opacity: 1, content: { date: "2027-02-14T00:00:00", label: "L'offre se termine le 14 février" }, style: { size: 26, color: "#ece9e2" } },
            ],
          },
          {
            id: "sec-2",
            h: 560,
            bg: "linear-gradient(180deg, #06070c 0%, #0c0e16 100%)",
            elements: [
              { id: "e5", type: "image", x: 60, y: 80, w: 520, h: 400, z: 1, rotation: 0, opacity: 1, content: { src: "/images/nous-deux.jpg", alt: "Étoiles de Nous Deux", fit: "cover", radius: 20, shadow: true, border: false } },
              { id: "e6", type: "text", x: 640, y: 120, w: 500, h: 100, z: 1, rotation: 0, opacity: 1, content: { text: "Le ciel de votre plus belle histoire", variant: "h2" }, style: { fontFamily: "serif", size: 40, weight: 600, color: "#ece9e2", align: "left" } },
              { id: "e7", type: "text", x: 640, y: 240, w: 500, h: 110, z: 1, rotation: 0, opacity: 1, content: { text: "Cœur ou medaillon, fond saphir, rubis ou émeraude : deux prénoms, un même ciel pour toujours. Coffret avec certificat d'authenticité.", variant: "p" }, style: { fontFamily: "sans", size: 16, weight: 400, color: "#c9c7d2", align: "left" } },
              { id: "e8", type: "button", x: 640, y: 380, w: 240, h: 54, z: 2, rotation: 0, opacity: 1, content: { text: "Voir le produit", href: "/produit/etoiles-de-nous-deux" }, style: { bg: "#c9a86a", color: "#06070c", hoverBg: "#e3cfa4", radius: 999, size: 15 } },
            ],
          },
        ],
      },
    });
  }
}
