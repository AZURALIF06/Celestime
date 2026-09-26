"use client";

// Célestime — Configurateur.
// UX inspirée de l'éditeur de carte du ciel de Momenterie (organisation,
// prévisualisation temps réel, choix visuels, prix visible, CTA, mobile) —
// mais 100 % du contenu (options, formats, prix, textes) vient de Célestime.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BACKGROUNDS,
  FRAME,
  LIMITS,
  OCCASIONS,
  SHAPES,
  SIZES,
  YEAR_MIN,
  YEAR_MAX,
  backgroundById,
  productBySlug,
  shapeById,
  sizeById,
} from "@/lib/options";
import {
  clearDraft,
  editorReducer,
  initEditorState,
  loadDraft,
  saveCreation,
  saveDraft,
  type SavedCreation,
} from "@/lib/editor";
import { validateConfig } from "@/lib/rules";
import { calculatePrice, eur } from "@/lib/pricing";
import type { ProductPriceTables } from "@/lib/options";

interface CatalogProduct {
  slug: string;
  name: string;
  prices: ProductPriceTables;
  sizes: string[];
  shapes: string[];
  backgrounds: string[];
  framed: boolean;
}
import { track } from "@/lib/track";
import { useCart } from "./cart-context";
import { StarMapCanvas, useSky } from "./starmap-canvas";
import { formatDecimal } from "@/lib/astro";
import type { BackgroundId, CreationConfig, GeocodeResult, RuleNote, ShapeId, SizeId } from "@/lib/types";

function useIsDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const f = () => setD(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return d;
}

