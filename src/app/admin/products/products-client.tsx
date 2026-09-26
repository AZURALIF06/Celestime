"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { euro, inputCls, Field } from "@/components/admin/admin-ui";
import MediaPicker from "@/components/admin/media-picker";

interface Variant {
  id?: string;
  name: string;
  priceCents: number;
  oldPriceCents?: number;
  stock: number;
  oversell: boolean;
  reference: string;
  image?: string;
  reserved?: number;
  sold?: number;
}
interface Product {
  id: string;
  slug: string;
  name: string;
  fullName: string;
  tagline: string;
  description: string;
  categoryId: number | null;
  reference: string;
  weight: string;
  dims: string;
  taxRate: number;
  oldPrice: number | null;
  onPromo: boolean;
  images: string[];
  status: string;
  kind: string;
  engine: Record<string, any> | null;
  box: string[];
  seo: Record<string, any>;
  rating: number;
  reviewsCount: number;
  variants: Variant[];
}
interface Category {
  id: number;
  name: string;
  slug: string;
}

/** Images d'origine des produits Célestime, par slug.
 *  Sert uniquement de visuel de repli dans l'aperçu admin : sans ça, tous les
 *  produits sans image enregistrée affichaient la même image (naissance). */
const SLUG_IMAGES: Record<string, string> = {
  "etoiles-de-naissance": "/images/naissance.jpg",
  "etoiles-de-nous-deux": "/images/nous-deux.jpg",
  "etoiles-de-rencontre": "/images/rencontre.jpg",
  "notre-journee-a-nous": "/images/journee.jpg",
  "calendrier-2027": "/images/calendrier.jpg",
  "carnet-personnalise": "/images/carnet.jpg",
  "recueil-de-poemes-cosmiques": "/images/poemes.jpg",
};

function imageForSlug(slug: string): string {
  return SLUG_IMAGES[slug] ?? "/images/naissance.jpg";
}

