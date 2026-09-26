"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PageRow {
  id: string; slug: string; name: string; status: string; updatedAt: string;
}
interface Template {
  id: number; name: string; description: string;
}

export default function PagesClient() {
  const router = useRouter();
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [fromTemplate, setFromTemplate] = useState<number | "">("");

  const load = useCallback(() => {
    fetch("/api/admin/pages").then((r) => r.json()).then((d) => {
      setPages(d.pages ?? []);
      setTemplates(d.templates ?? []);
    });
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    if (!name.trim()) return;
    const d = await fetch("/api/admin/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name, slug, templateId: fromTemplate || undefined }),
    }).then((r) => r.json());
    if (d.id) router.push(`/admin/editor/${d.id}`);
    else alert(d.error ?? "Erreur");
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette page définitivement ?")) return;
    await fetch("/api/admin/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface/60 p-4">
        <div className="min-w-44 flex-1">
          <label className="mb-1 block text-[11px] tracking-wide text-faint uppercase">Nouvelle page — nom</label>
          <input value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")); }} placeholder="Saint-Valentin" className="w-full rounded-lg border border-line bg-night px-3 py-2.5 text-sm text-ink focus:border-gold" />
        </div>
        <div className="min-w-40">
          <label className="mb-1 block text-[11px] tracking-wide text-faint uppercase">URL (/p/…)</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="saint-valentin" className="w-full rounded-lg border border-line bg-night px-3 py-2.5 text-sm text-ink focus:border-gold" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] tracking-wide text-faint uppercase">Modèle (optionnel)</label>
          <select value={fromTemplate} onChange={(e) => setFromTemplate(e.target.value ? Number(e.target.value) : "")} className="w-full rounded-lg border border-line bg-night px-3 py-2.5 text-sm text-ink focus:border-gold">
            <option value="">Page vierge</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <button onClick={create} disabled={!name.trim() || creating} className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft disabled:opacity-50">
          Créer
        </button>
      </div>

      {pages === null ? (
        <p className="py-16 text-center text-sm text-faint">Chargement…</p>
      ) : pages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-14 text-center">
          <p className="text-sm text-muted">Aucune page créée.</p>
          <p className="mt-2 text-xs text-faint">Créez une page (ex. « Saint-Valentin ») puis composez-la à l'éditeur visuel — sans code.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-[0.16em] text-faint uppercase">
                <th className="px-4 py-3">Page</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Modifiée</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id} className="border-b border-line/50 last:border-0 hover:bg-raised/40">
                  <td className="px-4 py-3 text-ink">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">/p/{p.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wide ${p.status === "published" ? "bg-gold/15 text-gold" : "bg-raised text-faint"}`}>
                      {p.status === "published" ? "Publiée" : p.status === "archived" ? "Archivée" : "Brouillon"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{new Date(p.updatedAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/editor/${p.id}`} className="rounded-full bg-gold px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-night uppercase hover:bg-goldsoft">Éditer</Link>
                      <button
                        onClick={async () => {
                          const d = await fetch("/api/admin/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "duplicate", id: p.id }) }).then((r) => r.json());
                          if (d.id) router.push(`/admin/editor/${d.id}`);
                          else load();
                        }}
                        className="rounded-full border border-line px-3.5 py-1.5 text-[11px] tracking-wide text-muted uppercase hover:text-ink"
                      >
                        Dupliquer
                      </button>
                      <button onClick={() => del(p.id)} className="rounded-full border border-line px-3.5 py-1.5 text-[11px] tracking-wide text-danger uppercase hover:border-danger">
                        Suppr.
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
