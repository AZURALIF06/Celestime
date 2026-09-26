"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface MediaItem {
  id: string; name: string; path: string; size: number; createdAt: string;
}

export default function MediaClient() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [usage, setUsage] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch("/api/admin/media").then((r) => r.json()).then((d) => {
      setItems(d.items ?? []);
      setUsage(d.usage ?? {});
    });
  }, []);
  useEffect(load, [load]);

  const upload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      await fetch("/api/admin/media", { method: "POST", body: fd });
    }
    setUploading(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette image de la médiathèque ?")) return;
    await fetch("/api/admin/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    load();
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input placeholder="Rechercher une image…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64 rounded-lg border border-line bg-night px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-gold" />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft disabled:opacity-50">
          {uploading ? "Envoi…" : "+ Importer"}
        </button>
        <input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.svg,.gif,.avif" className="hidden" onChange={(e) => upload(e.target.files)} />
        <p className="text-xs text-faint">JPG · PNG · WEBP · SVG · GIF · AVIF — 8 Mo max</p>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-14 text-center text-sm text-faint">
          {items.length === 0 ? "Aucune image importée. Les images des produits restent dans /images." : "Aucun résultat."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {filtered.map((m) => (
            <div key={m.id} className="group overflow-hidden rounded-xl border border-line bg-surface/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.path} alt={m.name} className="aspect-square w-full object-cover" />
              <div className="p-2.5">
                <input
                  className="w-full bg-transparent text-xs text-ink focus:border-b focus:border-gold"
                  defaultValue={m.name}
                  onBlur={(e) => e.target.value !== m.name && fetch("/api/admin/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rename", id: m.id, name: e.target.value }) }).then(() => load())}
                  aria-label="Renommer"
                />
                <p className="mt-0.5 truncate font-mono text-[10px] text-faint">{m.path}</p>
                {usage[m.path] && usage[m.path].length > 0 && (
                  <p className="mt-1 text-[10px] leading-tight text-goldsoft">Utilisée : {usage[m.path].join(", ")}</p>
                )}
                <button onClick={() => del(m.id)} className="mt-1.5 text-[11px] uppercase tracking-wide text-danger opacity-0 transition-opacity group-hover:opacity-100">
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