export default function ProductsClient() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
    fetch("/api/admin/commerce?scope=categories")
      .then((r) => r.json())
      .then((d) => setCats(d.categories ?? []));
  }, []);
  useEffect(load, [load]);

  const startNew = () => {
    setIsNew(true);
    setEditing({
      id: "",
      slug: "",
      name: "",
      fullName: "",
      tagline: "",
      description: "",
      categoryId: null,
      reference: "",
      weight: "",
      dims: "",
      taxRate: 2000,
      oldPrice: null,
      onPromo: false,
      images: [],
      status: "draft",
      kind: "static",
      engine: null,
      box: [],
      seo: {},
      rating: 50,
      reviewsCount: 0,
      variants: [],
    });
  };

  const save = async () => {
    if (!editing) return;
    // garde images en string[] pour compat
    const payload = {
      ...editing,
      oldPrice: editing.oldPrice ? editing.oldPrice / 100 : null,
      images: editing.images.filter(Boolean),
    };
    const d = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isNew ? "create" : "update", ...payload }),
    }).then((r) => r.json());
    if (d.ok || d.id) {
      setEditing(null);
      load();
    } else alert(d.error ?? "Erreur");
  };

  const del = async (p: Product) => {
    if (!confirm(`Supprimer « ${p.name} » et ses variantes ?`)) return;
    await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: p.id }),
    });
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
          Les produits, prix, variantes et stocks sont modifiables ici — les changements s&apos;appliquent immédiatement au site et au configurateur.
        </p>
        <button
          onClick={startNew}
          className="shrink-0 rounded-full bg-gold px-6 py-2.5 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft"
        >
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
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Prix</th>
                <th className="px-4 py-3">Variantes</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = p.variants.filter((v) => !v.oversell && v.stock - (v.reserved ?? 0) <= 5);
                const mainImg = p.images.find(Boolean) ?? imageForSlug(p.slug);
                return (
                  <tr key={p.id} className="border-b border-line/50 last:border-0 hover:bg-raised/40">
                    <td className="px-4 py-3">
                      <p className="text-ink">{p.name}</p>
                      <p className="font-mono text-[11px] text-faint">
                        {p.slug}
                        {p.kind === "starmap" ? " · configurateur" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mainImg} alt="" className="h-10 w-14 rounded-lg object-cover border border-line" />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{cats.find((c) => c.id === p.categoryId)?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-gold">{euro(p.variants[0]?.priceCents ?? 0)}+</span>
                      {p.onPromo && p.oldPrice ? <span className="ml-2 text-xs text-faint line-through">{euro(p.oldPrice)}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {p.variants.length} {low.length > 0 ? <span className="ml-1 rounded-full bg-danger/15 px-2 py-0.5 text-[11px] text-danger">{low.length} faible</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wide ${p.status === "active" ? "bg-gold/15 text-gold" : "bg-raised text-faint"}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link href={`/produit/${p.slug}`} target="_blank" className="rounded-full border border-line px-3 py-1.5 text-[11px] tracking-wide text-muted uppercase hover:text-ink">
                          Voir
                        </Link>
                        <button
                          onClick={() => {
                            setIsNew(false);
                            setEditing({ ...p, variants: p.variants.map((v) => ({ ...v })) });
                          }}
                          className="rounded-full bg-gold px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-night uppercase hover:bg-goldsoft"
                        >
                          Modifier
                        </button>
                        <button onClick={() => del(p)} className="rounded-full border border-line px-3 py-1.5 text-[11px] tracking-wide text-danger uppercase hover:border-danger">
                          Suppr.
                        </button>
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
  product,
  cats,
  isNew,
  onChange,
  onCancel,
  onSave,
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

  const [pickerOpen, setPickerOpen] = useState<false | "main" | "gallery">(false);
  const isStarmap = product.kind === "starmap";

  const mainImage = product.images[0] ?? "";
  const gallery = product.images.slice(1);

  const handlePickerSelect = (urls: string[]) => {
    if (pickerOpen === "main") {
      // Remplace l'image principale, garde galerie
      const newImages = [urls[0], ...gallery].filter(Boolean);
      set({ images: newImages });
    } else if (pickerOpen === "gallery") {
      // Ajoute à la galerie (multiple possible)
      const newImages = [mainImage, ...gallery, ...urls].filter(Boolean);
      // dédoublonne
      const dedup = Array.from(new Set(newImages));
      set({ images: dedup });
    }
    setPickerOpen(false);
  };

  const removeImage = (idx: number) => {
    set({ images: product.images.filter((_, j) => j !== idx) });
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= product.images.length) return;
    const arr = [...product.images];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    set({ images: arr });
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-ink">{isNew ? "Nouveau produit" : product.name}</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-full border border-line px-5 py-2 text-sm text-muted hover:text-ink">
            Annuler
          </button>
          <button onClick={onSave} className="rounded-full bg-gold px-6 py-2 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">
            Enregistrer
          </button>
        </div>
      </div>

      {/* Images — nouvelle médiathèque */}
      <div className="rounded-2xl border border-gold/20 bg-surface/60 p-5">
        <h3 className="text-xs tracking-[0.2em] text-gold uppercase">Médiathèque — Images du produit</h3>
        <p className="mt-1 text-xs text-muted">Utilisez la médiathèque persistante Vercel Blob. Anciennes images <code>/images/…</code> restent compatibles.</p>

        {/* Image principale */}
        <div className="mt-4 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div>
            <Field label="Image principale">
              <div className="overflow-hidden rounded-xl border border-line bg-night">
                {mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mainImage} alt="Image principale" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-xs text-faint">Aucune image</div>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setPickerOpen("main")}
                  className="flex-1 rounded-full bg-gold px-4 py-2 text-xs font-medium tracking-wide text-night uppercase hover:bg-goldsoft"
                >
                  Choisir dans la médiathèque
                </button>
                {mainImage && (
                  <button
                    onClick={() => removeImage(0)}
                    className="rounded-full border border-line px-3 py-2 text-xs uppercase tracking-wide text-danger hover:border-danger"
                  >
                    Retirer
                  </button>
                )}
              </div>
              {mainImage && (
                <p className="mt-2 truncate font-mono text-[10px] text-faint" title={mainImage}>
                  {mainImage}
                </p>
              )}
            </Field>
          </div>

          <div>
            <Field label={`Galerie — ${gallery.length} image${gallery.length !== 1 ? "s" : ""} supplémentaire${gallery.length !== 1 ? "s" : ""}`}>
              <div className="min-h-[160px] rounded-xl border border-dashed border-line bg-night/30 p-3">
                {gallery.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-xs text-faint">Aucune image supplémentaire.</p>
                    <button
                      onClick={() => setPickerOpen("gallery")}
                      className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs text-muted hover:text-ink"
                    >
                      + Ajouter depuis médiathèque
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {gallery.map((img, i) => {
                      const realIdx = i + 1;
                      return (
                        <div key={`${img}-${i}`} className="group relative overflow-hidden rounded-lg border border-line bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt="" className="aspect-square w-full object-cover" />
                          <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-1 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => moveImage(realIdx, realIdx - 1)}
                                className="rounded-full bg-black/60 px-2 py-1 text-[10px] text-white hover:bg-black/80"
                                title="Monter"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => moveImage(realIdx, realIdx + 1)}
                                className="rounded-full bg-black/60 px-2 py-1 text-[10px] text-white hover:bg-black/80"
                                title="Descendre"
                              >
                                ↓
                              </button>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  // mettre en principale
                                  const arr = [...product.images];
                                  const [picked] = arr.splice(realIdx, 1);
                                  arr.unshift(picked);
                                  set({ images: arr });
                                }}
                                className="flex-1 rounded-full bg-gold px-2 py-1 text-[10px] uppercase tracking-wide text-night"
                              >
                                En principale
                              </button>
                              <button onClick={() => removeImage(realIdx)} className="rounded-full bg-danger/90 px-2 py-1 text-[10px] text-white">
                                ×
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => setPickerOpen("gallery")}
                      className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-line bg-night/20 text-xs text-muted hover:border-gold hover:text-ink"
                    >
                      + Ajouter
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] text-faint">La première image est l&apos;image principale affichée sur le site public et le catalogue. Les suivantes sont la galerie.</p>
            </Field>

            {/* Compat : affichage brut pour debug */}
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wide text-faint">URLs stockées (compatibilité) :</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {product.images.map((u, i) => (
                  <span key={i} className="rounded-full border border-line bg-night px-2 py-0.5 font-mono text-[10px] text-muted">
                    {u.length > 40 ? u.slice(0, 40) + "…" : u}
                  </span>
                ))}
                {product.images.length === 0 && <span className="text-xs text-faint">Aucune</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Infos produit */}
      <div className="grid gap-4 rounded-2xl border border-line bg-surface/60 p-5 sm:grid-cols-2">
        <Field label="Nom">
          <input className={inputCls} value={product.name} onChange={(e) => set({ name: e.target.value, fullName: product.fullName || e.target.value })} />
        </Field>
        <Field label="Nom complet (SEO)">
          <input className={inputCls} value={product.fullName} onChange={(e) => set({ fullName: e.target.value })} />
        </Field>
        <Field label="Accroche">
          <input className={inputCls} value={product.tagline} onChange={(e) => set({ tagline: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea rows={3} className={`${inputCls} resize-none`} value={product.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label="Catégorie">
          <select className={inputCls} value={product.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Référence">
          <input className={inputCls} value={product.reference} onChange={(e) => set({ reference: e.target.value })} />
        </Field>
        <Field label="Type">
          <select className={inputCls} value={product.kind} onChange={(e) => set({ kind: e.target.value })}>
            <option value="static">Produit standard</option>
            <option value="starmap">Produit personnalisable (configurateur Célestime)</option>
          </select>
        </Field>
        <Field label="TVA (pour mille)">
          <input type="number" className={inputCls} value={product.taxRate} onChange={(e) => set({ taxRate: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Prix promo barré (€ — optionnel)">
          <input
            type="number"
            step="0.1"
            className={inputCls}
            value={product.oldPrice ? product.oldPrice / 100 : ""}
            onChange={(e) => set({ oldPrice: e.target.value ? Number(e.target.value) * 100 : null, onPromo: !!e.target.value })}
            placeholder="ex. 19"
          />
        </Field>
        <Field label="Statut">
          <select className={inputCls} value={product.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="active">Visible (publié)</option>
            <option value="draft">Brouillon</option>
            <option value="archived">Archivé</option>
          </select>
        </Field>
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
          <Field label="SEO — title">
            <input className={inputCls} value={(product.seo as any).title ?? ""} onChange={(e) => set({ seo: { ...(product.seo as any), title: e.target.value } } as Partial<Product>)} />
          </Field>
          <Field label="SEO — description">
            <input className={inputCls} value={(product.seo as any).description ?? ""} onChange={(e) => set({ seo: { ...(product.seo as any), description: e.target.value } } as Partial<Product>)} />
          </Field>
          <label className="mt-6 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={!!(product.seo as any).noindex} onChange={(e) => set({ seo: { ...(product.seo as any), noindex: e.target.checked } } as Partial<Product>)} className="accent-[#c9a86a]" /> noindex
          </label>
        </div>
      </div>

      {/* Configurateur */}
      {isStarmap && product.engine && (
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
          <h3 className="text-xs tracking-[0.2em] text-gold uppercase">Configurateur Célestime associé</h3>
          <p className="mt-1 text-xs text-muted">Le bouton « Personnaliser » de la fiche ouvre le configurateur avec les options ci-dessous.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Formats (séparés par des virgules)">
              <input
                className={inputCls}
                value={(product.engine as any).sizes?.join(", ") ?? ""}
                onChange={(e) =>
                  set({
                    engine: {
                      ...(product.engine as any),
                      sizes: e.target.value
                        .split(",")
                        .map((s) => s.trim().toUpperCase())
                        .filter((s) => ["A4", "A3", "A2", "A1", "A0"].includes(s)),
                    },
                  } as Partial<Product>)
                }
                placeholder="A4, A3, A2"
              />
            </Field>
            <Field label="Formes">
              <input
                className={inputCls}
                value={(product.engine as any).shapes?.join(", ") ?? ""}
                onChange={(e) =>
                  set({
                    engine: {
                      ...(product.engine as any),
                      shapes: e.target.value
                        .split(",")
                        .map((s) => s.trim().toLowerCase())
                        .filter((s) => ["medaillon", "coeur"].includes(s)),
                    },
                  } as Partial<Product>)
                }
                placeholder="medaillon, coeur"
              />
            </Field>
            <Field label="Fonds">
              <input
                className={inputCls}
                value={(product.engine as any).backgrounds?.join(", ") ?? ""}
                onChange={(e) =>
                  set({
                    engine: {
                      ...(product.engine as any),
                      backgrounds: e.target.value
                        .split(",")
                        .map((s) => s.trim().toLowerCase())
                        .filter((s) => ["saphir", "rubis", "emeraude"].includes(s)),
                    },
                  } as Partial<Product>)
                }
                placeholder="saphir, rubis, emeraude"
              />
            </Field>
            <label className="mt-7 flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={!!(product.engine as any).framed}
                onChange={(e) => set({ engine: { ...(product.engine as any), framed: e.target.checked } } as Partial<Product>)}
                className="accent-[#c9a86a]"
              />{" "}
              Option « Avec cadre »
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
              <button onClick={() => set({ variants: product.variants.filter((_, j) => j !== i) })} className="justify-self-end text-danger" aria-label="Supprimer la variante">
                ×
              </button>
            </div>
          ))}
          {product.variants.length === 0 && <p className="text-sm text-faint">Aucune variante — le produit sera vendu au prix de base.</p>}
        </div>
      </div>

      {/* Picker modal */}
      <MediaPicker
        open={pickerOpen !== false}
        multiple={pickerOpen === "gallery"}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        selectedUrls={pickerOpen === "main" ? (mainImage ? [mainImage] : []) : gallery}
        title={pickerOpen === "main" ? "Choisir l'image principale" : "Choisir des images pour la galerie"}
      />
    </div>
  );
}
