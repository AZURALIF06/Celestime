"use client";

// Célestime — admin : header, menu, footer, livraison, TVA.

import { useEffect, useState } from "react";
import { euro, inputCls, Field } from "@/components/admin/admin-ui";

interface MenuItem {
  label: string;
  href: string;
}
interface Settings {
  announcement: string;
  logoText: string;
  ctaText: string;
  ctaHref: string;
  menu: MenuItem[];
  footer: {
    about: string;
    contact: string;
    socials: { label: string; href: string }[];
    columns: { title: string; links: [string, string][] }[];
  };
}

export default function SettingsClient({
  initialZones,
  initialTaxes,
}: {
  initialZones: { id: number; code: string; label: string; costCents: number; freeFromCents: number; delay: string }[];
  initialTaxes: { id: number; code: string; label: string; ratePerThousand: number }[];
}) {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings").then((r) => r.json()).then((d) => setS(d.settings ?? defaults()));
  }, []);

  const save = async () => {
    if (!s) return;
    await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", data: s }) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!s) return <p className="py-16 text-center text-sm text-faint">Chargement…</p>;
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-2xl border border-line bg-surface/60 p-5">
        <h2 className="text-xs tracking-[0.2em] text-gold uppercase">Header (appliqué à toutes les pages)</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Bandeau d'annonce"><input className={inputCls} value={s.announcement} onChange={(e) => set({ announcement: e.target.value })} /></Field>
          <Field label="Texte du logo"><input className={inputCls} value={s.logoText} onChange={(e) => set({ logoText: e.target.value })} /></Field>
          <Field label="Texte du bouton principal"><input className={inputCls} value={s.ctaText} onChange={(e) => set({ ctaText: e.target.value })} /></Field>
          <Field label="Lien du bouton principal"><input className={inputCls} value={s.ctaHref} onChange={(e) => set({ ctaHref: e.target.value })} /></Field>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs tracking-[0.2em] text-gold uppercase">Menu principal</h2>
          <button
            onClick={() => set({ menu: [...s.menu, { label: "Nouveau lien", href: "/" }] })}
            className="rounded-full border border-line px-4 py-1.5 text-xs text-muted hover:border-gold hover:text-ink"
          >
            + Lien
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {s.menu.map((m, i) => (
            <li key={i} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (i === 0) return;
                  const next = [...s.menu];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  set({ menu: next });
                }}
                className="w-8 rounded-lg border border-line text-center text-sm text-muted hover:text-ink"
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                onClick={() => {
                  if (i === s.menu.length - 1) return;
                  const next = [...s.menu];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  set({ menu: next });
                }}
                className="w-8 rounded-lg border border-line text-center text-sm text-muted hover:text-ink"
                aria-label="Descendre"
              >
                ↓
              </button>
              <input className={inputCls} value={m.label} onChange={(e) => set({ menu: s.menu.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} aria-label="Texte du lien" />
              <input className={inputCls} value={m.href} onChange={(e) => set({ menu: s.menu.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) })} aria-label="Lien" />
              <button onClick={() => set({ menu: s.menu.filter((_, j) => j !== i) })} className="w-8 text-danger" aria-label="Supprimer">×</button>
            </li>
          ))}
          {s.menu.length === 0 && <li className="text-sm text-faint">Aucun lien.</li>}
        </ul>
      </div>

      <div className="rounded-2xl border border-line bg-surface/60 p-5">
        <h2 className="text-xs tracking-[0.2em] text-gold uppercase">Footer</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Texte à propos"><textarea rows={2} className={`${inputCls} resize-none`} value={s.footer.about} onChange={(e) => set({ footer: { ...s.footer, about: e.target.value } })} /></Field>
          </div>
          <Field label="Coordonnées"><input className={inputCls} value={s.footer.contact} onChange={(e) => set({ footer: { ...s.footer, contact: e.target.value } })} /></Field>
          <div>
            <span className="mb-1 block text-[11px] tracking-wide text-faint uppercase">Réseaux sociaux</span>
            <div className="space-y-2">
              {s.footer.socials.map((so, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inputCls} value={so.label} placeholder="Instagram" onChange={(e) => set({ footer: { ...s.footer, socials: s.footer.socials.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } })} />
                  <input className={inputCls} value={so.href} onChange={(e) => set({ footer: { ...s.footer, socials: s.footer.socials.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) } })} />
                  <button onClick={() => set({ footer: { ...s.footer, socials: s.footer.socials.filter((_, j) => j !== i) } })} className="text-danger" aria-label="Supprimer">×</button>
                </div>
              ))}
              <button onClick={() => set({ footer: { ...s.footer, socials: [...s.footer.socials, { label: "", href: "" }] } })} className="text-xs text-gold hover:underline">+ Réseaux</button>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {s.footer.columns.map((col, i) => (
            <div key={i} className="rounded-xl border border-line bg-night/40 p-3">
              <input className={`${inputCls} mb-2 font-medium`} value={col.title} onChange={(e) => set({ footer: { ...s.footer, columns: s.footer.columns.map((c, j) => (j === i ? { ...c, title: e.target.value } : c)) } })} aria-label="Titre de colonne" />
              {col.links.map((l, j) => (
                <div key={j} className="mb-1.5 flex gap-1">
                  <input className="min-w-0 flex-1 rounded-lg border border-line bg-night px-2 py-1.5 text-xs text-ink" value={l[0]} onChange={(e) => set({ footer: { ...s.footer, columns: s.footer.columns.map((c, j2) => (j2 === i ? { ...c, links: c.links.map((x, k) => (k === j ? [e.target.value, x[1]] : x)) } : c)) } })} aria-label="Libellé" />
                  <input className="min-w-0 flex-1 rounded-lg border border-line bg-night px-2 py-1.5 text-xs text-ink" value={l[1]} onChange={(e) => set({ footer: { ...s.footer, columns: s.footer.columns.map((c, j2) => (j2 === i ? { ...c, links: c.links.map((x, k) => (k === j ? [x[0], e.target.value] : x)) } : c)) } })} aria-label="URL" />
                  <button onClick={() => set({ footer: { ...s.footer, columns: s.footer.columns.map((c, j2) => (j2 === i ? { ...c, links: c.links.filter((_, k) => k !== j) } : c)) } })} className="text-danger" aria-label="Retirer">×</button>
                </div>
              ))}
              <button onClick={() => set({ footer: { ...s.footer, columns: s.footer.columns.map((c, j) => (j === i ? { ...c, links: [...c.links, ["Nouveau lien", "/"]] } : c)) } })} className="text-xs text-gold hover:underline">+ Lien</button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface/60 p-5">
        <h2 className="text-xs tracking-[0.2em] text-gold uppercase">Livraison (zones)</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {initialZones.map((z) => (
            <li key={z.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-night/40 px-3 py-2.5">
              <span className="w-32 text-ink">{z.label}</span>
              <span className="text-muted">
                Tarif : <span className="text-gold">{z.costCents === 0 ? "gratuite" : euro(z.costCents)}</span>
                {z.freeFromCents > 0 ? ` · offerte dès ${euro(z.freeFromCents)}` : ""}
              </span>
              <span className="ml-auto text-xs text-faint">{z.delay}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-faint">Gérée en base (zones de livraison). Modifiable via l'API / la base sans toucher au code.</p>
      </div>

      <div className="rounded-2xl border border-line bg-surface/60 p-5">
        <h2 className="text-xs tracking-[0.2em] text-gold uppercase">TVA</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {initialTaxes.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-xl border border-line bg-night/40 px-3 py-2.5">
              <span className="text-ink">{t.label}</span>
              <span className="text-gold">{(t.ratePerThousand / 100).toLocaleString("fr-FR")} %</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-faint">Prix HT / TVA / TTC séparés et conservés sur chaque commande.</p>
      </div>

      <button onClick={save} className="w-full rounded-full bg-gold py-3.5 text-sm font-medium tracking-[0.18em] text-night uppercase transition-all hover:bg-goldsoft">
        {saved ? "Enregistré ✓" : "Enregistrer les modifications du site"}
      </button>
    </div>
  );
}

function defaults(): Settings {
  return {
    announcement: "Coffret avec certificat d'authenticité · Papier satiné 250 g · Livraison rapide et gratuite",
    logoText: "CÉLESTIME",
    ctaText: "Créer ma carte",
    ctaHref: "/create",
    menu: [
      { label: "Boutique", href: "/boutique" },
      { label: "Comment ça marche", href: "/comment-ca-marche" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
    footer: {
      about: "Des cartes du ciel personnalisées, recomposées à partir de données astronomiques réelles.",
      contact: "bonjour@celestime.fr · Paris",
      socials: [],
      columns: [
        { title: "Découvrir", links: [["Boutique", "/boutique"]] },
        { title: "Aide", links: [["FAQ", "/faq"]] },
        { title: "Légal", links: [["CGV", "/cgv"]] },
      ],
    },
  };
}
