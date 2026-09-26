"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { euro, inputCls, Field } from "@/components/admin/admin-ui";

interface Variant {
  id?: string; name: string; priceCents: number; oldPriceCents?: number; stock: number; oversell: boolean; reference: string; image?: string; reserved?: number; sold?: number;
}
interface Product {
  id: string; slug: string; name: string; fullName: string; tagline: string; description: string;
  categoryId: number | null; reference: string; weight: string; dims: string; taxRate: number;
  oldPrice: number | null; onPromo: boolean; images: string[]; status: string; kind: string;
  engine: Record<string, any> | null; box: string[]; seo: Record<string, any>;
  rating: number; reviewsCount: number; variants: Variant[];
}
interface Category {
  id: number; name: string; slug: string;
}

export default function ProductsClient() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/products").then((r) => r.json()).then((d) => setProducts(d.products ?? []));
    fetch("/api/admin/commerce?scope=categories").then((r) => r.json()).then((d) => setCats(d.categories ?? []));
  }, []);
  useEffect(load, [load]);

  const startNew = () => {
    setIsNew(true);
    setEditing({
      id: "", slug: "", name: "", fullName: "", tagline: "", description: "", categoryId: null,
      reference: "", weight: "", dims: "", taxRate: 2000, oldPrice: null, onPromo: false,
      images: [], status: "draft", kind: "static", engine: null, box: [], seo: {}, rating: 50, reviewsCount: 0, variants: [],
    });
  };

  const save = async () => {
    if (!editing) return;
    const d = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: isNew ? "create" : "update", ...editing, oldPrice: editing.oldPrice ? editing.oldPrice / 100 : null }) }).then((r) => r.json());
    if (d.ok || d.id) {
      setEditing(null);
      load();
    } else alert(d.error ?? "Erreur");
  };

  const del = async (p: Product) => {
    if (!confirm(`Supprimer « ${p.name} » et ses variantes ?`)) return;
    await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: p.id }) });
    load();
  };

  if (editing) {
    return (
      <ProductForm
        product={editing}
        cats={cats}
        isNew={isNew}
        onChange={setEditing}
        onCancel={() => setEditing(null)}
        onSave={save}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Les produits, prix, variantes et stocks sont modifiables ici — les changements s'appliquent immédiatement au site et au configurateur.
        </p>
        <button onClick={startNew} className="shrink-0 rounded-full bg-gold px-6 py-2.5 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">
          + Ajouter un produit
        </button>
      </div>
      {products === null ? (
        <p className="py-16 text-center text-sm text-faint">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-[0.16em] text-faint uppercase">
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Prix</th>
                <th className="px-4 py-3">Variantes</th>
                <th className="px-4 py-3">Stock faible</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = p.variants.filter((v) => !v.oversell && v.stock - (v.reserved ?? 0) <= 5);
                return (
                  <tr key={p.id} className="border-b border-line/50 last:border-0 hover:bg-raised/40">
                    <td className="px-4 py-3">
                      <p className="text-ink">{p.name}</p>
                      <p className="font-mono text-[11px] text-faint">{p.slug}{p.kind === "starmap" ? " · configurateur" : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{cats.find((c) => c.id === p.categoryId)?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-gold">{euro(p.variants[0]?.priceCents ?? 0)}+</span>
                      {p.onPromo && p.oldPrice ? <span className="ml-2 text-xs text-faint line-through">{euro(p.oldPrice)}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{p.variants.length}</td>
                    <td className="px-4 py-3">
                      {low.length > 0 ? <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] text-danger">{low.length}</span> : <span className="text-xs text-faint">OK</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wide ${p.status === "active" ? "bg-gold/15 text-gold" : "bg-raised text-faint"}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link href={`/produit/${p.slug}`} target="_blank" className="rounded-full border border-line px-3 py-1.5 text-[11px] tracking-wide text-muted uppercase hover:text-ink">Voir</Link>
                        <button onClick={() => { setIsNew(false); setEditing({ ...p, variants: p.variants.map((v) => ({ ...v })) }); }} className="rounded-full bg-gold px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-night uppercase hover:bg-goldsoft">Modifier</button>
                        <button onClick={() => del(p)} className="rounded-full border border-line px-3 py-1.5 text-[11px] tracking-wide text-danger uppercase hover:border-danger">Suppr.</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductForm({
  product, cats, isNew, onChange, onCancel, onSave,
}: {
  product: Product;
  cats: Category[];
  isNew: boolean;
  onChange: (p: Product) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (patch: Partial<Product>) => onChange({ ...product, ...patch });
  const setV = (i: number, patch: Partial<Variant>) => {
    const vs = [...product.variants];
    vs[i] = { ...vs[i], ...patch };
    set({ variants: vs });
  };
  const isStarmap = product.kind === "starmap";
  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-ink">{isNew ? "Nouveau produit" : product.name}</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-full border border-line px-5 py-2 text-sm text-muted hover:text-ink">Annuler</button>
          <button onClick={onSave} className="rounded-full bg-gold px-6 py-2 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">Enregistrer</button>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-line bg-surface/60 p-5 sm:grid-cols-2">
        <Field label="Nom"><input className={inputCls} value={product.name} onChange={(e) => set({ name: e.target.value, fullName: product.fullName || e.target.value })} /></Field>
        <Field label="Nom complet (SEO)"><input className={inputCls} value={product.fullName} onChange={(e) => set({ fullName: e.target.value })} /></Field>
        <Field label="Accroche"><input className={inputCls} value={product.tagline} onChange={(e) => set({ tagline: e.target.value })} /></Field>
        <Field label="Description">
          <textarea rows={3} className={`${inputCls} resize-none`} value={product.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label="Catégorie">
          <select className={inputCls} value={product.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Référence"><input className={inputCls} value={product.reference} onChange={(e) => set({ reference: e.target.value })} /></Field>
        <Field label="Type">
          <select className={inputCls} value={product.kind} onChange={(e) => set({ kind: e.target.value })}>
            <option value="static">Produit standard</option>
            <option value="starmap">Produit personnalisable (configurateur Célestime)</option>
          </select>
        </Field>
        <Field label="TVA (pour mille)"><input type="number" className={inputCls} value={product.taxRate} onChange={(e) => set({ taxRate: Number(e.target.value) || 0 })} /></Field>
        <Field label="Prix promo barré (€ — optionnel)">
          <input type="number" step="0.1" className={inputCls} value={product.oldPrice ? product.oldPrice / 100 : ""} onChange={(e) => set({ oldPrice: e.target.value ? Number(e.target.value) * 100 : null, onPromo: !!e.target.value })} placeholder="ex. 19" />
        </Field>
        <Field label="Statut">
          <select className={inputCls} value={product.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="active">Visible (publié)</option>
            <option value="draft">Brouillon</option>
            <option value="archived">Archivé</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Images (chemins — /images/… ou /media/…)">
            <div className="flex flex-wrap gap-2">
              {product.images.map((img, i) => (
                <div key={i} className="flex items-center gap-1 rounded-full border border-line bg-night py-1 pl-3 pr-1 text-xs text-ink">
                  {img}
                  <button onClick={() => set({ images: product.images.filter((_, j) => j !== i) })} className="flex h-5 w-5 items-center justify-center rounded-full text-danger" aria-label="Retirer">×</button>
                </div>
              ))}
              <input
                list="media-images"
                placeholder="+ ajouter une image"
                className="w-44 rounded-full border border-dashed border-line bg-transparent px-3 py-1.5 text-xs text-muted focus:border-gold"
                onBlur={(e) => {
                  if (e.target.value) {
                    set({ images: [...product.images, e.target.value] });
                    e.target.value = "";
                  }
                }}
              />
            </div>
          </Field>
          <datalist id="media-images">
            {["/images/naissance.jpg", "/images/nous-deux.jpg", "/images/rencontre.jpg", "/images/journee.jpg", "/images/calendrier.jpg", "/images/carnet.jpg", "/images/poemes.jpg"].map((i) => <option key={i} value={i} />)}
          </datalist>
        </div>
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
          <Field label="SEO — title"><input className={inputCls} value={(product.seo as any).title ?? ""} onChange={(e) => set({ seo: { ...(product.seo as any), title: e.target.value } } as Partial<Product>)} /></Field>
          <Field label="SEO — description">
            <input className={inputCls} value={(product.seo as any).description ?? ""} onChange={(e) => set({ seo: { ...(product.seo as any), description: e.target.value } } as Partial<Product>)} />
          </Field>
          <label className="mt-6 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={!!(product.seo as any).noindex} onChange={(e) => set({ seo: { ...(product.seo as any), noindex: e.target.checked } } as Partial<Product>)} className="accent-[#c9a86a]" /> noindex
          </label>
        </div>
      </div>

      {/* Associé au configurateur */}
      {isStarmap && product.engine && (
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
          <h3 className="text-xs tracking-[0.2em] text-gold uppercase">Configurateur Célestime associé</h3>
          <p className="mt-1 text-xs text-muted">
            Le bouton « Personnaliser » de la fiche ouvre le configurateur avec les options ci-dessous (formats, formes, fonds, cadre).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Formats (séparés par des virgules)">
              <input className={inputCls} value={(product.engine as any).sizes?.join(", ") ?? ""} onChange={(e) => set({ engine: { ...(product.engine as any), sizes: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter((s) => ["A4", "A3", "A2", "A1", "A0"].includes(s)) } } as Partial<Product>)} placeholder="A4, A3, A2" />
            </Field>
            <Field label="Formes">
              <input className={inputCls} value={(product.engine as any).shapes?.join(", ") ?? ""} onChange={(e) => set({ engine: { ...(product.engine as any), shapes: e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter((s) => ["medaillon", "coeur"].includes(s)) } } as Partial<Product>)} placeholder="medaillon, coeur" />
            </Field>
            <Field label="Fonds">
              <input className={inputCls} value={(product.engine as any).backgrounds?.join(", ") ?? ""} onChange={(e) => set({ engine: { ...(product.engine as any), backgrounds: e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter((s) => ["saphir", "rubis", "emeraude"].includes(s)) } } as Partial<Product>)} placeholder="saphir, rubis, emeraude" />
            </Field>
            <label className="mt-7 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={!!(product.engine as any).framed} onChange={(e) => set({ engine: { ...(product.engine as any), framed: e.target.checked } } as Partial<Product>)} className="accent-[#c9a86a]" /> Option « Avec cadre »
            </label>
          </div>
        </div>
      )}

      {/* Variantes */}
      <div className="rounded-2xl border border-line bg-surface/60 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs tracking-[0.2em] text-gold uppercase">Variantes (formats, cadre, finitions…)</h3>
          <button
            onClick={() => set({ variants: [...product.variants, { name: "Nouvelle variante", priceCents: 0, stock: 10, oversell: false, reference: "" }] })}
            className="rounded-full border border-line px-4 py-1.5 text-xs text-muted hover:border-gold hover:text-ink"
          >
            + Variante
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {product.variants.map((v, i) => (
            <div key={v.id ?? i} className="grid items-center gap-2 rounded-xl border border-line bg-night/50 p-3 sm:grid-cols-[1fr_110px_110px_90px_1fr_auto]">
              <input className={inputCls} value={v.name} onChange={(e) => setV(i, { name: e.target.value })} aria-label="Nom de la variante" />
              <div>
                <label className="text-[10px] text-faint uppercase">Prix €</label>
                <input type="number" step="0.1" className={inputCls} value={(v.priceCents / 100).toFixed(2)} onChange={(e) => setV(i, { priceCents: Math.round(Number(e.target.value) * 100) })} />
              </div>
              <div>
                <label className="text-[10px] text-faint uppercase">Stock</label>
                <input type="number" className={inputCls} value={v.stock} onChange={(e) => setV(i, { stock: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-[10px] text-faint uppercase">Réf.</label>
                <input className={inputCls} value={v.reference} onChange={(e) => setV(i, { reference: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={v.oversell} onChange={(e) => setV(i, { oversell: e.target.checked })} className="accent-[#c9a86a]" /> Vente hors stock
              </label>
              <button onClick={() => set({ variants: product.variants.filter((_, j) => j !== i) })} className="justify-self-end text-danger" aria-label="Supprimer la variante">×</button>
            </div>
          ))}
          {product.variants.length === 0 && <p className="text-sm text-faint">Aucune variante — le produit sera vendu au prix de base.</p>}
        </div>
      </div>
    </div>
  );
}
