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
  countCmsNodes,
  createCmsIdFactory,
  duplicateCmsNode,
  removeCmsNodeFromSection,
  findCmsNode,
  findCmsParentNode,
  cmsAncestors,
  createCmsGroupFromElements,
  resizeCmsGroupToFrame,
  moveCmsColumnChild,
  isCmsContainer,
  isCmsColumn,
  isCmsGroup,
  isCmsRow,
  isCmsStructuralNode,
  isCmsNodeEditable,
  isValidGenericCmsPage,
  makeElement,
  resolveCmsButtonHref,
  updateCmsNodeInSection,
  type CmsColumn,
  type CmsContainer,
  type CmsElement,
  type CmsGroup,
  type CmsNode,
  type CmsPage,
  type CmsRow,
  type CmsSection,
  type CmsSectionNode,
  type CmsStructuralNode,
  type LibraryItem,
} from "@/lib/cms";
import {
  cmsAddTargetNodeId,
  describeCmsTarget,
  moveCmsLeafToColumn,
  removeCmsLeaf,
  resolveCmsAddTarget,
  resolveCmsColumnDropTarget,
  type CmsAddTarget,
} from "@/lib/cms-columns";
import { describeCmsRowLayout, resolveCmsColumnInsertionY, type CmsRowBreakpoint } from "@/lib/cms-responsive-rows";
import { CMS_FORM_FIELD_KEYS, normalizeCmsFormConfig, type CmsFormConfig, type CmsFormFieldKey } from "@/lib/cms-form";
import MediaPicker from "@/components/admin/media-picker";
import { alignFrame, appendHistorySnapshot, canvasFitZoom, clampFrame, resizeFrame, screenDeltaToCanvas, snapFrame, type CanvasGuide } from "@/lib/cms-editor-canvas";
import { CMS_STRUCTURE_LIMITS, cmsColumnRenderStyle, cmsContainerRenderStyle, cmsFlowLeafRenderStyle, cmsGroupRenderStyle, cmsLeafRenderStyle, cmsRowRenderStyle } from "@/lib/cms-structure";
import {
  applyCmsElementBreakpointPatch,
  CMS_BREAKPOINT_WIDTH,
  getCmsElementFontSizeInBreakpoint,
  getCmsElementForBreakpoint,
  getCmsElementFrameInBreakpoint,
  resolveCmsElementForBreakpoint,
  resolveCmsElementFrame,
  toCmsBreakpointFramePatch,
  type CmsBreakpoint,
  type CmsBreakpointPatch,
  type ResponsiveFrame,
} from "@/lib/cms-responsive";

type Device = CmsBreakpoint;
const LIBRARY_CATEGORY_ORDER = ["Texte", "Média", "Contenu", "Structure", "E-commerce", "Navigation", "Marketing"];
const SECTION_SELECTION_ID = "__cms_section_selection__";
const PHASE3B_DISABLED_SLUGS = new Set(["accueil", "boutique", "faq", "livraison", "comment-ca-marche"]);

type EditorLibraryEntry =
  | { kind: "element"; item: LibraryItem }
  | { kind: "row"; key: string; label: string; preset: number[] }
  | { kind: "group" }
  | { kind: "container" };

const PHASE3B_LIBRARY_ENTRIES: EditorLibraryEntry[] = [
  { kind: "row", key: "phase3b-row-1", label: "Ligne 1 colonne", preset: [100] },
  { kind: "row", key: "phase3b-row-2", label: "Ligne 2 colonnes (50/50)", preset: [50, 50] },
  { kind: "row", key: "phase3b-row-3", label: "Ligne 3 colonnes", preset: [100 / 3, 100 / 3, 100 / 3] },
  { kind: "row", key: "phase3b-row-4", label: "Ligne 4 colonnes", preset: [25, 25, 25, 25] },
  { kind: "group" },
  { kind: "container" },
  { kind: "row", key: "phase3b-row-2-30-70", label: "Ligne 2 colonnes (30/70)", preset: [30, 70] },
  { kind: "row", key: "phase3b-row-2-70-30", label: "Ligne 2 colonnes (70/30)", preset: [70, 30] },
];

function normalizeColumnWidths(columns: CmsColumn[]): CmsColumn[] {
  if (!columns.length) return columns;
  const extraBudget = 100 - columns.length;
  const weights = columns.map((column) => Math.max(0, column.width - 1));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let assigned = 0;
  return columns.map((column, index) => {
    const width = index === columns.length - 1
      ? 100 - assigned
      : Math.round((1 + (weightTotal > 0 ? extraBudget * weights[index] / weightTotal : extraBudget / columns.length)) * 100) / 100;
    assigned += width;
    return { ...column, width };
  });
}

interface Sel {
  sectionId: string;
  elId: string;
  parentId?: string;
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
  const [multiSel, setMultiSel] = useState<Sel[]>([]);
  const [device, setDevice] = useState<Device>("desktop");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([JSON.stringify(initialData)]);
  const [histIdx, setHistIdx] = useState(0);
  const historyRef = useRef(history);
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [guides, setGuides] = useState<CanvasGuide[]>([]);
  const [guideSectionId, setGuideSectionId] = useState<string | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [dropTarget, setDropTarget] = useState<{ sectionId: string; columnId: string; index: number } | null>(null);
  // Ref miroir : l'ecOUTIL mouseup est enregistre hors du cycle de rendu, il ne
  // doit pas lire un etat capture par closure (trop ancien).
  const dropTargetRef = useRef<{ sectionId: string; columnId: string; index: number } | null>(null);
  const sectionRefs = useRef(new Map<string, HTMLDivElement>());
  const columnDragRef = useRef<{ sectionId: string; leafId: string; originalPage: CmsPage; moved: boolean } | null>(null);
  const [clipboard, setClipboard] = useState<CmsElement[] | null>(null);
  const [versions, setVersions] = useState<{ id: number; label: string; createdAt: string }[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ sectionId: string; elementId: string; kind: "element" | "faqItem"; itemIndex?: number } | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const dragRef = useRef<{ mode: "move" | "resize"; dir?: string; start: { x: number; y: number }; node: CmsNode; parentId?: string; section: CmsSection; moved: boolean; originalPage: CmsPage; members?: { id: string; frame: { x: number; y: number; w: number; h: number } }[] } | null>(null);
  const sectionResizeRef = useRef<{ sectionId: string; startY: number; initialHeight: number; scale: number; moved: boolean; originalPage: CmsPage } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(page);
  const histIdxRef = useRef(histIdx);
  const editRevision = useRef(0);

  const show = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const pushHistory = useCallback((data: CmsPage) => {
    const result = appendHistorySnapshot(historyRef.current, histIdxRef.current, JSON.stringify(data), 50);
    if (!result.changed) return;
    historyRef.current = result.history;
    setHistory(result.history);
    histIdxRef.current = result.index;
    setHistIdx(result.index);
  }, []);

  const update = useCallback((fn: (p: CmsPage) => CmsPage) => {
    const current = pageRef.current;
    const next = fn(current);
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    pageRef.current = next;
    editRevision.current += 1;
    setPage(next);
    pushHistory(next);
    setDirty(true);
  }, [pushHistory]);

