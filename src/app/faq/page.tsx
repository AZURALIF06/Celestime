import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Tout savoir sur les cartes du ciel Célestime : ce que représente le ciel, les informations à fournir, l'heure approximative, le message personnalisé, les formats, le coffret et la livraison.",
};

const FAQ = [
  { q: "Que représente la carte du ciel ?", a: "La carte du ciel représente les étoiles et les constellations visibles à la date, à l'heure et au lieu indiqués. Elle permet de garder un souvenir symbolique d'un moment important. Notre moteur recompose ce firmament à partir du catalogue des étoiles réelles (Yale Bright Star Catalogue), calculé au temps sidéral de votre heure locale : aucune image générique, aucune étoile inventée." },
  { q: "Quelles informations dois-je fournir ?", a: "Vous devez renseigner le prénom, la date de naissance, l'heure de naissance et le lieu de naissance. Vous pouvez également ajouter un message personnalisé, selon les options proposées." },
  { q: "Dois-je connaître l'heure exacte de naissance ?", a: "L'heure exacte est recommandée pour créer une carte la plus précise possible. Si vous ne la connaissez pas, vous pouvez indiquer une heure approximative : elle sera estimée à midi local et clairement signalée comme telle sur la carte. Nous ne présentons jamais une heure estimée comme exacte." },
  { q: "Puis-je ajouter un message personnalisé ?", a: "Oui, vous pouvez ajouter un prénom, une date, une phrase ou un message personnel afin de rendre votre création encore plus unique. Le message apparaît sur la carte et sur le carton d'accompagnement A6 du coffret." },
  { q: "Cette création est-elle réservée aux enfants ?", a: "Non. Elle peut être créée pour un bébé ou un enfant, mais aussi pour un adulte, un couple ou toute personne importante. Elle convient pour une naissance, un anniversaire, un baptême, un mariage, une rencontre ou toute autre occasion spéciale." },
  { q: "Est-ce une bonne idée de cadeau ?", a: "Oui. La carte du ciel est un cadeau original, personnalisé et rempli de sens. Offerte dans son coffret — certificat d'authenticité et carton avec votre message —, elle permet de célébrer une personne ou de garder précieusement le souvenir d'une date importante." },
  { q: "Quels formats et quels choix proposes-vous ?", a: "Le fond du poster se décline en saphir (bleu), rubis (rouge) ou émeraude (vert). Le ciel se présente sous forme de medaillon (rond) ou de cœur. Les formats vont de A4 (21 × 29,7 cm) à A0 (120 × 80 cm), avec ou sans cadre." },
  { q: "Le coffret contient quoi exactement ?", a: "Une carte céleste personnalisée sur papier satiné 250 g (format A4 à A0, présentée avec soin et, en option, dans un cadre), un certificat d'authenticité format A4 (29,7 × 21 cm), et un carton d'accompagnement avec votre message personnalisé, format A6 (10,5 × 14,8 cm)." },
  { q: "Où puis-je l'installer ?", a: "Vous pouvez l'encadrer et l'installer dans une chambre d'enfant, une chambre parentale, un salon, un bureau ou tout autre espace de votre intérieur. Chaque pièce peut être encadrée, présentée et offerte comme un véritable objet d'art." },
  { q: "Comment choisir ma carte ?", a: "Choisissez le fond du poster, la forme du ciel, le format et l'option cadre. Renseignez ensuite le prénom, la date, l'heure et le lieu avant de valider votre commande. La prévisualisation se met à jour en temps réel et le prix est vérifié par nos serveurs à chaque étape." },
  { q: "Comment se passe la livraison ?", a: "Livraison rapide et gratuite. Un petit délai supplémentaire peut s'appliquer à cause de la personnalisation : chaque carte est réalisée à la main à partir de votre moment précis, puis vérifiée avant expédition." },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-center text-[11px] tracking-[0.3em] text-gold uppercase">Aide Célestime</p>
      <h1 className="mt-3 text-center font-display text-5xl text-ink">Questions fréquentes</h1>
      <div className="mt-10 space-y-3">
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
      <div className="mt-12 rounded-2xl border border-line bg-surface/50 p-8 text-center">
        <h2 className="font-display text-2xl text-ink">Une autre question ?</h2>
        <p className="mt-2 text-sm text-muted">Notre équipe vous répond sous 24 h ouvrées, sous le même ciel que vous.</p>
        <Link href="/contact" className="mt-5 inline-block rounded-full bg-gold px-7 py-3 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">
          Nous contacter
        </Link>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </div>
  );
}
