export interface FaqItem {
  q: string;
  a: string;
}

/** Contenu historique de /faq, conservé tel quel pour le fallback public. */
export const FAQ_CONTENT: FaqItem[] = [
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
