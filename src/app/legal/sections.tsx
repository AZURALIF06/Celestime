import type { Metadata } from "next";
import Link from "next/link";

export function LegalShell({
  title,
  updated,
  children,
  eyebrow = "Informations légales",
  updatedLabel = "Dernière mise à jour :",
  contactText = "Une question sur ces conditions ? Contactez-nous.",
  contactHref = "/contact",
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
  eyebrow?: string;
  updatedLabel?: string;
  contactText?: string;
  contactHref?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-[11px] tracking-[0.3em] text-gold uppercase">{eyebrow}</p>
      <h1 className="mt-3 font-display text-5xl text-ink">{title}</h1>
      <p className="mt-2 text-xs text-faint">{updatedLabel} {updated}</p>
      <div className="prose-invert mt-10 space-y-6 text-sm leading-relaxed text-muted [&_h2]:font-display [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:text-ink [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
      <div className="mt-12 border-t border-line pt-6 text-sm">
        <Link href={contactHref} className="text-gold hover:underline">
          {contactText}
        </Link>
      </div>
    </div>
  );
}

export const MENTIONS_META: Metadata = { title: "Mentions légales" };
export const CGV_META: Metadata = { title: "CGV" };
export const CONFID_META: Metadata = { title: "Confidentialité" };
export const LIVRAISON_META: Metadata = {
  title: "Livraison",
  description: "Délais, tarifs et modalités de livraison des cartes du ciel Célestime.",
};

export function MentionsLegales() {
  return (
    <LegalShell title="Mentions légales" updated="janvier 2025">
      <h2>Éditeur du site</h2>
      <p>
        Célestime — SASU au capital de 10 000 €, siège social : 12 rue des Étoiles, 75011 Paris, France.
        RCS Paris — SIRET 000 000 000 00000 — Directeur de la publication : la Direction Célestime.
        Contact : bonjour@celestime.fr.
      </p>
      <h2>Hébergement</h2>
      <p>Site hébergé dans l'Union Européenne. Données techniques du serveur disponibles sur simple demande.</p>
      <h2>Propriété intellectuelle</h2>
      <p>
        L'ensemble des designs, textes et éléments graphiques Célestime sont protégés. Les cieux
        affichés sont des représentations de phénomènes astronomiques observables ; chaque création
        personnalisée appartient à son commanditaire.
      </p>
      <h2>Responsabilité</h2>
      <p>
        Les positions astronomiques sont calculées à partir de données cataloguées et standardisées
        (J2000). En cas d'heure inconnue, l'estimation est clairement signalée et n'est jamais
        présentée comme exacte.
      </p>
    </LegalShell>
  );
}

export function Cgv() {
  return (
    <LegalShell title="Conditions générales de vente" updated="janvier 2025">
      <h2>Articles</h2>
      <p>
        Les cartes du ciel Célestime sont des œuvres personnalisées, conçues à la demande via le
        configurateur. Le prix affiché (TTC) est celui de la configuration exacte : design, format,
        support, cadre, finition et quantité. Le prix est vérifié par le serveur à l'ajout au panier
        et au paiement.
      </p>
      <h2>Commande</h2>
      <p>
        Toute commande implique l'acceptation des présentes CGV. Le configurateur valide la
        complétude de la création (date, heure ou estimation, lieu) avant l'ajout au panier ; les
        commandes ne sont pas expédiables tant que la configuration est incomplète.
      </p>
      <h2>Paiement</h2>
      <p>Paiement 100 % à la commande, par paiement sécurisé. Le solde de votre panier est recalculé et confirmé avant validation.</p>
      <h2>Fabrication & délais</h2>
      <p>Fabrication artisanale en France : 5 à 8 jours ouvrés, puis expédition. Les délais peuvent varier pour les commandes groupées.</p>
      <h2>Rétractation</h2>
      <p>
        Conformément au Code de la consommation, l'article personnalisé (confectionné en fonction des
        spécificités du client) n'est pas éligible au droit de rétractation, sauf défaut ou non-conformité.
        En cas d'insatisfaction, contactez-nous sous 14 jours : retouche ou refabrication sans frais.
      </p>
      <h2>Garantie</h2>
      <p>
        Chaque création est couverte par la garantie légale de conformité. Encres et papiers
        archivables : tenue dans le temps sous conditions normales de conservation (lumière modérée,
        hygrométrie stable).
      </p>
    </LegalShell>
  );
}

export function Confidentialite() {
  return (
    <LegalShell title="Politique de confidentialité" updated="janvier 2025">
      <h2>Données collectées</h2>
      <p>
        Coordonnées de livraison lors de la commande ; configuration de vos créations (date, heure,
        lieu, textes) indispensable à leur fabrication ; éventuellement un e-mail pour les
        notifications. Les brouillons de configuration restent par défaut sur votre appareil.
      </p>
      <h2>Utilisation</h2>
      <p>
        Vos données servent à fabriquer et livrer votre création, à répondre à vos demandes, et —
        uniquement si vous y consentez — à vous envoyer notre lettre céleste mensuelle.
        Elles ne sont jamais vendues à des tiers.
      </p>
      <h2>Vos droits</h2>
      <p>
        Accès, rectification, effacement, limitation, portabilité : écrivez à bonjour@celestime.fr.
        Vous pouvez également saisir la CNIL.
      </p>
      <h2>Cookies & mesures d'audience</h2>
      <p>
        Aucune publicité ciblée. Les événements d'usage (ouverture du configurateur, étapes
        complétées) sont agrégés et anonymisés pour améliorer l'expérience.
      </p>
    </LegalShell>
  );
}
