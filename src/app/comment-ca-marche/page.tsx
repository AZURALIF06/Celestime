import type { Metadata } from "next";
import Link from "next/link";
import { CommentCaMarcheCmsLayout } from "@/components/page/comment-ca-marche-cms-layout";
import { getPublishedCommentCaMarche } from "@/lib/comment-ca-marche-cms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Comment ça marche",
  description:
    "De votre moment à votre œuvre : géocodage, données astronomiques réelles, moteur de calcul du ciel, rendu Fine Art 300 DPI et fabrication en France.",
};

function CommentCaMarcheFallback() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-center text-[11px] tracking-[0.3em] text-gold uppercase">Comment ça marche</p>
      <h1 className="mt-3 text-center font-display text-5xl text-ink">
        De votre moment<br />à votre œuvre
      </h1>

      <div className="mt-14 space-y-6">
        {[
          {
            n: "01",
            t: "Vous racontez le moment",
            d: "Occasion, date, heure locale, ville. Le géocodeur localise votre lieu avec ses coordonnées exactes et son fuseau horaire (heure d'été comprise). Si vous ignorez l'heure, dites-le nous : elle sera estimée et explicitement présentée comme telle.",
          },
          {
            n: "02",
            t: "Nous recomposons le ciel",
            d: "Le moteur céleste calcule le temps sidéral local, puis la position d'environ 1 400 étoiles réelles du catalogue Yale (V ≤ 4,9) : altitude, azimut, teinte selon la température de chaque étoile. Constellations, plan galactique de la Voie lactée : tout est positionnellement exact pour l'instant choisi.",
          },
          {
            n: "03",
            t: "Vous composez l'œuvre",
            d: "Dix designs, huit fonds, trois formes, typographies, couleurs, message. La prévisualisation se met à jour à chaque clic ; les règles de compatibilité s'appliquent avec explication (finitions métallisées, fonds clairs, etc.).",
          },
          {
            n: "04",
            t: "Nous préparons votre coffret",
            d: "Votre carte est imprimée sur papier satiné 250 g au format exact choisi (A4 à A0), vérifiée à la main, présentée avec soin et, en option, dans un cadre. Le coffret contient aussi le certificat d'authenticité A4 et le carton d'accompagnement A6 avec votre message.",
          },
        ].map((s) => (
          <div key={s.n} className="grid gap-4 rounded-2xl border border-line bg-surface/50 p-6 sm:grid-cols-[80px_1fr] sm:p-8">
            <p className="font-display text-5xl text-gold/40">{s.n}</p>
            <div>
              <h2 className="text-lg font-medium text-ink">{s.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-2xl border border-line bg-surface/50 p-8">
        <h2 className="text-[11px] tracking-[0.24em] text-gold uppercase">La chaîne technique</h2>
        <p className="mt-4 text-center font-mono text-xs leading-relaxed text-muted sm:text-sm">
          Vos informations (prénom, date, heure, lieu, message) → géocodage (ville, latitude, longitude,
          fuseau) → données astronomiques (catalogue réel) → calcul du ciel (temps sidéral, alt/az) →
          moteur de rendu (fond, forme, textes) → prévisualisation → fichier d'impression au format exact
        </p>
        <p className="mt-4 text-center text-xs leading-relaxed text-faint">
          Les données astronomiques restent strictement séparées de l'interface commerciale :
          aucune donnée n'est inventée, aucun prix n'est calculé côté navigateur.
        </p>
      </div>

      <div className="mt-12 text-center">
        <Link
          href="/create"
          className="inline-block rounded-full bg-gold px-10 py-4 text-sm font-medium tracking-[0.18em] text-night uppercase transition-all hover:bg-goldsoft"
        >
          Créer ma carte du ciel
        </Link>
      </div>
    </div>
  );
}

export default async function CommentCaMarchePage() {
  const cmsPage = await getPublishedCommentCaMarche();
  return cmsPage ? <CommentCaMarcheCmsLayout page={cmsPage} /> : <CommentCaMarcheFallback />;
}
