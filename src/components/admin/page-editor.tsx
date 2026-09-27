"use client";

// Célestime — Éditeur visuel de page (esprit Wix).
// Positionnement libre, redimensionnement à la souris, calques (z), duplication,
// copier/coller, annuler/rétablir, verrouillage, masquage, édition de texte
// inline, responsive par appareil, brouillon / publication, historique.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LIBRARY,
  MIN_SIZE,
  PAGE_WIDTH,
  emptyPage,
  makeElement,
  newId,
  type CmsElement,
  type CmsPage,
  type CmsSection,
} from "@/lib/cms";
import MediaPicker from "@/components/admin/media-picker";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, number> = { desktop: PAGE_WIDTH, tablet: 768, mobile: 390 };

interface Sel {
  sectionId: string;
  elId: string;
}

export default function PageEditor({
  pageId,
  initialData,
  initialName,
  initialSlug,
  initialStatus,
  initialPublished,
  templates,
}: {
  pageId: string;
  initialData: CmsPage;
  initialName: string;
  initialSlug: string;
  initialStatus: string;
  initialPublished?: CmsPage | null;
  templates: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [page, setPage] = useState<CmsPage>(initialData);
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [status, setStatus] = useState(initialStatus);
  const [publishedSnapshot, setPublishedSnapshot] = useState<string | null>(initialPublished ? JSON.stringify(initialPublished) : null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([JSON.stringify(initialData)]);
  const [histIdx, setHistIdx] = useState(0);
  const [clipboard, setClipboard] = useState<CmsElement[] | null>(null);
  const [versions, setVersions] = useState<{ id: number; label: string; createdAt: string }[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [editingText, setEditingText] = useState<string | null>(null);
  const dragRef = useRef<{ mode: "move" | "resize"; dir?: string; start: { x: number; y: number }; el: CmsElement; section: CmsSection } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const pushHistory = useCallback(
    (data: CmsPage) => {
      setHistory((h) => {
        const next = [...h.slice(0, histIdx + 1), JSON.stringify(data)].slice(-50);
        setHistIdx(next.length - 1);
        return next;
      });
    },
    [histIdx]
  );

  const update = useCallback(
    (fn: (p: CmsPage) => CmsPage) => {
      setPage((p) => {
        const next = fn(p);
        pushHistory(next);
        return next;
      });
      setDirty(true);
      scheduleSave();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pushHistory]
  );

  const api = (body: Record<string, unknown>) =>
    fetch("/api/admin/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pageId, ...body }) }).then((r) => r.json());

  const doSave = useCallback(
    async (extra: Record<string, unknown> = {}): Promise<boolean> => {
      setSaving(true);
      try {
        const result = await api({ action: "update", name, slug, data: page, ...extra });
        if (result.error) throw new Error(result.error);
        setDirty(false);
        const v = await fetch(`/api/admin/pages?id=${pageId}&full=1`).then((r) => r.json()).catch(() => null);
        if (v) setStatus(v.status ?? status);
        return true;
      } catch {
        show("Échec de l'enregistrement.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [api, name, page, pageId, show, status]
  );

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 1800);
  }, [doSave]);

  useEffect(() => {
    const loadVersions = () => api({ action: "versions" }).then((d) => setVersions(d.versions ?? [])).catch(() => {});
    loadVersions();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Historique ---
  const undo = () => {
    if (histIdx <= 0) return;
    const data = JSON.parse(history[histIdx - 1]) as CmsPage;
    setHistIdx(histIdx - 1);
    setPage(data);
    setDirty(true);
    scheduleSave();
  };
  const redo = () => {
    if (histIdx >= history.length - 1) return;
    const data = JSON.parse(history[histIdx + 1]) as CmsPage;
    setHistIdx(histIdx + 1);
    setPage(data);
    setDirty(true);
    scheduleSave();
  };

  // --- Sections ---
  const addSection = () =>
    update((p) => ({
      sections: [...p.sections, { id: newId(), h: 480, bg: "linear-gradient(180deg,#06070c 0%,#0c0e16 100%)", elements: [] }],
    }));
  const sectionProp = (id: string, patch: Partial<CmsSection>) =>
    update((p) => ({ sections: p.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const removeSection = (id: string) => {
    if (!confirm("Supprimer cette section et tous ses éléments ?")) return;
    update((p) => ({ sections: p.sections.filter((s) => s.id !== id) }));
  };
  const duplicateSection = (id: string) =>
    update((p) => {
      const i = p.sections.findIndex((s) => s.id === id);
      const src = p.sections[i];
      const copy: CmsSection = JSON.parse(JSON.stringify(src));
      copy.id = newId();
      copy.elements = copy.elements.map((e) => ({ ...e, id: newId() }));
      const next = [...p.sections];
      next.splice(i + 1, 0, copy);
      return { sections: next };
    });
  const moveSection = (id: string, dir: -1 | 1) =>
    update((p) => {
      const i = p.sections.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= p.sections.length) return p;
      const next = [...p.sections];
      [next[i], next[j]] = [next[j], next[i]];
      return { sections: next };
    });

  // --- Éléments ---
  const selSection = sel ? page.sections.find((s) => s.id === sel.sectionId) : null;
  const selEl = sel && selSection ? selSection.elements.find((e) => e.id === sel.elId) : null;

  const addElement = (type: string, sectionId?: string, x?: number, y?: number) => {
    if (initialSlug === "boutique" && (type === "product" || type === "productGrid")) return;
    const item = LIBRARY.find((l) => l.type === type && l.label.length > 0) ?? LIBRARY.find((l) => l.type === type)!;
    const item2 = LIBRARY.find((l) => l.label === item.label && l.type === type) ?? item;
    void item2;
    const targetSectionId = sectionId ?? page.sections[page.sections.length - 1]?.id;
    if (!targetSectionId) return;
    const el = makeElement(item, x, y, (selSection?.elements.length ?? 0) + 1);
    update((p) => ({
      sections: p.sections.map((s) => (s.id === targetSectionId ? { ...s, elements: [...s.elements, el] } : s)),
    }));
    setSel({ sectionId: targetSectionId, elId: el.id });
  };

  const setEl = (sectionId: string, elId: string, patch: Partial<CmsElement>) =>
    update((p) => ({
      sections: p.sections.map((s) =>
        s.id === sectionId ? { ...s, elements: s.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e)) } : s
      ),
    }));

  const removeEl = (sectionId: string, elId: string) => {
    if (!confirm("Supprimer cet élément ? (Ctrl+Z pour annuler)")) return;
    update((p) => ({ sections: p.sections.map((s) => (s.id === sectionId ? { ...s, elements: s.elements.filter((e) => e.id !== elId) } : s)) }));
    setSel(null);
  };

  const duplicateEl = (sectionId: string, elId: string) =>
    update((p) => ({
      sections: p.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const src = s.elements.find((e) => e.id === elId)!;
        const copy = { ...JSON.parse(JSON.stringify(src)) as CmsElement, id: newId(), x: src.x + 24, y: src.y + 24, z: (src.z || 0) + 1 };
        return { ...s, elements: [...s.elements, copy] };
      }),
    }));

  const copyEl = () => {
    if (!selEl || !sel) return;
    setClipboard(JSON.parse(JSON.stringify([selEl])));
    show("Élément copié.");
  };
  const pasteEl = () => {
    if (!clipboard) return;
    const targetId = sel?.sectionId ?? page.sections[page.sections.length - 1]?.id;
    if (!targetId) return;
    const copies = clipboard.map((e) => ({ ...e, id: newId(), x: e.x + 24, y: e.y + 24 }));
    update((p) => ({ sections: p.sections.map((s) => (s.id === targetId ? { ...s, elements: [...s.elements, ...copies] } : s)) }));
    setSel({ sectionId: targetId, elId: copies[0]?.id });
  };
  const zEl = (sectionId: string, elId: string, dir: 1 | -1) =>
    update((p) => ({
      sections: p.sections.map((s) => (s.id === sectionId ? { ...s, elements: s.elements.map((e) => (e.id === elId ? { ...e, z: (e.z || 1) + dir } : e)) } : s)),
    }));

  // --- Interactions souris (déplacement / redimensionnement) ---
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.start.x;
      const dy = e.clientY - d.start.y;
      let { x, y, w, h } = d.el;
      if (d.mode === "move") {
        x = Math.min(PAGE_WIDTH - 40, Math.max(-40, d.el.x + dx));
        y = Math.min(d.section.h + 200, Math.max(-40, d.el.y + dy));
      } else if (d.dir) {
        if (d.dir.includes("e")) w = Math.max(MIN_SIZE, d.el.w + dx);
        if (d.dir.includes("s")) h = Math.max(MIN_SIZE, d.el.h + dy);
        if (d.dir.includes("w")) {
          w = Math.max(MIN_SIZE, d.el.w - dx);
          x = Math.min(PAGE_WIDTH - 40, d.el.x + dx);
        }
        if (d.dir.includes("n")) {
          h = Math.max(MIN_SIZE, d.el.h - dy);
          y = Math.min(d.section.h + 200, d.el.y + dy);
        }
      }
      setSelSafe(d);
      // Applique sans polluer l'historique à chaque frame :
      setPage((p) => ({
        sections: p.sections.map((s) =>
          s.id === d.section.id ? { ...s, elements: s.elements.map((e) => (e.id === d.el.id ? { ...e, x, y, w, h } : e)) } : s
        ),
      }));
    };
    const up = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      // snapshot d'historique à la fin du drag
      setHistory((hh) => {
        const next = [...hh.slice(0, histIdxRef.current + 1), JSON.stringify(pageRef.current)].slice(-50);
        setHistIdx(next.length - 1);
        return next;
      });
      setDirty(true);
      scheduleSave();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageRef = useRef(page);
  const histIdxRef = useRef(histIdx);
  const selRef = useRef<Sel | null>(null);
  pageRef.current = page;
  histIdxRef.current = histIdx;
  selRef.current = sel;

  const setSelSafe = (d: NonNullable<typeof dragRef.current>) => {
    const s = selRef.current;
    setSel(s && s.elId === d.el.id ? s : { sectionId: d.section.id, elId: d.el.id });
  };

  // --- Raccourcis clavier ---
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault();
        removeEl(sel.sectionId, sel.elId);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (sel) duplicateEl(sel.sectionId, sel.elId);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") copyEl();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") pasteEl();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, page, clipboard]);

  const startDrag = (e: React.MouseEvent, s: CmsSection, el: CmsElement, mode: "move" | "resize", dir?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (el.locked && mode === "move") return;
    setSel({ sectionId: s.id, elId: el.id });
    setEditingText(null);
    dragRef.current = { mode, dir, start: { x: e.clientX, y: e.clientY }, el: { ...el }, section: s };
  };

  const publish = async (pub: boolean) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    try {
      const d = await api({ action: "update", name, slug, data: page, publish: pub, saveVersion: pub ? "Publication" : undefined });
      if (d.error || d.ok === false) throw new Error(d.error ?? "Publication impossible.");
      setStatus(pub ? "published" : "draft");
      setDirty(false);
      if (pub) setPublishedSnapshot(JSON.stringify(page));
      show(pub ? "Page publiée ✓" : "Retirée de la publication.");
      await loadVersionsNow();
    } catch {
      show("Échec de la publication.");
    } finally {
      setSaving(false);
    }
  };
  const loadVersionsNow = () => api({ action: "versions" }).then((d) => setVersions(d.versions ?? [])).catch(() => {});
  const previewDraft = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (await doSave()) router.push(`/admin/editeur/apercu/${pageId}`);
  };

  const hasUnpublishedChanges = status === "published" && publishedSnapshot !== JSON.stringify(page);
  const vpw = DEVICE_WIDTH[device];
  const editorLibrary = initialSlug === "boutique" ? LIBRARY.filter((item) => item.type !== "product" && item.type !== "productGrid") : LIBRARY;

  return (
    <div className="flex h-screen flex-col bg-night text-ink">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <Link href="/admin/pages" className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">← Pages</Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-44 rounded-lg border border-line bg-night px-3 py-1.5 text-sm focus:border-gold"
          aria-label="Nom de la page"
        />
        <label className="flex items-center gap-1 text-xs text-faint">
          {initialSlug === "faq" || initialSlug === "boutique" ? "/" : "/p/"}
          <input
            value={slug}
            readOnly={initialSlug === "faq" || initialSlug === "boutique"}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            className="w-36 rounded-lg border border-line bg-night px-3 py-1.5 text-xs focus:border-gold read-only:opacity-70"
            aria-label="URL de la page"
          />
        </label>
        <div className="ml-1 flex rounded-full border border-line p-0.5">
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button key={d} onClick={() => setDevice(d)} className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${device === d ? "bg-gold text-night" : "text-muted"}`}>
              {d === "desktop" ? "Desktop" : d === "tablet" ? "Tablette" : "Mobile"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <ToolBtn onClick={undo} disabled={histIdx <= 0} title="Annuler (Ctrl+Z)">↶</ToolBtn>
          <ToolBtn onClick={redo} disabled={histIdx >= history.length - 1} title="Rétablir (Ctrl+Maj+Z)">↷</ToolBtn>
          <ToolBtn onClick={() => sel && duplicateEl(sel.sectionId, sel.elId)} disabled={!sel} title="Dupliquer (Ctrl+D)">⧉</ToolBtn>
          <ToolBtn onClick={copyEl} disabled={!sel} title="Copier (Ctrl+C)">⎘</ToolBtn>
          <ToolBtn onClick={pasteEl} disabled={!clipboard} title="Coller (Ctrl+V)">📋</ToolBtn>
          <ToolBtn onClick={() => sel && zEl(sel.sectionId, sel.elId, 1)} disabled={!sel} title="Apporter devant">▲</ToolBtn>
          <ToolBtn onClick={() => sel && zEl(sel.sectionId, sel.elId, -1)} disabled={!sel} title="Passer derrière">▼</ToolBtn>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowVersions((v) => !v)} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">
            Historique ({versions.length})
          </button>
          {toast && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs text-goldsoft">{toast}</span>}
          <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${status === "published" ? "bg-gold/15 text-gold" : "bg-raised text-faint"}`}>
            {status === "published" ? "Publiée" : "Brouillon"}{dirty ? " •" : ""}
          </span>
          <Link href={slug === "faq" || slug === "boutique" ? `/${slug}` : `/p/${slug}`} target="_blank" className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">
            Voir le site
          </Link>
          <button onClick={previewDraft} disabled={saving} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-50">
            Aperçu du brouillon
          </button>
          <button onClick={() => doSave()} disabled={saving} className="rounded-full border border-gold px-4 py-1.5 text-xs text-gold hover:bg-gold/10">
            {saving ? "…" : "Enregistrer"}
          </button>
          <button
            onClick={() => publish(status !== "published" || hasUnpublishedChanges)}
            disabled={saving}
            className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wide ${status === "published" && !hasUnpublishedChanges ? "border border-line text-muted hover:text-ink" : "bg-gold text-night hover:bg-goldsoft"}`}
          >
            {status === "published" ? hasUnpublishedChanges ? "Publier les modifications" : "Dépublier" : "Publier"}
          </button>
        </div>
      </div>

      {showVersions && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
          <span className="text-xs text-muted">Versions :</span>
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={async () => {
                const d = await api({ action: "restore", versionId: v.id });
                if (d.ok && d.data) {
                  setPage(d.data as CmsPage);
                  pushHistory(d.data as CmsPage);
                  setDirty(true);
                  show("Version restaurée dans le brouillon.");
                }
              }}
              className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-gold hover:text-ink"
            >
              {v.label} · {new Date(v.createdAt).toLocaleString("fr-FR")}
            </button>
          ))}
          <button
            onClick={async () => {
              await api({ action: "update", name, slug, data: page, saveVersion: `Version du ${new Date().toLocaleString("fr-FR")}` });
              await loadVersionsNow();
              show("Version enregistrée.");
            }}
            className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-night"
          >
            + Sauver une version
          </button>
          <button onClick={async () => { await api({ action: "saveTemplate", name, description: `Modèle « ${name} »` }); show("Modèle enregistré."); }} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink">
            Sauver comme modèle
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Bibliothèque */}
        <aside className="w-52 shrink-0 overflow-y-auto border-r border-line bg-surface/60 p-3">
          <p className="mb-2 text-[10px] tracking-[0.2em] text-faint uppercase">Bibliothèque</p>
          {Object.entries(editorLibrary.reduce<Record<string, typeof LIBRARY>>((acc, l) => ((acc[l.category] ??= []).push(l), acc), {})).map(([cat, items]) => (
            <div key={cat} className="mb-3">
              <p className="mb-1.5 text-[10px] tracking-[0.16em] text-gold uppercase">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((l, i) => (
                  <button
                    key={cat + l.label + i}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/cl-element", l.type)}
                    onClick={() => addElement(l.type)}
                    className="rounded-lg border border-line bg-night px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:border-gold hover:text-ink"
                    title="Cliquer pour ajouter, ou glisser dans une section"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={addSection} className="mt-2 w-full rounded-lg border border-dashed border-line py-2 text-xs text-muted hover:border-gold hover:text-ink">
            + Ajouter une section
          </button>
        </aside>

        {/* Canvas */}
        <div className="min-w-0 flex-1 overflow-auto bg-night/60 p-4">
          <div className="mx-auto" style={{ width: Math.min(vpw, PAGE_WIDTH) }}>
            {page.sections.map((s, si) => (
              <div key={s.id} className="group/sec relative mb-3">
                <div className="absolute -top-7 left-0 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover/sec:opacity-100">
                  <span className="rounded bg-raised px-2 py-0.5 text-[10px] text-faint">{initialSlug === "boutique" ? si === 0 ? "Éditorial avant les produits" : `Éditorial après les produits · ${si}` : `Section ${si + 1}`}</span>
                  <button onClick={() => moveSection(s.id, -1)} className="rounded bg-raised px-1.5 text-[11px] text-muted hover:text-ink" title="Monter">↑</button>
                  <button onClick={() => moveSection(s.id, 1)} className="rounded bg-raised px-1.5 text-[11px] text-muted hover:text-ink" title="Descendre">↓</button>
                  <button onClick={() => duplicateSection(s.id)} className="rounded bg-raised px-1.5 text-[11px] text-muted hover:text-ink" title="Dupliquer">⧉</button>
                  <button onClick={() => removeSection(s.id)} className="rounded bg-raised px-1.5 text-[11px] text-danger" title="Supprimer">×</button>
                </div>
                <div
                  className="relative overflow-hidden rounded-lg border border-line"
                  style={{ width: "100%", minHeight: s.h * (vpw / PAGE_WIDTH), background: s.bg }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const t = e.dataTransfer.getData("text/cl-element");
                    if (t) {
                      e.preventDefault();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const x = Math.round(((e.clientX - rect.left) / rect.width) * PAGE_WIDTH - 60);
                      const y = Math.round(((e.clientY - rect.top) / rect.height) * s.h - 30);
                      addElement(t, s.id, x, y);
                    }
                  }}
                >
                  <div style={{ width: PAGE_WIDTH, transform: `scale(${Math.min(1, vpw / PAGE_WIDTH)})`, transformOrigin: "top left", height: s.h }}>
                    {[...s.elements]
                      .sort((a, b) => a.z - b.z)
                      .map((el) => {
                        const isSel = sel?.elId === el.id;
                        return (
                          <div
                            key={el.id}
                            onMouseDown={(e) => startDrag(e, s, el, "move")}
                            onDoubleClick={() => el.type === "text" && setEditingText(el.id)}
                            className="absolute cursor-move select-none"
                            style={{
                              left: el.x,
                              top: el.y,
                              width: el.w,
                              height: el.h,
                              zIndex: el.z,
                              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                              opacity: el.opacity,
                              outline: isSel ? "2px solid #c9a86a" : el.locked ? "1px dashed #6d6c7d" : "1px solid transparent",
                              outlineOffset: 2,
                              display: el.hidden ? "none" : undefined,
                            }}
                          >
                            {editingText === el.id ? (
                              <ContentEditableText
                                value={(el.content?.text as string) ?? ""}
                                onChange={(v) => setEl(s.id, el.id, { content: { ...el.content, text: v } })}
                                onDone={() => setEditingText(null)}
                                style={textStyleFor(el)}
                              />
                            ) : (
                              <ElementViewLazy el={el} />
                            )}
                            {isSel && (
                              <>
                                {(["nw", "ne", "sw", "se"] as const).map((dir) => (
                                  <span
                                    key={dir}
                                    onMouseDown={(e) => startDrag(e, s, el, "resize", dir)}
                                    className="absolute z-30 h-3 w-3 rounded-full border border-gold bg-night"
                                    style={handleStyle(dir)}
                                    aria-hidden="true"
                                  />
                                ))}
                                {(["n", "s", "e", "w"] as const).map((dir) => (
                                  <span
                                    key={dir}
                                    onMouseDown={(e) => startDrag(e, s, el, "resize", dir)}
                                    className="absolute z-30 h-3 w-3 rounded-full border border-gold/60 bg-night"
                                    style={handleStyle(dir)}
                                    aria-hidden="true"
                                  />
                                ))}
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
                {initialSlug === "boutique" && si === 0 && (
                  <div className="my-4 rounded-xl border border-dashed border-gold/40 bg-gold/5 px-4 py-3 text-center text-xs text-goldsoft">
                    Catalogue produits dynamique — affiché par le site, non stocké et non modifiable dans le CMS.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Panneau de propriétés */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-line bg-surface/60 p-4">
          {sel && selEl && selSection ? (
            <PropsPanel
              el={selEl}
              section={selSection}
              device={device}
              onChange={(patch) => setEl(selSection.id, selEl.id, patch)}
              onChangeStyle={(patch) => setEl(selSection.id, selEl.id, { style: { ...selEl.style, ...patch } })}
              onChangeContent={(patch) => setEl(selSection.id, selEl.id, { content: { ...selEl.content, ...patch } })}
              onResponsive={(bp, patch) =>
                setEl(selSection.id, selEl.id, { responsive: { ...selEl.responsive, [bp]: { ...(selEl.responsive?.[bp] ?? {}), ...patch } } })
              }
              onRemove={() => removeEl(selSection.id, selEl.id)}
              onLock={() => setEl(selSection.id, selEl.id, { locked: !selEl.locked })}
              onHide={() => setEl(selSection.id, selEl.id, { hidden: !selEl.hidden })}
            />
          ) : selSection ? (
            <div>
              <p className="mb-3 text-xs tracking-[0.18em] text-gold uppercase">Section</p>
              <Field label="Hauteur (px)"><NumInput v={selSection.h} onChange={(v) => sectionProp(selSection.id, { h: Math.max(120, v) })} min={120} max={4000} /></Field>
              <Field label="Arrière-plan"><Input v={selSection.bg ?? ""} onChange={(v) => sectionProp(selSection.id, { bg: v })} /></Field>
              <p className="mt-4 text-xs leading-relaxed text-faint">Sélectionnez un élément pour modifier ses propriétés. Double-clic sur un texte pour l'éditer directement.</p>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-xs tracking-[0.18em] text-gold uppercase">Aide</p>
              <ul className="space-y-2 text-xs leading-relaxed text-muted">
                <li>• Cliquez sur un élément de la bibliothèque pour l'ajouter (ou glissez-le dans une section).</li>
                <li>• Déplacez librement, redimensionnez aux poignées dorées.</li>
                <li>• Double-clic sur un texte = édition directe.</li>
                <li>• Ctrl+Z annuler · Ctrl+D dupliquer · Suppr supprimer.</li>
                <li>• ▲ / ▼ pour l'ordre d'affichage (devant / derrière).</li>
                <li>• L'onglet Responsive ajuste la position par appareil.</li>
                <li>• « Enregistrer » garde le brouillon · « Publier » rend la page visible.</li>
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ToolBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm text-muted transition-colors hover:text-ink disabled:opacity-30">
      {children}
    </button>
  );
}

function handleStyle(dir: string) {
  const map: Record<string, React.CSSProperties> = {
    nw: { left: -6, top: -6, cursor: "nwse-resize" },
    ne: { right: -6, top: -6, cursor: "nesw-resize" },
    sw: { left: -6, bottom: -6, cursor: "nesw-resize" },
    se: { right: -6, bottom: -6, cursor: "nwse-resize" },
    n: { left: "50%", top: -6, transform: "translateX(-50%)", cursor: "ns-resize" },
    s: { left: "50%", bottom: -6, transform: "translateX(-50%)", cursor: "ns-resize" },
    e: { right: -6, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" },
    w: { left: -6, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" },
  };
  return map[dir] ?? {};
}

function textStyleFor(el: CmsElement): React.CSSProperties {
  const s = el.style ?? {};
  return {
    fontFamily: (el as any)._font,
    fontSize: s.size,
    fontWeight: s.weight,
    color: s.color,
    background: "transparent",
    border: "1px dashed #c9a86a",
    padding: 4,
    height: "100%",
    overflow: "hidden",
  };
}

function ContentEditableText({ value, onChange, onDone, style }: { value: string; onChange: (v: string) => void; onDone: () => void; style: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      style={style}
      onBlur={() => onDone()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDone();
      }}
      onInput={(e) => onChange((e.target as HTMLDivElement).innerText)}
    >
      {value}
    </div>
  );
}

// Renderer partagé (évite l'import circulaire avec l'aperçu public)
import { ElementView } from "@/components/page/element-view";
function ElementViewLazy({ el }: { el: CmsElement }) {
  return <ElementView el={el} products={[]} />;
}

// ---------------------------------------------------------------------------
// Panneau de propriétés
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2.5 block">
      <span className="mb-1 block text-[11px] tracking-wide text-faint uppercase">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-lg border border-line bg-night px-2.5 py-2 text-sm text-ink focus:border-gold";

function Input({ v, onChange, placeholder }: { v: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={inputCls} value={v ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
function NumInput({ v, onChange, min, max, step }: { v: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return <input type="number" className={inputCls} value={Math.round(v * 100) / 100} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value) || 0)} />;
}
function ColorInput({ v, onChange }: { v: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(v ?? "") ? v : "#c9a86a"} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 cursor-pointer rounded border border-line bg-night" aria-label="Couleur" />
      <input className={inputCls} value={v ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PropsPanel({
  el, onChange, onChangeStyle, onChangeContent, onResponsive, onRemove, onLock, onHide,
}: {
  el: CmsElement;
  section: CmsSection;
  device: Device;
  onChange: (p: Partial<CmsElement>) => void;
  onChangeStyle: (p: Record<string, any>) => void;
  onChangeContent: (p: Record<string, any>) => void;
  onResponsive: (bp: "tablet" | "mobile", p: Record<string, any>) => void;
  onRemove: () => void;
  onLock: () => void;
  onHide: () => void;
}) {
  const s = el.style ?? {};
  const c = el.content ?? {};
  const faqItems = Array.isArray(c.items) ? (c.items as { question: string; answer: string }[]) : [];
  const updateFaqItem = (index: number, patch: Partial<{ question: string; answer: string }>) => {
    const next = [...faqItems];
    next[index] = { ...next[index], ...patch };
    onChangeContent({ items: next });
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs tracking-[0.18em] text-gold uppercase">{el.type}</p>
        <div className="flex gap-1">
          <button onClick={onLock} className={`rounded px-2 py-1 text-[11px] ${el.locked ? "bg-gold/15 text-gold" : "text-muted"}`}>{el.locked ? "🔒" : "🔓"}</button>
          <button onClick={onHide} className={`rounded px-2 py-1 text-[11px] ${el.hidden ? "bg-gold/15 text-gold" : "text-muted"}`}>👁</button>
          <button onClick={onRemove} className="rounded px-2 py-1 text-[11px] text-danger">Suppr.</button>
        </div>
      </div>

      <p className="mb-1.5 text-[10px] tracking-[0.2em] text-faint uppercase">Position & taille</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Field label="X"><NumInput v={el.x} onChange={(v) => onChange({ x: v })} min={-200} max={PAGE_WIDTH} /></Field>
        <Field label="Y"><NumInput v={el.y} onChange={(v) => onChange({ y: v })} min={-200} max={4000} /></Field>
        <Field label="Largeur"><NumInput v={el.w} onChange={(v) => onChange({ w: Math.max(MIN_SIZE, v) })} min={MIN_SIZE} max={PAGE_WIDTH} /></Field>
        <Field label="Hauteur"><NumInput v={el.h} onChange={(v) => onChange({ h: Math.max(MIN_SIZE, v) })} min={MIN_SIZE} max={4000} /></Field>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Field label="Rotation (°)"><NumInput v={el.rotation} onChange={(v) => onChange({ rotation: v })} min={-180} max={180} /></Field>
        <Field label="Opacité"><NumInput v={el.opacity} onChange={(v) => onChange({ opacity: Math.min(1, Math.max(0.05, v / 100)) })} min={5} max={100} step={5} /></Field>
      </div>

      {/* Propriétés selon le type */}
      {el.type === "text" && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">Texte</p>
          <Field label="Contenu"><textarea rows={3} className={`${inputCls} resize-none`} value={c.text ?? ""} onChange={(e) => onChangeContent({ text: e.target.value })} /></Field>
          <Field label="Police">
            <select className={inputCls} value={s.fontFamily ?? "sans"} onChange={(e) => onChangeStyle({ fontFamily: e.target.value })}>
              <option value="serif">Serif — Cormorant</option>
              <option value="sans">Sans — Jost</option>
              <option value="script">Script — Parisienne</option>
              <option value="elegant">Élégante — Great Vibes</option>
              <option value="modern">Moderne — Montserrat</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Taille"><NumInput v={s.size ?? 16} onChange={(v) => onChangeStyle({ size: v })} min={8} max={160} /></Field>
            <Field label="Graisse"><NumInput v={s.weight ?? 400} onChange={(v) => onChangeStyle({ weight: v })} min={100} max={900} step={100} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Couleur"><ColorInput v={s.color ?? "#ece9e2"} onChange={(v) => onChangeStyle({ color: v })} /></Field>
            <Field label="Alignement">
              <select className={inputCls} value={s.align ?? "left"} onChange={(e) => onChangeStyle({ align: e.target.value })}>
                <option value="left">Gauche</option>
                <option value="center">Centre</option>
                <option value="right">Droite</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Interligne"><NumInput v={s.lineHeight ?? 1.5} onChange={(v) => onChangeStyle({ lineHeight: v })} min={0.8} max={3} step={0.1} /></Field>
            <Field label="Espacement"><NumInput v={s.letterSpacing ?? 0} onChange={(v) => onChangeStyle({ letterSpacing: v })} min={-4} max={20} step={0.5} /></Field>
          </div>
          <label className="mb-2 flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={!!s.italic} onChange={(e) => onChangeStyle({ italic: e.target.checked })} className="accent-[#c9a86a]" /> Italique</label>
        </>
      )}
      {el.type === "image" && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">Image</p>
          <Field label="Source (médiathèque Blob)">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input className={inputCls} value={c.src ?? ""} placeholder="/images/… ou https://…blob…" onChange={(e) => onChangeContent({ src: e.target.value })} />
                <button onClick={() => setPickerOpen(true)} className="shrink-0 rounded-full bg-gold px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-night hover:bg-goldsoft">
                  Choisir
                </button>
              </div>
              {c.src && (
                <div className="overflow-hidden rounded-lg border border-line bg-night">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.src} alt="" className="aspect-video w-full object-cover" />
                </div>
              )}
            </div>
          </Field>
          <Field label="Alt text"><Input v={c.alt ?? ""} onChange={(v) => onChangeContent({ alt: v })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ajustement">
              <select className={inputCls} value={c.fit ?? "cover"} onChange={(e) => onChangeContent({ fit: e.target.value })}>
                <option value="cover">Couvrir</option><option value="contain">Incorporer</option><option value="fill">Étirer</option>
              </select>
            </Field>
            <Field label="Rayon"><NumInput v={c.radius ?? 0} onChange={(v) => onChangeContent({ radius: v })} min={0} max={200} /></Field>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={!!c.shadow} onChange={(e) => onChangeContent({ shadow: e.target.checked })} className="accent-[#c9a86a]" /> Ombre</label>
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={!!c.border} onChange={(e) => onChangeContent({ border: e.target.checked })} className="accent-[#c9a86a]" /> Bordure</label>
          </div>
          <MediaPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(urls) => {
              if (urls[0]) onChangeContent({ src: urls[0] });
              setPickerOpen(false);
            }}
            selectedUrls={c.src ? [c.src] : []}
            title="Choisir une image"
          />
        </>
      )}
      {el.type === "button" && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">Bouton</p>
          <Field label="Texte"><Input v={c.text ?? ""} onChange={(v) => onChangeContent({ text: v })} /></Field>
          <Field label="Lien"><Input v={c.href ?? ""} onChange={(v) => onChangeContent({ href: v })} placeholder="/create" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fond"><ColorInput v={s.bg ?? "#c9a86a"} onChange={(v) => onChangeStyle({ bg: v })} /></Field>
            <Field label="Survol"><ColorInput v={s.hoverBg ?? "#e3cfa4"} onChange={(v) => onChangeStyle({ hoverBg: v })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Texte (couleur)"><ColorInput v={s.color ?? "#06070c"} onChange={(v) => onChangeStyle({ color: v })} /></Field>
            <Field label="Rayon"><NumInput v={s.radius ?? 999} onChange={(v) => onChangeStyle({ radius: v })} min={0} max={999} /></Field>
          </div>
        </>
      )}
      {(el.type === "product" || el.type === "productGrid") && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">E-commerce</p>
          {el.type === "product" ? (
            <Field label="Produit (slug)">
              <select className={inputCls} value={c.slug ?? ""} onChange={(e) => onChangeContent({ slug: e.target.value })}>
                <option value="">—</option>
                {["etoiles-de-naissance", "etoiles-de-nous-deux", "etoiles-de-rencontre", "notre-journee-a-nous", "calendrier-2027", "carnet-personnalise", "recueil-de-poemes-cosmiques"].map((sl) => (
                  <option key={sl} value={sl}>{sl}</option>
                ))}
              </select>
            </Field>
          ) : (
            <>
              <Field label="Titre"><Input v={c.title ?? ""} onChange={(v) => onChangeContent({ title: v })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Filtre (mot)"><Input v={c.category ?? ""} onChange={(v) => onChangeContent({ category: v })} placeholder="naissance…" /></Field>
                <Field label="Nombre"><NumInput v={c.count ?? 4} onChange={(v) => onChangeContent({ count: v })} min={1} max={12} /></Field>
              </div>
            </>
          )}
        </>
      )}
      {el.type === "video" && (
        <Field label="URL YouTube"><Input v={c.url ?? ""} onChange={(v) => onChangeContent({ url: v })} placeholder="https://youtube.com/watch?v=…" /></Field>
      )}
      {el.type === "countdown" && (
        <>
          <Field label="Date limite"><Input v={c.date ?? ""} onChange={(v) => onChangeContent({ date: v })} placeholder="2026-02-14T00:00:00" /></Field>
          <Field label="Libellé"><Input v={c.label ?? ""} onChange={(v) => onChangeContent({ label: v })} /></Field>
        </>
      )}
      {(el.type === "promo" || el.type === "newsletter" || el.type === "form" || el.type === "testimonials") && (
        <Field label="Texte principal"><Input v={c.text ?? c.title ?? ""} onChange={(v) => onChangeContent(el.type === "testimonials" ? { title: v } : { text: v })} /></Field>
      )}
      {el.type === "faq" && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">FAQ</p>
          <Field label="Surtitre"><Input v={c.eyebrow ?? ""} onChange={(v) => onChangeContent({ eyebrow: v })} /></Field>
          <Field label="Titre"><Input v={c.title ?? ""} onChange={(v) => onChangeContent({ title: v })} /></Field>
          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <div key={index} className="rounded-xl border border-line bg-night/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] tracking-wide text-gold uppercase">Question {index + 1}</span>
                  <button type="button" onClick={() => onChangeContent({ items: faqItems.filter((_, i) => i !== index) })} className="text-[10px] text-danger hover:underline">Supprimer</button>
                </div>
                <Field label="Question"><textarea rows={2} className={`${inputCls} resize-y`} value={item.question ?? ""} onChange={(e) => updateFaqItem(index, { question: e.target.value })} /></Field>
                <Field label="Réponse"><textarea rows={4} className={`${inputCls} resize-y`} value={item.answer ?? ""} onChange={(e) => updateFaqItem(index, { answer: e.target.value })} /></Field>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onChangeContent({ items: [...faqItems, { question: "", answer: "" }] })} className="w-full rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted hover:border-gold hover:text-ink">+ Ajouter une question</button>
          <p className="mb-1.5 mt-4 text-[10px] tracking-[0.2em] text-faint uppercase">Bloc contact</p>
          <Field label="Titre"><Input v={c.contactTitle ?? ""} onChange={(v) => onChangeContent({ contactTitle: v })} /></Field>
          <Field label="Texte"><textarea rows={2} className={`${inputCls} resize-y`} value={c.contactText ?? ""} onChange={(e) => onChangeContent({ contactText: e.target.value })} /></Field>
          <Field label="Libellé du lien"><Input v={c.contactLabel ?? ""} onChange={(v) => onChangeContent({ contactLabel: v })} /></Field>
          <Field label="URL du lien"><Input v={c.contactHref ?? ""} onChange={(v) => onChangeContent({ contactHref: v })} /></Field>
        </>
      )}
      {el.type === "divider" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Couleur"><ColorInput v={c.color ?? "#22263a"} onChange={(v) => onChangeContent({ color: v })} /></Field>
          <Field label="Épaisseur"><NumInput v={c.width ?? 1} onChange={(v) => onChangeContent({ width: v })} min={1} max={16} /></Field>
        </div>
      )}
      {el.type === "section" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fond (CSS)"><Input v={s.bg ?? ""} onChange={(v) => onChangeStyle({ bg: v })} /></Field>
          <Field label="Rayon"><NumInput v={s.radius ?? 0} onChange={(v) => onChangeStyle({ radius: v })} min={0} max={200} /></Field>
        </div>
      )}
      {(el.type === "text" || el.type === "image") && (
        <Field label="Lien (optionnel)"><Input v={el.link ?? ""} onChange={(v) => onChange({ link: v || undefined })} placeholder="/page" /></Field>
      )}

      {/* Responsive */}
      <div className="mt-4 rounded-xl border border-line p-3">
        <p className="mb-2 text-[10px] tracking-[0.2em] text-faint uppercase">Responsive (override)</p>
        {(["tablet", "mobile"] as const).map((bp) => (
          <div key={bp} className="mb-2 grid grid-cols-4 gap-1.5">
            <Field label={bp === "tablet" ? "Tab. X" : "Mob. X"}><NumInput v={el.responsive?.[bp]?.x ?? el.x} onChange={(v) => onResponsive(bp, { x: v })} /></Field>
            <Field label={bp === "tablet" ? "Tab. Y" : "Mob. Y"}><NumInput v={el.responsive?.[bp]?.y ?? el.y} onChange={(v) => onResponsive(bp, { y: v })} /></Field>
            <Field label="L."><NumInput v={el.responsive?.[bp]?.w ?? el.w} onChange={(v) => onResponsive(bp, { w: v })} min={MIN_SIZE} /></Field>
            <label className="flex flex-col justify-end pb-1 text-[10px] text-faint">
              Cacher
              <input type="checkbox" checked={el.responsive?.[bp]?.hidden ?? false} onChange={(e) => onResponsive(bp, { hidden: e.target.checked })} className="accent-[#c9a86a]" />
            </label>
          </div>
        ))}
        <p className="text-[10px] leading-relaxed text-faint">Laissez vide pour hériter de la position desktop.</p>
      </div>
    </div>
  );
}
