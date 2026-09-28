"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface MediaItem {
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

interface MediaPickerProps {
  open: boolean;
  multiple?: boolean;
  onClose: () => void;
  onSelect: (urls: string[]) => void;
  selectedUrls?: string[];
  title?: string;
}

// Même limite que le serveur (src/lib/media.ts) : les fichiers trop gros sont
// refusés côté client avec un message explicite, sans aller-retour réseau.
const MEDIA_MAX_MB = 4;
const ALLOWED_UPLOAD_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "svg", "gif", "avif"];

export default function MediaPicker({
  open,
  multiple = false,
  onClose,
  onSelect,
  selectedUrls = [],
  title = "Choisir une image",
}: MediaPickerProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selection, setSelection] = useState<{ key: string; urls: Set<string> }>(() => ({ key: "closed", urls: new Set(selectedUrls) }));
  const [copied, setCopied] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Miniatures en échec : on affiche « Image indisponible » au lieu de masquer
  // l'image silencieusement.
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedUrlsKey = selectedUrls.join("\u0000");
  const selectionKey = `${open ? "open" : "closed"}:${selectedUrlsKey}`;
  const selected = selection.key === selectionKey ? selection.urls : new Set(selectedUrlsKey ? selectedUrlsKey.split("\u0000") : []);

  const markThumbFailed = useCallback((id: string) => {
    setFailedThumbs((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/admin/media");
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? `Erreur chargement (${r.status})`);
        return;
      }
      setItems(d.items ?? []);
      setStorageReady(d.dbStorageReady ?? false);
    } catch (e: any) {
      setError(`Chargement médiathèque échoué: ${e?.message ?? e}`);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setSelection({ key: selectionKey, urls: new Set(selectedUrlsKey ? selectedUrlsKey.split("\u0000") : []) });
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, load, selectionKey, selectedUrlsKey]);

  // Fermer avec Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const errors: string[] = [];
    const uploadedUrls: string[] = [];

    // Contrôles côté client AVANT l'envoi (format + taille), messages explicites.
    const sendable = Array.from(files).filter((file) => {
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
        errors.push(
          `${file.name} : format .${ext || "?"} non supporté (autorisés : ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")})`
        );
        return false;
      }
      if (file.size > MEDIA_MAX_MB * 1024 * 1024) {
        errors.push(`${file.name} : ${(file.size / 1024 / 1024).toFixed(1)} Mo — ${MEDIA_MAX_MB} Mo max`);
        return false;
      }
      return true;
    });

    try {
      for (const file of sendable) {
        const fd = new FormData();
        fd.append("file", file);
        let res: Response;
        try {
          res = await fetch("/api/admin/media", { method: "POST", body: fd });
        } catch (e: any) {
          errors.push(`${file.name} : erreur réseau (${e?.message ?? e})`);
          continue;
        }
        // La réponse peut ne pas être du JSON (erreur proxy/limite body) :
        // ne jamais la supposer lisible, sinon l'échec passait inaperçu.
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.ok !== true) {
          errors.push(
            data?.error ??
              (res.status === 413
                ? `${file.name} : refusé par le serveur — ${MEDIA_MAX_MB} Mo max`
                : `${file.name} : échec (HTTP ${res.status})`)
          );
          continue;
        }
        const insertedItems = Array.isArray(data.items) ? data.items : [];
        if (insertedItems.length === 0) {
          errors.push(`${file.name} : aucun fichier enregistré côté serveur`);
          continue;
        }
        for (const item of insertedItems) {
          const url = item?.displayUrl ?? item?.url ?? item?.path;
          if (typeof url === "string" && url) uploadedUrls.push(url);
        }
      }
    } finally {
      setUploading(false);
      await load();
      if (uploadedUrls.length) {
        setSelection((previous) => {
          const current = previous.key === selectionKey ? previous.urls : new Set(selectedUrlsKey ? selectedUrlsKey.split("\u0000") : []);
          const next = multiple ? new Set(current) : new Set<string>();
          for (const url of uploadedUrls) {
            next.add(url);
            if (!multiple) break;
          }
          return { key: selectionKey, urls: next };
        });
      }
      if (fileRef.current) fileRef.current.value = "";
      // `load()` réinitialise l'erreur : ré-afficher le bilan après le
      // rechargement, sinon l'échec d'upload disparaissait aussitôt.
      if (errors.length > 0) setError(errors.join("\n"));
    }
  };

  const toggleSelect = (url: string) => {
    setSelection((previous) => {
      const current = previous.key === selectionKey ? previous.urls : new Set(selectedUrlsKey ? selectedUrlsKey.split("\u0000") : []);
      const next = new Set(current);
      if (multiple) {
        if (next.has(url)) next.delete(url);
        else next.add(url);
      } else {
        next.clear();
        next.add(url);
      }
      return { key: selectionKey, urls: next };
    });
  };

  const confirm = () => {
    if (selected.size === 0) return;
    onSelect(Array.from(selected));
    onClose();
  };

  const filtered = items.filter((i) => {
    const hay = `${i.name} ${i.path} ${i.url ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-[#0e1020] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-ink">{title}</h2>
            <p className="mt-0.5 text-xs text-faint">
              {multiple ? "Sélection multiple possible" : "Sélection unique"} · {items.length} image{items.length !== 1 ? "s" : ""} · 4 Mo max ·{" "}
              {storageReady === null ? "Chargement…" : storageReady ? "Stockage PostgreSQL actif" : "Colonne media.data absente — migration requise"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-full bg-gold px-5 py-2 text-xs font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft disabled:opacity-50"
            >
              {uploading ? "Envoi…" : "+ Importer depuis mon ordinateur"}
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-line px-4 py-2 text-xs tracking-wide text-muted uppercase hover:text-ink"
            >
              Fermer
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line/50 bg-night/50 px-5 py-3">
          <input
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64 rounded-lg border border-line bg-night px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-gold"
          />
          <span className="text-xs text-faint">{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</span>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.svg,.gif,.avif,image/*"
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-faint">{selected.size} sélectionnée{selected.size !== 1 ? "s" : ""}</span>
            <button
              onClick={confirm}
              disabled={selected.size === 0}
              className="rounded-full bg-gold px-6 py-2 text-xs font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft disabled:opacity-40"
            >
              Utiliser cette image{selected.size > 1 ? "s" : ""}
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            ❌ {error}
          </div>
        )}
        {storageReady === false && (
          <div className="mx-5 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            ⚠️ Colonne <code>media.data</code> absente : appliquez <code>drizzle/0002_media_db_storage.sql</code> sur la base pour activer l&apos;import.
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-auto p-4">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-14 text-center">
              <p className="text-sm text-faint">
                {items.length === 0 ? "Aucune image. Importez depuis votre ordinateur — stockage en base PostgreSQL." : "Aucun résultat."}
              </p>
              {items.length === 0 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-4 rounded-full border border-line px-5 py-2 text-xs text-muted hover:text-ink"
                >
                  Importer une image
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((m) => {
                const url = m.displayUrl || m.url || m.path;
                const isSelected = selected.has(url);
                return (
                  <div
                    key={m.id}
                    className={`group relative overflow-hidden rounded-xl border bg-surface/60 transition-all ${
                      isSelected ? "border-gold ring-1 ring-gold/40" : "border-line hover:border-gold/30"
                    }`}
                  >
                    <button onClick={() => toggleSelect(url)} className="block w-full text-left">
                      {failedThumbs.has(m.id) ? (
                        <div className="flex aspect-square w-full items-center justify-center p-2 text-center">
                          <span className="text-[11px] uppercase tracking-wide text-faint">Image indisponible</span>
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={url}
                          alt={m.name}
                          className="aspect-square w-full object-cover"
                          loading="lazy"
                          onError={() => markThumbFailed(m.id)}
                        />
                      )}
                      {isSelected && (
                        <div className="absolute right-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold tracking-wide text-night uppercase">
                          ✓ Sélectionnée
                        </div>
                      )}
                      <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] tracking-wide text-white/80 uppercase backdrop-blur">
                        {m.storage === "db" ? "PostgreSQL" : m.storage}
                      </div>
                    </button>
                    <div className="p-2.5">
                      <p className="truncate text-xs font-medium text-ink" title={m.name}>
                        {m.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-faint" title={url}>
                        {m.size ? `${(m.size / 1024).toFixed(0)} Ko` : ""} {m.kind?.toUpperCase()}
                      </p>
                      <div className="mt-1.5 flex gap-1">
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(url).catch(() => {});
                            setCopied(m.id);
                            setTimeout(() => setCopied(null), 1500);
                          }}
                          className="rounded-full border border-line px-2 py-1 text-[10px] uppercase tracking-wide text-muted hover:text-ink"
                        >
                          {copied === m.id ? "Copié !" : "Copier URL"}
                        </button>
                        <button
                          onClick={() => toggleSelect(url)}
                          className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${
                            isSelected ? "bg-gold/20 text-gold" : "border border-line text-muted hover:text-ink"
                          }`}
                        >
                          {isSelected ? "Retirer" : "Choisir"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer compat */}
        <div className="border-t border-line bg-night/30 px-5 py-3 text-[11px] text-faint">
          Compatible avec les images existantes <code className="rounded bg-raised px-1 py-0.5">/images/…</code> ; les nouveaux médias sont servis par{" "}
          <code className="rounded bg-raised px-1 py-0.5">/api/media/&lt;id&gt;</code>. La référence reste dans le contenu qui utilise le média.
        </div>
      </div>
    </div>
  );
}
