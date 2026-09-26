// Célestime — moteur de prix central.
// Les prix viennent du catalogue Célestime : définition servie par la base
// (administrée) si disponible, sinon le catalogue statique de repli.
// Le serveur recalcule toujours au panier/checkout.

import { SHIPPING_COST, productBySlug, type ProductPriceTables } from "./options";
import type { CreationConfig, PriceBreakdown } from "./types";

export type PriceTablesSource = { prices: ProductPriceTables } | null | undefined;

export function unitPriceOf(config: CreationConfig, product?: PriceTablesSource): number {
  const p = product ?? productBySlug(config.productId);
  if (!p) return 0;
  const base = p.prices.base[config.size] ?? Object.values(p.prices.base)[0] ?? 0;
  const shapeExtra = p.prices.shapeExtra?.[config.shape]?.[config.size] ?? 0;
  const frame = config.framed ? (p.prices.frame[config.size] ?? 0) : 0;
  return base + shapeExtra + frame;
}

export function calculatePrice(config: CreationConfig, product?: PriceTablesSource): PriceBreakdown {
  const p = product ?? productBySlug(config.productId);
  const base = p ? (p.prices.base[config.size] ?? Object.values(p.prices.base)[0] ?? 0) : 0;
  const shapeExtra = p ? (p.prices.shapeExtra?.[config.shape]?.[config.size] ?? 0) : 0;
  const frame = p && config.framed ? (p.prices.frame[config.size] ?? 0) : 0;
  const qty = Math.min(20, Math.max(1, Math.round(config.quantity || 1)));
  const unit = base + shapeExtra + frame;
  const subtotal = unit * qty;
  const shipping = SHIPPING_COST; // Célestime : livraison rapide et gratuite
  return {
    base: base * qty,
    options: (shapeExtra + frame) * qty,
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
}

export function eur(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
