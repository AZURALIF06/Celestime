import { LIVRAISON_META, LegalShell } from "../legal/sections";
import { LivraisonCmsContent } from "@/components/page/livraison-cms-content";
import { getPublishedLivraison } from "@/lib/livraison-cms";

export const dynamic = "force-dynamic";

export const metadata = LIVRAISON_META;

function LivraisonFallback() {
  return (
    <LegalShell title="Livraison" updated="janvier 2025">
      <h2>Livraison</h2>
      <p>
        Livraison rapide et gratuite. Chaque création est préparée avec soin dans son coffret —
        carte, certificat d'authenticité et carton d'accompagnement — et expédiée avec numéro de
        suivi. Des points de retrait (Chronopost) peuvent être proposés à l'expédition.
      </p>
      <h2>Délais</h2>
      <p>
        Petite délai supplémentaire possible à cause de la personnalisation : chaque carte est
        réalisée à la main à partir de votre moment précis, puis vérifiée avant expédition.
        Formats A1 et A0 : transport rigide surdimensionné.
      </p>
      <h2>Emballage</h2>
      <p>
        Colis rigide adapté au format, calage soigné. Le coffret cadeau (carte, certificat d'authenticité
        A4, carton d'accompagnement A6 avec votre message) est inclus.
      </p>
      <h2>Colis endommagé</h2>
      <p>Signalez tout dommage sous 48 h avec photos : refabrication prioritaire, sans frais.</p>
    </LegalShell>
  );
}

export default async function LivraisonPage() {
  const page = await getPublishedLivraison();
  return page ? <LivraisonCmsContent page={page} /> : <LivraisonFallback />;
}
