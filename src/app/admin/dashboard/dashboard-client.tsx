"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Stat, euro, STATUS_LABELS } from "@/components/admin/admin-ui";

interface Dash {
  revenue: number; ordersCount: number; pending: number; avg: number;
  productsCount: number; customersCount: number; lowStock: { name: string; productId: string; stock: number }[];
  weeks: number[]; topProducts: { name: string; slug: string; qty: number }[];
  payments: { sessionOrIntentId: string; amountCents: number; status: string; createdAt: string }[];
  recentOrders: { orderNumber: string; total: number; status: string; customer: { fullName: string }; createdAt: string }[];
}

export default function DashboardClient() {
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => {
    fetch("/api/admin/dashboard").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
  }, []);
  if (!d) return <div className="py-24 text-center text-sm text-faint">Chargement…</div>;
  const max = Math.max(1, ...d.weeks);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Chiffre d'affaires" value={euro(d.revenue)} sub={`${d.ordersCount} commande(s)`} accent />
        <Stat label="En attente" value={String(d.pending)} sub="à traiter" />
        <Stat label="Panier moyen" value={euro(d.avg)} />
        <Stat label="Clients" value={String(d.customersCount)} sub={`${d.productsCount} produits actifs`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface/60 p-5">
          <h2 className="text-xs tracking-[0.2em] text-gold uppercase">Ventes — 8 dernières semaines</h2>
          <div className="mt-4 flex h-40 items-end gap-2">
            {d.weeks.map((w, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-gold/70 transition-all" style={{ height: `${Math.max(4, (w / max) * 100)}%` }} title={euro(w)} />
                <span className="text-[9px] text-faint">S{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface/60 p-5">
          <h2 className="text-xs tracking-[0.2em] text-gold uppercase">Meilleures ventes</h2>
          <ul className="mt-3 space-y-2">
            {d.topProducts.length === 0 && <li className="text-sm text-faint">Aucune vente pour le moment.</li>}
            {d.topProducts.map((p) => (
              <li key={p.slug} className="flex items-center justify-between rounded-lg bg-raised px-3 py-2 text-sm">
                <span className="text-ink">{p.name}</span>
                <span className="tabular-nums text-gold">× {p.qty}</span>
              </li>
            ))}
          </ul>
          {d.lowStock.length > 0 && (
            <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-3">
              <p className="text-xs text-danger">Stock faible ({d.lowStock.length})</p>
              <ul className="mt-1 space-y-1 text-xs text-muted">
                {d.lowStock.slice(0, 4).map((v, i) => (
                  <li key={i}>{v.name} — {Math.max(0, v.stock)} restant(s)</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs tracking-[0.2em] text-gold uppercase">Commandes récentes</h2>
            <Link href="/admin/orders" className="text-xs text-muted hover:text-gold">Tout voir →</Link>
          </div>
          <ul className="mt-3 divide-y divide-line/50">
            {d.recentOrders.map((o) => (
              <li key={o.orderNumber} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="text-ink">{o.orderNumber}</p>
                  <p className="text-xs text-faint">{o.customer.fullName} · {new Date(o.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-gold">{euro(o.total)}</p>
                  <p className="text-[11px] text-muted">{STATUS_LABELS[o.status] ?? o.status}</p>
                </div>
              </li>
            ))}
            {d.recentOrders.length === 0 && <li className="py-3 text-sm text-faint">Aucune commande.</li>}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-surface/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs tracking-[0.2em] text-gold uppercase">Derniers paiements</h2>
            <Link href="/admin/commerce?tab=paiements" className="text-xs text-muted hover:text-gold">Détails →</Link>
          </div>
          <ul className="mt-3 divide-y divide-line/50">
            {d.payments.map((p) => (
              <li key={p.sessionOrIntentId} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-mono text-xs text-muted">{p.sessionOrIntentId.slice(0, 18)}…</p>
                  <p className="text-xs text-faint">{new Date(p.createdAt).toLocaleString("fr-FR")}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-ink">{euro(p.amountCents)}</p>
                  <p className={`text-[11px] ${p.status === "succeeded" ? "text-goldsoft" : p.status === "refunded" ? "text-muted" : "text-danger"}`}>
                    {p.status === "succeeded" ? "Réussi" : p.status === "refunded" ? "Remboursé" : "Échoué"}
                  </p>
                </div>
              </li>
            ))}
            {d.payments.length === 0 && <li className="py-3 text-sm text-faint">Aucun paiement.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
