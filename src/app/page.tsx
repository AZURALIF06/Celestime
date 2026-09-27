import type { Metadata } from "next";
import { HomePageLayout } from "@/components/page/home-page-layout";
import { getPublishedHome } from "@/lib/home-cms";
import { DEFAULT_HOME_CONTENT } from "@/lib/home-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Célestime — Cartes du ciel personnalisées",
  description:
    "Chaque naissance a son étoile, chaque instant son ciel. Célestime recompose le ciel exact du moment de votre choix : prénom, date, heure, lieu. Coffret avec certificat d'authenticité, papier satiné 250 g, livraison offerte.",
};

export default async function Home() {
  let content = DEFAULT_HOME_CONTENT;
  try {
    content = (await getPublishedHome()) ?? DEFAULT_HOME_CONTENT;
  } catch {
    // Le rendu codé en dur reste le filet de sécurité, même en cas d'erreur CMS inattendue.
    content = DEFAULT_HOME_CONTENT;
  }

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
      <HomePageLayout content={content} />
    </>
  );
}
