// Célestime — zones de livraison (admin) : France / Europe / International.

import { db } from "@/db";
import { shippingZones } from "@/db/schema";

export interface ShippingZone {
  code: "fr" | "eu" | "intl";
  label: string;
  costCents: number;
  freeFromCents: number;
  delay: string;
}

const EU = new Set(["France","Monaco","Belgique","Germany","Allemagne","Italy","Italie","Espagne","Spain","Portugal","Luxembourg","Pays-Bas","Netherlands","Irlande","Ireland","Malte","Malta","Chypre","Croatie","Croatia","Autriche","Austria","Danemark","Denmark","Finlande","Finland","Grèce","Greece","Hongrie","Hungary","Irlande","Lettonie","Latvia","Lituanie","Pologne","Poland","République tchèque","Czechia","Roumanie","Romania","Slovénie","Slovenia","Slovaquie","Slovakia","Suede","Suède","Sweden","Norvège","Norway","Islande","Iceland","Liechtenstein"]);

export function zoneForCountry(country: string): "fr" | "eu" | "intl" {
  const c = (country || "").trim();
  if (c === "France" || c === "Monaco" || c === "france" || c === "monaco") return "fr";
  if (EU.has(c)) return "eu";
  return "intl";
}

export async function getShippingZones(): Promise<ShippingZone[]> {
  try {
    const rows = await db.select().from(shippingZones);
    if (rows.length === 0) return [];
    return rows.map((r) => ({ code: r.code as ShippingZone["code"], label: r.label, costCents: r.costCents, freeFromCents: r.freeFromCents, delay: r.delay }));
  } catch {
    return [
      { code: "fr", label: "France", costCents: 0, freeFromCents: 0, delay: "3 à 5 jours ouvrés" },
      { code: "eu", label: "Europe", costCents: 1290, freeFromCents: 20000, delay: "5 à 8 jours ouvrés" },
      { code: "intl", label: "International", costCents: 1990, freeFromCents: 30000, delay: "8 à 12 jours ouvrés" },
    ];
  }
}

export function shippingCost(zones: ShippingZone[], zoneCode: string, subtotal: number): number {
  const z = zones.find((z) => z.code === zoneCode) ?? zones[0];
  if (!z) return 0;
  if (z.costCents === 0) return 0;
  if (z.freeFromCents > 0 && subtotal >= z.freeFromCents) return 0;
  return z.costCents;
}
