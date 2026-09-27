"use client";

// Célestime — rendu des éléments CMS (partagé entre le site public et l'éditeur).

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CmsElement } from "@/lib/cms";
import type { DbProduct } from "@/lib/catalog";
import { eur } from "@/lib/pricing";

const FONTS: Record<string, string> = {
  serif: "'Cormorant Garamond', Georgia, serif",
  sans: "'Jost', 'Helvetica Neue', Arial, sans-serif",
  script: "'Parisienne', cursive",
  elegant: "'Great Vibes', cursive",
  modern: "'Montserrat', sans-serif",
};

function textFont(el: CmsElement): string {
  return FONTS[el.style?.fontFamily] ?? FONTS.sans;
}

function textStyle(el: CmsElement) {
  const s = el.style ?? {};
  return {
    fontFamily: textFont(el),
    fontSize: s.size ?? 16,
    fontWeight: s.weight ?? 400,
    fontStyle: s.italic ? "italic" : "normal",
    color: s.color ?? "#ece9e2",
    textAlign: s.align ?? ("left" as const),
    lineHeight: s.lineHeight ?? 1.5,
    letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined,
    wordBreak: "break-word" as const,
  };
}

function Countdown({ date, label }: { date?: string; label?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = date ? new Date(date).getTime() : 0;
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const Cell = ({ v, l }: { v: number; l: string }) => (
    <div className="flex flex-col items-center rounded-xl bg-night/60 px-3 py-2">
      <span className="font-display text-2xl tabular-nums text-goldsoft">{String(v).padStart(2, "0")}</span>
      <span className="text-[9px] tracking-[0.2em] text-faint uppercase">{l}</span>
    </div>
  );
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      {label && <p className="text-xs tracking-[0.2em] text-muted uppercase">{label}</p>}
      <div className="flex gap-2">
        <Cell v={d} l="jours" />
        <Cell v={h} l="heures" />
        <Cell v={m} l="min" />
        <Cell v={s} l="sec" />
      </div>
    </div>
  );
}

