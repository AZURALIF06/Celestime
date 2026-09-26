"use client";

// Célestime — Checkout : validation côté serveur (configuration, prix, options)
// avant création de la commande. Le prix navigateur n'est jamais trusté.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StarMapCanvas, useSky } from "./starmap-canvas";
import { useCart } from "./cart-context";
import { eur } from "@/lib/pricing";
import { track } from "@/lib/track";
import { ORDERS_KEY } from "@/lib/editor";
import type { CartItem, Order } from "@/lib/types";

export default function CheckoutView() {
  const { cartId, refresh } = useCart();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [price, setPrice] = useState<{ subtotal: number; shipping: number; total: number } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    zip: "",
    city: "",
    country: "France",
    notes: "",
  });
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponOk, setCouponOk] = useState<string | null>(null);

  useEffect(() => {
    track("checkout_started");
  }, []);

  const load = useCallback(() => {
    if (!cartId) return;
    fetch(`/api/cart?cartId=${encodeURIComponent(cartId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && (setItems(d.items), setPrice(d.price)));
  }, [cartId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setError(null);
    if (!form.fullName || !form.email || !form.address || !form.city || !form.zip || !form.country) {
      setError("Veuillez compléter toutes les coordonnées de livraison.");
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId, customer: form, coupon: couponOk ?? coupon }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.orderNumber) {
        setError(d?.error ?? "Une erreur est survenue lors de la validation de la commande.");
        return;
      }
      track("purchase_completed", { orderNumber: d.orderNumber, total: d.order?.total });
      try {
        const prev = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]");
        localStorage.setItem(ORDERS_KEY, JSON.stringify([d.order, ...prev]));
      } catch {
        /* ignore */
      }
      refresh();
      router.push(`/confirmation/${encodeURIComponent(d.orderNumber)}`);
    } catch {
      setError("Impossible de finaliser la commande. Réessayez dans un instant.");
    } finally {
      setPlacing(false);
    }
  };

  if (items === null) {
    return (
      <div className="mt-16 flex justify-center">
        <div className="anim-pulse-soft h-10 w-10 rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-16 rounded-3xl border border-dashed border-line px-6 py-20 text-center">
        <p className="font-display text-3xl text-ink">Votre panier est vide.</p>
        <Link href="/create" className="mt-8 inline-block rounded-full bg-gold px-8 py-3.5 text-sm font-medium tracking-[0.16em] text-night uppercase hover:bg-goldsoft">
          Créer ma carte du ciel
        </Link>
      </div>
    );
  }

  const input =
    "w-full rounded-lg border border-line bg-night px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-gold";

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="rounded-2xl border border-line bg-surface/50 p-6">
          <h2 className="text-[11px] tracking-[0.24em] text-muted uppercase">Coordonnées</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="co-name" className="mb-1.5 block text-xs tracking-wide text-muted">Nom complet</label>
              <input id="co-name" className={input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Camille Dupont" autoComplete="name" />
            </div>
            <div>
              <label htmlFor="co-email" className="mb-1.5 block text-xs tracking-wide text-muted">E-mail</label>
              <input id="co-email" type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="camille@exemple.fr" autoComplete="email" />
            </div>
            <div>
              <label htmlFor="co-tel" className="mb-1.5 block text-xs tracking-wide text-muted">Téléphone <span className="text-faint">(optionnel)</span></label>
              <input id="co-tel" className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="06 12 34 56 78" autoComplete="tel" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="co-addr" className="mb-1.5 block text-xs tracking-wide text-muted">Adresse</label>
              <input id="co-addr" className={input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="12 rue des Étoiles" autoComplete="street-address" />
            </div>
            <div>
              <label htmlFor="co-zip" className="mb-1.5 block text-xs tracking-wide text-muted">Code postal</label>
              <input id="co-zip" className={input} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="06400" autoComplete="postal-code" />
            </div>
            <div>
              <label htmlFor="co-city" className="mb-1.5 block text-xs tracking-wide text-muted">Ville</label>
              <input id="co-city" className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Cannes" autoComplete="address-level2" />
            </div>
            <div>
              <label htmlFor="co-country" className="mb-1.5 block text-xs tracking-wide text-muted">Pays</label>
              <input id="co-country" className={input} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} autoComplete="country-name" />
            </div>
            <div>
              <label htmlFor="co-notes" className="mb-1.5 block text-xs tracking-wide text-muted">Instructions <span className="text-faint">(optionnel)</span></label>
              <textarea id="co-notes" rows={2} className={`${input} resize-none`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Emballage cadeau, code de la maison…" />
            </div>
            <div>
              <label htmlFor="co-coupon" className="mb-1.5 block text-xs tracking-wide text-muted">Code promotionnel <span className="text-faint">(optionnel)</span></label>
              <div className="flex gap-2">
                <input id="co-coupon" className={`${input} uppercase`} value={coupon} onChange={(e) => { setCoupon(e.target.value); setCouponMsg(null); }} placeholder="BIENVENUE10" />
                <button
                  type="button"
                  onClick={async () => {
                    if (!coupon.trim()) return;
                    const d = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: items?.[0]?.config, coupon: coupon.trim(), country: form.country, quantity: items!.reduce((s, i) => s + i.quantity, 0) }) }).then((r) => r.json());
                    if (d.coupon?.ok) {
                      setCouponOk(coupon.trim().toUpperCase());
                      setCouponMsg(null);
                    } else {
                      setCouponOk(null);
                      setCouponMsg(d.coupon?.message ?? "Code invalide.");
                    }
                  }}
                  className="shrink-0 rounded-full border border-gold px-4 text-xs font-medium uppercase tracking-wide text-gold hover:bg-gold hover:text-night"
                >
                  Appliquer
                </button>
              </div>
              {couponMsg && <p className="mt-1 text-xs text-danger">{couponMsg}</p>}
              {couponOk && <p className="mt-1 text-xs text-goldsoft">Code {couponOk} appliqué — remise calculée par le serveur.</p>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface/50 p-6">
          <h2 className="text-[11px] tracking-[0.24em] text-muted uppercase">Paiement sécurisé</h2>
          <div className="mt-4 flex items-start gap-3">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 018 0v3" />
            </svg>
            <p className="text-sm leading-relaxed text-muted">
              En validant, le serveur revalide chaque configuration et recalcule le prix.
              <span className="block mt-1 text-xs text-faint">
                Démonstration : le paiement est simulé — aucune donnée bancaire n'est collectée.
                La chaîne de production branchera ici votre prestataire de paiement.
              </span>
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={placing}
          className="w-full rounded-full bg-gold py-4 text-sm font-medium tracking-[0.18em] text-night uppercase transition-all hover:bg-goldsoft disabled:opacity-60"
        >
          {placing ? "Validation en cours…" : `Payer ${price ? eur(price.total) : ""}`}
        </button>
        <p className="text-center text-[11px] text-faint">
          TVA incluse · Paiement sécurisé · Confirmation immédiate par e-mail
        </p>
      </form>

      <aside className="h-fit rounded-2xl border border-line bg-surface/60 p-6 lg:sticky lg:top-24">
        <h2 className="text-[11px] tracking-[0.24em] text-muted uppercase">Votre commande</h2>
        <ul className="mt-4 max-h-72 space-y-3 overflow-auto pr-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3">
              <div className="w-14 shrink-0 overflow-hidden rounded-lg border border-line">
                <ItemThumb config={it.config} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{it.config.name || "Création Célestime"}</p>
                <p className="text-xs text-faint">
                  {it.config.size} · {it.config.quantity > 1 ? `× ${it.config.quantity} · ` : ""}
                  {eur(it.unitPrice * it.config.quantity)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {price && (
          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Articles</dt>
              <dd className="tabular-nums text-ink">{eur(price.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Livraison</dt>
              <dd className="tabular-nums text-ink">{price.shipping === 0 ? "Offerte" : eur(price.shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="text-ink">Total TTC</dt>
              <dd className="font-display text-2xl text-gold tabular-nums">{eur(price.total)}</dd>
            </div>
          </dl>
        )}
      </aside>
    </div>
  );
}

function ItemThumb({ config }: { config: import("@/lib/types").CreationConfig }) {
  const sky = useSky(config);
  return <StarMapCanvas config={config} sky={sky.sky} className="aspect-[3/4] w-full" maxRenderPx={220} />;
}
