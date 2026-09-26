"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface MediaItem {
  id: string;
  name: string;
  path: string;
  url?: string | null;
  displayUrl: string;
  size: number;
  kind: string;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  storage: string;
  createdAt: string;
}

interface Diagnostics {
  storage: string;
  hasDataColumn: boolean;
  dbOk: boolean;
  dbError: string | null;
  mediaCount: number;
  pendingMigration: string | null;
}

export default function MediaClient() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [usage, setUsage] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState<boolean | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/admin/media");
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? `Erreur chargement médiathèque (${r.status})`);
        return;
      }
      setItems(d.items ?? []);
      setUsage(d.usage ?? {});
      setStorageReady(d.dbStorageReady ?? false);
      setDiagnostics(d.diagnostics ?? null);
    } catch (e: any) {
      setError(`Impossible de charger la médiathèque: ${e?.message ?? e}`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    let okCount = 0;
    let lastError: string | null = null;

    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/media", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          lastError = data.error ?? `Échec upload ${file.name} (${res.status})`;
          setError(lastError);
        } else {
          okCount++;
          if (data.items?.[0]?.displayUrl) {
            setSuccess(`Upload réussi: ${file.name} → ${data.items[0].displayUrl.slice(0, 60)}...`);
          }
        }
      }
      if (okCount > 0) {
        setSuccess(`${okCount} image${okCount > 1 ? "s" : ""} uploadée${okCount > 1 ? "s" : ""} avec succès${lastError ? ` — mais ${lastError}` : ""}`);
      }
    } catch (e: any) {
      setError(`Erreur réseau upload: ${e?.message ?? e}`);
    } finally {
      setUploading(false);
      await load();
      if (fileRef.current) fileRef.current.value = "";
      // auto-clear success after 4s
      if (okCount > 0) setTimeout(() => setSuccess(null), 4000);
    }
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Supprimer "${name}" de la médiathèque ?\nCette action est définitive et supprimera l'image stockée en base.`)) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Suppression échouée");
      } else {
        setSuccess(`"${name}" supprimée`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e: any) {
      setError(`Erreur suppression: ${e?.message ?? e}`);
    }
    load();
  };

  const rename = async (id: string, oldName: string, newName: string) => {
    if (!newName.trim() || newName.trim() === oldName) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", id, name: newName.trim().slice(0, 200) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? "Renommage échoué");
      else setSuccess(`Renommé en "${newName}"`);
    } catch (e: any) {
      setError(`Erreur renommage: ${e?.message ?? e}`);
    }
    load();
  };

  const copyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      prompt("Copiez l'URL :", url);
    }
  };

  const filtered = items.filter((i) => {
    const hay = `${i.name} ${i.path} ${i.url ?? ""} ${i.kind}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Diagnostics / Status */}
      <div className="rounded-2xl border border-line bg-surface/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xs tracking-[0.2em] text-gold uppercase">Statut stockage</h3>
          {storageReady === null ? (
            <span className="rounded-full bg-raised px-3 py-1 text-[11px] uppercase tracking-wide text-faint">Chargement…</span>
          ) : storageReady ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-300">● PostgreSQL actif — images stockées en base</span>
          ) : (
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-[11px] uppercase tracking-wide text-red-300">● Colonne media.data absente — migration requise</span>
          )}
          {diagnostics && (
            <span className="text-[11px] text-faint">
              Stockage {diagnostics.storage} · {diagnostics.mediaCount} image{diagnostics.mediaCount !== 1 ? "s" : ""} · colonne data : {diagnostics.hasDataColumn ? "OK" : "MANQUANTE"}
            </span>
          )}
          <button onClick={load} className="ml-auto rounded-full border border-line px-3 py-1 text-[11px] uppercase tracking-wide text-muted hover:text-ink">
            Rafraîchir
          </button>
        </div>

        {storageReady === false && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
            <p className="font-medium">⚠️ Migration base de données requise</p>
            <p className="mt-1">
              La colonne <code>media.data</code> (bytea) est absente : l&apos;upload est bloqué tant qu&apos;elle n&apos;est pas créée.
              Aucune donnée existante n&apos;est modifiée, les images <code>/images/…</code> restent servies normalement.
              <br />
              <strong>Action requise :</strong> appliquer{" "}
              <code>{diagnostics?.pendingMigration ?? "drizzle/0002_media_db_storage.sql"}</code> sur la base :
              <code className="mt-1 block rounded bg-black/30 p-2 font-mono text-[11px]">
                psql $DATABASE_URL -f {diagnostics?.pendingMigration ?? "drizzle/0002_media_db_storage.sql"}
              </code>
            </p>
            {diagnostics?.dbError && (
              <p className="mt-2 font-mono text-[11px] text-amber-300/80">DB erreur: {diagnostics.dbError}</p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            <p className="font-medium">❌ Erreur</p>
            <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px]">{error}</p>
          </div>
        )}
        {success && (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <p>✅ {success}</p>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4">
        <input
          placeholder="Rechercher une image…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64 rounded-lg border border-line bg-night px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-gold"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft disabled:opacity-50"
        >
          {uploading ? "Envoi en cours…" : "+ Ajouter une image"}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.svg,.gif,.avif,image/*"
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        <p className="text-xs text-faint">JPG · PNG · WEBP · SVG · GIF · AVIF — 8 Mo max · Plusieurs fichiers · Stockage en base PostgreSQL</p>
      </div>

      {/* Drag & drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-2 transition-colors ${dragOver ? "border-gold bg-gold/5" : "border-line/50"}`}
      >
        {filtered.length === 0 ? (
          <div className="rounded-xl bg-night/30 p-14 text-center">
            <p className="text-sm text-faint">
              {items.length === 0
                ? storageReady === false
                  ? "Aucune image et colonne media.data absente — appliquez la migration pour activer l'upload."
                  : "Aucune image importée. Glissez-déposez vos images ici ou cliquez sur Ajouter. Les octets sont stockés en base PostgreSQL."
                : "Aucun résultat pour cette recherche."}
            </p>
            {items.length === 0 && (
              <div className="mt-4 text-xs text-muted">
                Compatible avec les images existantes <code>/images/…</code> — les nouvelles images sont servies par <code>/api/media/&lt;id&gt;</code>.
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {filtered.map((m) => {
              const display = m.displayUrl || m.url || m.path;
              const isDb = m.storage === "db";
              const usageList = usage[display] ?? usage[m.path] ?? usage[m.url ?? ""] ?? [];
              return (
                <div key={m.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface/60 transition-colors hover:border-gold/30">
                  {/* Thumbnail */}
                  <div className="relative aspect-square w-full overflow-hidden bg-night">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={display}
                      alt={m.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/images/naissance.jpg";
                      }}
                    />
                    <div className="absolute left-2 top-2 flex gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] tracking-wide uppercase backdrop-blur ${isDb ? "bg-gold/90 text-night" : "bg-black/60 text-white/80"}`}>
                        {isDb ? "PostgreSQL" : m.storage}
                      </span>
                    </div>
                    {usageList.length > 0 && (
                      <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] text-goldsoft backdrop-blur">
                        {usageList.length} usage{usageList.length > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex flex-1 flex-col p-2.5">
                    <input
                      className="w-full truncate bg-transparent text-xs font-medium text-ink focus:border-b focus:border-gold focus:outline-none"
                      defaultValue={m.name}
                      onBlur={(e) => {
                        if (e.target.value !== m.name) rename(m.id, m.name, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      aria-label="Renommer"
                    />
                    <p className="mt-0.5 truncate font-mono text-[10px] text-faint" title={display}>
                      {display}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {m.size ? `${(m.size / 1024).toFixed(0)} Ko` : ""}
                      {m.width && m.height ? ` · ${m.width}×${m.height}` : ""} · {m.kind?.toUpperCase()} ·{" "}
                      {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                    {usageList.length > 0 && (
                      <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-goldsoft" title={usageList.join(", ")}>
                        Utilisée : {usageList.slice(0, 3).join(", ")}
                        {usageList.length > 3 ? ` +${usageList.length - 3}` : ""}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        onClick={() => copyUrl(display, m.id)}
                        className="rounded-full border border-line px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted hover:border-gold hover:text-ink"
                      >
                        {copied === m.id ? "Copié !" : "Copier URL"}
                      </button>
                      <button
                        onClick={() => del(m.id, m.name)}
                        className="rounded-full border border-line px-2.5 py-1 text-[10px] uppercase tracking-wide text-danger opacity-60 transition-opacity hover:border-danger hover:opacity-100 group-hover:opacity-100"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Help */}
      <div className="rounded-xl border border-line/50 bg-night/20 p-4 text-xs leading-relaxed text-muted">
        <p className="font-medium text-ink">Comment ça marche :</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Upload depuis n&apos;importe quel ordinateur → les octets sont écrits dans la colonne <code className="rounded bg-raised px-1">media.data</code> (bytea) de la base PostgreSQL.</li>
          <li>Aucun stockage externe à provisionner : pas de token, pas de Blob Store, et rien n&apos;est écrit sur le disque du serveur.</li>
          <li>Anciennes images <code className="rounded bg-raised px-1">/images/…</code> et <code className="rounded bg-raised px-1">/media/…</code> restent compatibles.</li>
          <li>Nouvelles images : URL <code className="rounded bg-raised px-1">/api/media/&lt;id&gt;</code> copiable et réutilisable dans Produits, Pages, Blog.</li>
          <li>Suppression : supprime la ligne, donc l&apos;image et ses octets.</li>
          <li>Recherche par nom, extension, URL.</li>
        </ul>
      </div>
    </div>
  );
}
