"use client";

import { useCallback, useEffect, useState } from "react";
import { euro, inputCls, Field } from "@/components/admin/admin-ui";

type Tab = "categories" | "collections" | "coupons" | "clients" | "paiements";

export default function CommerceClient() {
  const [tab, setTab] = useState<Tab>("categories");
  const [cats, setCats] = useState<any[]>([]);
  const [colls, setColls] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[] | null>(null);
  const [customers, setCustomers] = useState<any[] | null>(null);
  const [payments, setPayments] = useState<any[] | null>(null);
  const [newCat, setNewCat] = useState("");

  const load = useCallback(() => {
    fetch("/api/admin/commerce?scope=categories").then((r) => r.json()).then((d) => setCats(d.categories ?? []));
    fetch("/api/admin/commerce?scope=collections").then((r) => r.json()).then((d) => setColls(d.collections ?? []));
    fetch("/api/admin/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
    fetch("/api/admin/commerce?scope=coupons").then((r) => r.json()).then((d) => setCoupons(d.coupons ?? []));
    fetch("/api/admin/commerce?scope=customers").then((r) => r.json()).then((d) => setCustomers(d.customers ?? []));
    fetch("/api/admin/commerce?scope=payments").then((r) => r.json()).then((d) => setPayments(d.payments ?? []));
  }, []);
  useEffect(load, [load]);

  const post = (action: string, payload: Record<string, unknown> = {}) =>
    fetch("/api/admin/commerce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) }).then((r) => r.json());

  const TABS: [Tab, string][] = [
    ["categories", "Catégories"], ["collections", "Collections"], ["coupons", "Coupons"], ["clients", "Clients"], ["paiements", "Paiements"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-wide ${tab === t ? "border-gold bg-gold/10 text-gold" : "border-line text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "categories" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Nouvelle catégorie (ex. Cadeaux bébé)" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button onClick={async () => { const d = await post("category.create", { name: newCat }); if (!d.error) { setNewCat(""); load(); } }} className="shrink-0 rounded-full bg-gold px-5 py-2 text-xs font-medium uppercase tracking-wide text-night">Créer</button>
          </div>
          <ul className="divide-y divide-line/50 rounded-2xl border border-line">
            {cats.map((c: any, i: number) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => post("category.update", { id: c.id, name: c.name, sortOrder: Math.max(0, i - 1) })} className="text-muted hover:text-ink" aria-label="Monter">↑</button>
                <button onClick={() => post("category.update", { id: c.id, name: c.name, sortOrder: i + 1 })} className="text-muted hover:text-ink" aria-label="Descendre">↓</button>
                <input className="flex-1 bg-transparent text-sm text-ink focus:border-b focus:border-gold" value={c.name} onBlur={(e) => post("category.update", { id: c.id, name: e.target.value, sortOrder: c.sortOrder })} />
                <span className="text-xs text-faint">{products.filter((p: any) => p.categoryId === c.id).length} produit(s)</span>
                <button onClick={() => { if (confirm("Supprimer ?")) post("category.delete", { id: c.id }).then(load); }} className="text-danger" aria-label="Supprimer">×</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "collections" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Nouvelle collection (ex. Noël)" id="new-coll" />
            <button
              onClick={async () => {
                const name = (document.getElementById("new-coll") as HTMLInputElement).value;
                if (name) { await post("collection.create", { name }); load(); }
              }}
              className="shrink-0 rounded-full bg-gold px-5 py-2 text-xs font-medium uppercase tracking-wide text-night"
            >
              Créer
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {colls.map((c: any) => (
              <div key={c.id} className="rounded-2xl border border-line bg-surface/60 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl text-ink">{c.name}</h3>
                  <button onClick={() => { if (confirm("Supprimer cette collection ?")) post("collection.delete", { id: c.id }).then(load); }} className="text-danger" aria-label="Supprimer">×</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {products.map((p: any) => {
                    const inColl = c.items.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => post("collection.update", { id: c.id, items: inColl ? c.items.filter((x: string) => x !== p.id) : [...c.items, p.id] }).then(load)}
                        className={`rounded-full border px-3 py-1 text-xs ${inColl ? "border-gold bg-gold/10 text-gold" : "border-line text-muted hover:text-ink"}`}
                      >
                        {inColl ? "✓ " : "+ "}{p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {colls.length === 0 && <p className="text-sm text-faint">Aucune collection.</p>}
          </div>
        </div>
      )}

      {tab === "coupons" && (
        <div className="space-y-3">
          <CouponForm onCreate={async (c) => { await post("coupon.create", c); load(); }} />
          {coupons === null ? (
            <p className="text-sm text-faint">Chargement…</p>
          ) : (
            <ul className="divide-y divide-line/50 rounded-2xl border border-line">
              {coupons.map((c: any) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="font-mono text-sm text-gold">{c.code}</span>
                  <span className="text-sm text-ink">{c.type === "pct" ? `−${c.value} %` : `−${euro(c.value)}`}</span>
                  <span className="text-xs text-faint">
                    min {euro(c.minAmount)} · {c.endsAt ? `jusqu'au ${new Date(c.endsAt).toLocaleDateString("fr-FR")}` : "sans fin"} · {c.usedCount}/{c.maxUses || "∞"} utilisation(s)
                  </span>
                  <label className="ml-auto flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={c.active} onChange={(e) => post("coupon.update", { id: c.id, ...c, active: e.target.checked }).then(load)} className="accent-[#c9a86a]" /> Actif
                  </label>
                  <button onClick={() => { if (confirm("Supprimer ce code ?")) post("coupon.delete", { id: c.id }).then(load); }} className="text-danger" aria-label="Supprimer">×</button>
                </li>
              ))}
              {coupons.length === 0 && <li className="px-4 py-6 text-center text-sm text-faint">Aucun coupon.</li>}
            </ul>
          )}
        </div>
      )}

      {tab === "clients" && (
        customers === null ? (
          <p className="text-sm text-faint">Chargement…</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] tracking-[0.16em] text-faint uppercase">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Commandes</th>
                  <th className="px-4 py-3">Dépensé</th>
                  <th className="px-4 py-3">Dernière commande</th>
                </tr>
              </thead>
              <tbody>
                {(customers as any[]).map((c: any) => (
                  <tr key={c.email} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-ink">{c.full_name}</p>
                      <p className="text-xs text-faint">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{c.phone || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{c.orders}</td>
                    <td className="px-4 py-3 tabular-nums text-gold">{euro(Number(c.spent))}</td>
                    <td className="px-4 py-3 text-xs text-muted">{c.last ? new Date(c.last).toLocaleDateString("fr-FR") : "—"}</td>
                  </tr>
                ))}
                {(customers as any[]).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-faint">Aucun client pour le moment.</td></tr>}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "paiements" && (
        payments === null ? (
          <p className="text-sm text-faint">Chargement…</p>
        ) : (
          <div className="space-y-3">
            <StripeStatus />
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] tracking-[0.16em] text-faint uppercase">
                    <th className="px-4 py-3">ID transaction</th>
                    <th className="px-4 py-3">Montant</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {(payments as any[]).map((p: any) => (
                    <tr key={p.id} className="border-b border-line/50 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-muted">{p.sessionOrIntentId.slice(0, 24)}…</td>
                      <td className="px-4 py-3 tabular-nums text-ink">{euro(p.amountCents)}</td>
                      <td className="px-4 py-3 text-xs text-muted">{new Date(p.createdAt).toLocaleString("fr-FR")}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${p.status === "succeeded" ? "bg-gold/15 text-gold" : p.status === "refunded" ? "bg-raised text-muted" : "bg-danger/10 text-danger"}`}>
                          {p.status === "succeeded" ? "Réussi" : p.status === "refunded" ? "Remboursé" : "Échoué"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(payments as any[]).length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-faint">Aucune transaction.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function CouponForm({ onCreate }: { onCreate: (c: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({ code: "", type: "pct", value: 10, minAmount: 0, maxUses: 0, endsAt: "" });
  return (
    <div className="grid gap-3 rounded-2xl border border-line bg-surface/60 p-4 sm:grid-cols-6">
      <Field label="Code"><input className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="SAINT-VAL" /></Field>
      <Field label="Type">
        <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="pct">%</option><option value="fixed">€</option>
        </select>
      </Field>
      <Field label={f.type === "pct" ? "Valeur %" : "Valeur €"}><input type="number" className={inputCls} value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} /></Field>
      <Field label="Min. d'achat €"><input type="number" className={inputCls} value={f.minAmount} onChange={(e) => setF({ ...f, minAmount: Number(e.target.value) })} /></Field>
      <Field label="Jusqu'au"><input type="date" className={inputCls} value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></Field>
      <div className="flex items-end">
        <button onClick={async () => { if (f.code) { await onCreate({ ...f, minAmount: f.minAmount * 100, endsAt: f.endsAt || undefined }); setF({ ...f, code: "", endsAt: "" }); } }} className="w-full rounded-full bg-gold py-2.5 text-xs font-medium uppercase tracking-wide text-night">Créer</button>
      </div>
    </div>
  );
}

function StripeStatus() {
  const [st, setSt] = useState<{ enabled: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/stripe/checkout").then((r) => (r.ok ? r.json() : { enabled: false })).then(setSt).catch(() => setSt({ enabled: false }));
  }, []);
  if (!st) return null;
  return st.enabled ? (
    <p className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-xs text-goldsoft">
      Stripe connecté. Checkout + Apple Pay / Google Pay / Stripe Link activés. Webhooks synchronisent les statuts automatiquement.
    </p>
  ) : (
    <p className="rounded-xl border border-line bg-raised/50 px-4 py-3 text-xs leading-relaxed text-muted">
      <span className="text-gold">Mode démonstration</span> — Stripe n'est pas configuré (ajouter <code>STRIPE_SECRET_KEY</code> et <code>STRIPE_WEBHOOK_SECRET</code>).
      Les commandes sont enregistrées en « paiement démo » ; l'infrastructure Stripe (Checkout, webhooks <code>checkout.session.completed</code>, <code>charge.refunded</code>, remboursements) est en place et s'activera automatiquement.
    </p>
  );
}
