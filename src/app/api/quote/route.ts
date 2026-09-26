import { getProduct } from "@/lib/catalog";
import { validateCoupon } from "@/lib/coupons";
import { getShippingZones, shippingCost, zoneForCountry } from "@/lib/shipping";
import { unitPriceOf } from "@/lib/pricing";
import { normalizeConfig } from "@/lib/rules";

export const runtime = "nodejs";

// Devis côté serveur : prix + coupon + livraison. Source de vérité unique.
export async function POST(req: Request) {
  let body: { config?: unknown; coupon?: string; country?: string; quantity?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const config = normalizeConfig(body.config);
  if (!config) return Response.json({ error: "Configuration illisible." }, { status: 400 });

  const product = await getProduct(config.productId);
  const qty = Math.min(20, Math.max(1, Math.round(body.quantity ?? config.quantity)));
  const unit = unitPriceOf(config, product ?? null);
  const subtotal = unit * qty;

  const coupon = body.coupon ? await validateCoupon(body.coupon, subtotal, [config.productId]) : { ok: false, discount: 0 };
  const zones = await getShippingZones();
  const shipping = shippingCost(zones, zoneForCountry(body.country ?? "France"), subtotal);

  return Response.json({
    unitPrice: unit,
    price: { base: unit * qty, options: 0, subtotal, discount: coupon.ok ? coupon.discount : 0, shipping, total: Math.max(0, subtotal - (coupon.ok ? coupon.discount : 0)) + shipping },
    coupon,
  });
}