export function ElementView({ el, products = [] }: { el: CmsElement; products?: DbProduct[] }) {
  const s = el.style ?? {};
  const c = el.content ?? {};
  const inner = (() => {
    switch (el.type) {
      case "text": {
        const st = textStyle(el);
        if (c.variant === "h1" || c.variant === "h2" || c.variant === "h3") {
          const Tag = (c.variant === "h1" ? "h1" : c.variant === "h2" ? "h2" : "h3") as "h1";
          return <Tag style={{ ...st, margin: 0, lineHeight: 1.15 }}>{c.text}</Tag>;
        }
        if (c.variant === "quote") return <p style={{ ...st, margin: 0 }}>"{c.text}"</p>;
        if (c.variant === "list")
          return (
            <ul style={{ ...st, margin: 0, paddingLeft: 18 }}>
              {String(c.text ?? "").split("\n").filter(Boolean).map((li, i) => (
                <li key={i}>{li}</li>
              ))}
            </ul>
          );
        if (c.variant === "price") return <p style={{ ...st, margin: 0 }}>{c.text}</p>;
        if (c.variant === "link")
          return (
            <Link href={el.link || "#"} style={{ ...st, color: s.color ?? "#c9a86a", textDecoration: "none" }}>
              {c.text}
            </Link>
          );
        if (c.variant === "breadcrumb")
          return <p style={{ ...st, margin: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>{c.text}</p>;
        if (c.variant === "review") return <p style={{ ...st, margin: 0 }}>{c.text}</p>;
        return <p style={{ ...st, margin: 0 }}>{c.text}</p>;
      }
      case "image":
        return (
          <img
            src={c.src}
            alt={c.alt ?? ""}
            style={{
              width: "100%",
              height: "100%",
              objectFit: c.fit ?? "cover",
              borderRadius: c.radius ?? 0,
              border: c.border ? "1px solid #22263a" : undefined,
              boxShadow: c.shadow ? "0 24px 60px rgba(0,0,0,0.5)" : undefined,
              display: "block",
            }}
            draggable={false}
          />
        );
      case "video": {
        const src = String(c.url ?? "");
        const embed = src.includes("youtube.com/watch") ? src.replace("watch?v=", "embed/") : src;
        return <iframe src={embed} title="Vidéo" style={{ width: "100%", height: "100%", border: 0, borderRadius: s.radius ?? 0 }} allowFullScreen />;
      }
      case "icon":
        return (
          <div className="flex h-full w-full items-center justify-center">
            <svg viewBox="0 0 24 24" style={{ width: c.size ?? 40, height: c.size ?? 40, color: c.color ?? "#c9a86a" }} fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.1 6.6L21 12l-6.9 3.4L12 22l-2.1-6.6L3 12l6.9-3.4L12 2z" />
            </svg>
          </div>
        );
      case "button":
        return (
          <div className="flex h-full w-full items-center justify-center">
            <Link
              href={c.href || "#"}
              style={{
                display: "inline-block",
                padding: "14px 30px",
                borderRadius: s.radius ?? 999,
                background: s.bg ?? "#c9a86a",
                color: s.color ?? "#06070c",
                fontSize: s.size ?? 15,
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                textDecoration: "none",
                boxShadow: s.shadow ? "0 12px 30px rgba(201,168,106,0.25)" : undefined,
                fontFamily: "'Jost', sans-serif",
                maxWidth: "100%",
                textAlign: "center",
              }}
            >
              {c.text}
            </Link>
          </div>
        );
      case "divider":
        return <hr style={{ border: 0, height: c.width ?? 1, background: c.color ?? "#22263a", margin: 0 }} />;
      case "spacer":
        return <div className="h-full w-full" aria-hidden="true" />;
      case "section":
        return (
          <div
            className="h-full w-full"
            style={{
              background: s.bg ?? "rgba(255,255,255,0.03)",
              borderRadius: s.radius ?? 0,
              border: s.border ? "1px solid #22263a" : undefined,
            }}
          />
        );
      case "promo":
        return (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-1 px-4 text-center"
            style={{ background: s.bg ?? "#1d2547", borderRadius: s.radius ?? 16 }}
          >
            <p className="font-display text-2xl text-goldsoft">{c.text}</p>
            {c.badge && <p className="text-[11px] tracking-[0.2em] text-muted uppercase">{c.badge}</p>}
          </div>
        );
      case "countdown":
        return <Countdown date={c.date} label={c.label} />;
      case "newsletter":
        return (
          <form
            className="flex h-full w-full flex-col items-center justify-center gap-3 px-4"
            style={{ background: s.bg ?? "#0c0e16", borderRadius: s.radius ?? 16, border: "1px solid #22263a" }}
            onSubmit={async (e) => {
              e.preventDefault();
              const input = (e.currentTarget.querySelector("input") as HTMLInputElement)?.value ?? "";
              if (input.includes("@")) {
                await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: input }) }).catch(() => {});
                (e.currentTarget.querySelector("input") as HTMLInputElement).value = "";
                alert("Merci ! Vous recevrez la lettre céleste.");
              }
            }}
          >
            {c.text && <p className="text-sm text-ink">{c.text}</p>}
            <div className="flex w-full max-w-sm gap-2">
              <input type="email" required placeholder="votre@email.fr" aria-label="Votre e-mail" className="w-full rounded-full border border-line bg-night px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-gold" />
              <button className="rounded-full bg-gold px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-night uppercase">OK</button>
            </div>
          </form>
        );
      case "form":
        return (
          <div className="flex h-full w-full flex-col gap-2.5 overflow-hidden p-4" style={{ background: s.bg ?? "#0c0e16", borderRadius: s.radius ?? 16, border: "1px solid #22263a" }}>
            {c.text && <p className="text-sm font-medium text-ink">{c.text}</p>}
            <input placeholder="Votre nom" aria-label="Votre nom" className="rounded-lg border border-line bg-night px-3 py-2 text-sm text-ink placeholder:text-faint" />
            <input type="email" placeholder="Votre e-mail" aria-label="Votre e-mail" className="rounded-lg border border-line bg-night px-3 py-2 text-sm text-ink placeholder:text-faint" />
            <textarea rows={3} placeholder="Votre message" aria-label="Votre message" className="w-full resize-none rounded-lg border border-line bg-night px-3 py-2 text-sm text-ink placeholder:text-faint" />
            <button className="rounded-full bg-gold py-2.5 text-xs font-medium tracking-[0.14em] text-night uppercase">Envoyer</button>
          </div>
        );
      case "testimonials":
        return (
          <div className="h-full w-full overflow-hidden">
            <h3 className="mb-3 text-center font-display text-2xl text-ink">{c.title ?? "Ils ont trouvé leur ciel"}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ["« Le site est clair, la livraison a été rapide et les produits correspondent parfaitement aux photos. »", "Cliente vérifiée"],
                ["« Belle qualité d'impression et livraison rapide. Le résultat reste superbe. »", "Client vérifié"],
                ["« Très joli rendu, bien emballé. Ça valait la peine d'attendre. »", "Cliente vérifiée"],
              ].map(([q, who], i) => (
                <figure key={i} className="rounded-xl border border-line bg-night/60 p-4">
                  <div className="text-xs text-gold">★★★★★</div>
                  <blockquote className="mt-2 font-display text-sm italic text-ink">{q}</blockquote>
                  <figcaption className="mt-2 text-[10px] tracking-[0.16em] text-muted uppercase">{who}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        );
      case "faq": {
        const legacyItems = [
          { question: "Que représente la carte du ciel ?", answer: "Les étoiles et les constellations visibles à la date, à l'heure et au lieu indiqués. Elle permet de garder un souvenir symbolique d'un moment important." },
          { question: "Dois-je connaître l'heure exacte ?", answer: "L'heure exacte est recommandée. Sinon, vous pouvez indiquer une heure approximative, clairement signalée comme telle." },
          { question: "Quels formats ?", answer: "A4 à A0, en medaillon ou en cœur, fond saphir, rubis ou émeraude, avec ou sans cadre." },
        ];
        const items = Array.isArray(c.items)
          ? c.items.filter((item: unknown) => {
              if (!item || typeof item !== "object") return false;
              const entry = item as { question?: unknown; answer?: unknown };
              return typeof entry.question === "string" && typeof entry.answer === "string";
            }) as { question: string; answer: string }[]
          : legacyItems;
        return (
          <section className="w-full space-y-3">
            {c.eyebrow && <p className="text-center text-[11px] tracking-[0.3em] text-gold uppercase">{c.eyebrow}</p>}
            <h1 className="mb-8 text-center font-display text-5xl text-ink">{c.title ?? "Questions fréquentes"}</h1>
            {items.map((item, i) => (
              <details key={`${item.question}-${i}`} className="group rounded-xl border border-line bg-surface/50">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-ink">
                  {item.question}<span className="text-gold transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.answer}</p>
              </details>
            ))}
            {c.contactTitle && (
              <div className="mt-12 rounded-2xl border border-line bg-surface/50 p-8 text-center">
                <h2 className="font-display text-2xl text-ink">{c.contactTitle}</h2>
                {c.contactText && <p className="mt-2 text-sm text-muted">{c.contactText}</p>}
                {c.contactLabel && c.contactHref && (
                  <Link href={c.contactHref} className="mt-5 inline-block rounded-full bg-gold px-7 py-3 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">
                    {c.contactLabel}
                  </Link>
                )}
              </div>
            )}
          </section>
        );
      }
      case "product": {
        const p = products.find((x) => x.slug === c.slug);
        if (!p) return <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-line text-xs text-faint">Produit introuvable</div>;
        return (
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface/60">
            <div className="aspect-[4/3] w-full shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={p.fullName} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h4 className="font-display text-lg leading-tight text-ink">{p.name}</h4>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{p.tagline}</p>
              <p className="mt-auto pt-2 text-sm text-gold">
                dès {eur(p.priceFrom)}
                {p.onPromo && p.oldPrice ? <span className="ml-2 text-xs text-faint line-through">{eur(p.oldPrice)}</span> : null}
              </p>
            </div>
          </div>
        );
      }
      case "productGrid": {
        const list = products
          .filter((p) => p.status === "active")
          .filter((p) => !c.category || p.slug.includes(c.category) || p.tagline.toLowerCase().includes(String(c.category).toLowerCase()))
          .slice(0, c.count ?? 4);
        return (
          <div className="h-full w-full">
            {c.title && <h3 className="mb-4 font-display text-3xl text-ink">{c.title}</h3>}
            <div className={`grid gap-4 ${list.length > 3 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
              {list.map((p) => (
                <Link key={p.id} href={`/produit/${p.slug}`} className="group overflow-hidden rounded-2xl border border-line bg-surface/60 transition-colors hover:border-gold/50">
                  <div className="aspect-[4/3] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt={p.fullName} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-4">
                    <h4 className="font-display text-lg text-ink">{p.name}</h4>
                    <p className="mt-1 text-sm text-gold">dès {eur(p.priceFrom)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      }
      case "breadcrumb":
        return <p className="text-xs tracking-[0.14em] text-faint uppercase">{c.text}</p>;
      default:
        return <div className="h-full w-full rounded-lg border border-dashed border-line" />;
    }
  })();

  return <div className="h-full w-full" style={{ pointerEvents: el.type === "text" ? "auto" : undefined }}>{inner}</div>;
}
