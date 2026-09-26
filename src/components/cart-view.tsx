"use client";

// Célestime — Panier : chaque article conserve le snapshot complet de sa
// configuration (section 31). Modifier, dupliquer, quantité, export PDF HD.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { computeSky } from "@/lib/astro";
import { StarMapCanvas, useSky, renderHighRes } from "./starmap-canvas";
import { exportPosterPdf } from "@/lib/pdf";
import { eur } from "@/lib/pricing";
import { track } from "@/lib/track";
import { useCart } from "./cart-context";
import { backgroundById, shapeById, sizeById } from "@/lib/options";
import type { CartItem } from "@/lib/types";

interface Price {
  subtotal: number;
  shipping: number;
  total: number;
}

export default function CartView() {
  const { cartId, refresh } = useCart();
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [price, setPrice] = useState<Price | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!cartId) return;
    fetch(`/api/cart?cartId=${encodeURIComponent(cartId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setItems(d.items);
          setPrice(d.price);
        }
      });
  }, [cartId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    await fetch(`/api/cart/item?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
    refresh();
  };

  const setQty = async (id: string, quantity: number) => {
    await fetch(`/api/cart/item`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, quantity }),
    });
    load();
    refresh();
  };

  const duplicate = async (item: CartItem) => {
    await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartId, config: item.config, quantity: item.quantity }),
    });
    setFlash("Création dupliquée — modifiez le nom et la date pour chaque exemplaire.");
    setTimeout(() => setFlash(null), 4000);
    load();
    refresh();
  };

  const exportPdf = (item: CartItem) => {
    try {
      const hd = renderHighRes(item.config, buildSkySync(item.config));
      exportPosterPdf({ ...hd, config: item.config });
      setFlash("Fichier PDF haute définition téléchargé.");
      setTimeout(() => setFlash(null), 4000);
    } catch {
      setFlash("Le téléchargement a échoué. Réessayez dans un instant.");
      setTimeout(() => setFlash(null), 4000);
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
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
          Chaque moment mérite son ciel. Le vôtre vous attend dans le configurateur.
        </p>
        <Link
          href="/create"
          className="mt-8 inline-block rounded-full bg-gold px-8 py-3.5 text-sm font-medium tracking-[0.16em] text-night uppercase transition-all hover:bg-goldsoft"
        >
          Créer ma carte du ciel
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        {flash && (
          <p className="anim-fade-up rounded-xl border border-gold/40 bg-gold/5 px-4 py-3 text-center text-sm text-goldsoft">{flash}</p>
        )}
        {items.map((item) => (
          <CartItemCard key={item.id} item={item} onQty={(q) => setQty(item.id, q)} onRemove={() => remove(item.id)} onDuplicate={() => duplicate(item)} onPdf={() => exportPdf(item)} />
        ))}
      </div>

      <aside className="h-fit rounded-2xl border border-line bg-surface/60 p-6 lg:sticky lg:top-24">
        <h2 className="text-[11px] tracking-[0.24em] text-muted uppercase">Votre création</h2>
        {price && (
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Articles</dt>
              <dd className="tabular-nums text-ink">{eur(price.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Livraison</dt>
              <dd className="tabular-nums text-ink">{price.shipping === 0 ? "Offerte" : eur(price.shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3">
              <dt className="text-ink">Total TTC</dt>
              <dd className="font-display text-2xl text-gold tabular-nums">{eur(price.total)}</dd>
            </div>
          </dl>
        )}
        {price && price.shipping > 0 && (
          <p className="mt-2 text-xs text-faint">
            Plus que {eur(15000 - price.subtotal)} pour la livraison offerte.
          </p>
        )}
        <Link
          href="/checkout"
          className="mt-6 block w-full rounded-full bg-gold py-3.5 text-center text-sm font-medium tracking-[0.16em] text-night uppercase transition-all hover:bg-goldsoft"
        >
          Passer commande
        </Link>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-faint">
          Prix recalculés et vérifiés par le serveur à chaque étape. Paiement sécurisé.
        </p>
      </aside>
    </div>
  );
}

function buildSkySync(config: import("@/lib/types").CreationConfig) {
  const h = config.timeApprox ? 12 : +config.hour;
  const m = config.timeApprox ? 0 : +config.minute;
  return computeSky(+config.day, +config.month, +config.year, h, m, config.location!.latitude, config.location!.longitude, config.location!.timezone);
}

function CartItemCard({
  item,
  onQty,
  onRemove,
  onDuplicate,
  onPdf,
}: {
  item: CartItem;
  onQty: (q: number) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onPdf: () => void;
}) {
  const router = useRouter();
  const c = item.config;
  const sky = useSky(c);
  return (
    <article className="grid gap-5 rounded-2xl border border-line bg-surface/50 p-5 sm:grid-cols-[150px_1fr]">
      <div className="overflow-hidden rounded-xl border border-line">
        <StarMapCanvas config={c} sky={sky.sky} className="aspect-[3/4] w-full" maxRenderPx={600} />
      </div>
      <div className="flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl text-ink">{c.name || "Création Célestime"}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {backgroundById(c.background).label} · {shapeById(c.shape).label} · {c.size} · {c.framed ? "Avec cadre" : "Sans cadre"}
              <br />
              {c.location ? `${c.location.name}, ${c.location.country}` : "Lieu à préciser"} · {c.day && c.day ? `${c.day}/${c.month}/${c.year}` : "date à préciser"}
              {c.timeApprox ? " · heure approximative" : ""}
            </p>
          </div>
          <p className="text-right">
            <p className="text-lg tabular-nums text-gold">{eur(item.unitPrice * item.quantity)}</p>
            {item.quantity > 1 && <p className="text-xs text-faint">{eur(item.unitPrice)} × {item.quantity}</p>}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <div className="flex items-center rounded-full border border-line">
            <button onClick={() => onQty(Math.max(1, item.quantity - 1))} aria-label="Diminuer la quantité" className="h-9 w-9 rounded-l-full text-muted hover:text-ink">
              −
            </button>
            <span className="w-8 text-center text-sm tabular-nums text-ink" aria-live="polite">{item.quantity}</span>
            <button onClick={() => onQty(Math.min(20, item.quantity + 1))} aria-label="Augmenter la quantité" className="h-9 w-9 rounded-r-full text-muted hover:text-ink">
              +
            </button>
          </div>
          <ActionBtn onClick={() => router.push(`/create?edit=${item.id}`)} primary>
            Modifier
          </ActionBtn>
          <ActionBtn onClick={onDuplicate}>Dupliquer</ActionBtn>
          <ActionBtn onClick={onPdf}>PDF HD</ActionBtn>
          <ActionBtn onClick={onRemove} danger>
            Retirer
          </ActionBtn>
        </div>
      </div>
    </article>
  );
}

function ActionBtn({
  children,
  onClick,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-[11px] tracking-[0.14em] uppercase transition-colors ${
        primary
          ? "border-gold bg-gold/10 text-gold hover:bg-gold hover:text-night"
          : danger
            ? "border-line text-muted hover:border-danger hover:text-danger"
            : "border-line text-muted hover:border-gold hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
