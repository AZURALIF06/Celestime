// Célestime — codes promotionnels (admin).

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { coupons, products } from "@/db/schema";

export interface CouponResult {
  ok: boolean;
  discount: number; // centimes
  message?: string;
  label?: string;
}

export async function validateCoupon(
  code: string,
  subtotalCents: number,
  productSlugs: string[]
): Promise<CouponResult> {
  const c = code.trim().toUpperCase();
  if (!c) return { ok: false, discount: 0 };
  const rows = await db.select().from(coupons).where(eq(coupons.code, c));
  const cp = rows[0];
  if (!cp || !cp.active) return { ok: false, discount: 0, message: "Ce code n'existe pas ou n'est plus actif." };
  const now = Date.now();
  if (cp.startsAt && +cp.startsAt > now) return { ok: false, discount: 0, message: "Cette promotion n'a pas encore commencé." };
  if (cp.endsAt && +cp.endsAt < now) return { ok: false, discount: 0, message: "Cette promotion a expiré." };
  if (cp.maxUses > 0 && cp.usedCount >= cp.maxUses) return { ok: false, discount: 0, message: "Ce code a atteint sa limite d'utilisations." };
  if (cp.minAmount > 0 && subtotalCents < cp.minAmount) {
    return { ok: false, discount: 0, message: `Valable à partir de ${(cp.minAmount / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} d'achat.` };
  }
  const prods: string[] = (cp.productSlugs as unknown as string[]) ?? [];
  if (prods.length > 0 && !productSlugs.some((s) => prods.includes(s))) {
    return { ok: false, discount: 0, message: "Ce code n'est valable que sur certains produits." };
  }
  const discount = cp.type === "pct" ? Math.round((subtotalCents * Math.min(90, cp.value)) / 100) : Math.min(cp.value, subtotalCents);
  const label = cp.type === "pct" ? `-${cp.value} %` : `-${(cp.value / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`;
  return { ok: true, discount, label };
}

export async function markCouponUsed(code: string) {
  try {
    const c = code.trim().toUpperCase();
    const rows = await db.select().from(coupons).where(eq(coupons.code, c));
    if (rows[0]) {
      await db.update(coupons).set({ usedCount: rows[0].usedCount + 1 }).where(eq(coupons.id, rows[0].id));
    }
  } catch {
    /* ignore */
  }
}