  const api = useCallback((body: Record<string, unknown>) =>
    fetch("/api/admin/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pageId, ...body }) }).then((r) => r.json()), [pageId]);

  const doSave = useCallback(
    async (extra: Record<string, unknown> = {}): Promise<boolean> => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const savingRevision = editRevision.current;
      const savingPage = page;
      setSaving(true);
      try {
        const result = await api({ action: "update", name, slug, data: savingPage, ...extra });
        if (result.error) throw new Error(result.error);
        if (editRevision.current === savingRevision) setDirty(false);
        const v = await fetch(`/api/admin/pages?id=${pageId}&full=1`).then((r) => r.json()).catch(() => null);
        if (v) setStatus(v.status ?? status);
        show("Brouillon enregistré.");
        return true;
      } catch (error) {
        show(error instanceof Error ? error.message : "Échec de l'enregistrement.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [api, name, page, pageId, show, slug, status]
  );

  useEffect(() => {
    pageRef.current = page;
    histIdxRef.current = histIdx;
    historyRef.current = history;
  }, [page, histIdx, history]);

  useEffect(() => {
    if (!dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void doSave();
    }, 1800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
    };
  }, [page, dirty, doSave]);

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
    const index = histIdxRef.current;
    const entries = historyRef.current;
    if (index <= 0) return;
    const nextIndex = index - 1;
    const data = JSON.parse(entries[nextIndex]) as CmsPage;
    editRevision.current += 1;
    histIdxRef.current = nextIndex;
    pageRef.current = data;
    setHistIdx(nextIndex);
    setPage(data);
    setDirty(true);
  };
  const redo = () => {
    const index = histIdxRef.current;
    const entries = historyRef.current;
    if (index >= entries.length - 1) return;
    const nextIndex = index + 1;
    const data = JSON.parse(entries[nextIndex]) as CmsPage;
    editRevision.current += 1;
    histIdxRef.current = nextIndex;
    pageRef.current = data;
    setHistIdx(nextIndex);
    setPage(data);
    setDirty(true);
  };

  // --- Sections ---
  const addSection = () => {
    const id = createCmsIdFactory(pageRef.current)();
    update((p) => ({
      sections: [...p.sections, { id, h: 480, bg: "linear-gradient(180deg,#06070c 0%,#0c0e16 100%)", elements: [] }],
    }));
    setMultiSel([]);
    setSel({ sectionId: id, elId: SECTION_SELECTION_ID });
  };
  const sectionProp = (id: string, patch: Partial<CmsSection>) =>
    update((p) => ({ sections: p.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const removeSection = (id: string) => {
    if (pageRef.current.sections.length <= 1) { show("Une page doit conserver au moins une section."); return; }
    const section = pageRef.current.sections.find((item) => item.id === id);
    if (section?.elements.some((element) => element.locked ||
      ((isCmsContainer(element) || isCmsGroup(element)) && element.children.some((child) => child.locked)) ||
      (isCmsRow(element) && element.children.some((column) => column.locked || column.children.some((child) => child.locked))))) {
      show("Déverrouillez les éléments verrouillés avant de supprimer cette section.");
      return;
    }
    if (!confirm("Supprimer cette section et tous ses éléments ?")) return;
    update((p) => ({ sections: p.sections.filter((s) => s.id !== id) }));
    if (sel?.sectionId === id) { setSel(null); setMultiSel([]); }
  };
  const duplicateSection = (id: string) =>
    update((p) => {
      const i = p.sections.findIndex((s) => s.id === id);
      const src = p.sections[i];
      const copy: CmsSection = JSON.parse(JSON.stringify(src));
      const createId = createCmsIdFactory(p);
      copy.id = createId();
      copy.elements = copy.elements.map((node) => duplicateCmsNode(node, createId) as CmsSectionNode);
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
  const selIsSection = sel?.elId === SECTION_SELECTION_ID;
  const selNode = sel && selSection && !selIsSection ? findCmsNode(selSection, sel.elId) : null;
  const selContainer = selNode && isCmsContainer(selNode) ? selNode : null;
  const selRow = selNode && isCmsRow(selNode) ? selNode : null;
  const selColumn = selNode && isCmsColumn(selNode) ? selNode : null;
  const selGroup = selNode && isCmsGroup(selNode) ? selNode : null;
  const selParent = sel && selSection ? findCmsParentNode(selSection, sel.elId) : undefined;
  const selEl = selNode && !isCmsStructuralNode(selNode) ? selNode : null;
  const selReadOnly = !!selNode?.locked || !!(selSection && sel ? cmsAncestors(selSection, sel.elId).some((parent) => parent.locked) : false);
  const activeMulti = multiSel.length > 1 && multiSel.every((item) => item.sectionId === sel?.sectionId) ? multiSel : [];
  const activeMultiElements = selSection ? activeMulti.flatMap((item) => {
    const node = findCmsNode(selSection, item.elId);
    return node && !isCmsStructuralNode(node) ? [node] : [];
  }) : [];
  const selectNode = (selection: Sel, event?: React.MouseEvent, multiEligible = false) => {
    const modified = !!event && (event.metaKey || event.ctrlKey);
    if (modified && multiEligible) {
      const existing = multiSel.length ? multiSel : (sel && sel.sectionId === selection.sectionId && !sel.parentId ? [sel] : []);
      const alreadySelected = existing.some((item) => item.elId === selection.elId);
      const next = alreadySelected ? existing.filter((item) => item.elId !== selection.elId) : [...existing.filter((item) => item.elId !== selection.elId), selection];
      setMultiSel(next.length > 1 ? next : []);
      setSel(next[next.length - 1] ?? null);
      setEditingText(null);
      return true;
    }
    setMultiSel([]);
    setSel(selection);
    setEditingText(null);
    return false;
  };
  const selectSection = (sectionId: string) => {
    setMultiSel([]);
    setSel({ sectionId, elId: SECTION_SELECTION_ID });
    setEditingText(null);
  };

  const addContainer = (sectionId?: string) => {
    if (PHASE3B_DISABLED_SLUGS.has(initialSlug)) return;
    if (device !== "desktop") { show("Les conteneurs de cette phase sont éditables sur Desktop uniquement."); return; }
    const targetSectionId = sectionId ?? selSection?.id ?? page.sections[page.sections.length - 1]?.id;
    const target = pageRef.current.sections.find((section) => section.id === targetSectionId);
    if (!target || target.elements.length >= CMS_STRUCTURE_LIMITS.elementsPerSection || target.elements.filter(isCmsContainer).length >= CMS_STRUCTURE_LIMITS.containersPerSection || countCmsNodes(pageRef.current) >= CMS_STRUCTURE_LIMITS.totalNodesPerPage) { show("Limite de conteneurs ou de nœuds atteinte pour cette page."); return; }
    const createId = createCmsIdFactory(pageRef.current);
    const container: CmsContainer = {
      id: createId(), nodeType: "container", x: 80, y: 80, w: 480, h: 300,
      z: Math.max(0, ...target.elements.map((node) => node.z)) + 1, rotation: 0, opacity: 1,
      layout: "free", children: [],
    };
    update((p) => ({ sections: p.sections.map((section) => section.id === targetSectionId ? { ...section, elements: [...section.elements, container] } : section) }));
    setSel({ sectionId: targetSectionId, elId: container.id });
  };

  const addRow = (preset: number[]) => {
    if (PHASE3B_DISABLED_SLUGS.has(initialSlug)) return;
    if (device !== "desktop") { show("Les rangées et colonnes structurelles sont éditables sur Desktop uniquement."); return; }
    const targetSectionId = selSection?.id ?? page.sections[page.sections.length - 1]?.id;
    const target = pageRef.current.sections.find((section) => section.id === targetSectionId);
    if (!target || target.elements.length >= CMS_STRUCTURE_LIMITS.elementsPerSection || countCmsNodes(pageRef.current) + preset.length + 1 > CMS_STRUCTURE_LIMITS.totalNodesPerPage || target.elements.filter(isCmsRow).length >= CMS_STRUCTURE_LIMITS.rowsPerSection) {
      show("Limite de rangées ou de nœuds atteinte."); return;
    }
    const createId = createCmsIdFactory(pageRef.current);
    const row: CmsRow = {
      id: createId(), nodeType: "row", x: 80, y: 80, w: 1040, h: 320,
      z: Math.max(0, ...target.elements.map((node) => node.z)) + 1, rotation: 0, opacity: 1,
      layout: "horizontal", gap: 16, alignX: "start", alignY: "start",
      children: preset.map((width) => ({
        id: createId(), nodeType: "column", width, z: 1, opacity: 1, layout: "vertical", gap: 16, children: [],
      })),
    };
    update((p) => ({ sections: p.sections.map((section) => section.id === targetSectionId ? { ...section, elements: [...section.elements, row] } : section) }));
    setMultiSel([]);
    setSel({ sectionId: targetSectionId, elId: row.id });
  };

  const groupSelection = () => {
    if (device !== "desktop" || activeMulti.length < 2 || !selSection) return;
    const ids = new Set(activeMulti.map((item) => item.elId));
    const nodes = activeMulti.map((item) => findCmsNode(selSection, item.elId));
    if (nodes.length > CMS_STRUCTURE_LIMITS.childrenPerGroup || nodes.some((node) => !node || isCmsStructuralNode(node) || node.locked) ||
      selSection.elements.filter(isCmsGroup).length >= CMS_STRUCTURE_LIMITS.groupsPerSection ||
      countCmsNodes(pageRef.current) + 1 > CMS_STRUCTURE_LIMITS.totalNodesPerPage) {
      show("Seules plusieurs feuilles racines modifiables peuvent être regroupées."); return;
    }
    const rootNodes = nodes as CmsElement[];
    const ordered = [...selSection.elements].sort((a, b) => a.z - b.z);
    const selectedPositions = ordered.flatMap((node, index) => ids.has(node.id) ? [index] : []);
    if (selectedPositions.length !== rootNodes.length || Math.max(...selectedPositions) - Math.min(...selectedPositions) + 1 !== selectedPositions.length) {
      show("Pour préserver l’empilement visuel, regroupez des feuilles contiguës dans les calques."); return;
    }
    const group = createCmsGroupFromElements(rootNodes, createCmsIdFactory(pageRef.current)());
    update((p) => ({ sections: p.sections.map((section) => section.id === selSection.id
      ? { ...section, elements: [...section.elements.filter((node) => !ids.has(node.id)), group] } : section) }));
    setMultiSel([]);
    setSel({ sectionId: selSection.id, elId: group.id });
  };

  const applyMultiPatch = (patch: Partial<CmsElement>) => {
    if (activeMulti.length < 2 || !selSection) return;
    const ids = new Set(activeMulti.map((item) => item.elId));
    update((p) => ({ sections: p.sections.map((section) => section.id === selSection.id ? {
      ...section,
      elements: section.elements.map((node) => !isCmsStructuralNode(node) && ids.has(node.id) ? { ...node, ...patch } : node),
    } : section) }));
  };

  const duplicateMulti = () => {
    if (activeMulti.length < 2 || !selSection) return;
    if (activeMultiElements.some((element) => element.locked)) { show("Déverrouillez les éléments verrouillés avant de les dupliquer."); return; }
    if (selSection.elements.length + activeMulti.length > CMS_STRUCTURE_LIMITS.elementsPerSection || countCmsNodes(pageRef.current) + activeMulti.length > CMS_STRUCTURE_LIMITS.totalNodesPerPage) { show("La duplication dépasserait une limite de nœuds ou de feuilles."); return; }
    const createId = createCmsIdFactory(pageRef.current);
    const copies = activeMulti.map(({ elId }) => {
      const source = findCmsNode(selSection, elId);
      if (!source || isCmsStructuralNode(source)) return null;
      const copy: CmsElement = { ...source, id: createId(), x: source.x + 24, y: source.y + 24, z: source.z + 1 };
      if (source.responsive) {
        copy.responsive = { ...source.responsive };
        for (const breakpoint of ["tablet", "mobile"] as const) {
          const override = source.responsive[breakpoint];
          if (!override) continue;
          const scale = CMS_BREAKPOINT_WIDTH[breakpoint] / PAGE_WIDTH;
          copy.responsive[breakpoint] = { ...override,
            ...(override.x !== undefined ? { x: override.x + 24 * scale } : {}),
            ...(override.y !== undefined ? { y: override.y + 24 * scale } : {}),
          };
        }
      }
      return copy;
    }).filter((node): node is CmsElement => !!node);
    update((p) => ({ sections: p.sections.map((section) => section.id === selSection.id ? { ...section, elements: [...section.elements, ...copies] } : section) }));
    setMultiSel([]);
    setSel(copies[0] ? { sectionId: selSection.id, elId: copies[0].id } : null);
  };

  const removeMulti = () => {
    if (activeMulti.length < 2 || !selSection) return;
    if (activeMultiElements.some((element) => element.locked)) { show("Déverrouillez les éléments verrouillés avant de les supprimer."); return; }
    if (!confirm(`Supprimer ces ${activeMulti.length} éléments ?`)) return;
    const ids = new Set(activeMulti.map((item) => item.elId));
    update((p) => ({ sections: p.sections.map((section) => section.id === selSection.id ? { ...section, elements: section.elements.filter((node) => !ids.has(node.id)) } : section) }));
    setMultiSel([]);
    setSel(null);
  };

  /**
   * Phase 3C — la cible d'ajout est dérivée de l'ARBRE, pas d'une variable de
   * sélection globale : sélectionner une feuille située dans une colonne cible
   * désormais CETTE colonne (Phase 3B ajoutait à la racine de section).
   */
  const resolveAddTargetFor = (sectionId: string): CmsAddTarget => {
    const section = pageRef.current.sections.find((candidate) => candidate.id === sectionId);
    if (!section) return { kind: "section" };
    return resolveCmsAddTarget(section, sel?.sectionId === sectionId ? sel.elId : null);
  };

  const addElementToTarget = (item: LibraryItem, sectionId: string, target: CmsAddTarget) => {
    const section = pageRef.current.sections.find((candidate) => candidate.id === sectionId);
    if (!section) return;
    const targetId = cmsAddTargetNodeId(target);
    if (!targetId && section.elements.length >= CMS_STRUCTURE_LIMITS.elementsPerSection) {
      show("La limite de feuilles de cette section est atteinte."); return;
    }
    if (targetId && !isCmsNodeEditable(section, targetId)) {
      show("Déverrouillez les parents avant d’ajouter un élément."); return;
    }
    if (targetId && countCmsNodes(pageRef.current) >= CMS_STRUCTURE_LIMITS.totalNodesPerPage) {
      show("La limite totale de nœuds est atteinte."); return;
    }
    if (targetId && device !== "desktop") {
      show("Le contenu structurel s’édite sur Desktop uniquement."); return;
    }
    const el = makeElement(item, 0, 0, 1);
    el.id = createCmsIdFactory(pageRef.current)();
    if (!isValidGenericCmsPage({ sections: [{ id: "structure-child-check", h: 1, elements: [el] }] })) {
      show("Ce bloc n’est pas autorisé comme feuille de page générique.");
      return;
    }
    if (!targetId) {
      update((p) => ({ sections: p.sections.map((candidate) => candidate.id === sectionId
        ? { ...candidate, elements: [...candidate.elements, { ...el, x: 60, y: 40 }] }
        : candidate) }));
      setSel({ sectionId, elId: el.id });
    } else {
      update((p) => ({ sections: p.sections.map((candidate) => updateCmsNodeInSection(candidate, targetId, (node) => {
        if (!isCmsStructuralNode(node)) return node;
        return { ...node, children: [...node.children, el] } as CmsStructuralNode;
      })) }));
      setSel({ sectionId, elId: el.id, parentId: targetId });
    }
    setMultiSel([]);
    show(`Ajouté dans ${describeCmsTarget(section, target)}.`);
  };

  const addElement = (itemOrType: LibraryItem | string, sectionId?: string) => {
    const item = typeof itemOrType === "string" ? LIBRARY.find((entry) => entry.type === itemOrType) : itemOrType;
    if (!item || (initialSlug === "boutique" && (item.type === "product" || item.type === "productGrid"))) return;
    const targetSectionId = sectionId ?? selSection?.id ?? page.sections[page.sections.length - 1]?.id;
    if (!targetSectionId) return;
    addElementToTarget(item, targetSectionId, resolveAddTargetFor(targetSectionId));
  };

  const setEl = (sectionId: string, elId: string, patch: Partial<CmsElement>) => {
    const section = pageRef.current.sections.find((candidate) => candidate.id === sectionId);
    const target = section && findCmsNode(section, elId);
    if (!section || !target || isCmsStructuralNode(target) || !isCmsNodeEditable(section, elId)) return;
    update((p) => ({ sections: p.sections.map((item) => item.id === sectionId ? updateCmsNodeInSection(item, elId, (node) => !isCmsStructuralNode(node) ? { ...node, ...patch } : node) : item) }));
  };

  const setStructure = (sectionId: string, nodeId: string, patch: Partial<CmsContainer> | Partial<CmsRow> | Partial<CmsColumn> | Partial<CmsGroup>) => {
    const section = pageRef.current.sections.find((candidate) => candidate.id === sectionId);
    const target = section && findCmsNode(section, nodeId);
    const unlocking = patch.locked === false && Object.keys(patch).length === 1;
    if (!section || !target || !isCmsStructuralNode(target) || (target.locked && !unlocking) || cmsAncestors(section, nodeId).some((parent) => parent.locked)) return;
    update((p) => ({ sections: p.sections.map((item) => item.id === sectionId ? updateCmsNodeInSection(item, nodeId, (node) => {
      if (!isCmsStructuralNode(node)) return node;
      if (isCmsGroup(node) && (("w" in patch && patch.w !== undefined) || ("h" in patch && patch.h !== undefined))) return resizeCmsGroupToFrame(node, { x: node.x, y: node.y, w: Math.max(MIN_SIZE, "w" in patch ? patch.w ?? node.w : node.w), h: Math.max(MIN_SIZE, "h" in patch ? patch.h ?? node.h : node.h) });
      return { ...node, ...patch } as CmsStructuralNode;
    }) : item) }));
  };
  const setContainer = (sectionId: string, containerId: string, patch: Partial<CmsContainer>) => setStructure(sectionId, containerId, patch);

  const setColumnWidth = (sectionId: string, rowId: string, columnId: string, requested: number) => {
    const section = pageRef.current.sections.find((candidate) => candidate.id === sectionId);
    const row = section && findCmsNode(section, rowId);
    if (!section || !row || !isCmsRow(row) || !isCmsNodeEditable(section, columnId)) return;
    const others = row.children.filter((column) => column.id !== columnId);
    const maxWidth = 100 - others.length;
    const value = Math.min(maxWidth, Math.max(1, Number.isFinite(requested) ? requested : 1));
    const oldOtherTotal = others.reduce((sum, column) => sum + column.width, 0);
    const remaining = maxWidth + others.length - value;
    const shouldRedistribute = others.length > 0 && value + oldOtherTotal > 100;
    let assigned = 0;
    const widths = new Map(others.map((column, index) => {
      const nextWidth = shouldRedistribute
        ? index === others.length - 1 ? remaining - assigned : Math.round(remaining / others.length * 100) / 100
        : column.width;
      assigned += nextWidth;
      return [column.id, nextWidth];
    }));
    update((p) => ({ sections: p.sections.map((item) => item.id === sectionId ? updateCmsNodeInSection(item, rowId, (node) => isCmsRow(node) ? {
      ...node, children: node.children.map((column) => column.id === columnId ? { ...column, width: value } : { ...column, width: widths.get(column.id) ?? column.width }),
    } : node) : item) }));
  };

  /** Phase 3C — ecrit une cle responsive de rangee ou de colonne sans ecraser les autres. */
  const setStructureResponsive = (
    sectionId: string,
    nodeId: string,
    breakpoint: CmsRowBreakpoint,
    patch: Record<string, unknown> | null,
  ) => {
    setStructure(sectionId, nodeId, (() => {
      const section = pageRef.current.sections.find((candidate) => candidate.id === sectionId);
      const node = section && findCmsNode(section, nodeId);
      if (!node || !isCmsStructuralNode(node)) return {};
      const current = ((node as CmsRow | CmsColumn).responsive ?? {}) as Record<string, Record<string, unknown>>;
      const nextBreakpoint = { ...(current[breakpoint] ?? {}) };
      for (const [key, value] of Object.entries(patch ?? {})) {
        if (value === null) delete nextBreakpoint[key];
        else nextBreakpoint[key] = value;
      }
      const next = { ...current };
      if (Object.keys(nextBreakpoint).length) next[breakpoint] = nextBreakpoint;
      else delete next[breakpoint];
      return { responsive: Object.keys(next).length ? next : undefined } as Partial<CmsRow> & Partial<CmsColumn>;
    })());
  };

  const reorderColumnChild = (sectionId: string, rowId: string, columnId: string, childId: string, direction: -1 | 1) => {
    const section = pageRef.current.sections.find((candidate) => candidate.id === sectionId);
    const row = section && findCmsNode(section, rowId);
    if (!section || !row || !isCmsRow(row) || !isCmsNodeEditable(section, childId)) return;
    update((p) => ({ sections: p.sections.map((item) => item.id === sectionId ? updateCmsNodeInSection(item, rowId, (node) => isCmsRow(node) ? {
      ...node, children: node.children.map((column) => column.id === columnId ? moveCmsColumnChild(column, childId, direction) : column),
    } : node) : item) }));
  };

  const setElAtBreakpoint = (sectionId: string, elId: string, breakpoint: Device, patch: CmsBreakpointPatch) => {
    const section = pageRef.current.sections.find((candidate) => candidate.id === sectionId);
    const target = section && findCmsNode(section, elId);
    if (!section || !target || isCmsStructuralNode(target) || !isCmsNodeEditable(section, elId)) return;
    const nextElement = applyCmsElementBreakpointPatch(target, breakpoint, patch);
    update((pageData) => ({ sections: pageData.sections.map((item) => item.id === sectionId ? updateCmsNodeInSection(item, elId, () => nextElement) : item) }));
  };
  const setElAtDevice = (sectionId: string, elId: string, patch: CmsBreakpointPatch) => setElAtBreakpoint(sectionId, elId, device, patch);

  const removeEl = (sectionId: string, elId: string) => {
    const section = pageRef.current.sections.find((item) => item.id === sectionId);
    const node = section && findCmsNode(section, elId);
    if (!section || !node || !isCmsNodeEditable(section, elId)) return;
    const label = isCmsRow(node) ? "rangée et toutes ses colonnes / feuilles" : isCmsGroup(node) ? "groupe et toutes ses feuilles" : isCmsContainer(node) ? "conteneur et tous ses éléments" : isCmsColumn(node) ? "colonne et ses feuilles" : "élément";
    if (!confirm(`Supprimer ${label} ?`)) return;
    update((p) => ({ sections: p.sections.map((item) => item.id === sectionId ? removeCmsNodeFromSection(item, elId) : item) }));
    setMultiSel([]);
    setSel(null);
  };

  const duplicateEl = (sectionId: string, elId: string) => {
    const section = pageRef.current.sections.find((item) => item.id === sectionId);
    const src = section && findCmsNode(section, elId);
    if (!section || !src || !isCmsNodeEditable(section, elId)) return;
    const parent = findCmsParentNode(section, elId);
    const copyCost = isCmsRow(src) ? 1 + src.children.reduce((sum, column) => sum + 1 + column.children.length, 0)
      : (isCmsContainer(src) || isCmsGroup(src)) ? 1 + src.children.length : isCmsColumn(src) ? 1 + src.children.length : 1;
    if (countCmsNodes(pageRef.current) + copyCost > CMS_STRUCTURE_LIMITS.totalNodesPerPage) { show("La duplication dépasserait la limite totale de nœuds."); return; }
    if (isCmsContainer(src) && section.elements.filter(isCmsContainer).length >= CMS_STRUCTURE_LIMITS.containersPerSection) { show("Limite de conteneurs atteinte."); return; }
    if (isCmsRow(src) && section.elements.filter(isCmsRow).length >= CMS_STRUCTURE_LIMITS.rowsPerSection) { show("Limite de rangées atteinte."); return; }
    if (isCmsGroup(src) && section.elements.filter(isCmsGroup).length >= CMS_STRUCTURE_LIMITS.groupsPerSection) { show("Limite de groupes atteinte."); return; }
    if (!parent && section.elements.length >= CMS_STRUCTURE_LIMITS.elementsPerSection) { show("La limite de feuilles de cette section est atteinte."); return; }
    if (isCmsColumn(src) && (!parent || !isCmsRow(parent) || parent.children.length >= CMS_STRUCTURE_LIMITS.columnsPerRow)) { show("Cette rangée a déjà quatre colonnes."); return; }
    if (parent && (isCmsContainer(parent) || isCmsGroup(parent)) && parent.children.length >= CMS_STRUCTURE_LIMITS.childrenPerContainer) { show("La limite d’enfants de cette structure est atteinte."); return; }
    if (parent && isCmsColumn(parent) && parent.children.length >= CMS_STRUCTURE_LIMITS.childrenPerColumn) { show("La colonne a déjà atteint sa limite de feuilles."); return; }
    const cloned = duplicateCmsNode(src, createCmsIdFactory(pageRef.current));
    const copy = isCmsStructuralNode(cloned) && !isCmsColumn(cloned) ? { ...cloned, x: cloned.x + 24, y: cloned.y + 24, z: cloned.z + 1 } :
      !isCmsStructuralNode(cloned) ? { ...cloned, x: cloned.x + (parent ? 24 : 24), y: cloned.y + 24, z: cloned.z + 1 } : cloned;
    update((p) => ({ sections: p.sections.map((item) => {
      if (item.id !== sectionId) return item;
      if (!parent) return { ...item, elements: [...item.elements, copy as CmsSectionNode] };
      if (isCmsContainer(parent) || isCmsGroup(parent)) return updateCmsNodeInSection(item, parent.id, (node) =>
        isCmsContainer(node) || isCmsGroup(node) ? { ...node, children: [...node.children, copy as CmsElement] } : node);
      if (isCmsColumn(parent)) {
        const row = findCmsParentNode(item, parent.id);
        if (!row || !isCmsRow(row)) return item;
        return updateCmsNodeInSection(item, row.id, (node) => isCmsRow(node) ? { ...node, children: node.children.map((column) => column.id === parent.id ? { ...column, children: [...column.children, copy as CmsElement] } : column) } : node);
      }
      if (isCmsRow(parent) && isCmsColumn(copy)) {
        const children = normalizeColumnWidths([...parent.children, copy]);
        return updateCmsNodeInSection(item, parent.id, (node) => isCmsRow(node) ? { ...node, children } : node);
      }
      return item;
    }) }));
    setSel({ sectionId, elId: copy.id });
  };

  const copyEl = () => {
    if (!selEl || !sel) return;
    setClipboard(JSON.parse(JSON.stringify([selEl])));
    show("Élément copié.");
  };
  const pasteEl = () => {
    if (!clipboard) return;
    const targetId = sel?.sectionId ?? page.sections[page.sections.length - 1]?.id;
    if (!targetId) return;
    const targetSection = pageRef.current.sections.find((section) => section.id === targetId);
    if (!targetSection || targetSection.elements.length + clipboard.length > CMS_STRUCTURE_LIMITS.elementsPerSection || countCmsNodes(pageRef.current) + clipboard.length > CMS_STRUCTURE_LIMITS.totalNodesPerPage) { show("Le collage dépasserait une limite de la page."); return; }
    const createId = createCmsIdFactory(pageRef.current);
    const copies = clipboard.map((e) => ({ ...e, id: createId(), x: e.x + 24, y: e.y + 24 }));
    update((p) => ({ sections: p.sections.map((s) => (s.id === targetId ? { ...s, elements: [...s.elements, ...copies] } : s)) }));
    setSel({ sectionId: targetId, elId: copies[0]?.id });
  };
  const zEl = (sectionId: string, elId: string, action: "front" | "forward" | "backward" | "back") => {
    const section = pageRef.current.sections.find((item) => item.id === sectionId);
    const target = section && findCmsNode(section, elId);
    if (!section || !target || !isCmsNodeEditable(section, elId)) return;
    const parent = findCmsParentNode(section, elId);
    const siblings = parent && (isCmsContainer(parent) || isCmsGroup(parent) || isCmsColumn(parent) || isCmsRow(parent))
      ? parent.children : section.elements;
    const otherZ = siblings.filter((node) => node.id !== elId).map((node) => node.z);
    const nextZ = action === "front" ? Math.max(0, ...otherZ) + 1
      : action === "back" ? Math.min(0, ...otherZ) - 1
      : target.z + (action === "forward" ? 1 : -1);
    update((p) => ({ sections: p.sections.map((item) => item.id === sectionId ? updateCmsNodeInSection(item, elId, (node) => ({ ...node, z: nextZ })) : item) }));
  };

  // --- Interactions souris : déplacement, redimensionnement, multi-déplacement et pan ---
  useEffect(() => {
    const move = (event: MouseEvent) => {
      const sectionResize = sectionResizeRef.current;
      if (sectionResize) {
        const deltaY = screenDeltaToCanvas(event.clientY - sectionResize.startY, sectionResize.scale);
        if (!sectionResize.moved && Math.abs(deltaY) < 2) return;
        sectionResize.moved = true;
        const height = Math.min(4000, Math.max(120, Math.round(sectionResize.initialHeight + deltaY)));
        const next: CmsPage = { sections: pageRef.current.sections.map((section) => section.id === sectionResize.sectionId ? { ...section, h: height } : section) };
        pageRef.current = next;
        setPage(next);
        return;
      }
      if (panRef.current && stageRef.current) {
        stageRef.current.scrollLeft = panRef.current.scrollLeft - (event.clientX - panRef.current.startX);
        stageRef.current.scrollTop = panRef.current.scrollTop - (event.clientY - panRef.current.startY);
        return;
      }
      const columnDrag = columnDragRef.current;
      if (columnDrag) {
        columnDrag.moved = true;
        const host = sectionRefs.current.get(columnDrag.sectionId);
        if (!host) return;
        const section = pageRef.current.sections.find((candidate) => candidate.id === columnDrag.sectionId);
        if (!section) return;
        const rect = host.getBoundingClientRect();
        const scale = scaleRef.current || 1;
        const point = {
          x: (event.clientX - rect.left) / scale,
          y: (event.clientY - rect.top) / scale,
        };
        const target = resolveCmsColumnDropTarget(section, point);
        const next = target ? { sectionId: columnDrag.sectionId, columnId: target.columnId, index: target.index } : null;
        dropTargetRef.current = next;
        setDropTarget(next);
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const screenDx = event.clientX - drag.start.x;
      const screenDy = event.clientY - drag.start.y;
      if (!drag.moved && Math.hypot(screenDx, screenDy) < 3) return;
      drag.moved = true;
      let dx = screenDeltaToCanvas(screenDx, scaleRef.current);
      let dy = screenDeltaToCanvas(screenDy, scaleRef.current);
      const current = pageRef.current;
      const section = current.sections.find((item) => item.id === drag.section.id);
      if (!section) return;
      if (drag.members?.length) {
        const minX = Math.min(...drag.members.map((member) => member.frame.x));
        const minY = Math.min(...drag.members.map((member) => member.frame.y));
        const maxX = Math.max(...drag.members.map((member) => member.frame.x + member.frame.w));
        const maxY = Math.max(...drag.members.map((member) => member.frame.y + member.frame.h));
        const minDx = -minX;
        const maxDx = PAGE_WIDTH - maxX;
        const minDy = -minY;
        const maxDy = section.h - maxY;
        dx = minDx <= maxDx ? Math.min(maxDx, Math.max(minDx, dx)) : 0;
        dy = minDy <= maxDy ? Math.min(maxDy, Math.max(minDy, dy)) : 0;
        const byId = new Map(drag.members.map((member) => [member.id, member.frame]));
        const next: CmsPage = { sections: current.sections.map((item) => item.id !== section.id ? item : {
          ...item,
          elements: item.elements.map((node) => {
            if (isCmsStructuralNode(node) || !byId.has(node.id)) return node;
            const frame = byId.get(node.id)!;
            return applyCmsElementBreakpointPatch(node, device, toCmsBreakpointFramePatch({ x: frame.x + dx, y: frame.y + dy }, device));
          }),
        }) };
        pageRef.current = next;
        setPage(next);
        return;
      }
      if (isCmsColumn(drag.node)) return;
      const parent = drag.parentId ? findCmsParentNode(section, drag.node.id) : undefined;
      const parentFrame = parent && (isCmsContainer(parent) || isCmsGroup(parent)) ? parent : undefined;
      const bounds = parentFrame ? { width: parentFrame.w, height: parentFrame.h } : { width: PAGE_WIDTH, height: section.h };
      let frame = { x: drag.node.x, y: drag.node.y, w: drag.node.w, h: drag.node.h };
      if (drag.mode === "move") {
        frame = clampFrame({ ...frame, x: drag.node.x + dx, y: drag.node.y + dy }, bounds.width, bounds.height);
        const siblings: CmsNode[] = parentFrame ? parentFrame.children : section.elements;
        const others = siblings.filter((candidate): candidate is CmsElement => candidate.id !== drag.node.id && !candidate.hidden && !isCmsStructuralNode(candidate))
          .map((candidate) => !parentFrame || isCmsGroup(parentFrame) ? resolveCmsElementFrame(candidate, device) : ({ x: candidate.x, y: candidate.y, w: candidate.w, h: candidate.h }));
        setGuideSectionId(section.id);
        const logicalGridSize = 20 * PAGE_WIDTH / CMS_BREAKPOINT_WIDTH[device];
        const snapped = snapFrame(frame, { enabled: snapEnabled, gridEnabled: snapEnabled, gridSize: logicalGridSize,
          threshold: screenDeltaToCanvas(8, scaleRef.current), canvasWidth: bounds.width, canvasHeight: bounds.height, otherFrames: others });
        frame = snapped.frame;
        setGuides(snapped.guides.map((guide) => ({ ...guide, position: guide.position + (parentFrame?.x ?? 0) })));
      } else if (drag.dir) {
        frame = resizeFrame(frame, drag.dir, dx, dy, bounds.width, bounds.height, MIN_SIZE);
        setGuides([]);
      }
      const next: CmsPage = { sections: current.sections.map((item) => item.id === section.id
        ? updateCmsNodeInSection(item, drag.node.id, (node) => {
            if (isCmsGroup(node) && drag.mode === "resize") return resizeCmsGroupToFrame(drag.node as CmsGroup, frame);
            if (isCmsStructuralNode(node)) return isCmsColumn(node) ? node : { ...node, ...frame } as CmsStructuralNode;
            if (drag.parentId && parentFrame && !isCmsGroup(parentFrame)) return { ...node, ...frame };
            return applyCmsElementBreakpointPatch(node, device, toCmsBreakpointFramePatch(frame, device));
          }) : item) };
      pageRef.current = next;
      setPage(next);
    };
    const up = () => {
      const sectionResize = sectionResizeRef.current;
      if (sectionResize) {
        sectionResizeRef.current = null;
        if (!sectionResize.moved) {
          pageRef.current = sectionResize.originalPage;
          setPage(sectionResize.originalPage);
          return;
        }
        const currentSection = pageRef.current.sections.find((section) => section.id === sectionResize.sectionId);
        const originalSection = sectionResize.originalPage.sections.find((section) => section.id === sectionResize.sectionId);
        if (currentSection?.h === originalSection?.h) return;
        pushHistory(pageRef.current);
        editRevision.current += 1;
        setDirty(true);
        return;
      }
      if (panRef.current) { panRef.current = null; return; }
      const columnDrag = columnDragRef.current;
      if (columnDrag) {
        columnDragRef.current = null;
        const target = dropTargetRef.current;
        dropTargetRef.current = null;
        setDropTarget(null);
        if (!columnDrag.moved || !target || target.sectionId !== columnDrag.sectionId) return;
        const result = moveCmsLeafToColumn(pageRef.current, columnDrag.sectionId, {
          leafId: columnDrag.leafId,
          columnId: target.columnId,
          index: target.index,
        });
        if (!result.ok) {
          if (result.reason === "locked") show("Déverrouillez la destination avant de déplacer cet élément.");
          else if (result.reason === "column-full") show("La colonne de destination a atteint sa limite d’éléments.");
          return;
        }
        update((p) => ({ sections: p.sections.map((candidate) => candidate.id === columnDrag.sectionId ? result.section : candidate) }));
        setSel({ sectionId: columnDrag.sectionId, elId: columnDrag.leafId, parentId: target.columnId });
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setGuides([]);
      setGuideSectionId(null);
      if (!drag.moved) return;
      const currentSection = pageRef.current.sections.find((item) => item.id === drag.section.id);
      const unchanged = drag.members?.length
        ? !!currentSection && drag.members.every((member) => {
            const currentNode = findCmsNode(currentSection, member.id);
            return !!currentNode && !isCmsStructuralNode(currentNode) && JSON.stringify(resolveCmsElementFrame(currentNode, device)) === JSON.stringify(member.frame);
          })
        : (() => {
            const node = currentSection && findCmsNode(currentSection, drag.node.id);
            if (!node || !("x" in node) || !("x" in drag.node)) return true;
            const nodeParent = drag.parentId ? findCmsParentNode(currentSection, node.id) : undefined;
            const frame = isCmsStructuralNode(node)
              ? { x: node.x, y: node.y, w: node.w, h: node.h }
              : drag.parentId && !isCmsGroup(nodeParent) ? { x: node.x, y: node.y, w: node.w, h: node.h } : resolveCmsElementFrame(node, device);
            return frame.x === drag.node.x && frame.y === drag.node.y && frame.w === drag.node.w && frame.h === drag.node.h;
          })();
      if (unchanged) {
        pageRef.current = drag.originalPage;
        setPage(drag.originalPage);
        return;
      }
      pushHistory(pageRef.current);
      editRevision.current += 1;
      setDirty(true);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    // `show` et `update` sont des useCallback stables (dependances vides) :
    // les ajouter ne reabonne pas l'ecouteur a chaque rendu.
  }, [device, pushHistory, snapEnabled, show, update]);

  const startSectionResize = (event: React.MouseEvent, section: CmsSection) => {
    if (spacePressed || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    scaleRef.current = canvasScale;
    selectSection(section.id);
    sectionResizeRef.current = {
      sectionId: section.id,
      startY: event.clientY,
      initialHeight: section.h,
      scale: canvasScale,
      moved: false,
      originalPage: pageRef.current,
    };
  };

  /**
   * Phase 3C — drag & drop structurel des feuilles en flux.
   * Phase 3B les feuilles de colonne n'etaient selectionnables qu'au clic :
   * le parent etait fige au mousedown, donc aucun deplacement entre colonnes
   * n'etait possible. Ici la cible est recalculee a chaque mouvement.
   */
  const startColumnDrag = (e: React.MouseEvent, section: CmsSection, element: CmsElement, parentId: string) => {
    if (spacePressed || e.button !== 0) return;
    selectNode({ sectionId: section.id, elId: element.id, parentId });
    setEditingText(null);
    if (!isCmsNodeEditable(section, element.id)) return;
    e.preventDefault();
    e.stopPropagation();
    scaleRef.current = canvasScale;
    columnDragRef.current = { sectionId: section.id, leafId: element.id, originalPage: pageRef.current, moved: false };
  };

  const startDrag = (e: React.MouseEvent, section: CmsSection, node: CmsNode, mode: "move" | "resize", dir?: string, parentId?: string) => {
    if (spacePressed || e.button !== 0 || isCmsColumn(node)) return;
    scaleRef.current = canvasScale;
    e.preventDefault();
    e.stopPropagation();
    const rootLeaf = !parentId && !isCmsStructuralNode(node);
    const selection = { sectionId: section.id, elId: node.id, parentId };
    const modified = e.metaKey || e.ctrlKey;
    const preserveMulti = rootLeaf && !modified && multiSel.length > 1 && multiSel.some((item) => item.elId === node.id && item.sectionId === section.id);
    if (modified) {
      if (selectNode(selection, e, rootLeaf)) return;
    } else if (preserveMulti) setSel(selection);
    else selectNode(selection);
    const ancestors = cmsAncestors(section, node.id);
    if (node.locked || ancestors.some((parent) => parent.locked)) return;
      const parentNode = parentId ? findCmsParentNode(section, node.id) : undefined;
      if ((isCmsStructuralNode(node) || (parentId && !isCmsGroup(parentNode))) && device !== "desktop") { show("Les structures et les feuilles en flux s’éditent sur Desktop uniquement."); return; }
    setEditingText(null);
    const effectiveNode = !isCmsStructuralNode(node) && (!parentId || isCmsGroup(parentNode)) ? getCmsElementForBreakpoint(node, device) : node;
    const members = preserveMulti ? multiSel.flatMap((item) => {
      const candidate = findCmsNode(section, item.elId);
      return candidate && !isCmsStructuralNode(candidate) ? [{ id: candidate.id, frame: resolveCmsElementFrame(candidate, device) }] : [];
    }) : undefined;
    if (preserveMulti && activeMultiElements.some((element) => element.locked)) { show("Déverrouillez tous les éléments sélectionnés avant leur déplacement commun."); return; }
    dragRef.current = { mode, dir, start: { x: e.clientX, y: e.clientY }, node: effectiveNode, parentId, section, moved: false, originalPage: pageRef.current, members };
  };

  // --- Raccourcis clavier ---
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if ((e.key === "Delete" || e.key === "Backspace") && (activeMulti.length > 1 || sel)) {
        e.preventDefault();
        if (activeMulti.length > 1) removeMulti();
        else if (sel?.elId === SECTION_SELECTION_ID) removeSection(sel.sectionId);
        else if (sel) removeEl(sel.sectionId, sel.elId);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (activeMulti.length > 1) duplicateMulti();
        else if (sel?.elId === SECTION_SELECTION_ID) duplicateSection(sel.sectionId);
        else if (sel) duplicateEl(sel.sectionId, sel.elId);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") copyEl();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") pasteEl();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, page, clipboard, multiSel]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.code === "Space" && target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA" && !target?.isContentEditable) {
        event.preventDefault();
        setSpacePressed(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const publish = async (pub: boolean) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const publishingRevision = editRevision.current;
    const publishingPage = page;
    setSaving(true);
    try {
      const d = await api({ action: "update", name, slug, data: publishingPage, publish: pub, saveVersion: pub ? "Publication" : undefined });
      if (d.error || d.ok === false) throw new Error(d.error ?? "Publication impossible.");
      setStatus(pub ? "published" : "draft");
      if (pub) setPublishedSnapshot(JSON.stringify(publishingPage));
      setDirty(editRevision.current !== publishingRevision);
      show(pub ? "Page publiée ✓" : "Retirée de la publication.");
      await loadVersionsNow();
    } catch (error) {
      show(error instanceof Error ? error.message : "Échec de la publication.");
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
  const vpw = CMS_BREAKPOINT_WIDTH[device];
  const deviceScale = Math.min(1, vpw / PAGE_WIDTH);
  const canvasScale = deviceScale * zoom / 100;
  const gridStep = 20 * PAGE_WIDTH / vpw;
  const setZoomToFit = () => {
    const availableWidth = stageRef.current?.clientWidth ?? PAGE_WIDTH;
    setZoom(canvasFitZoom(availableWidth, PAGE_WIDTH, deviceScale));
  };
  const alignSelected = (alignment: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => {
    if (!sel || !selSection || selReadOnly || selParent) return;
    if (selEl) {
      const currentFrame = resolveCmsElementFrame(selEl, device);
      const aligned = alignFrame(currentFrame, alignment, PAGE_WIDTH, selSection.h);
      setElAtDevice(selSection.id, selEl.id, toCmsBreakpointFramePatch({ x: aligned.x, y: aligned.y }, device));
      return;
    }
    if (selNode && !isCmsColumn(selNode) && isCmsStructuralNode(selNode)) {
      const aligned = alignFrame({ x: selNode.x, y: selNode.y, w: selNode.w, h: selNode.h }, alignment, PAGE_WIDTH, selSection.h);
      setStructure(selSection.id, selNode.id, { x: aligned.x, y: aligned.y });
    }
  };
  const editorLibrary = initialSlug === "boutique"
    ? LIBRARY.filter((item) => item.type !== "product" && item.type !== "productGrid" && !(item.type === "text" && item.def.content?.variant === "link"))
    : LIBRARY;
  const libraryEntriesByCategory = editorLibrary.reduce<Record<string, EditorLibraryEntry[]>>((acc, item) => {
    (acc[item.category] ??= []).push({ kind: "element", item });
    return acc;
  }, {});
  if (!PHASE3B_DISABLED_SLUGS.has(initialSlug)) {
    libraryEntriesByCategory.Structure = [
      ...PHASE3B_LIBRARY_ENTRIES,
      ...(libraryEntriesByCategory.Structure ?? []),
    ];
  }
  const editorLibraryGroups = Object.entries(libraryEntriesByCategory)
    .sort(([left], [right]) => LIBRARY_CATEGORY_ORDER.indexOf(left) - LIBRARY_CATEGORY_ORDER.indexOf(right));
  const isConnectedContentPage = ["faq", "boutique", "comment-ca-marche", "livraison"].includes(initialSlug);

  const addEditorialTextBlock = (sectionId: string) => {
    const section = page.sections.find((item) => item.id === sectionId);
    if (!section) return;
    const existing = section.elements.filter((element): element is CmsElement => !isCmsStructuralNode(element) && Number.isFinite(element.y) && Number.isFinite(element.h) && Number.isFinite(element.z));
    const y = Math.max(120, ...existing.map((element) => element.y + element.h + 16));
    const block: CmsElement = {
      id: createCmsIdFactory(pageRef.current)(), type: "text", x: 40, y, w: 1120, h: 96,
      z: Math.max(0, ...existing.map((element) => element.z)) + 1, rotation: 0, opacity: 1,
      content: { role: "editorialBlock", text: "Nouveau texte", variant: "p" },
      style: { fontFamily: "sans", size: 16, weight: 400, color: "#9a98a8", align: "left", lineHeight: 1.6 },
    };
    update((current) => ({
      sections: current.sections.map((item) => item.id === sectionId
        ? { ...item, h: Math.max(item.h, y + block.h + 24), elements: [...item.elements, block] }
        : item),
    }));
    show("Bloc texte ajouté au brouillon.");
  };

  const moveEditorialTextBlock = (sectionId: string, elementId: string, direction: -1 | 1) => {
    update((current) => ({
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const index = section.elements.findIndex((element) => !isCmsStructuralNode(element) && element.id === elementId && element.content?.role === "editorialBlock");
        const blockIndexes = section.elements.flatMap((element, i) => !isCmsStructuralNode(element) && element.content?.role === "editorialBlock" ? [i] : []);
        const blockPosition = blockIndexes.indexOf(index);
        const targetIndex = blockIndexes[blockPosition + direction];
        if (index < 0 || targetIndex === undefined) return section;
        const elements = [...section.elements];
        [elements[index], elements[targetIndex]] = [elements[targetIndex], elements[index]];
        if (initialSlug === "boutique") {
          const baseY = Math.max(0, ...elements.filter((element) => !isCmsStructuralNode(element) && element.content?.role !== "editorialBlock" && Number.isFinite(element.y) && Number.isFinite(element.h)).map((element) => element.y + element.h + 16));
          let nextY = baseY;
          for (const element of elements) {
            if (!isCmsStructuralNode(element) && element.content?.role === "editorialBlock") {
              element.y = nextY;
              nextY += element.h + 16;
            }
          }
          return { ...section, h: Math.max(section.h, nextY + 16), elements };
        }
        return { ...section, elements };
      }),
    }));
  };

  const moveFaqItem = (sectionId: string, element: CmsElement, itemIndex: number, direction: -1 | 1) => {
    const items = Array.isArray(element.content.items) ? [...element.content.items] : [];
    const target = itemIndex + direction;
    if (target < 0 || target >= items.length) return;
    [items[itemIndex], items[target]] = [items[target], items[itemIndex]];
    setEl(sectionId, element.id, { content: { ...element.content, items } });
  };

  const restoreVersion = async (versionId: number) => {
    if (saving) return;
    if (dirty && !window.confirm("Restaurer cette version remplacera les modifications non enregistrées du brouillon. Continuer ?")) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    try {
      const result = await api({ action: "restore", versionId });
      if (!result.ok || !result.data) throw new Error(result.error ?? "Restauration impossible.");
      editRevision.current += 1;
      pageRef.current = result.data as CmsPage;
      setPage(result.data as CmsPage);
      pushHistory(result.data as CmsPage);
      setDirty(false);
      show("Version restaurée dans le brouillon. Publiez-la pour la mettre en ligne.");
    } catch (error) {
      show(error instanceof Error ? error.message : "Restauration impossible.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const pending = pendingDelete;
    update((current) => ({
      sections: current.sections.map((section) => {
        if (section?.id !== pending.sectionId) return section;
        if (pending.kind === "element") {
          return { ...section, elements: section.elements.filter((element) => element?.id !== pending.elementId) };
        }
        return {
          ...section,
          elements: section.elements.map((element) => !isCmsStructuralNode(element) && element.id === pending.elementId
            ? { ...element, content: { ...element.content, items: Array.isArray(element.content.items) ? element.content.items.filter((_: unknown, index: number) => index !== pending.itemIndex) : [] } }
            : element),
        };
      }),
    }));
    if (pending.kind === "element") setSel(null);
    setPendingDelete(null);
  };

  if (isConnectedContentPage) {
    const sectionLabel = (index: number) => {
      if (initialSlug === "boutique") return index === 0 ? "Éditorial avant les produits" : `Éditorial après les produits · ${index}`;
      if (initialSlug === "comment-ca-marche") return index === 0 ? "Introduction" : index <= 4 ? `Étape ${String(index).padStart(2, "0")}` : index === 5 ? "Chaîne technique" : "Appel à l’action";
      if (initialSlug === "livraison") return index === 0 ? "Informations et livraison" : `Contenu juridique · ${index + 1}`;
      return "Questions fréquentes";
    };
    const statusText = status === "published" ? (dirty || hasUnpublishedChanges ? "Publiée · brouillon modifié" : "Publiée") : "Brouillon";
    const editableSections = Array.isArray(page?.sections)
      ? page.sections.filter((section): section is CmsSection => !!section && typeof section === "object" && typeof section.id === "string" && Array.isArray(section.elements))
      : [];

    return (
      <div className="flex h-screen flex-col bg-night text-ink">
        <header className="shrink-0 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
            <Link href="/admin/editeur" className="rounded-full border border-line px-3 py-2 text-xs text-muted hover:text-ink">← Éditeur du site</Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-medium text-ink">{name}</h1>
              <p className="text-xs text-faint">/{slug} · {statusText}{dirty ? " · modifications à enregistrer" : ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={undo} disabled={histIdx <= 0} className="rounded-full border border-line px-3 py-2 text-xs text-muted disabled:opacity-40" aria-label="Annuler la dernière modification">Annuler</button>
              <button onClick={redo} disabled={histIdx >= history.length - 1} className="rounded-full border border-line px-3 py-2 text-xs text-muted disabled:opacity-40" aria-label="Rétablir la modification">Rétablir</button>
              <button onClick={() => setShowVersions((visible) => !visible)} className="rounded-full border border-line px-3 py-2 text-xs text-muted hover:text-ink">Versions ({versions.length})</button>
              <button onClick={previewDraft} disabled={saving} className="rounded-full border border-line px-3 py-2 text-xs text-muted disabled:opacity-50">Aperçu du brouillon</button>
              <button onClick={() => void doSave()} disabled={saving} className="rounded-full border border-gold px-4 py-2 text-xs font-medium text-gold disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer le brouillon"}</button>
              <button onClick={() => void publish(true)} disabled={saving} className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-night disabled:opacity-50">Publier</button>
              {status === "published" && <button onClick={() => void publish(false)} disabled={saving} className="rounded-full border border-line px-3 py-2 text-xs text-muted disabled:opacity-50">Dépublier</button>}
            </div>
          </div>
          {(toast || saving) && <div className="mx-auto mt-2 max-w-5xl" aria-live="polite">{toast && <p className="text-xs text-goldsoft">{toast}</p>}{saving && <p className="text-xs text-muted">Enregistrement en cours…</p>}</div>}
        </header>

        {showVersions && (
          <section className="shrink-0 border-b border-line bg-surface/70 px-4 py-3 sm:px-6" aria-label="Historique des versions">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
              <span className="mr-2 text-xs text-muted">Versions enregistrées — restauration dans le brouillon :</span>
              {versions.length ? versions.map((version) => (
                <button key={version.id} onClick={() => void restoreVersion(version.id)} disabled={saving} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:border-gold hover:text-ink disabled:opacity-50">
                  Restaurer · {version.label} · {new Date(version.createdAt).toLocaleString("fr-FR")}
                </button>
              )) : <span className="text-xs text-faint">Aucune version enregistrée.</span>}
            </div>
          </section>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <fieldset disabled={saving} className="mx-auto min-w-0 max-w-5xl space-y-5 border-0 p-0">
            <div className="rounded-xl border border-line bg-surface/50 p-4 sm:p-5">
              <p className="text-sm font-medium text-ink">Contenu éditorial</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">Modifiez les textes structurés ci-dessous. Les changements restent en brouillon jusqu’à publication. Les produits de la boutique, lorsqu’ils existent, restent gérés par le catalogue dynamique.</p>
            </div>
            {editableSections.map((section, sectionIndex) => (
              <section key={section.id} className="rounded-2xl border border-line bg-surface/40 p-4 sm:p-6" aria-label={sectionLabel(sectionIndex)}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-medium text-goldsoft">{sectionLabel(sectionIndex)}</h2>
                  <button onClick={() => addEditorialTextBlock(section.id)} className="rounded-full border border-gold/50 px-3 py-2 text-xs text-gold hover:bg-gold/10">+ Ajouter un bloc texte</button>
                </div>
                <div className="space-y-4">
                  {section.elements.filter((element): element is CmsElement => !!element && typeof element === "object" && typeof element.id === "string").map((element) => (
                    <article key={element.id} className="rounded-xl border border-line bg-night/70 p-4">
                      {element.type === "faq" ? (
                        <div className="space-y-4">
                          <p className="text-xs font-medium tracking-wide text-muted">FAQ · titre, introduction, questions et réponses</p>
                          <label className="block text-xs text-muted">Sur-titre
                            <input className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink" value={String(element.content.eyebrow ?? "")} onChange={(event) => setEl(section.id, element.id, { content: { ...element.content, eyebrow: event.target.value } })} />
                          </label>
                          <label className="block text-xs text-muted">Titre principal
                            <input className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink" value={String(element.content.title ?? "")} onChange={(event) => setEl(section.id, element.id, { content: { ...element.content, title: event.target.value } })} />
                          </label>
                          <label className="block text-xs text-muted">Introduction (facultative)
                            <textarea rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink" value={String(element.content.intro ?? "")} onChange={(event) => setEl(section.id, element.id, { content: { ...element.content, intro: event.target.value } })} />
                          </label>
                          <div className="space-y-3">
                            <h3 className="text-xs font-medium text-ink">Questions et réponses</h3>
                            {(Array.isArray(element.content.items) ? element.content.items : []).map((item: any, itemIndex: number) => (
                              <div key={`${element.id}-faq-${itemIndex}`} className="rounded-lg border border-line bg-surface/50 p-3 sm:p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-muted">Question {itemIndex + 1}</span>
                                  <div className="flex gap-2">
                                    <button onClick={() => moveFaqItem(section.id, element, itemIndex, -1)} disabled={itemIndex === 0} className="rounded border border-line px-2.5 py-1 text-xs text-muted disabled:opacity-40" aria-label={`Monter la question ${itemIndex + 1}`}>Monter ↑</button>
                                    <button onClick={() => moveFaqItem(section.id, element, itemIndex, 1)} disabled={itemIndex === element.content.items.length - 1} className="rounded border border-line px-2.5 py-1 text-xs text-muted disabled:opacity-40" aria-label={`Descendre la question ${itemIndex + 1}`}>Descendre ↓</button>
                                    <button onClick={() => setPendingDelete({ sectionId: section.id, elementId: element.id, kind: "faqItem", itemIndex })} className="rounded border border-danger/40 px-2.5 py-1 text-xs text-danger">Supprimer</button>
                                  </div>
                                </div>
                                <label className="block text-xs text-muted">Question
                                  <textarea rows={2} className="mt-1.5 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink" value={String(item?.question ?? "")} onChange={(event) => { const items = [...element.content.items]; items[itemIndex] = { ...item, question: event.target.value }; setEl(section.id, element.id, { content: { ...element.content, items } }); }} />
                                </label>
                                <label className="mt-3 block text-xs text-muted">Réponse
                                  <textarea rows={4} className="mt-1.5 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink" value={String(item?.answer ?? "")} onChange={(event) => { const items = [...element.content.items]; items[itemIndex] = { ...item, answer: event.target.value }; setEl(section.id, element.id, { content: { ...element.content, items } }); }} />
                                </label>
                              </div>
                            ))}
                            <button onClick={() => setEl(section.id, element.id, { content: { ...element.content, items: [...(Array.isArray(element.content.items) ? element.content.items : []), { question: "Nouvelle question", answer: "Nouvelle réponse" }] } })} className="rounded-full border border-line px-3 py-2 text-xs text-muted hover:border-gold hover:text-ink">+ Ajouter une question</button>
                          </div>
                          <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                            <label className="block text-xs text-muted">Titre du contact
                              <input className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink" value={String(element.content.contactTitle ?? "")} onChange={(event) => setEl(section.id, element.id, { content: { ...element.content, contactTitle: event.target.value } })} />
                            </label>
                            <label className="block text-xs text-muted">Texte du contact
                              <input className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink" value={String(element.content.contactText ?? "")} onChange={(event) => setEl(section.id, element.id, { content: { ...element.content, contactText: event.target.value } })} />
                            </label>
                            <label className="block text-xs text-muted">Libellé du lien
                              <input className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink" value={String(element.content.contactLabel ?? "")} onChange={(event) => setEl(section.id, element.id, { content: { ...element.content, contactLabel: event.target.value } })} />
                            </label>
                            <label className="block text-xs text-muted">URL du lien
                              <input className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink" value={String(element.content.contactHref ?? "")} onChange={(event) => setEl(section.id, element.id, { content: { ...element.content, contactHref: event.target.value } })} />
                            </label>
                          </div>
                        </div>
                      ) : element.type === "text" ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium text-muted">{element.content.role === "editorialBlock" ? "Bloc texte" : element.content.variant === "h1" || element.content.variant === "h2" || element.content.variant === "h3" ? `Titre · ${element.content.variant.toUpperCase()}` : element.content.variant === "link" ? "Lien" : "Texte · paragraphe"}</p>
                            <div className="flex gap-2">
                              {element.content.role === "editorialBlock" && <>
                                <button onClick={() => moveEditorialTextBlock(section.id, element.id, -1)} disabled={!section.elements.slice(0, section.elements.findIndex((candidate) => candidate.id === element.id)).some((candidate) => !isCmsStructuralNode(candidate) && candidate.content?.role === "editorialBlock")} className="rounded border border-line px-2.5 py-1 text-xs text-muted disabled:opacity-40">Monter ↑</button>
                                <button onClick={() => moveEditorialTextBlock(section.id, element.id, 1)} disabled={!section.elements.slice(section.elements.findIndex((candidate) => candidate.id === element.id) + 1).some((candidate) => !isCmsStructuralNode(candidate) && candidate.content?.role === "editorialBlock")} className="rounded border border-line px-2.5 py-1 text-xs text-muted disabled:opacity-40">Descendre ↓</button>
                              </>}
                              <button onClick={() => setPendingDelete({ sectionId: section.id, elementId: element.id, kind: "element" })} className="rounded border border-danger/40 px-2.5 py-1 text-xs text-danger">Supprimer</button>
                            </div>
                          </div>
                          <label className="block text-xs text-muted">Texte
                            <textarea rows={element.content.variant === "h1" || element.content.variant === "h2" ? 2 : 4} className="mt-1.5 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink" value={String(element.content.text ?? "")} onChange={(event) => setEl(section.id, element.id, { content: { ...element.content, text: event.target.value } })} />
                          </label>
                          {element.content.variant === "link" && <label className="block text-xs text-muted">URL du lien
                            <input className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink" value={String(element.link ?? "")} onChange={(event) => setEl(section.id, element.id, { link: event.target.value })} />
                          </label>}
                        </div>
                      ) : element.type === "button" ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-xs text-muted">Libellé du bouton
                            <input className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink" value={String(element.content.text ?? "")} onChange={(event) => setEl(section.id, element.id, { content: { ...element.content, text: event.target.value } })} />
                          </label>
                          <label className="block text-xs text-muted">URL du bouton
                            <input className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink" value={String(element.content.href ?? "")} onChange={(event) => setEl(section.id, element.id, { content: { ...element.content, href: event.target.value } })} />
                          </label>
                          <div className="sm:col-span-2"><button onClick={() => setPendingDelete({ sectionId: section.id, elementId: element.id, kind: "element" })} className="rounded border border-danger/40 px-2.5 py-1 text-xs text-danger">Supprimer ce bouton</button></div>
                        </div>
                      ) : (
                        <p className="text-xs leading-relaxed text-faint">Élément « {element.type} » conservé tel quel. Son édition visuelle n’est pas comprise dans cette phase.</p>
                      )}
                    </article>
                  ))}
                  {section.elements.length === 0 && <p className="rounded-lg border border-dashed border-line p-4 text-xs text-faint">Aucun contenu dans cette section.</p>}
                </div>
              </section>
            ))}
            {!editableSections.length && <p role="alert" className="rounded-xl border border-danger/30 p-4 text-sm text-danger">Le brouillon ne contient aucune section exploitable. Le contenu public actuel reste conservé tant qu’une version valide n’est pas publiée.</p>}
          </fieldset>
        </main>
        {pendingDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
            <div role="alertdialog" aria-modal="true" aria-labelledby="cms-delete-title" aria-describedby="cms-delete-description" className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6">
              <h2 id="cms-delete-title" className="text-base font-medium text-ink">{pendingDelete.kind === "faqItem" ? "Supprimer cette question ?" : "Supprimer cet élément ?"}</h2>
              <p id="cms-delete-description" className="mt-2 text-sm leading-relaxed text-muted">{pendingDelete.kind === "faqItem" ? "La question et sa réponse seront retirées du brouillon." : "Cet élément sera retiré du brouillon."}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setPendingDelete(null)} className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-ink">Annuler</button>
                <button onClick={confirmDelete} className="rounded-full bg-danger px-4 py-2 text-sm font-medium text-white hover:brightness-110">Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
          {initialSlug === "faq" || initialSlug === "boutique" || initialSlug === "comment-ca-marche" || initialSlug === "livraison" ? "/" : "/p/"}
          <input
            value={slug}
            readOnly={initialSlug === "faq" || initialSlug === "boutique" || initialSlug === "comment-ca-marche" || initialSlug === "livraison"}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            className="w-36 rounded-lg border border-line bg-night px-3 py-1.5 text-xs focus:border-gold read-only:opacity-70"
            aria-label="URL de la page"
          />
        </label>
        <div className="ml-1 flex rounded-full border border-line p-0.5">
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button key={d} type="button" aria-pressed={device === d} title={`Aperçu ${d === "desktop" ? "Desktop" : d === "tablet" ? "Tablette" : "Mobile"} · ${CMS_BREAKPOINT_WIDTH[d]} px`} onClick={() => setDevice(d)} className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${device === d ? "bg-gold text-night" : "text-muted"}`}>
              {d === "desktop" ? "Desktop" : d === "tablet" ? "Tablette" : "Mobile"}
            </button>
          ))}
        </div>
        <span className="rounded bg-raised px-2 py-1 text-[10px] text-goldsoft" aria-live="polite">Mode actif · {device === "desktop" ? "Desktop" : device === "tablet" ? "Tablette" : "Mobile"} · {vpw} px</span>
        <div className="flex flex-wrap items-center gap-1 border-l border-line pl-2" aria-label="Outils du canvas">
          <ToolBtn onClick={() => { setSpacePressed(false); panRef.current = null; }} title="Mode Sélection actif">Sélection</ToolBtn>
          <ToolBtn onClick={() => setShowGrid((value) => !value)} title="Afficher ou masquer la grille">Grille {showGrid ? "✓" : "—"}</ToolBtn>
          <ToolBtn onClick={() => setSnapEnabled((value) => !value)} title="Activer ou désactiver l’aimantation">Snap {snapEnabled ? "✓" : "—"}</ToolBtn>
          <ToolBtn onClick={() => setZoom((value) => Math.max(25, value - 25))} title="Zoom arrière">Zoom −</ToolBtn>
          <label className="flex items-center gap-1 text-xs text-muted" title="Niveau de zoom du canvas">
            <select aria-label="Niveau de zoom" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="rounded border border-line bg-night px-1.5 py-1 text-xs text-ink">
              {[25, 50, 75, 100, 125, 150].map((value) => <option key={value} value={value}>{value} %</option>)}
            </select>
          </label>
          <ToolBtn onClick={() => setZoom((value) => Math.min(150, value + 25))} title="Zoom avant">Zoom +</ToolBtn>
          <ToolBtn onClick={() => setZoom(100)} title="Rétablir le zoom à 100 %">100 %</ToolBtn>
          <ToolBtn onClick={setZoomToFit} title="Ajuster le canvas à l’espace visible">Ajuster</ToolBtn>
        </div>
        {selSection && !selParent && (selEl || selRow || selGroup || selContainer) && (
          <div className="flex flex-wrap items-center gap-1 border-l border-line pl-2" aria-label="Alignement de l’élément sélectionné">
            <ToolBtn onClick={() => alignSelected("left")} disabled={selReadOnly} title="Aligner à gauche du canvas">Gauche</ToolBtn>
            <ToolBtn onClick={() => alignSelected("centerX")} disabled={selReadOnly} title="Centrer horizontalement">Centre H</ToolBtn>
            <ToolBtn onClick={() => alignSelected("right")} disabled={selReadOnly} title="Aligner à droite du canvas">Droite</ToolBtn>
            <ToolBtn onClick={() => alignSelected("top")} disabled={selReadOnly} title="Aligner en haut de la section">Haut</ToolBtn>
            <ToolBtn onClick={() => alignSelected("centerY")} disabled={selReadOnly} title="Centrer verticalement dans la section">Centre V</ToolBtn>
            <ToolBtn onClick={() => alignSelected("bottom")} disabled={selReadOnly} title="Aligner en bas de la section">Bas</ToolBtn>
          </div>
        )}
        <div className="flex items-center gap-1">
          <ToolBtn onClick={undo} disabled={histIdx <= 0} title="Annuler (Ctrl+Z)">Annuler</ToolBtn>
          <ToolBtn onClick={redo} disabled={histIdx >= history.length - 1} title="Rétablir (Ctrl+Maj+Z)">Rétablir</ToolBtn>
          <ToolBtn onClick={() => sel && (selIsSection ? duplicateSection(sel.sectionId) : duplicateEl(sel.sectionId, sel.elId))} disabled={!sel || (!selIsSection && selReadOnly)} title="Dupliquer (Ctrl+D)">⧉</ToolBtn>
          <ToolBtn onClick={copyEl} disabled={!selEl || selReadOnly} title="Copier (Ctrl+C)">⎘</ToolBtn>
          <ToolBtn onClick={pasteEl} disabled={!clipboard} title="Coller (Ctrl+V)">📋</ToolBtn>
          <ToolBtn onClick={() => sel && !selIsSection && zEl(sel.sectionId, sel.elId, "front")} disabled={!sel || selIsSection || selReadOnly} title="Mettre au premier plan">⇈</ToolBtn>
          <ToolBtn onClick={() => sel && !selIsSection && zEl(sel.sectionId, sel.elId, "forward")} disabled={!sel || selIsSection || selReadOnly} title="Avancer d’un niveau">↑</ToolBtn>
          <ToolBtn onClick={() => sel && !selIsSection && zEl(sel.sectionId, sel.elId, "backward")} disabled={!sel || selIsSection || selReadOnly} title="Reculer d’un niveau">↓</ToolBtn>
          <ToolBtn onClick={() => sel && !selIsSection && zEl(sel.sectionId, sel.elId, "back")} disabled={!sel || selIsSection || selReadOnly} title="Mettre à l’arrière-plan">⇊</ToolBtn>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowVersions((v) => !v)} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">
            Historique ({versions.length})
          </button>
          {toast && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs text-goldsoft">{toast}</span>}
          <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${status === "published" ? "bg-gold/15 text-gold" : "bg-raised text-faint"}`}>
            {status === "published" ? "Publiée" : "Brouillon"}{dirty ? " •" : ""}
          </span>
          <Link href={slug === "faq" || slug === "boutique" || slug === "comment-ca-marche" || slug === "livraison" ? `/${slug}` : `/p/${slug}`} target="_blank" className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">
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
              onClick={() => void restoreVersion(v.id)}
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
          {(() => {
            const hintSectionId = selSection?.id ?? page.sections[page.sections.length - 1]?.id;
            const hintSection = hintSectionId ? page.sections.find((candidate) => candidate.id === hintSectionId) : undefined;
            const hintTarget = hintSection ? resolveCmsAddTarget(hintSection, sel?.sectionId === hintSectionId ? sel.elId : null) : null;
            return hintTarget ? (
              <p data-cms-add-target="true" className="mb-2 rounded-lg border border-line bg-surface/60 px-2.5 py-1.5 text-[11px] text-muted">
                Ajout dans <span className="text-goldsoft">{describeCmsTarget(hintSection!, hintTarget)}</span>
                {hintTarget.kind === "column" && (
                  <span className="ml-1 text-faint">— sélectionnez la colonne pour changer de cible</span>
                )}
              </p>
            ) : null;
          })()}
          {editorLibraryGroups.map(([cat, items]) => (
            <div key={cat} className="mb-3">
              <p className="mb-1.5 text-[10px] tracking-[0.16em] text-gold uppercase">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((entry, index) => {
                  if (entry.kind === "element") {
                    const item = entry.item;
                    return (
                      <button
                        key={`${cat}-element-${item.label}-${index}`}
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData("text/cl-element", String(LIBRARY.indexOf(item)))}
                        onClick={() => addElement(item)}
                        className="w-full rounded-lg border border-line bg-night px-2.5 py-2 text-left text-[11px] text-muted transition-colors hover:border-gold hover:text-ink"
                        title={item.description ?? "Cliquer pour ajouter, ou glisser dans une section"}
                      >
                        <span className="block font-medium">{item.label}</span>
                        {item.description && <span className="mt-0.5 block text-[10px] leading-snug text-faint">{item.description}</span>}
                      </button>
                    );
                  }
                  if (entry.kind === "row") {
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => addRow(entry.preset)}
                        disabled={device !== "desktop"}
                        className="w-full rounded-lg border border-gold/40 bg-night px-2.5 py-2 text-left text-[11px] text-ink hover:border-gold disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {entry.label}
                      </button>
                    );
                  }
                  if (entry.kind === "group") {
                    return (
                      <button
                        key="phase3b-group"
                        type="button"
                        onClick={groupSelection}
                        disabled={activeMulti.length < 2 || device !== "desktop"}
                        aria-label="Grouper les feuilles sélectionnées"
                        title="Sélectionnez au moins deux feuilles racines sœurs avec Ctrl/Cmd + clic."
                        className="w-full rounded-lg border border-gold/40 bg-night px-2.5 py-2 text-left text-[11px] text-ink hover:border-gold disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Groupe{activeMulti.length > 1 ? ` · ${activeMulti.length} sélectionnées` : ""}
                      </button>
                    );
                  }
                  return (
                    <button
                      key="phase3a-container"
                      type="button"
                      onClick={() => addContainer()}
                      disabled={device !== "desktop"}
                      title="Ajouter un conteneur libre à la section"
                      className="w-full rounded-lg border border-line bg-night px-2.5 py-2 text-left text-[11px] text-muted hover:border-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      ▣ Conteneur libre · Phase 3A
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={addSection} className="mt-2 w-full rounded-lg border border-dashed border-line py-2 text-xs text-muted hover:border-gold hover:text-ink">
            + Ajouter une section
          </button>
        </aside>

        {/* Canvas */}
        <div
          ref={stageRef}
          className={`min-w-0 flex-1 overflow-auto bg-night/60 p-4 ${spacePressed ? "cursor-grab" : ""}`}
          onMouseDown={(event) => {
            if (event.button === 1 || spacePressed) {
              event.preventDefault();
              panRef.current = { startX: event.clientX, startY: event.clientY, scrollLeft: stageRef.current?.scrollLeft ?? 0, scrollTop: stageRef.current?.scrollTop ?? 0 };
            }
          }}
          onMouseUp={() => { panRef.current = null; }}
        >
          <div className="mx-auto w-max">
            {page.sections.map((section, sectionIndex) => (
              <div key={section.id} className="group/sec relative mb-3" style={{ width: PAGE_WIDTH * canvasScale }}>
                <div className="absolute -top-7 left-0 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover/sec:opacity-100">
                  <button type="button" onClick={() => selectSection(section.id)} className={`rounded px-2 py-0.5 text-[10px] ${sel?.sectionId === section.id && selIsSection ? "bg-gold/20 text-goldsoft" : "bg-raised text-faint"}`} title="Sélectionner les propriétés de la section">{initialSlug === "boutique" ? sectionIndex === 0 ? "Éditorial avant les produits" : `Éditorial après les produits · ${sectionIndex}` : `Section ${sectionIndex + 1}`}</button>
                  <button onClick={() => moveSection(section.id, -1)} className="rounded bg-raised px-1.5 text-[11px] text-muted hover:text-ink" title="Monter">↑</button>
                  <button onClick={() => moveSection(section.id, 1)} className="rounded bg-raised px-1.5 text-[11px] text-muted hover:text-ink" title="Descendre">↓</button>
                  <button onClick={() => duplicateSection(section.id)} className="rounded bg-raised px-1.5 text-[11px] text-muted hover:text-ink" title="Dupliquer">⧉</button>
                  <button onClick={() => removeSection(section.id)} className="rounded bg-raised px-1.5 text-[11px] text-danger" title="Supprimer">×</button>
                </div>
                <div
                  ref={(node) => { if (node) sectionRefs.current.set(section.id, node); else sectionRefs.current.delete(section.id); }}
                  className="relative overflow-hidden rounded-lg border border-line"
                  style={{ width: PAGE_WIDTH * canvasScale, height: section.h * canvasScale, background: section.bg, outline: sel?.sectionId === section.id && selIsSection ? "2px solid #c9a86a" : undefined, outlineOffset: 2 }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const rawIndex = event.dataTransfer.getData("text/cl-element");
                    const itemIndex = rawIndex ? Number(rawIndex) : Number.NaN;
                    const item = Number.isInteger(itemIndex) ? LIBRARY[itemIndex] : undefined;
                    if (item) {
                      event.preventDefault();
                      // Phase 3C : la bibliotheque vise la colonne reellement
                      // selectionnee, ou la colonne survolee au moment du drop.
                      const rect = event.currentTarget.getBoundingClientRect();
                      const point = {
                        x: (event.clientX - rect.left) / canvasScale,
                        y: (event.clientY - rect.top) / canvasScale,
                      };
                      const hovered = resolveCmsColumnDropTarget(section, point);
                      const target = hovered
                        ? { kind: "column", columnId: hovered.columnId, rowId: hovered.rowId } as CmsAddTarget
                        : resolveAddTargetFor(section.id);
                      addElementToTarget(item, section.id, target);
                    }
                  }}
                >
                  <div
                    onMouseDown={(event) => { if (event.target === event.currentTarget) selectSection(section.id); }}
                    style={{
                      position: "absolute", left: 0, top: 0, width: PAGE_WIDTH, height: section.h,
                      transform: `scale(${canvasScale})`, transformOrigin: "top left",
                      backgroundImage: showGrid ? "linear-gradient(to right, rgba(201,168,106,.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(201,168,106,.16) 1px, transparent 1px)" : undefined,
                      backgroundSize: showGrid ? `${gridStep}px ${gridStep}px` : undefined,
                    }}
                  >
                    {[...section.elements].sort((a, b) => a.z - b.z).map((node) => {
                      const renderLeaf = (element: CmsElement, parentId?: string, flow = false, responsiveLocal = false) => {
                        const effectiveElement = responsiveLocal || (!parentId && !flow) ? getCmsElementForBreakpoint(element, device) : element;
                        const isSelected = sel?.sectionId === section.id && sel.elId === element.id;
                        const isMultiSelected = activeMulti.some((item) => item.sectionId === section.id && item.elId === element.id);
                        const isLocked = !!element.locked || cmsAncestors(section, element.id).some((parent) => parent.locked);
                        const frameStyle = flow ? cmsFlowLeafRenderStyle(effectiveElement) : cmsLeafRenderStyle(effectiveElement);
                        return (
                          <div key={element.id}
                            onMouseDown={(event) => flow
                              ? startColumnDrag(event, section, element, parentId!)
                              : startDrag(event, section, element, "move", undefined, parentId)}
                            onDoubleClick={() => !isLocked && element.type === "text" && setEditingText(element.id)}
                            className={`select-none ${flow ? "relative w-full" : "absolute"} ${isLocked ? "cursor-not-allowed" : flow ? "cursor-grab active:cursor-grabbing" : "cursor-move"}`}
                            style={{ ...frameStyle, outline: isSelected || isMultiSelected ? "2px solid #c9a86a" : isLocked ? "1px dashed #6d6c7d" : "1px solid transparent", outlineOffset: 2 }}>
                            {editingText === element.id ? <ContentEditableText value={(element.content?.text as string) ?? ""}
                              onChange={(value) => setEl(section.id, element.id, { content: { ...element.content, text: value } })}
                              onDone={() => setEditingText(null)} style={textStyleFor(effectiveElement)} /> : <ElementViewLazy el={effectiveElement} formSlug={initialSlug} />}
                            {isSelected && !isLocked && !flow && <>
                              {(["nw", "ne", "sw", "se"] as const).map((direction) => <span key={direction} onMouseDown={(event) => startDrag(event, section, element, "resize", direction, parentId)} className="absolute z-30 h-3 w-3 rounded-full border border-gold bg-night" style={handleStyle(direction)} aria-hidden="true" />)}
                              {(["n", "s", "e", "w"] as const).map((direction) => <span key={direction} onMouseDown={(event) => startDrag(event, section, element, "resize", direction, parentId)} className="absolute z-30 h-3 w-3 rounded-full border border-gold/60 bg-night" style={handleStyle(direction)} aria-hidden="true" />)}
                            </>}
                          </div>
                        );
                      };
                      if (!isCmsStructuralNode(node)) return renderLeaf(node);
                      const selected = sel?.sectionId === section.id && sel.elId === node.id;
                      const locked = !!node.locked || cmsAncestors(section, node.id).some((parent) => parent.locked);
                      if (isCmsRow(node)) return (
                        <div key={node.id} data-cms-node="row" onMouseDown={(event) => startDrag(event, section, node, "move")}
                          className={`absolute select-none ${locked ? "cursor-not-allowed" : "cursor-move"}`}
                          style={{ ...cmsRowRenderStyle(node), outline: selected ? "2px solid #c9a86a" : "1px dashed rgba(201,168,106,.55)", outlineOffset: 2 }}>
                          {node.children.map((column) => (
                            <div key={column.id} data-cms-node="column"
                              onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); selectNode({ sectionId: section.id, elId: column.id, parentId: node.id }, event, false); }}
                              className="relative min-w-0"
                              data-cms-column-drop={dropTarget?.sectionId === section.id && dropTarget.columnId === column.id ? "true" : undefined}
                              style={{
                                ...cmsColumnRenderStyle(column, node),
                                outline: sel?.elId === column.id ? "2px solid #c9a86a"
                                  : dropTarget?.sectionId === section.id && dropTarget.columnId === column.id ? "2px dashed #f0c674"
                                  : column.locked || locked ? "1px dashed #6d6c7d" : "1px dashed rgba(201,168,106,.2)",
                                outlineOffset: -2,
                              }}>
                              {column.children.map((child) => renderLeaf(child, column.id, true))}
                              {dropTarget?.sectionId === section.id && dropTarget.columnId === column.id && (() => {
                                const offset = resolveCmsColumnInsertionY(column, dropTarget.index);
                                return <span
                                  aria-hidden="true"
                                  data-cms-drop-indicator="true"
                                  className="pointer-events-none absolute left-0 right-0 z-40 border-t-2 border-dashed border-gold bg-gold/10"
                                  style={{ top: offset }}
                                />;
                              })()}
                            </div>
                          ))}
                          {selected && !locked && <>
                            {(["nw", "ne", "sw", "se"] as const).map((direction) => <span key={direction} onMouseDown={(event) => startDrag(event, section, node, "resize", direction)} className="absolute z-30 h-3 w-3 rounded-full border border-gold bg-night" style={handleStyle(direction)} aria-hidden="true" />)}
                            {(["n", "s", "e", "w"] as const).map((direction) => <span key={direction} onMouseDown={(event) => startDrag(event, section, node, "resize", direction)} className="absolute z-30 h-3 w-3 rounded-full border border-gold/60 bg-night" style={handleStyle(direction)} aria-hidden="true" />)}
                          </>}
                        </div>
                      );
                      const freeNode = isCmsContainer(node) || isCmsGroup(node);
                      const frameStyle = isCmsGroup(node) ? cmsGroupRenderStyle(node) : cmsContainerRenderStyle(node as CmsContainer);
                      return <div key={node.id} data-cms-node={isCmsGroup(node) ? "group" : "container"}
                        onMouseDown={(event) => startDrag(event, section, node, "move")}
                        className={`absolute select-none ${locked ? "cursor-not-allowed" : "cursor-move"}`}
                        style={{ ...frameStyle, outline: selected ? "2px solid #c9a86a" : "1px dashed rgba(201,168,106,.55)", outlineOffset: 2, overflow: "visible" }}>
                        {freeNode && [...node.children].sort((a, b) => a.z - b.z).map((child) => renderLeaf(child, node.id, false, isCmsGroup(node)))}
                        {selected && !locked && <>
                          {(["nw", "ne", "sw", "se"] as const).map((direction) => <span key={direction} onMouseDown={(event) => startDrag(event, section, node, "resize", direction)} className="absolute z-30 h-3 w-3 rounded-full border border-gold bg-night" style={handleStyle(direction)} aria-hidden="true" />)}
                          {(["n", "s", "e", "w"] as const).map((direction) => <span key={direction} onMouseDown={(event) => startDrag(event, section, node, "resize", direction)} className="absolute z-30 h-3 w-3 rounded-full border border-gold/60 bg-night" style={handleStyle(direction)} aria-hidden="true" />)}
                        </>}
                      </div>;
                    })}
                    {guideSectionId === section.id && guides.filter((guide) => guide.axis === "x").map((guide, index) => <div key={`gx-${index}`} aria-hidden="true" style={{ position: "absolute", zIndex: 9999, pointerEvents: "none", left: guide.position, top: 0, height: section.h, borderLeft: "1px dashed #f0c674" }} />)}
                    {guideSectionId === section.id && guides.filter((guide) => guide.axis === "y").map((guide, index) => <div key={`gy-${index}`} aria-hidden="true" style={{ position: "absolute", zIndex: 9999, pointerEvents: "none", top: guide.position, left: 0, width: PAGE_WIDTH, borderTop: "1px dashed #f0c674" }} />)}
                  </div>
                </div>
                {sel?.sectionId === section.id && selIsSection && <button type="button" aria-label={`Redimensionner la section ${sectionIndex + 1}`} title="Faire glisser pour redimensionner la section" onMouseDown={(event) => startSectionResize(event, section)} className="absolute bottom-[-7px] left-1/2 z-40 h-3 w-12 -translate-x-1/2 cursor-ns-resize rounded-full border border-night bg-gold shadow" />}
                {initialSlug === "boutique" && sectionIndex === 0 && (
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
          <section className="mb-4 border-b border-line pb-4" aria-label="Structure et calques">
            <p className="mb-2 text-xs tracking-[0.18em] text-gold uppercase">Structure / calques</p>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {page.sections.map((section, index) => (
                <div key={section.id}>
                  <button type="button" onClick={() => selectSection(section.id)} className={`mb-1 w-full rounded px-1 py-0.5 text-left text-[10px] ${sel?.sectionId === section.id && selIsSection ? "bg-gold/10 text-goldsoft" : "text-faint hover:text-ink"}`}>Section {index + 1} · {section.h}px</button>
                  {[...section.elements].sort((left, right) => right.z - left.z).map((node) => {
                    const selected = sel?.sectionId === section.id && sel.elId === node.id;
                    const isMultiSelected = activeMulti.some((item) => item.sectionId === section.id && item.elId === node.id);
                    const structural = isCmsStructuralNode(node);
                    const hidden = structural ? !!node.hidden || cmsAncestors(section, node.id).some((parent) => parent.hidden) : resolveCmsElementForBreakpoint(node, device).hidden || cmsAncestors(section, node.id).some((parent) => parent.hidden);
                    const locked = !!node.locked || cmsAncestors(section, node.id).some((parent) => parent.locked);
                    const label = structural ? (isCmsRow(node) ? "↔ Rangée" : isCmsColumn(node) ? "▥ Colonne" : isCmsGroup(node) ? "◇ Groupe" : "▣ Conteneur") : node.type;
                    const layerButton = (item: CmsNode, parentId?: string, multiEligible = false, indent = false) => {
                      const itemSelected = sel?.sectionId === section.id && sel.elId === item.id;
                      const itemMulti = activeMulti.some((entry) => entry.sectionId === section.id && entry.elId === item.id);
                      const itemHidden = !!item.hidden || cmsAncestors(section, item.id).some((parent) => parent.hidden);
                      const itemLocked = !!item.locked || cmsAncestors(section, item.id).some((parent) => parent.locked);
                      return <div key={item.id} className={`mb-1 flex items-center gap-1 ${indent ? "ml-3" : ""}`}>
                        <button type="button" onClick={(event) => selectNode({ sectionId: section.id, elId: item.id, parentId }, event, multiEligible)} className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-left text-[11px] ${itemSelected || itemMulti ? "border-gold bg-gold/10 text-ink" : "border-line text-muted hover:border-gold/50"}`}>
                          <span className="flex items-center justify-between gap-1"><span className="truncate">{indent ? "↳ " : ""}{isCmsStructuralNode(item) ? (isCmsRow(item) ? "Rangée" : isCmsColumn(item) ? "Colonne" : isCmsGroup(item) ? "Groupe" : "Conteneur") : item.type} · {item.id.slice(0, 5)}</span><span className="shrink-0 text-[10px]">{itemHidden ? "Masqué" : "Visible"}{itemLocked ? " · 🔒" : ""}</span></span>
                        </button>
                        {isCmsStructuralNode(item) && <>
                          <button type="button" aria-label={`${item.locked ? "Déverrouiller" : "Verrouiller"} ${label}`} title={item.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => setStructure(section.id, item.id, { locked: !item.locked })} className="rounded border border-line px-1.5 py-1 text-[10px] text-muted">{item.locked ? "🔓" : "🔒"}</button>
                          <button type="button" aria-label={`${item.hidden ? "Afficher" : "Masquer"} ${label}`} title={item.hidden ? "Afficher" : "Masquer"} onClick={() => setStructure(section.id, item.id, { hidden: !item.hidden })} className="rounded border border-line px-1.5 py-1 text-[10px] text-muted">{item.hidden ? "◉" : "◌"}</button>
                        </>}
                      </div>;
                    };
                    return <div key={node.id}>
                      {layerButton(node, undefined, !structural)}
                      {(isCmsContainer(node) || isCmsGroup(node)) && node.children.map((child) => layerButton(child, node.id, false, true))}
                      {isCmsRow(node) && node.children.map((column) => <div key={column.id} className="ml-2">
                        {layerButton(column, node.id, false, true)}
                        {column.children.map((child, childIndex) => <div key={child.id} className="flex items-center gap-1">
                          <div className="min-w-0 flex-1">{layerButton(child, column.id, false, true)}</div>
                          <button type="button" title="Monter dans la colonne" aria-label="Monter dans la colonne" disabled={childIndex === 0 || locked || column.locked} onClick={() => reorderColumnChild(section.id, node.id, column.id, child.id, -1)} className="rounded border border-line px-1 py-1 text-[10px] text-muted disabled:opacity-30">↑</button>
                          <button type="button" title="Descendre dans la colonne" aria-label="Descendre dans la colonne" disabled={childIndex === column.children.length - 1 || locked || column.locked} onClick={() => reorderColumnChild(section.id, node.id, column.id, child.id, 1)} className="rounded border border-line px-1 py-1 text-[10px] text-muted disabled:opacity-30">↓</button>
                        </div>)}
                      </div>)}
                    </div>;
                  })}
                  {section.elements.length === 0 && <p className="text-[10px] text-faint">Aucun élément</p>}
                </div>
              ))}
            </div>
          </section>
          {activeMulti.length > 1 && selSection ? (
            <div>
              <p className="mb-2 text-xs tracking-[0.18em] text-gold uppercase">Multi-sélection · {activeMultiElements.length}</p>
              <p className="mb-3 text-[11px] leading-relaxed text-muted">Sélection de feuilles racines sœurs. Déplacez un élément sélectionné pour translater l’ensemble.</p>
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => applyMultiPatch({ locked: !activeMultiElements.every((element) => element.locked) })} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">{activeMultiElements.every((element) => element.locked) ? "Déverrouiller" : "Verrouiller"}</button>
                <button type="button" onClick={() => applyMultiPatch({ hidden: !activeMultiElements.every((element) => element.hidden) })} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">{activeMultiElements.every((element) => element.hidden) ? "Afficher" : "Masquer"}</button>
                <button type="button" onClick={groupSelection} disabled={device !== "desktop"} className="rounded border border-gold px-2.5 py-1.5 text-xs text-gold disabled:opacity-40">Créer un groupe</button>
                <button type="button" onClick={duplicateMulti} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">Dupliquer</button>
                <button type="button" onClick={removeMulti} className="rounded border border-danger/40 px-2.5 py-1.5 text-xs text-danger">Supprimer</button>
              </div>
              <button type="button" onClick={() => { setMultiSel([]); setSel(null); }} className="text-xs text-faint hover:text-ink">Effacer la sélection</button>
            </div>
          ) : sel && selSection && (selContainer || selRow || selGroup || selColumn) && device !== "desktop" ? (
            <p className="rounded-lg border border-line p-3 text-xs text-muted">Les structures de la Phase 3B sont éditables sur Desktop uniquement. L’aperçu responsive des feuilles historiques reste inchangé.</p>
          ) : sel && selRow && selSection ? (
            <div>
              <p className="mb-2 text-xs tracking-[0.18em] text-gold uppercase">Rangée horizontale</p>
              <p className="mb-3 text-[11px] leading-relaxed text-muted">Les colonnes s’écoulent horizontalement ; leurs largeurs sont des pourcentages de la largeur disponible après le gap.</p>
              <Field label="X (px)"><NumInput v={selRow.x} onChange={(v) => setStructure(selSection.id, selRow.id, { x: v })} /></Field>
              <Field label="Y (px)"><NumInput v={selRow.y} onChange={(v) => setStructure(selSection.id, selRow.id, { y: v })} /></Field>
              <Field label="Largeur (px)"><NumInput v={selRow.w} min={MIN_SIZE} onChange={(v) => setStructure(selSection.id, selRow.id, { w: Math.max(MIN_SIZE, v) })} /></Field>
              <Field label="Hauteur (px)"><NumInput v={selRow.h} min={MIN_SIZE} onChange={(v) => setStructure(selSection.id, selRow.id, { h: Math.max(MIN_SIZE, v) })} /></Field>
              <Field label="Gap entre colonnes (px)"><NumInput v={selRow.gap} min={0} max={128} onChange={(v) => setStructure(selSection.id, selRow.id, { gap: Math.min(128, Math.max(0, v)) })} /></Field>
              <Field label="Alignement horizontal"><select className={inputCls} value={selRow.alignX} onChange={(event) => setStructure(selSection.id, selRow.id, { alignX: event.target.value as CmsRow["alignX"] })}><option value="start">Gauche</option><option value="center">Centre</option><option value="end">Droite</option><option value="between">Espace entre</option></select></Field>
              <Field label="Alignement vertical"><select className={inputCls} value={selRow.alignY} onChange={(event) => setStructure(selSection.id, selRow.id, { alignY: event.target.value as CmsRow["alignY"] })}><option value="start">Haut</option><option value="center">Centre</option><option value="end">Bas</option></select></Field>
              <Field label="Opacité (%)"><NumInput v={selRow.opacity * 100} min={0} max={100} onChange={(v) => setStructure(selSection.id, selRow.id, { opacity: Math.min(1, Math.max(0, v / 100)) })} /></Field>
              <div className="my-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setStructure(selSection.id, selRow.id, { locked: !selRow.locked })} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">{selRow.locked ? "Déverrouiller" : "Verrouiller"}</button>
                <button type="button" onClick={() => setStructure(selSection.id, selRow.id, { hidden: !selRow.hidden })} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">{selRow.hidden ? "Afficher" : "Masquer"}</button>
                <button type="button" onClick={() => duplicateEl(selSection.id, selRow.id)} disabled={selReadOnly} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted disabled:opacity-40">Dupliquer</button>
                <button type="button" onClick={() => removeEl(selSection.id, selRow.id)} disabled={selReadOnly} className="rounded border border-danger/40 px-2.5 py-1.5 text-xs text-danger disabled:opacity-40">Supprimer</button>
              </div>
              <p className="mb-1.5 mt-3 text-[10px] tracking-[0.2em] text-faint uppercase">Responsive</p>
              <Field label="Empiler sur tablette">
                <select className={inputCls} value={selRow.responsive?.tablet?.stack === true ? "1" : "0"} onChange={(event) => setStructureResponsive(selSection.id, selRow.id, "tablet", { stack: event.target.value === "1" })}><option value="0">Non</option><option value="1">Oui</option></select>
              </Field>
              <Field label="Empiler sur mobile">
                <select className={inputCls} value={selRow.responsive?.mobile?.stack === true ? "1" : "0"} onChange={(event) => setStructureResponsive(selSection.id, selRow.id, "mobile", { stack: event.target.value === "1" })}><option value="0">Non (horizontale)</option><option value="1">Oui (colonnes empilées)</option></select>
              </Field>
              <Field label="Gap tablette (px)"><NumInput v={selRow.responsive?.tablet?.gap ?? selRow.gap} min={0} max={128} onChange={(v) => setStructureResponsive(selSection.id, selRow.id, "tablet", { gap: Math.min(128, Math.max(0, v)) })} /></Field>
              <Field label="Gap mobile (px)"><NumInput v={selRow.responsive?.mobile?.gap ?? selRow.gap} min={0} max={128} onChange={(v) => setStructureResponsive(selSection.id, selRow.id, "mobile", { gap: Math.min(128, Math.max(0, v)) })} /></Field>
              <p className="text-[11px] leading-relaxed text-faint">
                Sans réglage, la rangée garde exactement son rendu Phase 3B. L’empilement est facultatif : la section s’agrandit si nécessaire.
              </p>
              <p className="text-[11px] text-muted">Disposition active — {device} : {describeCmsRowLayout(selRow, device)}</p>
              {selRow.locked && <p className="text-[11px] text-goldsoft">La rangée verrouillée bloque les colonnes et toutes leurs feuilles.</p>}
            </div>
          ) : sel && selColumn && selSection && selParent && isCmsRow(selParent) ? (
            <div>
              <p className="mb-2 text-xs tracking-[0.18em] text-gold uppercase">Colonne · {selColumn.width.toFixed(2)} %</p>
              <p className="mb-3 text-[11px] leading-relaxed text-muted">La largeur est calculée dans sa rangée. Les feuilles s’empilent selon leur ordre dans Structure / Calques, remplissent la colonne et conservent leur hauteur.</p>
              <Field label="Largeur (%)"><NumInput v={selColumn.width} min={1} max={99} step={0.1} onChange={(v) => setColumnWidth(selSection.id, selParent.id, selColumn.id, v)} /></Field>
              <Field label="Gap vertical (px)"><NumInput v={selColumn.gap} min={0} max={128} onChange={(v) => setStructure(selSection.id, selColumn.id, { gap: Math.min(128, Math.max(0, v)) })} /></Field>
              <Field label="Opacité (%)"><NumInput v={selColumn.opacity * 100} min={0} max={100} onChange={(v) => setStructure(selSection.id, selColumn.id, { opacity: Math.min(1, Math.max(0, v / 100)) })} /></Field>
              <p className="mb-1.5 mt-3 text-[10px] tracking-[0.2em] text-faint uppercase">Responsive</p>
              <Field label="Largeur tablette (%)"><NumInput v={selColumn.responsive?.tablet?.width ?? selColumn.width} min={1} max={100} step={0.1} onChange={(v) => setStructureResponsive(selSection.id, selColumn.id, "tablet", { width: Math.min(100, Math.max(1, v)) })} /></Field>
              <Field label="Largeur mobile (%)"><NumInput v={selColumn.responsive?.mobile?.width ?? 100} min={1} max={100} step={0.1} onChange={(v) => setStructureResponsive(selSection.id, selColumn.id, "mobile", { width: Math.min(100, Math.max(1, v)) })} /></Field>
              <Field label="Ordre mobile">
                <select className={inputCls} value={String(selColumn.responsive?.mobile?.order ?? "")} onChange={(event) => setStructureResponsive(selSection.id, selColumn.id, "mobile", { order: event.target.value === "" ? null : Number(event.target.value) })}>
                  <option value="">Hérité ( ordre du tableau )</option>
                  {[0, 1, 2, 3].map((order) => <option key={order} value={String(order)}>{order + 1}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Masquée tablette">
                  <select className={inputCls} value={selColumn.responsive?.tablet?.hidden === true ? "1" : "0"} onChange={(event) => setStructureResponsive(selSection.id, selColumn.id, "tablet", { hidden: event.target.value === "1" })}><option value="0">Non</option><option value="1">Oui</option></select>
                </Field>
                <Field label="Masquée mobile">
                  <select className={inputCls} value={selColumn.responsive?.mobile?.hidden === true ? "1" : "0"} onChange={(event) => setStructureResponsive(selSection.id, selColumn.id, "mobile", { hidden: event.target.value === "1" })}><option value="0">Non</option><option value="1">Oui</option></select>
                </Field>
              </div>
              <div className="my-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setStructure(selSection.id, selColumn.id, { locked: !selColumn.locked })} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">{selColumn.locked ? "Déverrouiller" : "Verrouiller"}</button>
                <button type="button" onClick={() => setStructure(selSection.id, selColumn.id, { hidden: !selColumn.hidden })} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">{selColumn.hidden ? "Afficher" : "Masquer"}</button>
                <button type="button" onClick={() => duplicateEl(selSection.id, selColumn.id)} disabled={selReadOnly} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted disabled:opacity-40">Dupliquer</button>
                <button type="button" onClick={() => removeEl(selSection.id, selColumn.id)} disabled={selReadOnly || selParent.children.length <= 1} className="rounded border border-danger/40 px-2.5 py-1.5 text-xs text-danger disabled:opacity-40">Supprimer</button>
              </div>
              <p className="text-[11px] text-faint">Pour ajouter du contenu, gardez cette colonne — ou l’un de ses éléments — sélectionné, puis choisissez un bloc dans la bibliothèque.</p>
            </div>
          ) : sel && selGroup && selSection ? (
            <div>
              <p className="mb-2 text-xs tracking-[0.18em] text-gold uppercase">Groupe libre</p>
              <p className="mb-3 text-[11px] leading-relaxed text-muted">Le redimensionnement conserve les proportions des feuilles, leurs textes et leurs overrides responsive. Les enfants restent sélectionnables dans Calques.</p>
              <Field label="X (px)"><NumInput v={selGroup.x} onChange={(v) => setStructure(selSection.id, selGroup.id, { x: v })} /></Field>
              <Field label="Y (px)"><NumInput v={selGroup.y} onChange={(v) => setStructure(selSection.id, selGroup.id, { y: v })} /></Field>
              <Field label="Largeur (px)"><NumInput v={selGroup.w} min={MIN_SIZE} onChange={(v) => setStructure(selSection.id, selGroup.id, { w: Math.max(MIN_SIZE, v) })} /></Field>
              <Field label="Hauteur (px)"><NumInput v={selGroup.h} min={MIN_SIZE} onChange={(v) => setStructure(selSection.id, selGroup.id, { h: Math.max(MIN_SIZE, v) })} /></Field>
              <Field label="Opacité (%)"><NumInput v={selGroup.opacity * 100} min={0} max={100} onChange={(v) => setStructure(selSection.id, selGroup.id, { opacity: Math.min(1, Math.max(0, v / 100)) })} /></Field>
              <div className="my-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setStructure(selSection.id, selGroup.id, { locked: !selGroup.locked })} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">{selGroup.locked ? "Déverrouiller" : "Verrouiller"}</button>
                <button type="button" onClick={() => setStructure(selSection.id, selGroup.id, { hidden: !selGroup.hidden })} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">{selGroup.hidden ? "Afficher" : "Masquer"}</button>
                <button type="button" onClick={() => duplicateEl(selSection.id, selGroup.id)} disabled={selReadOnly} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted disabled:opacity-40">Dupliquer</button>
                <button type="button" onClick={() => removeEl(selSection.id, selGroup.id)} disabled={selReadOnly} className="rounded border border-danger/40 px-2.5 py-1.5 text-xs text-danger disabled:opacity-40">Supprimer</button>
              </div>
            </div>
          ) : sel && selContainer && selSection ? (
            <div>
              <p className="mb-3 text-xs tracking-[0.18em] text-gold uppercase">Container libre</p>
              <p className="mb-3 text-[11px] leading-relaxed text-muted">Ses enfants utilisent des coordonnées locales. Déplacer le container déplace tout son contenu ; le redimensionner ne met pas les enfants à l’échelle.</p>
              <Field label="X (px)"><NumInput v={selContainer.x} onChange={(v) => setContainer(selSection.id, selContainer.id, { x: v })} /></Field>
              <Field label="Y (px)"><NumInput v={selContainer.y} onChange={(v) => setContainer(selSection.id, selContainer.id, { y: v })} /></Field>
              <Field label="Largeur (px)"><NumInput v={selContainer.w} min={MIN_SIZE} onChange={(v) => setContainer(selSection.id, selContainer.id, { w: Math.max(MIN_SIZE, v) })} /></Field>
              <Field label="Hauteur (px)"><NumInput v={selContainer.h} min={MIN_SIZE} onChange={(v) => setContainer(selSection.id, selContainer.id, { h: Math.max(MIN_SIZE, v) })} /></Field>
              <div className="my-3 flex gap-2">
                <button type="button" onClick={() => setContainer(selSection.id, selContainer.id, { locked: !selContainer.locked })} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">{selContainer.locked ? "Déverrouiller" : "Verrouiller"}</button>
                <button type="button" onClick={() => setContainer(selSection.id, selContainer.id, { hidden: !selContainer.hidden })} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted">{selContainer.hidden ? "Afficher" : "Masquer"}</button>
              </div>
              <div className="mb-3 flex gap-2">
                <button type="button" onClick={() => duplicateEl(selSection.id, selContainer.id)} disabled={selReadOnly} className="rounded border border-line px-2.5 py-1.5 text-xs text-muted disabled:opacity-40">Dupliquer</button>
                <button type="button" onClick={() => removeEl(selSection.id, selContainer.id)} disabled={selReadOnly} className="rounded border border-danger/40 px-2.5 py-1.5 text-xs text-danger disabled:opacity-40">Supprimer</button>
              </div>
              {selContainer.locked ? <p className="text-[11px] text-goldsoft">Déverrouillez ce container pour modifier ses enfants.</p> : <p className="text-[11px] text-faint">Pour ajouter un enfant, gardez le container sélectionné puis choisissez un élément dans la bibliothèque.</p>}
            </div>
          ) : sel && selEl && selSection && selParent && !isCmsGroup(selParent) && device !== "desktop" ? (
            <p className="rounded-lg border border-line p-3 text-xs text-muted">Les feuilles de conteneur / colonne s’éditent sur Desktop uniquement.</p>
          ) : sel && selEl && selSection && selReadOnly ? (
            <p className="rounded-lg border border-line p-3 text-xs text-muted">Ce nœud appartient à un parent verrouillé. Sélectionnez et déverrouillez le parent dans Structure / Calques.</p>
          ) : sel && selEl && selSection ? (
            <>
              {selParent && isCmsColumn(selParent) && <div className="mb-3 flex items-center gap-2 rounded-lg border border-line p-2 text-[11px] text-muted">
                <span className="flex-1">Positionné dans le flux de la colonne · l’ordre se règle dans Calques.</span>
                <button type="button" disabled={selParent.locked || cmsAncestors(selSection, selParent.id).some((parent) => parent.locked)} onClick={() => {
                  const row = findCmsParentNode(selSection, selParent.id);
                  if (row && isCmsRow(row)) reorderColumnChild(selSection.id, row.id, selParent.id, selEl.id, -1);
                }} className="rounded border border-line px-1.5 py-1 disabled:opacity-30">↑</button>
                <button type="button" disabled={selParent.locked || cmsAncestors(selSection, selParent.id).some((parent) => parent.locked)} onClick={() => {
                  const row = findCmsParentNode(selSection, selParent.id);
                  if (row && isCmsRow(row)) reorderColumnChild(selSection.id, row.id, selParent.id, selEl.id, 1);
                }} className="rounded border border-line px-1.5 py-1 disabled:opacity-30">↓</button>
              </div>}
              <PropsPanel
                el={selEl}
                frame={getCmsElementFrameInBreakpoint(selEl, device)}
                canvasWidth={vpw}
                sectionHeight={selSection.h * vpw / PAGE_WIDTH}
                fontSize={getCmsElementFontSizeInBreakpoint(selEl, device)}
                device={device}
                isBoutiquePage={initialSlug === "boutique"}
                flowLayout={!!selParent && isCmsColumn(selParent)}
                onChange={(patch) => setEl(selSection.id, selEl.id, patch)}
                onChangeFrame={(patch) => setElAtDevice(selSection.id, selEl.id, patch)}
                onChangeStyle={(patch) => setEl(selSection.id, selEl.id, { style: { ...selEl.style, ...patch } })}
                onChangeContent={(patch) => setEl(selSection.id, selEl.id, { content: { ...selEl.content, ...patch } })}
                onResponsive={(breakpoint, patch) => setElAtBreakpoint(selSection.id, selEl.id, breakpoint, patch)}
                responsiveEnabled={!selParent || isCmsGroup(selParent)}
                onFontSizeChange={(value) => device === "desktop"
                  ? setEl(selSection.id, selEl.id, { style: { ...selEl.style, size: value } })
                  : setElAtDevice(selSection.id, selEl.id, { fontSize: value })}
                onRemove={() => removeEl(selSection.id, selEl.id)}
                onLock={() => setEl(selSection.id, selEl.id, { locked: !selEl.locked })}
              />
            </>
          ) : selSection ? (
            <div>
              <p className="mb-3 text-xs tracking-[0.18em] text-gold uppercase">Section</p>
              <Field label="Hauteur (px)"><NumInput v={selSection.h} onChange={(v) => sectionProp(selSection.id, { h: Math.max(120, v) })} min={120} max={4000} /></Field>
              <Field label="Arrière-plan"><Input v={selSection.bg ?? ""} onChange={(v) => sectionProp(selSection.id, { bg: v })} /></Field>
              <p className="mt-4 text-xs leading-relaxed text-faint">Sélectionnez un élément pour modifier ses propriétés. Double-clic sur un texte pour l&apos;éditer directement.</p>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-xs tracking-[0.18em] text-gold uppercase">Aide</p>
              <ul className="space-y-2 text-xs leading-relaxed text-muted">
                <li>• Cliquez sur un élément de la bibliothèque pour l&apos;ajouter (ou glissez-le dans une section).</li>
                <li>• Déplacez librement, redimensionnez aux poignées dorées.</li>
                <li>• Double-clic sur un texte = édition directe.</li>
                <li>• Ctrl+Z annuler · Ctrl+D dupliquer · Suppr supprimer.</li>
                <li>• ▲ / ▼ pour l&apos;ordre d&apos;affichage (devant / derrière).</li>
                <li>• L&apos;onglet Responsive ajuste la position par appareil.</li>
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
function ElementViewLazy({ el, formSlug = "" }: { el: CmsElement; formSlug?: string }) {
  return <ElementView el={el} products={[]} formSlug={formSlug} />;
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

function MediaSelectButton({
  onSelect, multiple = false, selectedUrls = [], title = "Choisir des images",
}: { onSelect: (urls: string[]) => void; multiple?: boolean; selectedUrls?: string[]; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-line px-3 py-2 text-[11px] text-muted hover:border-gold hover:text-ink">Importer depuis mon ordinateur…</button>
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-line px-3 py-2 text-[11px] text-muted hover:border-gold hover:text-ink">Choisir dans la médiathèque</button>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} onSelect={onSelect} selectedUrls={selectedUrls} multiple={multiple} title={title} />
    </>
  );
}

function ImageListEditor({
  value, onChange, title, primaryFirst = false,
}: { value: unknown; onChange: (images: { src: string; alt?: string; caption?: string }[]) => void; title: string; primaryFirst?: boolean }) {
  const images = Array.isArray(value) ? value.filter((item): item is { src: string; alt?: string; caption?: string } => !!item && typeof item === "object" && typeof (item as { src?: unknown }).src === "string") : [];
  const replace = (index: number, patch: Partial<{ src: string; alt: string; caption: string }>) => onChange(images.map((item, i) => i === index ? { ...item, ...patch } : item));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-faint">{title} · jusqu’à 30 images. L’import ouvre la médiathèque, puis choisissez « Importer » dans sa fenêtre.</p>
      <MediaSelectButton multiple title="Ajouter des images" onSelect={(urls) => {
        const known = new Set(images.map((image) => image.src));
        onChange([...images, ...urls.filter((url) => !known.has(url)).map((src) => ({ src, alt: "", caption: "" }))].slice(0, 30));
      }} />
      {!images.length && <p className="rounded-lg border border-dashed border-line p-3 text-xs text-faint">Aucune image sélectionnée.</p>}
      {images.map((image, index) => (
        <div key={`${image.src}-${index}`} className="rounded-lg border border-line bg-night/50 p-2.5">
          {primaryFirst && index === 0 && <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gold">Image principale · affichée en premier</p>}
          <div className="flex gap-2">
            <div className="h-14 w-16 shrink-0 overflow-hidden rounded bg-raised">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-wrap content-start gap-1">
              <button type="button" title="Monter" disabled={index === 0} onClick={() => move(index, -1)} className="rounded border border-line px-2 py-1 text-[10px] text-muted disabled:opacity-40">↑</button>
              <button type="button" title="Descendre" disabled={index === images.length - 1} onClick={() => move(index, 1)} className="rounded border border-line px-2 py-1 text-[10px] text-muted disabled:opacity-40">↓</button>
              <MediaSelectButton title="Remplacer cette image" selectedUrls={[image.src]} onSelect={(urls) => { if (urls[0]) replace(index, { src: urls[0] }); }} />
              <button type="button" onClick={() => onChange(images.filter((_, i) => i !== index))} className="rounded border border-danger/40 px-2 py-1 text-[10px] text-danger">Retirer</button>
            </div>
          </div>
          <div className="mt-2 grid gap-2">
            <Field label="Texte alternatif"><Input v={image.alt ?? ""} onChange={(alt) => replace(index, { alt })} /></Field>
            <Field label="Légende"><Input v={image.caption ?? ""} onChange={(caption) => replace(index, { caption })} /></Field>
          </div>
        </div>
      ))}
    </div>
  );
}

function VisualSpacingFields({ content, onChange }: { content: Record<string, any>; onChange: (patch: Record<string, unknown>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Marge haute (px)"><NumInput v={content.marginTop ?? 0} onChange={(marginTop) => onChange({ marginTop })} min={0} max={240} /></Field>
      <Field label="Marge basse (px)"><NumInput v={content.marginBottom ?? 0} onChange={(marginBottom) => onChange({ marginBottom })} min={0} max={240} /></Field>
      <Field label="Marge interne (px)"><NumInput v={content.padding ?? 0} onChange={(padding) => onChange({ padding })} min={0} max={128} /></Field>
    </div>
  );
}

function PropsPanel({
  el, frame, canvasWidth, sectionHeight, fontSize, device, onChange, onChangeFrame, onChangeStyle, onChangeContent, onResponsive, onFontSizeChange, onRemove, onLock, isBoutiquePage, responsiveEnabled = true, flowLayout = false,
}: {
  el: CmsElement;
  frame: ResponsiveFrame;
  canvasWidth: number;
  sectionHeight: number;
  fontSize: number;
  device: Device;
  isBoutiquePage: boolean;
  responsiveEnabled?: boolean;
  flowLayout?: boolean;
  onChange: (p: Partial<CmsElement>) => void;
  onChangeFrame: (p: Partial<ResponsiveFrame>) => void;
  onChangeStyle: (p: Record<string, any>) => void;
  onChangeContent: (p: Record<string, any>) => void;
  onResponsive: (bp: Device, p: CmsBreakpointPatch) => void;
  onFontSizeChange: (value: number) => void;
  onRemove: () => void;
  onLock: () => void;
}) {
  const s = el.style ?? {};
  const c = el.content ?? {};
  const activeOverride = device === "desktop" ? undefined : el.responsive?.[device];
  const hasFrameOverride = !!activeOverride && [activeOverride.x, activeOverride.y, activeOverride.w, activeOverride.h].some((value) => value !== undefined);
  const faqItems = Array.isArray(c.items) ? (c.items as { question: string; answer: string }[]) : [];
  const menuItems = el.type === "menu" && Array.isArray(c.items) ? (c.items as { label: string; href: string }[]) : [];
  const updateMenuItem = (index: number, patch: Partial<{ label: string; href: string }>) => {
    const next = [...menuItems];
    next[index] = { ...next[index], ...patch };
    onChangeContent({ items: next });
  };
  const updateFaqItem = (index: number, patch: Partial<{ question: string; answer: string }>) => {
    const next = [...faqItems];
    next[index] = { ...next[index], ...patch };
    onChangeContent({ items: next });
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs tracking-[0.18em] text-gold uppercase">{el.type}</p>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={onLock} aria-pressed={!!el.locked} className={`rounded border px-2 py-1 text-[11px] ${el.locked ? "border-gold bg-gold/15 text-gold" : "border-line text-muted"}`}>Verrouillé · {el.locked ? "Oui" : "Non"}</button>
          <button type="button" onClick={onRemove} disabled={!!el.locked} className="rounded border border-line px-2 py-1 text-[11px] text-danger disabled:opacity-40">Suppr.</button>
        </div>
      </div>
      {el.hidden && <p className="mb-3 rounded-lg bg-gold/10 p-2 text-xs text-goldsoft">Élément masqué sur le canvas ; il reste administrable dans Structure / calques.</p>}
      {el.locked && <p className="mb-3 rounded-lg bg-raised p-2 text-xs text-muted">Élément verrouillé. Déverrouillez-le pour modifier ses propriétés.</p>}
      <fieldset disabled={!!el.locked} className="min-w-0 space-y-1 border-0 p-0 disabled:opacity-60">
      {responsiveEnabled && <section className="mb-3 rounded-xl border border-line p-3" aria-label="Visibilité par appareil">
        <p className="mb-2 text-[10px] tracking-[0.2em] text-faint uppercase">Visibilité par appareil</p>
        {(["desktop", "tablet", "mobile"] as Device[]).map((breakpoint) => {
          const hidden = resolveCmsElementForBreakpoint(el, breakpoint).hidden;
          const label = breakpoint === "desktop" ? "Desktop" : breakpoint === "tablet" ? "Tablette" : "Mobile";
          return <label key={breakpoint} className="flex items-center justify-between gap-2 py-1 text-xs text-muted">
            <span>{hidden ? `Masquer sur ${label}` : `Afficher sur ${label}`}</span>
            <input type="checkbox" checked={!hidden} aria-label={`${hidden ? "Afficher" : "Masquer"} sur ${label}`} onChange={(event) => onResponsive(breakpoint, { hidden: !event.target.checked })} className="accent-[#c9a86a]" />
          </label>;
        })}
      </section>}
      {flowLayout ? (
        <div className="mb-3 rounded-lg border border-line p-2">
          <p className="mb-2 text-[10px] tracking-[0.15em] text-faint uppercase">Flux vertical de la colonne</p>
          <p className="mb-2 text-[10px] leading-relaxed text-faint">La largeur remplit le parent et l’ordre se règle dans Calques ; seule la hauteur est éditée ici.</p>
          <Field label="Hauteur (px)"><NumInput v={frame.h} onChange={(v) => onChangeFrame({ h: Math.max(MIN_SIZE, v) })} min={MIN_SIZE} max={Math.max(4000, sectionHeight)} /></Field>
        </div>
      ) : (
        <>
          <p className="mb-1.5 text-[10px] tracking-[0.2em] text-faint uppercase">Position & taille · {device === "desktop" ? "Desktop" : device === "tablet" ? "Tablette" : "Mobile"}</p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Field label="X"><NumInput v={frame.x} onChange={(v) => onChangeFrame({ x: v })} min={-200} max={canvasWidth} /></Field>
            <Field label="Y"><NumInput v={frame.y} onChange={(v) => onChangeFrame({ y: v })} min={-200} max={Math.max(4000, sectionHeight)} /></Field>
            <Field label="Largeur"><NumInput v={frame.w} onChange={(v) => onChangeFrame({ w: Math.max(MIN_SIZE, v) })} min={MIN_SIZE} max={canvasWidth} /></Field>
            <Field label="Hauteur"><NumInput v={frame.h} onChange={(v) => onChangeFrame({ h: Math.max(MIN_SIZE, v) })} min={MIN_SIZE} max={Math.max(4000, sectionHeight)} /></Field>
          </div>
        </>
      )}
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
            <Field label={`Taille · ${device === "desktop" ? "Desktop" : device === "tablet" ? "Tablette" : "Mobile"}`}><NumInput v={fontSize} onChange={onFontSizeChange} min={device === "desktop" ? 8 : 1} max={160} /></Field>
            <Field label="Graisse"><NumInput v={s.weight ?? 400} onChange={(v) => onChangeStyle({ weight: v })} min={100} max={900} step={100} /></Field>
          </div>
          {responsiveEnabled && device !== "desktop" && el.responsive?.[device]?.fontSize !== undefined && (
            <button type="button" onClick={() => onResponsive(device, { fontSize: null })} className="mb-2 text-xs text-gold hover:underline">Réinitialiser la taille Desktop</button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Couleur"><ColorInput v={s.color ?? "#ece9e2"} onChange={(v) => onChangeStyle({ color: v })} /></Field>
            <Field label="Alignement">
              <select className={inputCls} value={s.align ?? "left"} onChange={(e) => onChangeStyle({ align: e.target.value })}>
                <option value="left">Gauche</option>
                <option value="center">Centre</option>
                <option value="right">Droite</option>
                <option value="justify">Justifié</option>
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
          <div className="space-y-2">
            <p className="text-[11px] text-faint">Importer depuis votre ordinateur ou réutiliser une image de la médiathèque.</p>
            <MediaSelectButton title="Choisir une image" selectedUrls={c.src ? [c.src] : []} onSelect={(urls) => { if (urls[0]) onChangeContent({ src: urls[0] }); }} />
            <Field label="Référence média"><Input v={c.src ?? ""} onChange={(src) => onChangeContent({ src })} placeholder="Choisissez un média existant" /></Field>
            {c.src && <div className="overflow-hidden rounded-lg border border-line bg-night">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.src} alt="" className="aspect-video w-full object-cover" />
            </div>}
          </div>
          <Field label="Texte alternatif (alt)"><Input v={c.alt ?? ""} onChange={(alt) => onChangeContent({ alt })} /></Field>
          <Field label="Légende"><Input v={c.caption ?? ""} onChange={(caption) => onChangeContent({ caption })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ajustement">
              <select className={inputCls} value={c.fit ?? "cover"} onChange={(e) => onChangeContent({ fit: e.target.value })}>
                <option value="cover">Couvrir</option><option value="contain">Incorporer</option><option value="fill">Étirer</option>
              </select>
            </Field>
            <Field label="Rayon"><NumInput v={c.radius ?? 0} onChange={(v) => onChangeContent({ radius: v })} min={0} max={200} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Largeur (%)"><NumInput v={c.widthPercent ?? 100} onChange={(widthPercent) => onChangeContent({ widthPercent })} min={10} max={100} /></Field>
            <Field label="Largeur max (px)"><NumInput v={c.maxWidthPx ?? 1200} onChange={(maxWidthPx) => onChangeContent({ maxWidthPx })} min={160} max={2400} step={20} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Alignement"><select className={inputCls} value={c.align ?? "center"} onChange={(e) => onChangeContent({ align: e.target.value })}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></Field>
            <Field label="Ratio"><select className={inputCls} value={c.ratio ?? "auto"} onChange={(e) => onChangeContent({ ratio: e.target.value })}><option value="auto">Original</option><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="16:9">16:9</option></select></Field>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={!!c.shadow} onChange={(e) => onChangeContent({ shadow: e.target.checked })} className="accent-[#c9a86a]" /> Ombre</label>
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={!!c.border} onChange={(e) => onChangeContent({ border: e.target.checked })} className="accent-[#c9a86a]" /> Bordure</label>
          </div>
        </>
      )}
      {(el.type === "gallery" || el.type === "carousel" || el.type === "imageMarquee") && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">{el.type === "gallery" ? "Galerie" : el.type === "carousel" ? "Carrousel" : "Image défilante"}</p>
          <ImageListEditor value={c.images} onChange={(images) => onChangeContent({ images })} title="Sélectionnez, remplacez et réordonnez les images." primaryFirst={el.type === "carousel"} />
          {el.type === "gallery" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Colonnes"><NumInput v={c.columns ?? 3} onChange={(columns) => onChangeContent({ columns })} min={1} max={6} /></Field>
                <Field label="Espacement (px)"><NumInput v={c.gap ?? 16} onChange={(gap) => onChangeContent({ gap })} min={0} max={64} /></Field>
              </div>
              <Field label="Ratio des images"><select className={inputCls} value={c.ratio ?? "4:3"} onChange={(e) => onChangeContent({ ratio: e.target.value })}><option value="auto">Original</option><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="3:2">3:2</option><option value="16:9">16:9</option><option value="21:9">21:9</option></select></Field>
              <label className="mb-2 flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={c.showCaptions !== false} onChange={(e) => onChangeContent({ showCaptions: e.target.checked })} className="accent-[#c9a86a]" /> Afficher les légendes</label>
            </>
          )}
          {el.type === "carousel" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Durée par image (ms)"><NumInput v={c.speedMs ?? 5000} onChange={(speedMs) => onChangeContent({ speedMs })} min={1000} max={30000} step={500} /></Field>
                <Field label="Rayon (px)"><NumInput v={c.radius ?? 16} onChange={(radius) => onChangeContent({ radius })} min={0} max={200} /></Field>
              </div>
              <div className="space-y-2">
                {([["autoplay", "Lecture automatique"], ["loop", "Boucle"], ["showArrows", "Commandes précédent / suivant"], ["showIndicators", "Indicateurs"]] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={c[key] !== false && (key !== "autoplay" || c[key] === true)} onChange={(e) => onChangeContent({ [key]: e.target.checked })} className="accent-[#c9a86a]" /> {label}</label>)}
              </div>
            </>
          )}
          {el.type === "imageMarquee" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Durée de boucle (s)"><NumInput v={c.speedSeconds ?? 32} onChange={(speedSeconds) => onChangeContent({ speedSeconds })} min={5} max={120} /></Field>
                <Field label="Images visibles"><NumInput v={c.visibleCount ?? 4} onChange={(visibleCount) => onChangeContent({ visibleCount })} min={1} max={8} /></Field>
                <Field label="Espacement (px)"><NumInput v={c.gap ?? 16} onChange={(gap) => onChangeContent({ gap })} min={0} max={64} /></Field>
                <Field label="Rayon (px)"><NumInput v={c.radius ?? 12} onChange={(radius) => onChangeContent({ radius })} min={0} max={200} /></Field>
              </div>
              <Field label="Sens"><select className={inputCls} value={c.direction ?? "left"} onChange={(e) => onChangeContent({ direction: e.target.value })}><option value="left">Vers la gauche</option><option value="right">Vers la droite</option></select></Field>
              <label className="mb-2 flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={c.pauseOnHover !== false} onChange={(e) => onChangeContent({ pauseOnHover: e.target.checked })} className="accent-[#c9a86a]" /> Pause au survol</label>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Largeur max (px)"><NumInput v={c.maxWidthPx ?? 1120} onChange={(maxWidthPx) => onChangeContent({ maxWidthPx })} min={160} max={2400} step={20} /></Field>
            <Field label="Rayon (px)"><NumInput v={c.radius ?? 12} onChange={(radius) => onChangeContent({ radius })} min={0} max={200} /></Field>
          </div>
          <Field label="Alignement"><select className={inputCls} value={c.align ?? "center"} onChange={(e) => onChangeContent({ align: e.target.value })}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></Field>
          <VisualSpacingFields content={c} onChange={onChangeContent} />
        </>
      )}
      {el.type === "panorama" && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">Panorama horizontal · pas de 360°</p>
          <MediaSelectButton title="Choisir le panorama" selectedUrls={c.src ? [c.src] : []} onSelect={(urls) => { if (urls[0]) onChangeContent({ src: urls[0] }); }} />
          <Field label="Référence média"><Input v={c.src ?? ""} onChange={(src) => onChangeContent({ src })} placeholder="Choisissez une image panoramique" /></Field>
          <Field label="Texte alternatif"><Input v={c.alt ?? ""} onChange={(alt) => onChangeContent({ alt })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Position initiale (%)"><NumInput v={c.initialPosition ?? 50} onChange={(initialPosition) => onChangeContent({ initialPosition })} min={0} max={100} /></Field>
            <Field label="Vitesse (px/s)"><NumInput v={c.speedPxPerSecond ?? 24} onChange={(speedPxPerSecond) => onChangeContent({ speedPxPerSecond })} min={1} max={120} /></Field>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={!!c.autoScroll} onChange={(e) => onChangeContent({ autoScroll: e.target.checked })} className="accent-[#c9a86a]" /> Défilement automatique</label>
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={!!c.loop} onChange={(e) => onChangeContent({ loop: e.target.checked })} className="accent-[#c9a86a]" /> Boucle automatique</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Largeur max (px)"><NumInput v={c.maxWidthPx ?? 1120} onChange={(maxWidthPx) => onChangeContent({ maxWidthPx })} min={160} max={2400} step={20} /></Field>
            <Field label="Rayon (px)"><NumInput v={c.radius ?? 12} onChange={(radius) => onChangeContent({ radius })} min={0} max={200} /></Field>
          </div>
          <Field label="Alignement"><select className={inputCls} value={c.align ?? "center"} onChange={(e) => onChangeContent({ align: e.target.value })}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></Field>
          <VisualSpacingFields content={c} onChange={onChangeContent} />
        </>
      )}
      {el.type === "article" && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">Article éditorial</p>
          <MediaSelectButton title="Choisir l’image de l’article" selectedUrls={c.src ? [c.src] : []} onSelect={(urls) => { if (urls[0]) onChangeContent({ src: urls[0] }); }} />
          <Field label="Référence média"><Input v={c.src ?? ""} onChange={(src) => onChangeContent({ src })} placeholder="Image facultative" /></Field>
          <Field label="Texte alternatif"><Input v={c.alt ?? ""} onChange={(alt) => onChangeContent({ alt })} /></Field>
          <Field label="Titre"><Input v={c.title ?? ""} onChange={(title) => onChangeContent({ title })} /></Field>
          <Field label="Sous-titre"><Input v={c.subtitle ?? ""} onChange={(subtitle) => onChangeContent({ subtitle })} /></Field>
          <div className="space-y-2">
            <p className="text-[11px] text-faint">Paragraphes</p>
            {(Array.isArray(c.paragraphs) ? c.paragraphs : []).map((paragraph: string, index: number) => <div key={index} className="rounded-lg border border-line p-2"><div className="mb-1 flex items-center justify-between"><span className="text-[10px] text-faint">Paragraphe {index + 1}</span><button type="button" disabled={c.paragraphs.length <= 1} onClick={() => onChangeContent({ paragraphs: c.paragraphs.filter((_: string, i: number) => i !== index) })} className="text-[10px] text-danger disabled:opacity-40">Retirer</button></div><textarea rows={3} className={`${inputCls} resize-y`} value={paragraph ?? ""} onChange={(e) => { const paragraphs = [...c.paragraphs]; paragraphs[index] = e.target.value; onChangeContent({ paragraphs }); }} /></div>)}
            <button type="button" disabled={!Array.isArray(c.paragraphs) || c.paragraphs.length >= 20} onClick={() => onChangeContent({ paragraphs: [...(Array.isArray(c.paragraphs) ? c.paragraphs : []), ""] })} className="w-full rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted disabled:opacity-40">+ Ajouter un paragraphe</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Image"><select className={inputCls} value={c.imagePosition ?? "left"} onChange={(e) => onChangeContent({ imagePosition: e.target.value })}><option value="left">À gauche</option><option value="right">À droite</option><option value="top">Au-dessus</option></select></Field>
            <Field label="Alignement"><select className={inputCls} value={c.align ?? "left"} onChange={(e) => onChangeContent({ align: e.target.value })}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Espacement (px)"><NumInput v={c.spacing ?? 24} onChange={(spacing) => onChangeContent({ spacing })} min={0} max={96} /></Field>
            <Field label="Largeur max (px)"><NumInput v={c.maxWidthPx ?? 1120} onChange={(maxWidthPx) => onChangeContent({ maxWidthPx })} min={160} max={2400} step={20} /></Field>
          </div>
          <Field label="Rayon (px)"><NumInput v={c.radius ?? 12} onChange={(radius) => onChangeContent({ radius })} min={0} max={200} /></Field>
          <Field label="Libellé du bouton (facultatif)"><Input v={c.buttonLabel ?? ""} onChange={(buttonLabel) => onChangeContent({ buttonLabel })} /></Field>
          {c.buttonLabel && <Field label="Lien du bouton"><Input v={c.buttonHref ?? ""} onChange={(buttonHref) => onChangeContent({ buttonHref })} placeholder="/page" /></Field>}
          <VisualSpacingFields content={c} onChange={onChangeContent} />
        </>
      )}
      {el.type === "button" && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">Bouton</p>
          <Field label="Texte"><Input v={c.text ?? ""} onChange={(v) => onChangeContent({ text: v })} /></Field>
          {isBoutiquePage ? (
            <div>
              <Field label="Destination (verrouillée)">
                <input className={inputCls} value={c.href ?? "(à corriger)"} readOnly aria-readonly="true" />
              </Field>
              {c.href !== "/create" && (
                <button type="button" onClick={() => onChangeContent({ href: "/create" })} className="mt-2 text-xs text-gold hover:underline">
                  Rétablir la destination /create
                </button>
              )}
            </div>
          ) : (
            <>
              <Field label="Lien"><Input v={c.href ?? ""} onChange={(v) => onChangeContent({ href: v })} placeholder="/boutique, https://…, tel:…, mailto:…" /></Field>
              {c.href && !resolveCmsButtonHref(c.href) && (
                <p className="mb-2 text-[11px] text-danger">
                  Destination refusée : utilisez un lien interne, une URL https, tel: ou mailto:.
                </p>
              )}
              {c.href && resolveCmsButtonHref(c.href) && (
                <p className="mb-2 text-[11px] text-faint">
                  Type détecté : {{
                    internal: "lien interne", external: "lien externe HTTPS",
                    phone: "appel téléphonique", email: "e-mail",
                  }[resolveCmsButtonHref(c.href)!.kind]}
                </p>
              )}
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Alignement"><select className={inputCls} value={c.align ?? "center"} onChange={(event) => onChangeContent({ align: event.target.value })}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></Field>
            <Field label="Nouvel onglet">
              <select className={inputCls} value={c.newTab === true ? "1" : "0"} onChange={(event) => onChangeContent({ newTab: event.target.value === "1" })}><option value="0">Non</option><option value="1">Oui</option></select>
            </Field>
          </div>
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
      {el.type === "hero" && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">Hero marketing</p>
          <Field label="Surtitre"><Input v={c.eyebrow ?? ""} onChange={(eyebrow) => onChangeContent({ eyebrow })} /></Field>
          <Field label="Titre"><textarea rows={2} className={`${inputCls} resize-y`} value={c.title ?? ""} onChange={(event) => onChangeContent({ title: event.target.value })} /></Field>
          <Field label="Sous-titre"><textarea rows={3} className={`${inputCls} resize-y`} value={c.subtitle ?? ""} onChange={(event) => onChangeContent({ subtitle: event.target.value })} /></Field>
          <Field label="Visuel de fond"><MediaSelectButton title="Choisir le visuel du hero" selectedUrls={c.imageSrc ? [c.imageSrc] : []} onSelect={(urls) => { if (urls[0]) onChangeContent({ imageSrc: urls[0] }); }} /></Field>
          <Field label="Texte alternatif"><Input v={c.imageAlt ?? ""} onChange={(imageAlt) => onChangeContent({ imageAlt })} /></Field>
          <Field label="Libellé du bouton"><Input v={c.buttonLabel ?? ""} onChange={(buttonLabel) => onChangeContent({ buttonLabel })} /></Field>
          {c.buttonLabel && <Field label="Lien du bouton"><Input v={c.buttonHref ?? ""} onChange={(buttonHref) => onChangeContent({ buttonHref })} placeholder="/boutique" /></Field>}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fond"><ColorInput v={s.bg ?? "#0c0e16"} onChange={(bg) => onChangeStyle({ bg })} /></Field>
            <Field label="Accent"><ColorInput v={s.accent ?? "#c9a86a"} onChange={(accent) => onChangeStyle({ accent })} /></Field>
          </div>
        </>
      )}
      {el.type === "menu" && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">Menu de navigation</p>
          <Field label="Orientation"><select className={inputCls} value={c.orientation ?? "horizontal"} onChange={(event) => onChangeContent({ orientation: event.target.value })}><option value="horizontal">Horizontale</option><option value="vertical">Verticale</option></select></Field>
          <Field label="Libellé accessible"><Input v={c.ariaLabel ?? "Navigation"} onChange={(ariaLabel) => onChangeContent({ ariaLabel })} /></Field>
          <div className="space-y-2">
            {menuItems.map((item, index) => <div key={index} className="rounded-lg border border-line p-2">
              <Field label={`Lien ${index + 1}`}><Input v={item.label ?? ""} onChange={(label) => updateMenuItem(index, { label })} placeholder="Boutique" /></Field>
              <Field label="Destination"><Input v={item.href ?? ""} onChange={(href) => updateMenuItem(index, { href })} placeholder="/boutique" /></Field>
              <button type="button" onClick={() => onChangeContent({ items: menuItems.filter((_, itemIndex) => itemIndex !== index) })} disabled={menuItems.length <= 1} className="text-[11px] text-danger disabled:opacity-40">Supprimer le lien</button>
            </div>)}
          </div>
          <button type="button" onClick={() => onChangeContent({ items: [...menuItems, { label: "Nouveau lien", href: "/" }] })} disabled={menuItems.length >= 12} className="w-full rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted disabled:opacity-40">+ Ajouter un lien</button>
          <Field label="Espacement (px)"><NumInput v={s.gap ?? 24} min={0} max={128} onChange={(gap) => onChangeStyle({ gap })} /></Field>
        </>
      )}
      {el.type === "cart" && (
        <>
          <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">Panier existant</p>
          <Field label="Libellé"><Input v={c.label ?? "Voir mon panier"} onChange={(label) => onChangeContent({ label })} /></Field>
          <p className="text-[11px] leading-relaxed text-faint">Ce bloc ouvre le panier actuel. Il ne touche ni au checkout ni au paiement.</p>
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
      {(el.type === "promo" || el.type === "newsletter" || el.type === "testimonials") && (
        <Field label="Texte principal"><Input v={c.text ?? c.title ?? ""} onChange={(v) => onChangeContent(el.type === "testimonials" ? { title: v } : { text: v })} /></Field>
      )}
      {el.type === "form" && (() => {
        const formConfig: CmsFormConfig = normalizeCmsFormConfig(c);
        const fieldByKey = (key: CmsFormFieldKey) => formConfig.fields.find((field) => field.key === key);
        const patchField = (key: CmsFormFieldKey, patch: Record<string, unknown>) => {
          const current = normalizeCmsFormConfig(c).fields;
          const next = current.map((field) => field.key === key ? { ...field, ...patch } : field);
          // On conserve TOUJOURS les cinq cles : l'ordre du tableau fait foi.
          const merged = CMS_FORM_FIELD_KEYS.map((candidate) => next.find((field) => field.key === candidate)
            ?? { key: candidate, type: candidate, label: candidate, enabled: false, required: false, placeholder: "", rows: 1 });
          onChangeContent({ ...c, fields: merged });
        };
        const moveField = (key: CmsFormFieldKey, direction: -1 | 1) => {
          const current = [...formConfig.fields];
          const index = current.findIndex((field) => field.key === key);
          const nextIndex = index + direction;
          if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;
          [current[index], current[nextIndex]] = [current[nextIndex], current[index]];
          onChangeContent({ ...c, fields: current });
        };
        const toggle = (key: CmsFormFieldKey, prop: "enabled" | "required") => {
          const field = fieldByKey(key);
          if (!field) return;
          patchField(key, { [prop]: !field[prop] });
        };
        return (
          <>
            <p className="mb-1.5 mt-2 text-[10px] tracking-[0.2em] text-faint uppercase">Formulaire — traitement serveur</p>
            <Field label="Titre"><Input v={formConfig.title} onChange={(title) => onChangeContent({ ...c, title })} /></Field>
            <Field label="Description"><textarea rows={2} className={`${inputCls} resize-y`} value={formConfig.description} onChange={(event) => onChangeContent({ ...c, description: event.target.value })} /></Field>
            <div className="space-y-2">
              <p className="text-[11px] text-faint">Champs — l’ordre ci-dessous est l’ordre d’affichage</p>
              {formConfig.fields.map((field, index) => (
                <div key={field.key} className={`rounded-lg border p-2 ${field.enabled ? "border-line" : "border-dashed border-line opacity-70"}`}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] tracking-wide text-gold uppercase">{index + 1}. {field.label}</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveField(field.key, -1)} disabled={index === 0} className="rounded border border-line px-1 text-[10px] text-muted disabled:opacity-30" title="Monter">↑</button>
                      <button type="button" onClick={() => moveField(field.key, 1)} disabled={index === formConfig.fields.length - 1} className="rounded border border-line px-1 text-[10px] text-muted disabled:opacity-30" title="Descendre">↓</button>
                    </div>
                  </div>
                  <Field label="Libellé"><Input v={field.label} onChange={(label) => patchField(field.key, { label })} /></Field>
                  <Field label="Texte indicatif"><Input v={field.placeholder} onChange={(placeholder) => patchField(field.key, { placeholder })} /></Field>
                  {field.type === "message" && (
                    <Field label="Lignes"><NumInput v={field.rows} min={3} max={20} onChange={(rows) => patchField(field.key, { rows })} /></Field>
                  )}
                  <div className="mt-2 flex gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] text-muted">
                      <input type="checkbox" checked={field.enabled} onChange={() => toggle(field.key, "enabled")} /> Actif
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted">
                      <input type="checkbox" checked={field.required} disabled={!field.enabled} onChange={() => toggle(field.key, "required")} /> Obligatoire
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <Field label="Libellé du bouton"><Input v={formConfig.submitLabel} onChange={(submitLabel) => onChangeContent({ ...c, submitLabel })} /></Field>
            <Field label="Message de succès"><textarea rows={2} className={`${inputCls} resize-y`} value={formConfig.successMessage} onChange={(event) => onChangeContent({ ...c, successMessage: event.target.value })} /></Field>
            <Field label="Message d’erreur"><textarea rows={2} className={`${inputCls} resize-y`} value={formConfig.errorMessage} onChange={(event) => onChangeContent({ ...c, errorMessage: event.target.value })} /></Field>
            <p className="text-[11px] leading-relaxed text-faint">
              Les envois sont validés et enregistrés côté serveur à partir de la version publiée de la page.
              Aucun destinataire ni secret n’est stocké dans le CMS.
            </p>
          </>
        );
      })()}
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
      {(el.type === "text" || el.type === "image") && !isBoutiquePage && (
        <Field label="Lien (optionnel)"><Input v={el.link ?? ""} onChange={(v) => onChange({ link: v || undefined })} placeholder="/page" /></Field>
      )}
      {isBoutiquePage && ((el.type === "text" && c.variant === "link") || (typeof el.link === "string" && !!el.link.trim())) && (
        <button
          type="button"
          onClick={() => {
            if (el.type === "text" && c.variant === "link") onChangeContent({ variant: "p" });
            onChange({ link: undefined });
          }}
          className="mt-2 text-xs text-gold hover:underline"
        >
          Retirer ce lien éditorial
        </button>
      )}

      <div className="mt-4 rounded-xl border border-line p-3">
        <p className="mb-1 text-[10px] tracking-[0.2em] text-faint uppercase">Responsive actif</p>
        <p className="text-xs leading-relaxed text-muted">
          {device === "desktop" ? "Les propriétés X, Y, largeur, hauteur et taille de police modifient Desktop." : `X, Y, largeur, hauteur et taille de police modifient uniquement ${device === "tablet" ? "Tablette" : "Mobile"}. Les valeurs sans override héritent du Desktop, adaptées à la largeur de référence.`}
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-faint">Le contenu, la rotation, l’opacité et les autres styles sans stockage responsive restent partagés entre les appareils.</p>
        {responsiveEnabled && device !== "desktop" && hasFrameOverride && (
          <button type="button" onClick={() => onResponsive(device, { x: null, y: null, w: null, h: null })} className="mt-2 text-xs text-gold hover:underline">Réinitialiser les dimensions de ce mode</button>
        )}
      </div>
      </fieldset>
    </div>
  );
}
