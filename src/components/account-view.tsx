"use client";

// Célestime — Compte client : mes créations (brouillons & sauvegardes) et mes commandes.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StarMapCanvas, useSky } from "./starmap-canvas";
import { deleteCreation, listCreations, ORDERS_KEY, DRAFT_KEY, type SavedCreation } from "@/lib/editor";
import { eur } from "@/lib/pricing";
import type { Order } from "@/lib/types";

export default function AccountView() {
  const router = useRouter();
  const [creations, setCreations] = useState<SavedCreation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(() => {
    setCreations(listCreations());
    try {
      const raw = localStorage.getItem(ORDERS_KEY);
      setOrders(raw ? JSON.parse(raw) : []);
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreation = (c: SavedCreation) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
    router.push("/create");
  };

  const removeCreation = (id: string) => {
    deleteCreation(id);
    load();
  };

  return (
    <div className="mt-10 space-y-12">
      <section>
        <h2 className="text-[11px] tracking-[0.24em] text-muted uppercase">Mes créations ({creations.length})</h2>
        {creations.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
            <p className="text-sm text-muted">Aucune création sauvegardée pour le moment.</p>
            <Link href="/create" className="mt-5 inline-block rounded-full bg-gold px-7 py-3 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">
              Créer ma première carte
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {creations.map((c) => (
              <article key={c.id} className="overflow-hidden rounded-2xl border border-line bg-surface/50">
                <div className="border-b border-line">
                  <CreationThumb config={c.config} />
                </div>
                <div className="p-4">
                  <p className="truncate font-display text-lg text-ink">{c.name}</p>
                  <p className="mt-0.5 text-xs text-faint">
                    {c.config.location ? `${c.config.location.name} · ` : ""}
                    {c.config.day ? `${c.config.day}/${c.config.month}/${c.config.year} · ` : ""}
                    {c.config.size}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => openCreation(c)} className="rounded-full border border-gold bg-gold/10 px-3.5 py-1.5 text-[11px] tracking-[0.12em] text-gold uppercase transition-colors hover:bg-gold hover:text-night">
                      Modifier
                    </button>
                    <button onClick={() => openCreation(c)} className="rounded-full border border-line px-3.5 py-1.5 text-[11px] tracking-[0.12em] text-muted uppercase hover:text-ink">
                      Dupliquer
                    </button>
                    <button onClick={() => removeCreation(c.id)} className="rounded-full border border-line px-3.5 py-1.5 text-[11px] tracking-[0.12em] text-muted uppercase hover:border-danger hover:text-danger">
                      Supprimer
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[11px] tracking-[0.24em] text-muted uppercase">Mes commandes ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-6 py-8 text-center text-sm text-muted">
            Aucune commande passée sur cet appareil.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/50 px-5 py-4">
                <div>
                  <p className="text-sm text-ink">
                    <span className="text-gold">{o.orderNumber}</span>
                    <span className="text-faint"> · {new Date(o.createdAt).toLocaleDateString("fr-FR")}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {o.items.reduce((s, i) => s + i.quantity, 0)} création(s) · Statut : <span className="text-goldsoft">confirmée, en préparation</span>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-display text-xl text-gold tabular-nums">{eur(o.total)}</p>
                  <Link href={`/confirmation/${encodeURIComponent(o.orderNumber)}`} className="rounded-full border border-line px-4 py-2 text-[11px] tracking-[0.12em] text-muted uppercase hover:border-gold hover:text-ink">
                    Détails
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreationThumb({ config }: { config: import("@/lib/types").CreationConfig }) {
  const sky = useSky(config);
  return <StarMapCanvas config={config} sky={sky.sky} className="aspect-[3/4] w-full" maxRenderPx={500} />;
}