function Section({
  num,
  title,
  hint,
  innerRef,
  children,
  defaultOpen = false,
}: {
  num: string;
  title: string;
  hint?: string;
  innerRef?: (el: HTMLElement | null) => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(defaultOpen);
  if (isDesktop) {
    return (
      <section ref={innerRef} className="rounded-xl border border-line bg-surface/60 p-5">
        <div className="mb-4 flex items-baseline gap-3">
          <span className="font-display text-2xl text-gold/80">{num}</span>
          <div>
            <h2 className="text-[13px] font-medium tracking-[0.2em] text-ink uppercase">{title}</h2>
            {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
          </div>
        </div>
        {children}
      </section>
    );
  }
  return (
    <section ref={innerRef} className="overflow-hidden rounded-xl border border-line bg-surface/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-baseline gap-3">
          <span className="font-display text-xl text-gold/80">{num}</span>
          <span className="text-[13px] font-medium tracking-[0.18em] text-ink uppercase">{title}</span>
        </span>
        <span className="text-xl leading-none text-muted">{open ? "−" : "+"}</span>
      </button>
      <div className={open ? "block border-t border-line px-4 py-4" : "hidden"}>{children}</div>
    </section>
  );
}

function CharCounter({ value, max }: { value: string; max: number }) {
  return (
    <span className={`text-[11px] tabular-nums ${value.length >= max ? "text-danger" : "text-faint"}`}>
      {value.length}/{max}
    </span>
  );
}

const STEPS = [
  { id: "moment", label: "Moment" },
  { id: "fond", label: "Fond" },
  { id: "forme", label: "Forme" },
  { id: "texte", label: "Texte" },
  { id: "format", label: "Format" },
  { id: "recap", label: "Récapitulatif" },
];

export default function Editor({ productId, catalog }: { productId?: string; catalog?: CatalogProduct[] }) {
  const router = useRouter();
  const { cartId, refresh } = useCart();
  const [state, dispatch] = useReducer(editorReducer, undefined, initEditorState);
  const { config, notes } = state;
  // Définition servie par l'administration (base) — repli statique si indisponible
  const product: CatalogProduct = catalog?.find((p) => p.slug === config.productId) ??
    productBySlug(config.productId) ?? productBySlug("etoiles-de-naissance")!;
  const [activeStep, setActiveStep] = useState(1);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<SavedCreation | null>(null);
  const [zoom, setZoom] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const sky = useSky(config);
  const price = useMemo(() => calculatePrice(config), [config]);
  const patch = useCallback((p: Partial<CreationConfig>) => dispatch({ type: "PATCH", patch: p }), []);

  const refs = {
    moment: useRef<HTMLElement | null>(null),
    fond: useRef<HTMLElement | null>(null),
    forme: useRef<HTMLElement | null>(null),
    texte: useRef<HTMLElement | null>(null),
    format: useRef<HTMLElement | null>(null),
    recap: useRef<HTMLElement | null>(null),
  };

  // Chargement initial : reprise de brouillon ou édition depuis le panier
  const editId = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    editId.current = params.get("edit");
    track("editor_opened", { productId: config.productId, edit: Boolean(editId.current) });
    if (editId.current) {
      setLoadingEdit(true);
      fetch(`/api/cart/item?id=${encodeURIComponent(editId.current)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.config) dispatch({ type: "LOAD", config: d.config });
          else setToast("Cette création n'est plus disponible dans votre panier.");
        })
        .finally(() => setLoadingEdit(false));
    } else {
      const draft = loadDraft();
      if (draft) setResumeDraft(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si on arrive d'une fiche produit
  useEffect(() => {
    if (productId) dispatch({ type: "RESET", productId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, catalog]);

  // Sauvegarde automatique du brouillon
  useEffect(() => {
    const t = setTimeout(() => saveDraft(config), 350);
    return () => clearTimeout(t);
  }, [config]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Analytics de progression
  const completedDate = validateConfig(config).date === undefined;
  const prev = useRef({ date: false, loc: null as string | null });
  useEffect(() => {
    if (completedDate && !prev.current.date) track("date_completed", { productId: config.productId });
    if (config.location && config.location.name !== prev.current.loc) {
      track("location_completed", { city: config.location.name });
      prev.current.loc = config.location.name;
    }
    prev.current.date = completedDate;
  }, [completedDate, config.location, config.productId]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (state.dirty) {
        track("editor_abandoned");
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [state.dirty]);

  const goTo = (id: string, step: number) => {
    setActiveStep(step);
    const r = (refs as Record<string, { current: HTMLElement | null }>)[id];
    r?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addToCart = async () => {
    const errs = validateConfig(config);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = Object.keys(errs)[0];
      const map: Record<string, string> = { date: "moment", time: "moment", location: "moment", name: "texte" };
      const target = (refs as Record<string, { current: HTMLElement | null }>)[map[first] ?? "moment"];
      target?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId, config, quantity: config.quantity }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setToast(d?.error ?? "Impossible d'ajouter votre création au panier. Réessayez.");
        return;
      }
      const d = await res.json();
      if (d.price && d.price.total !== price.total) {
        setToast("Le prix a été confirmé par le serveur et correspond exactement à votre création.");
      }
      saveCreation(config);
      track("customization_completed", { productId: config.productId });
      track("add_to_cart", { total: d.price?.total });
      refresh();
      router.push("/cart");
    } catch {
      setToast("Une erreur est survenue. Votre création est sauvegardée sur cet appareil.");
    } finally {
      setAdding(false);
    }
  };

  const saveNow = () => {
    saveCreation(config);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  if (loadingEdit) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-32">
        <div className="anim-pulse-soft h-10 w-10 rounded-full border-2 border-gold border-t-transparent" />
        <p className="mt-6 text-sm tracking-[0.18em] text-muted uppercase">On recharge votre création…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-3 pt-4 pb-28 sm:px-6 lg:pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.26em] text-gold uppercase" aria-live="polite">
            Étape {activeStep} sur 6 — {STEPS[activeStep - 1]?.label}
          </p>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            {product.name} <span className="text-goldsoft italic">personnalisée</span>
          </h1>
        </div>
        <nav aria-label="Étapes" className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(s.id, i + 1)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] tracking-[0.14em] uppercase transition-colors ${
                activeStep === i + 1 ? "border-gold bg-gold/10 text-gold" : "border-line text-muted hover:border-gold/50 hover:text-ink"
              }`}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </nav>
      </div>

      {resumeDraft && (
        <div className="anim-fade-up mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/5 px-4 py-3">
          <p className="text-sm text-ink">
            <span className="text-gold">Reprendre votre création ?</span>{" "}
            <span className="text-muted">
              « {resumeDraft.name} » modifiée le {new Date(resumeDraft.updatedAt).toLocaleDateString("fr-FR")}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                dispatch({ type: "LOAD", config: resumeDraft.config });
                setResumeDraft(null);
              }}
              className="rounded-full bg-gold px-4 py-1.5 text-[12px] font-medium tracking-wide text-night"
            >
              Reprendre
            </button>
            <button
              onClick={() => {
                dispatch({ type: "RESET", productId: config.productId });
                setResumeDraft(null);
                clearDraft();
              }}
              className="rounded-full border border-line px-4 py-1.5 text-[12px] tracking-wide text-muted hover:text-ink"
            >
              Commencer à neuf
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 lg:grid lg:grid-cols-[370px_minmax(0,1fr)_370px] lg:items-start lg:gap-6">
        {/* ---------- PRÉVISUALISATION ---------- */}
        <div className="lg:order-2 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-line bg-surface/70 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] tracking-[0.24em] text-muted uppercase">Prévisualisation</p>
              <div className="flex items-center gap-1" role="group" aria-label="Zoom de prévisualisation">
                <button
                  onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                  disabled={zoom <= 1}
                  aria-label="Zoom arrière"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:text-ink disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-12 text-center text-[11px] tabular-nums text-faint">{Math.round(zoom * 100)} %</span>
                <button
                  onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                  disabled={zoom >= 2.5}
                  aria-label="Zoom avant"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:text-ink disabled:opacity-30"
                >
                  +
                </button>
                <button
                  onClick={() => setZoom(1)}
                  aria-label="Réinitialiser le zoom"
                  className="ml-1 flex h-8 items-center justify-center rounded-full border border-line px-2.5 text-[11px] tracking-wide text-muted uppercase transition-colors hover:text-ink"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="no-scrollbar mt-4 flex justify-center overflow-auto" style={{ maxHeight: "62vh" }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform .25s ease" }}>
                <PosterFrame framed={config.framed}>
                  <StarMapCanvas config={config} sky={sky.sky} className="w-full" />
                </PosterFrame>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
              {sky.sky ? (
                <>
                  <span className="text-xs text-muted">
                    {sky.sky.stars.length.toLocaleString("fr-FR")} étoiles réelles · calcul en {Math.max(1, Math.round(sky.computeMs))} ms
                  </span>
                  <span className="text-xs text-faint">
                    {config.location?.name} · {formatDecimal(config.location!.latitude, true)} · {formatDecimal(config.location!.longitude, false)}
                  </span>
                  {sky.sky.sunAlt > 0 && (
                    <span className="rounded-full border border-line px-3 py-1 text-[11px] text-muted">
                      Ce moment était de jour — les étoiles sont positionnées telles qu'elles étaient.
                    </span>
                  )}
                </>
              ) : (
                <p className="max-w-sm text-xs leading-relaxed text-muted">
                  Renseignez la date, l'heure et le lieu : votre Célestime sera alors recomposée à partir du
                  catalogue des étoiles réelles, sans aucune image générique.
                </p>
              )}
            </div>

            {notes.map((n: RuleNote, i: number) => (
              <p key={i} className="anim-fade-up mt-3 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-center text-xs text-goldsoft">
                {n.message}
              </p>
            ))}
            {toast && <p className="anim-fade-up mt-3 rounded-lg border border-line bg-raised px-3 py-2 text-center text-xs text-ink">{toast}</p>}
          </div>
        </div>

        {/* ---------- OPTIONS (Célestime uniquement) ---------- */}
        <div className="mt-4 space-y-4 lg:order-1 lg:mt-0">
          <Section num="1" title="Votre moment" hint="Le moment à immortaliser" innerRef={(el) => (refs.moment.current = el)} defaultOpen>
            <div>
              <label className="text-xs tracking-[0.16em] text-muted uppercase" htmlFor="date">
                La date
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="date"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="JJ"
                  value={config.day}
                  onChange={(e) => patch({ day: e.target.value.replace(/\D/g, "") })}
                  className="w-16 rounded-lg border border-line bg-night px-3 py-2.5 text-center text-sm text-ink tabular-nums placeholder:text-faint focus:border-gold"
                  aria-label="Jour"
                />
                <span className="flex items-center text-faint">/</span>
                <input
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={config.month}
                  onChange={(e) => patch({ month: e.target.value.replace(/\D/g, "") })}
                  className="w-16 rounded-lg border border-line bg-night px-3 py-2.5 text-center text-sm text-ink tabular-nums placeholder:text-faint focus:border-gold"
                  aria-label="Mois"
                />
                <span className="flex items-center text-faint">/</span>
                <input
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="AAAA"
                  value={config.year}
                  onChange={(e) => patch({ year: e.target.value.replace(/\D/g, "") })}
                  className="w-24 rounded-lg border border-line bg-night px-3 py-2.5 text-center text-sm text-ink tabular-nums placeholder:text-faint focus:border-gold"
                  aria-label="Année"
                />
              </div>
              {errors.date ? (
                <p className="mt-1.5 text-xs text-danger">{errors.date}</p>
              ) : (
                <p className="mt-1.5 text-xs text-faint">
                  Plage supportée : {YEAR_MIN} – {YEAR_MAX}.
                </p>
              )}
            </div>

            <div className="mt-4">
              <label className="text-xs tracking-[0.16em] text-muted uppercase" htmlFor="heure">
                L'heure locale
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id="heure"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="HH"
                  value={config.timeApprox ? "" : config.hour}
                  disabled={config.timeApprox}
                  onChange={(e) => patch({ hour: e.target.value.replace(/\D/g, "") })}
                  className="w-16 rounded-lg border border-line bg-night px-3 py-2.5 text-center text-sm text-ink tabular-nums placeholder:text-faint focus:border-gold disabled:opacity-40"
                  aria-label="Heures"
                />
                <span className="text-faint">:</span>
                <input
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={config.timeApprox ? "" : config.minute}
                  disabled={config.timeApprox}
                  onChange={(e) => patch({ minute: e.target.value.replace(/\D/g, "") })}
                  className="w-16 rounded-lg border border-line bg-night px-3 py-2.5 text-center text-sm text-ink tabular-nums placeholder:text-faint focus:border-gold disabled:opacity-40"
                  aria-label="Minutes"
                />
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={config.timeApprox}
                    onChange={(e) => patch({ timeApprox: e.target.checked })}
                    className="h-4 w-4 accent-[#c9a86a]"
                  />
                  Je ne connais pas l'heure exacte
                </label>
              </div>
              {config.timeApprox && (
                <p className="mt-2 rounded-lg border border-line bg-raised px-3 py-2 text-xs leading-relaxed text-muted">
                  L'heure sera estimée à 12 h 00, l'heure locale de midi, et la carte l'indiquera
                  clairement (« heure approximative »). Nous ne présentons jamais une heure estimée comme exacte.
                </p>
              )}
              {errors.time && <p className="mt-1.5 text-xs text-danger">{errors.time}</p>}
            </div>

            <LocationField config={config} onPick={(loc) => dispatch({ type: "LOCATION", location: loc })} error={errors.location} />
          </Section>

          <Section num="2" title="Fond du poster" hint="La couleur de votre création" innerRef={(el) => (refs.fond.current = el)}>
            <div className="grid grid-cols-3 gap-2.5">
              {product.backgrounds.map((id) => {
                const b = backgroundById(id);
                return (
                  <button
                    key={id}
                    onClick={() => patch({ background: id as BackgroundId })}
                    aria-pressed={config.background === id}
                    className={`group overflow-hidden rounded-xl border transition-all ${
                      config.background === id ? "border-gold ring-1 ring-gold" : "border-line hover:border-gold/50"
                    }`}
                  >
                    <span className="block h-16 w-full" style={{ background: b.swatch }} aria-hidden="true" />
                    <span className="block px-2 py-2 text-center text-xs text-ink">{b.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section num="3" title="Forme du ciel" hint="Le cœur de votre Célestime" innerRef={(el) => (refs.forme.current = el)}>
            <div className="grid grid-cols-2 gap-2.5">
              {product.shapes.map((id) => {
                const s = shapeById(id);
                return (
                  <button
                    key={id}
                    onClick={() => patch({ shape: id as ShapeId })}
                    aria-pressed={config.shape === id}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-all ${
                      config.shape === id ? "border-gold bg-gold/10" : "border-line hover:border-gold/50"
                    }`}
                  >
                    {id === "medaillon" ? (
                      <svg viewBox="0 0 48 48" className={`h-12 w-12 ${config.shape === id ? "text-gold" : "text-muted"}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <circle cx="24" cy="24" r="17" />
                        <circle cx="19" cy="19" r="1.2" fill="currentColor" stroke="none" />
                        <circle cx="29" cy="22" r="0.9" fill="currentColor" stroke="none" />
                        <circle cx="26" cy="30" r="1.1" fill="currentColor" stroke="none" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 48 48" className={`h-12 w-12 ${config.shape === id ? "text-gold" : "text-muted"}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M24 40C13 31 9 24.5 9 18.5 9 13 13.2 9 18.2 9c2.6 0 4.8 1.2 5.8 3.1C25 10.2 27.2 9 29.8 9 34.8 9 39 13 39 18.5c0 6-4 12.5-15 21.5z" strokeLinejoin="round" />
                        <circle cx="20" cy="19" r="1" fill="currentColor" stroke="none" />
                        <circle cx="29" cy="22" r="0.8" fill="currentColor" stroke="none" />
                      </svg>
                    )}
                    <span className="text-center text-xs text-ink">{s.label}</span>
                    <span className="text-center text-[10px] leading-tight text-faint">{s.desc}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section num="4" title="Nom & message" hint="Les mots qui accompagnent le ciel" innerRef={(el) => (refs.texte.current = el)}>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="nom" className="text-xs tracking-[0.16em] text-muted uppercase">
                    Nom, prénom ou surnom
                  </label>
                  <CharCounter value={config.name} max={LIMITS.name} />
                </div>
                <input
                  id="nom"
                  value={config.name}
                  maxLength={LIMITS.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Camille — ou « Louise & Arnaud »"
                  className="mt-1.5 w-full rounded-lg border border-line bg-night px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-gold"
                />
                {errors.name && <p className="mt-1 text-xs text-danger">{errors.name}</p>}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="message" className="text-xs tracking-[0.16em] text-muted uppercase">
                    Message personnalisé
                  </label>
                  <CharCounter value={config.message} max={LIMITS.message} />
                </div>
                <textarea
                  id="message"
                  value={config.message}
                  maxLength={LIMITS.message}
                  rows={3}
                  onChange={(e) => patch({ message: e.target.value })}
                  placeholder={OCCASIONS[config.occasion]?.placeholder}
                  className="mt-1.5 w-full resize-none rounded-lg border border-line bg-night px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-gold"
                />
                <p className="mt-1 text-[11px] leading-relaxed text-faint">
                  Reproduit sur votre carte et sur le carton d'accompagnement A6 du coffret.
                </p>
              </div>
            </div>
          </Section>
        </div>

        {/* ---------- FORMAT + RÉCAP ---------- */}
        <div className="no-scrollbar mt-4 space-y-4 lg:order-3 lg:mt-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto">
          <Section num="5" title="Format & cadre" innerRef={(el) => (refs.format.current = el)}>
            <div className="grid grid-cols-2 gap-2">
              {product.sizes.map((id) => {
                const s = sizeById(id);
                return (
                  <button
                    key={id}
                    onClick={() => patch({ size: id as SizeId })}
                    aria-pressed={config.size === id}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      config.size === id ? "border-gold bg-gold/10" : "border-line hover:border-gold/50"
                    }`}
                  >
                    <span className="flex items-baseline justify-between">
                      <span className="font-display text-xl text-ink">
                        {s.label} <span className="text-sm text-gold">{s.tag}</span>
                      </span>
                      <span className="text-xs tabular-nums text-gold">{eur((product.prices.base as Record<string, number>)[id] ?? 0)}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] tabular-nums text-faint">
                      {s.w.toLocaleString("fr-FR")} × {s.h.toLocaleString("fr-FR")} cm
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 mb-2 text-xs tracking-[0.16em] text-muted uppercase">Le cadre</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => patch({ framed: false })}
                aria-pressed={!config.framed}
                className={`rounded-xl border p-3 text-left transition-all ${
                  !config.framed ? "border-gold bg-gold/10" : "border-line hover:border-gold/50"
                }`}
              >
                <span className="block text-sm text-ink">Sans cadre</span>
                <span className="mt-0.5 block text-[11px] text-faint">Poster satiné 250 g, présenté avec soin</span>
              </button>
              {product.framed && (
                <button
                  onClick={() => patch({ framed: true })}
                  aria-pressed={config.framed}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    config.framed ? "border-gold bg-gold/10" : "border-line hover:border-gold/50"
                  }`}
                >
                  <span className="flex items-center justify-between text-sm text-ink">
                    <span>Avec cadre</span>
                    <span className="text-xs tabular-nums text-gold">+ {eur(product.prices.frame[config.size] ?? 0)}</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-faint">{FRAME.label}</span>
                </button>
              )}
            </div>
          </Section>

          <Section num="6" title="Récapitulatif" innerRef={(el) => (refs.recap.current = el)} defaultOpen>
            <div className="space-y-1.5 text-sm">
              <RecapRow k="Produit" v={product.name} />
              {config.name && <RecapRow k="Nom" v={config.name} />}
              <RecapRow k="Date" v={config.day && config.month && config.year ? `${config.day}/${config.month}/${config.year}` : "—"} />
              <RecapRow k="Heure" v={config.timeApprox ? "≈ 12h00 (approximative)" : config.hour && config.minute ? `${config.hour}h${config.minute}` : "—"} />
              <RecapRow k="Lieu" v={config.location ? `${config.location.name}, ${config.location.country}` : "—"} />
              <RecapRow k="Fond" v={backgroundById(config.background).label} />
              <RecapRow k="Forme" v={shapeById(config.shape).label} />
              <RecapRow
                k="Format"
                v={`${config.size} (${sizeById(config.size).w} × ${sizeById(config.size).h} cm) — ${sizeById(config.size).tag}`}
              />
              <RecapRow k="Cadre" v={config.framed ? FRAME.label : "Sans cadre"} />
              <RecapRow k="Quantité" v={String(config.quantity)} />
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[11px] tracking-[0.24em] text-muted uppercase">Votre création</p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Carte {config.size}{config.framed ? " encadrée" : ""}</dt>
                  <dd className="tabular-nums text-ink">
                    {eur((product.prices.base[config.size] ?? 0) + (product.prices.shapeExtra?.[config.shape]?.[config.size] ?? 0) + (config.framed ? product.prices.frame[config.size] ?? 0 : 0))}
                    {config.quantity > 1 ? ` × ${config.quantity}` : ""}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Livraison</dt>
                  <dd className="text-ink">Offerte</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-base">
                  <dt className="text-ink">Total</dt>
                  <dd className="font-display text-xl text-gold tabular-nums">{eur(price.total)}</dd>
                </div>
              </dl>
            </div>

            {Object.keys(errors).length === 0 ? (
              <p className="mt-4 text-center text-sm text-goldsoft">
                Votre création est prête — <span className="italic">elle contient aussi le certificat d'authenticité et le carton A6 avec votre message.</span>
              </p>
            ) : (
              <ul className="mt-4 space-y-1 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                {Object.values(errors).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}

            <button
              onClick={addToCart}
              disabled={adding}
              className="mt-4 w-full rounded-full bg-gold py-3.5 text-sm font-medium tracking-[0.18em] text-night uppercase transition-all hover:bg-goldsoft disabled:opacity-60"
            >
              {adding ? "Ajout en cours…" : `Ajouter au panier · ${eur(price.total)}`}
            </button>
            <button
              onClick={saveNow}
              className="mt-2 w-full rounded-full border border-line py-3 text-sm tracking-[0.14em] text-muted uppercase transition-colors hover:border-gold hover:text-ink"
            >
              {savedFlash ? "Création sauvegardée ✓" : "Sauvegarder ma création"}
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-faint">
              Prix Célestime TTC · Livraison offerte · Le prix est vérifié par le serveur à l'ajout au panier et au paiement.
            </p>
          </Section>
        </div>
      </div>

      {/* Barre sticky mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-night/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-[0.2em] text-muted uppercase">Total TTC · livraison offerte</p>
            <p className="font-display text-2xl text-gold tabular-nums">{eur(price.total)}</p>
          </div>
          <button
            onClick={addToCart}
            disabled={adding}
            className="rounded-full bg-gold px-7 py-3 text-sm font-medium tracking-[0.14em] text-night uppercase transition-all hover:bg-goldsoft disabled:opacity-60"
          >
            {adding ? "…" : "Ajouter au panier"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RecapRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-faint">{k}</dt>
      <dd className="truncate text-right text-ink">{v || "—"}</dd>
    </div>
  );
}

/** Cadre bois naturel (Celstime) : apparaît autour de la preview sans modifier la carte. */
function PosterFrame({ framed, children }: { framed: boolean; children: React.ReactNode }) {
  return (
    <div className="relative w-[70vw] max-w-[400px]">
      <div
        className="p-2 shadow-2xl shadow-black/60 transition-all duration-500 sm:p-2.5"
        style={{
          background: framed
            ? "repeating-linear-gradient(95deg,#c8a06a 0 7px,#b98f5c 7px 15px,#cfa878 15px 26px,#b3854f 26px 34px)"
            : "transparent",
        }}
      >
        <div className="overflow-hidden" style={{ borderRadius: framed ? 3 : 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function LocationField({
  config,
  onPick,
  error,
}: {
  config: CreationConfig;
  onPick: (loc: GeocodeResult | null) => void;
  error?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<(GeocodeResult & { via: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setNotFound(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`);
        const d = await res.json();
        setResults(d.results ?? []);
        setNotFound(d.notFound ?? null);
        setOpen(true);
      } catch {
        setNotFound("Service momentanément indisponible. Réessayez.");
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (config.location) {
    return (
      <div className="mt-4">
        <p className="text-xs tracking-[0.16em] text-muted uppercase">Le lieu</p>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/5 px-4 py-3">
          <div>
            <p className="text-sm text-ink">
              {config.location.name}, {config.location.country}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-faint">
              {formatDecimal(config.location.latitude, true)} · {formatDecimal(config.location.longitude, false)} · {config.location.timezone}
            </p>
          </div>
          <button
            onClick={() => {
              onPick(null);
              setQ("");
              setOpen(true);
            }}
            className="rounded-full border border-line px-3 py-1.5 text-[11px] tracking-wide text-muted uppercase hover:border-gold hover:text-ink"
          >
            Modifier
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative mt-4" ref={boxRef}>
      <label className="text-xs tracking-[0.16em] text-muted uppercase" htmlFor="lieu">
        Le lieu
      </label>
      <div className="relative mt-2">
        <input
          id="lieu"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setNotFound(null);
          }}
          onFocus={() => q.length >= 2 && setOpen(true)}
          placeholder="Rechercher une ville — Cannes, Alger, Montréal…"
          autoComplete="off"
          className="w-full rounded-lg border border-line bg-night px-3.5 py-2.5 pr-10 text-sm text-ink placeholder:text-faint focus:border-gold"
        />
        {loading && (
          <span className="anim-pulse-soft absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-gold border-t-transparent" aria-hidden="true" />
        )}
      </div>
      {open && (q.trim().length >= 2 || notFound) && (
        <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface shadow-2xl shadow-black/60">
          {results.map((r) => (
            <button
              key={`${r.name}-${r.latitude}-${r.longitude}`}
              onClick={() => {
                onPick(r);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised"
            >
              <span className="text-sm text-ink">{r.name}</span>
              <span className="shrink-0 text-xs text-faint">
                {r.country} · {r.latitude.toFixed(2)}° {r.longitude.toFixed(2)}°
              </span>
            </button>
          ))}
          {results.length === 0 && notFound && <p className="px-4 py-3 text-xs text-muted">{notFound}</p>}
          {results.length === 0 && !notFound && <p className="px-4 py-3 text-xs text-faint">Recherche…</p>}
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

// Lien utilitaire conservé pour d'éventuelles extensions
export { Link };
