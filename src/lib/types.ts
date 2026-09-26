// Célestime — types partagés (source unique de vérité du configurateur).
// Options alignées sur le catalogue réel Célestime (audit celestime.fr) :
// fond du poster (Saphir / Rubis / Émeraude), forme du ciel (Medaillon / Cœur),
// cadre, formats A4–A0, nom, date, heure, lieu, message.

export type ShapeId = "medaillon" | "coeur";
export type SizeId = "A4" | "A3" | "A2" | "A1" | "A0";
export type BackgroundId = "saphir" | "rubis" | "emeraude";

export type OccasionId =
  | "naissance"
  | "rencontre"
  | "mariage"
  | "anniversaire"
  | "bapteme"
  | "souvenir"
  | "autre";

export interface GeocodeResult {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/** État unique d'une création Célestime. */
export interface CreationConfig {
  productId: string;
  occasion: OccasionId; // déterminée par le produit, pas par l'utilisateur
  name: string; // « Nom, prénom ou surnom »
  message: string; // « Message personnalisé »
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
  timeApprox: boolean; // « heure approximative » (FAQ Célestime)
  location: GeocodeResult | null;
  background: BackgroundId;
  shape: ShapeId;
  framed: boolean; // Cadre / Sans Cadre
  size: SizeId;
  quantity: number;
}

export interface PriceBreakdown {
  base: number; // € centimes
  options: number; // cadre + supplément forme
  subtotal: number;
  shipping: number;
  total: number;
}

export interface CartItem {
  id: string;
  cartId: string;
  config: CreationConfig;
  unitPrice: number;
  quantity: number;
  createdAt: string;
}

export interface CustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  notes: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: string;
  createdAt: string;
}

export interface RuleNote {
  type: "info" | "error";
  message: string;
}
