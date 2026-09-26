"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { inputCls, Field } from "@/components/admin/admin-ui";

interface Post {
  id: string; slug: string; title: string; excerpt: string; body: string; cover: string | null;
  status: string; author: string; tags: string[]; seo: Record<string, any>; updatedAt?: string;
}

export default function BlogClient() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/blog").then((r) => r.json()).then((d) => setPosts(d.posts ?? []));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!editing) return;
    const d = await fetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: isNew ? "create" : "update", ...editing }) }).then((r) => r.json());
    if (d.ok || d.id) {
      setEditing(null);
      load();
    } else alert(d.error ?? "Erreur");
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cet article ?")) return;
    await fetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    load();
  };

  if (editing) {
    const set = (patch: Partial<Post>) => setEditing({ ...editing, ...patch });
    return (
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">{isNew ? "Nouvel article" : editing.title}</h2>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="rounded-full border border-line px-5 py-2 text-sm text-muted hover:text-ink">Annuler</button>
            <button onClick={save} className="rounded-full bg-gold px-6 py-2 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">Enregistrer</button>
          </div>
        </div>
        <Field label="Titre"><input className={inputCls} value={editing.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Auteur"><input className={inputCls} value={editing.author} onChange={(e) => set({ author: e.target.value })} /></Field>
          <Field label="Image principale (chemin)"><input className={inputCls} value={editing.cover ?? ""} onChange={(e) => set({ cover: e.target.value || null })} placeholder="/media/… ou /images/…" /></Field>
          <Field label="Tags (séparés par des virgules)"><input className={inputCls} value={editing.tags.join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></Field>
          <Field label="Statut">
            <select className={inputCls} value={editing.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="draft">Brouillon</option>
              <option value="published">Publier maintenant</option>
              <option value="scheduled">Programmer</option>
            </select>
          </Field>
        </div>
        <Field label="Extrait"><textarea rows={2} className={`${inputCls} resize-none`} value={editing.excerpt} onChange={(e) => set({ excerpt: e.target.value })} /></Field>
        <Field label="Contenu (paragraphes séparés par une ligne vide)"><textarea rows={14} className={`${inputCls} font-mono text-xs leading-relaxed`} value={editing.body} onChange={(e) => set({ body: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SEO — title"><input className={inputCls} value={(editing.seo as any).title ?? ""} onChange={(e) => set({ seo: { ...(editing.seo as any), title: e.target.value } } as Partial<Post>)} /></Field>
          <Field label="SEO — meta description"><input className={inputCls} value={(editing.seo as any).description ?? ""} onChange={(e) => set({ seo: { ...(editing.seo as any), description: e.target.value } } as Partial<Post>)} /></Field>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => {
          setIsNew(true);
          setEditing({ id: "", slug: "", title: "", excerpt: "", body: "", cover: null, status: "draft", author: "Célestime", tags: [], seo: {} });
        }}
        className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft"
      >
        + Nouvel article
      </button>
      {posts === null ? (
        <p className="py-16 text-center text-sm text-faint">Chargement…</p>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-14 text-center text-sm text-faint">Aucun article. Le blog public (/blog) est prêt.</div>
      ) : (
        <ul className="divide-y divide-line/50 rounded-2xl border border-line">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{p.title}</p>
                <p className="text-xs text-faint">/blog/{p.slug} · {p.author} · {p.tags.join(", ")}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wide ${p.status === "published" ? "bg-gold/15 text-gold" : "bg-raised text-faint"}`}>{p.status}</span>
              <Link href={`/blog/${p.slug}`} target="_blank" className="rounded-full border border-line px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted hover:text-ink">Voir</Link>
              <button onClick={() => { setIsNew(false); setEditing(p); }} className="rounded-full bg-gold px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-night hover:bg-goldsoft">Modifier</button>
              <button onClick={() => del(p.id)} className="rounded-full border border-line px-3 py-1.5 text-[11px] uppercase tracking-wide text-danger hover:border-danger">Suppr.</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
