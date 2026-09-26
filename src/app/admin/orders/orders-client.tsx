"use client";

import { useCallback, useEffect, useState } from "react";
import { euro, STATUS_LABELS } from "@/components/admin/admin-ui";

interface Order {
  id: string; orderNumber: string; customer: { fullName: string; email: string; phone?: string; address: string; zip: string; city: string; country: string };
  total: number; discount: number; couponCode: string | null; status: string; paymentStatus: string;
  items: { id: string; quantity: number; unitPrice: number; config: Record<string, any> }[];
  createdAt: string;
}

const FLOW = ["en_attente", "payee", "en_preparation", "expediee", "livree"];

export default function OrdersClient() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState<Order | null>(null);
  const [action, setAction] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/orders").then((r) => r.json()).then((d) => setOrders(d.orders ?? []));
  }, []);
  useEffect(load, [load]);

  const setStatus = async (id: string, status: string) => {
    setAction(status);
    await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", id, status }) });
    setAction(null);
    load();
  };

  const refund = async (id: string) => {
    if (!confirm("Procéder au remboursement de cette commande ?")) return;
    setAction("refund");
    const d = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refund", id }) }).then((r) => r.json());
    setAction(null);
    if (d.error) alert(d.error);
    load();
  };

  const list = (orders ?? []).filter((o) => statusFilter === "all" || o.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["all", ...FLOW, "annulee", "remboursee"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-wide ${statusFilter === s ? "border-gold bg-gold/10 text-gold" : "border-line text-muted hover:text-ink"}`}>
            {s === "all" ? "Toutes" : STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {orders === null ? (
        <p className="py-16 text-center text-sm text-faint">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-[0.16em] text-faint uppercase">
                <th className="px-4 py-3">N°</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Produits</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Paiement</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="border-b border-line/50 last:border-0 hover:bg-raised/40">
                  <td className="px-4 py-3">
                    <button onClick={() => setOpen(o)} className="font-mono text-xs text-gold hover:underline">{o.orderNumber}</button>
                    <p className="text-[11px] text-faint">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-ink">{o.customer.fullName}</p>
                    <p className="text-xs text-faint">{o.customer.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {o.items.map((i) => `${i.quantity}× ${(i.config?.name ?? i.config?.productId ?? "Création")}`).join(", ").slice(0, 40)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gold">{euro(o.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${o.paymentStatus === "succeeded" ? "bg-gold/15 text-gold" : o.paymentStatus === "refunded" ? "bg-raised text-muted" : "bg-raised text-faint"}`}>
                      {o.paymentStatus === "succeeded" ? "Payée" : o.paymentStatus === "refunded" ? "Remboursée" : "Démo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      disabled={action !== null}
                      onChange={(e) => setStatus(o.id, e.target.value)}
                      className="rounded-lg border border-line bg-night px-2 py-1.5 text-xs text-ink focus:border-gold"
                      aria-label="Changer le statut"
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => refund(o.id)} disabled={o.status === "remboursee"} className="rounded-full border border-line px-3 py-1.5 text-[11px] uppercase tracking-wide text-danger hover:border-danger disabled:opacity-40">
                      Rembourser
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-faint">Aucune commande dans ce statut.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-2xl text-ink">{open.orderNumber}</h3>
                <p className="text-xs text-faint">{new Date(open.createdAt).toLocaleString("fr-FR")} · {STATUS_LABELS[open.status]}</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-2xl leading-none text-muted" aria-label="Fermer">×</button>
            </div>
            <div className="mt-4 rounded-xl border border-line bg-night/40 p-4 text-sm">
              <p className="text-ink">{open.customer.fullName} · {open.customer.email}</p>
              <p className="mt-1 text-xs text-muted">{open.customer.address}, {open.customer.zip} {open.customer.city}, {open.customer.country}</p>
            </div>
            <ul className="mt-4 space-y-2">
              {open.items.map((i) => (
                <li key={i.id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex justify-between">
                    <p className="text-ink">
                      {i.quantity}× {(i.config as any)?.name || "Création Célestime"}
                      <span className="text-faint"> · {(i.config as any)?.size}{(i.config as any)?.framed ? " encadrée" : ""}</span>
                    </p>
                    <span className="tabular-nums text-gold">{euro(i.unitPrice * i.quantity)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {(i.config as any)?.location ? `${(i.config as any).location.name}, ${(i.config as any).location.country} · ` : ""}
                    {(i.config as any)?.day ? `${(i.config as any).day}/${(i.config as any).month}/${(i.config as any).year} · ` : ""}
                    {(i.config as any)?.timeApprox ? "heure approximative" : `${(i.config as any)?.hour ?? ""}h${(i.config as any)?.minute ?? ""}`}
                    {(i.config as any)?.message ? ` · « ${(i.config as any).message} »` : ""}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Sous-total</dt><dd className="tabular-nums text-ink">{euro(open.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0))}</dd></div>
              {open.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Remise {open.couponCode}</dt><dd className="tabular-nums text-danger">−{euro(open.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink">Total TTC</dt><dd className="tabular-nums text-gold">{euro(open.total)}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
