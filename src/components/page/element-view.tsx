"use client";

// Célestime — rendu des éléments CMS (partagé entre le site public et l'éditeur).

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CmsElement } from "@/lib/cms";
import type { DbProduct } from "@/lib/catalog";
import { eur } from "@/lib/pricing";
import { getCmsVideoEmbedUrl, isActiveGenericCmsProduct, isValidCmsImageSource, safeCmsHref } from "@/lib/cms";

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

function CountdownCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-night/60 px-3 py-2">
      <span className="font-display text-2xl tabular-nums text-goldsoft">{String(value).padStart(2, "0")}</span>
      <span className="text-[9px] tracking-[0.2em] text-faint uppercase">{label}</span>
    </div>
  );
}

function Countdown({ date, label }: { date?: string; label?: string }) {
  const [now, setNow] = useState(0);
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
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      {label && <p className="text-xs tracking-[0.2em] text-muted uppercase">{label}</p>}
      <div className="flex gap-2">
        <CountdownCell value={d} label="jours" />
        <CountdownCell value={h} label="heures" />
        <CountdownCell value={m} label="min" />
        <CountdownCell value={s} label="sec" />
      </div>
    </div>
  );
}

function CmsImage({ src, alt, style, onLoad }: { src: unknown; alt: unknown; style: CSSProperties; onLoad?: () => void }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const safeSrc = isValidCmsImageSource(src) ? src : null;
  const safeAlt = typeof alt === "string" ? alt : "";

  if (!safeSrc || failedSrc === safeSrc) {
    return (
      <div
        role={safeAlt ? "img" : undefined}
        aria-label={safeAlt || undefined}
        aria-hidden={safeAlt ? undefined : true}
        style={{ ...style, background: "rgba(255,255,255,0.025)" }}
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- CMS sources include arbitrary allowlisted HTTPS origins.
  return <img src={safeSrc} alt={safeAlt} style={style} draggable={false} onLoad={onLoad} onError={() => setFailedSrc(safeSrc)} />;
}

type VisualCmsImage = { src?: unknown; alt?: unknown; caption?: unknown };

function visualImages(value: unknown): VisualCmsImage[] {
  return Array.isArray(value) ? value.filter((image): image is VisualCmsImage => !!image && typeof image === "object" && !Array.isArray(image)) : [];
}

function imageRatio(value: unknown): string | undefined {
  if (value === "1:1") return "1 / 1";
  if (value === "4:3") return "4 / 3";
  if (value === "3:2") return "3 / 2";
  if (value === "16:9") return "16 / 9";
  if (value === "21:9") return "21 / 9";
  return undefined;
}

function visualFrameStyle(content: Record<string, any>): CSSProperties {
  return {
    width: "100%",
    maxWidth: content.maxWidthPx ?? 2400,
    marginLeft: content.align === "left" ? 0 : "auto",
    marginRight: content.align === "right" ? 0 : "auto",
    marginTop: content.marginTop ?? 0,
    marginBottom: content.marginBottom ?? 0,
    padding: content.padding ?? 0,
  };
}

function CmsCarousel({ images, autoplay, speedMs, loop, showArrows, showIndicators, radius }: {
  images: VisualCmsImage[]; autoplay: boolean; speedMs: number; loop: boolean; showArrows: boolean; showIndicators: boolean; radius: number;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const available = images.filter((image) => isValidCmsImageSource(image.src));
  useEffect(() => {
    if (!autoplay || available.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => loop ? (current + 1) % available.length : Math.min(current + 1, available.length - 1)), Math.max(1000, Math.min(30_000, speedMs)));
    return () => window.clearInterval(timer);
  }, [autoplay, available.length, loop, speedMs]);
  if (!available.length) return <div className="h-full w-full rounded-xl border border-dashed border-line bg-white/[0.02]" aria-label="Aucune image sélectionnée" />;
  const activeIndex = Math.min(index, available.length - 1);
  const step = (direction: -1 | 1) => setIndex((current) => {
    const normalized = Math.min(current, available.length - 1);
    return loop ? (normalized + direction + available.length) % available.length : Math.max(0, Math.min(available.length - 1, normalized + direction));
  });
  const image = available[activeIndex];
  return (
    <div className="relative h-full w-full overflow-hidden bg-black/10" style={{ borderRadius: radius }} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = touchStartX.current; const end = event.changedTouches[0]?.clientX; touchStartX.current = null; if (start !== null && end !== undefined && Math.abs(end - start) > 36) step(end < start ? 1 : -1); }}>
      <CmsImage src={image.src} alt={image.alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      {typeof image.caption === "string" && image.caption && <p className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-center text-xs text-white">{image.caption}</p>}
      {showArrows && available.length > 1 && <>
        <button type="button" aria-label="Image précédente" onClick={() => step(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black/80">‹</button>
        <button type="button" aria-label="Image suivante" onClick={() => step(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black/80">›</button>
      </>}
      {showIndicators && available.length > 1 && <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2" aria-label="Choisir une image">
        {available.map((_, itemIndex) => <button key={itemIndex} type="button" aria-label={`Afficher l’image ${itemIndex + 1}`} aria-current={itemIndex === activeIndex} onClick={() => setIndex(itemIndex)} className={`h-2.5 w-2.5 rounded-full border border-white ${itemIndex === activeIndex ? "bg-white" : "bg-black/40"}`} />)}
      </div>}
    </div>
  );
}

function CmsImageMarquee({ images, speedSeconds, direction, pauseOnHover, visibleCount, gap, radius }: {
  images: VisualCmsImage[]; speedSeconds: number; direction: "left" | "right"; pauseOnHover: boolean; visibleCount: number; gap: number; radius: number;
}) {
  const available = images.filter((image) => isValidCmsImageSource(image.src));
  if (!available.length) return <div className="h-full w-full rounded-xl border border-dashed border-line bg-white/[0.02]" aria-label="Aucune image sélectionnée" />;
  const duration = Math.max(5, Math.min(120, speedSeconds));
  const count = Math.max(1, Math.min(8, Math.round(visibleCount), available.length));
  return (
    <div className={`cms-image-marquee h-full w-full overflow-hidden ${pauseOnHover ? "pause-on-hover" : ""} ${direction === "right" ? "reverse" : ""}`} style={{ borderRadius: radius }}>
      <style>{`@keyframes cms-image-marquee-track { from { transform: translateX(0); } to { transform: translateX(-50%); } } .cms-image-marquee-track { animation: cms-image-marquee-track ${duration}s linear infinite; } .cms-image-marquee.reverse .cms-image-marquee-track { animation-direction: reverse; } .cms-image-marquee.pause-on-hover:hover .cms-image-marquee-track, .cms-image-marquee.pause-on-hover:focus-within .cms-image-marquee-track { animation-play-state: paused; } @media (prefers-reduced-motion: reduce) { .cms-image-marquee-track { animation-play-state: paused; } }`}</style>
      <div className={`cms-image-marquee-track flex h-full ${direction === "right" ? "reverse" : ""}`} style={{ width: "200%" }}>
        {[0, 1].map((copy) => <div key={copy} aria-hidden={copy === 1 || undefined} className="flex h-full shrink-0" style={{ width: "50%", gap }}>
          {available.map((image, index) => <figure key={`${String(image.src)}-${index}`} className="relative h-full min-w-0 overflow-hidden" style={{ flex: `0 0 calc((100% - ${gap * (count - 1)}px) / ${count})`, borderRadius: radius }}>
            <CmsImage src={image.src} alt={image.alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {typeof image.caption === "string" && image.caption && <figcaption className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-center text-[11px] text-white">{image.caption}</figcaption>}
          </figure>)}
        </div>)}
      </div>
    </div>
  );
}

function positionPanorama(node: HTMLDivElement | null, position: number) {
  if (!node) return;
  node.scrollLeft = Math.max(0, node.scrollWidth - node.clientWidth) * (Math.max(0, Math.min(100, position)) / 100);
}

function CmsPanorama({ src, alt, initialPosition, autoScroll, speed, loop, radius }: {
  src: unknown; alt: unknown; initialPosition: number; autoScroll: boolean; speed: number; loop: boolean; radius: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; scrollLeft: number } | null>(null);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    positionPanorama(viewport.current, initialPosition);
  }, [src, initialPosition]);
  useEffect(() => {
    const node = viewport.current;
    if (!node || !autoScroll || interacting) return;
    let frame = 0;
    let previous = 0;
    const step = (now: number) => {
      if (previous) {
        const maxScroll = node.scrollWidth - node.clientWidth;
        if (maxScroll > 0) {
          if (loop && node.scrollLeft >= maxScroll - 1) node.scrollLeft = 0;
          else if (node.scrollLeft < maxScroll) node.scrollLeft = Math.min(maxScroll, node.scrollLeft + (now - previous) * Math.max(1, Math.min(120, speed)) / 1000);
          else if (!loop) return;
        }
      }
      previous = now;
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [autoScroll, interacting, loop, speed, src]);
  return (
    <div ref={viewport} className="h-full w-full overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:thin]" style={{ borderRadius: radius, cursor: "grab", touchAction: "pan-x pan-y" }}
      onPointerDown={(event) => { setInteracting(true); if (event.pointerType === "mouse") { drag.current = { startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft }; event.currentTarget.setPointerCapture(event.pointerId); } }}
      onPointerMove={(event) => { if (drag.current) event.currentTarget.scrollLeft = drag.current.scrollLeft - (event.clientX - drag.current.startX); }}
      onPointerUp={() => { drag.current = null; setInteracting(false); }} onPointerCancel={() => { drag.current = null; setInteracting(false); }}>
      {isValidCmsImageSource(src) ? <CmsImage src={src} alt={alt} onLoad={() => positionPanorama(viewport.current, initialPosition)} style={{ display: "block", height: "100%", width: "auto", maxWidth: "none", objectFit: "contain" }} /> : <div className="h-full min-w-full bg-white/[0.02]" aria-label="Aucune image panoramique sélectionnée" />}
    </div>
  );
}

export function ElementView({ el, products = [], genericSafety = false }: { el: CmsElement; products?: DbProduct[]; genericSafety?: boolean }) {
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
        if (c.variant === "quote") return <p style={{ ...st, margin: 0 }}>&quot;{c.text}&quot;</p>;
        if (c.variant === "list")
          return (
            <ul style={{ ...st, margin: 0, paddingLeft: 18 }}>
              {String(c.text ?? "").split("\n").filter(Boolean).map((li, i) => (
                <li key={i}>{li}</li>
              ))}
            </ul>
          );
        if (c.variant === "price") return <p style={{ ...st, margin: 0 }}>{c.text}</p>;
        if (c.variant === "link") {
          const href = genericSafety ? safeCmsHref(el.link) : el.link || "#";
          const linkStyle = { ...st, color: s.color ?? "#c9a86a", textDecoration: "none" as const };
          return href ? <Link href={href} style={linkStyle}>{c.text}</Link> : <span style={linkStyle}>{c.text}</span>;
        }
        if (c.variant === "breadcrumb")
          return <p style={{ ...st, margin: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>{c.text}</p>;
        if (c.variant === "review") return <p style={{ ...st, margin: 0 }}>{c.text}</p>;
        return <p style={{ ...st, margin: 0 }}>{c.text}</p>;
      }
      case "image": {
        const ratio = imageRatio(c.ratio);
        const align = c.align ?? "center";
        const figure = <figure style={{ width: `${Math.max(10, Math.min(100, Number(c.widthPercent) || 100))}%`, maxWidth: c.maxWidthPx ?? 2400, height: ratio ? "auto" : "100%", margin: align === "left" ? "0 auto 0 0" : align === "right" ? "0 0 0 auto" : "0 auto", aspectRatio: ratio }}>
          <CmsImage src={c.src} alt={c.alt} style={{ width: "100%", height: ratio ? "auto" : "100%", minHeight: ratio ? undefined : 1, objectFit: c.fit ?? "cover", borderRadius: c.radius ?? 0, border: c.border ? "1px solid #22263a" : undefined, boxShadow: c.shadow ? "0 24px 60px rgba(0,0,0,0.5)" : undefined, display: "block" }} />
          {c.caption && <figcaption style={{ marginTop: 8, color: "#9a98a8", fontSize: 13, textAlign: align }}>{c.caption}</figcaption>}
        </figure>;
        const href = safeCmsHref(el.link);
        return href ? <Link href={href} className="block h-full w-full">{figure}</Link> : figure;
      }
      case "gallery": {
        const images = visualImages(c.images);
        const ratio = imageRatio(c.ratio);
        const columns = Math.max(1, Math.min(6, Number(c.columns) || 3));
        return <div style={visualFrameStyle(c)}>
          <style>{`.cms-gallery-cols-${columns} { display:grid; grid-template-columns:repeat(${columns}, minmax(0,1fr)); } @media(max-width: 760px) { .cms-gallery-cols-${columns} { grid-template-columns:repeat(${Math.min(2, columns)}, minmax(0,1fr)); } } @media(max-width: 460px) { .cms-gallery-cols-${columns} { grid-template-columns:1fr; } }`}</style>
          <div className={`cms-gallery-cols-${columns}`} style={{ gap: c.gap ?? 16 }}>
            {images.filter((image) => isValidCmsImageSource(image.src)).map((image, index) => <figure key={`${String(image.src)}-${index}`} className="min-w-0 overflow-hidden" style={{ margin: 0, borderRadius: c.radius ?? 0 }}>
              <div style={{ width: "100%", aspectRatio: ratio, height: ratio ? undefined : "auto", overflow: "hidden" }}><CmsImage src={image.src} alt={image.alt} style={{ width: "100%", height: ratio ? "100%" : "auto", display: "block", objectFit: ratio ? "cover" : "contain" }} /></div>
              {c.showCaptions !== false && typeof image.caption === "string" && image.caption && <figcaption className="px-2 py-1.5 text-center text-xs text-muted">{image.caption}</figcaption>}
            </figure>)}
          </div>
        </div>;
      }
      case "carousel":
        return <div style={visualFrameStyle(c)}><CmsCarousel images={visualImages(c.images)} autoplay={c.autoplay === true} speedMs={Number(c.speedMs) || 5000} loop={c.loop !== false} showArrows={c.showArrows !== false} showIndicators={c.showIndicators !== false} radius={Number(c.radius) || 0} /></div>;
      case "imageMarquee":
        return <div style={visualFrameStyle(c)}><CmsImageMarquee images={visualImages(c.images)} speedSeconds={Number(c.speedSeconds) || 32} direction={c.direction === "right" ? "right" : "left"} pauseOnHover={c.pauseOnHover !== false} visibleCount={Number(c.visibleCount) || 4} gap={Number(c.gap) || 0} radius={Number(c.radius) || 0} /></div>;
      case "panorama":
        return <div style={visualFrameStyle(c)}><CmsPanorama src={c.src} alt={c.alt} initialPosition={Number(c.initialPosition) || 0} autoScroll={c.autoScroll === true} speed={Number(c.speedPxPerSecond) || 24} loop={c.loop === true} radius={Number(c.radius) || 0} /></div>;
      case "article": {
        const paragraphs = Array.isArray(c.paragraphs) ? c.paragraphs.filter((paragraph: unknown) => typeof paragraph === "string") : [];
        const hasImage = isValidCmsImageSource(c.src);
        const imageOnRight = c.imagePosition === "right";
        const imageOnTop = c.imagePosition === "top";
        const href = safeCmsHref(c.buttonHref);
        const text = <div className="flex min-w-0 flex-1 flex-col justify-center" style={{ textAlign: c.align ?? "left" as const }}>
          {c.title && <h2 className="font-display text-3xl text-ink sm:text-4xl">{c.title}</h2>}
          {c.subtitle && <p className="mt-2 text-sm font-medium text-goldsoft sm:text-base">{c.subtitle}</p>}
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted sm:text-base" style={{ marginTop: c.spacing ?? 24 }}>{paragraphs.map((paragraph: string, index: number) => <p key={index} className="whitespace-pre-line">{paragraph}</p>)}</div>
          {c.buttonLabel && <div className="mt-5">{href ? <Link href={href} className="inline-flex rounded-full bg-gold px-6 py-3 text-xs font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">{c.buttonLabel}</Link> : <span className="inline-flex rounded-full bg-gold px-6 py-3 text-xs font-medium tracking-[0.14em] text-night uppercase">{c.buttonLabel}</span>}</div>}
        </div>;
        const image = hasImage ? <div className={`min-h-40 overflow-hidden ${imageOnTop ? "w-full" : "w-full md:w-[38%] md:shrink-0"}`} style={{ borderRadius: c.radius ?? 0, height: imageOnTop ? "min(35vh, 320px)" : "100%" }}><CmsImage src={c.src} alt={c.alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></div> : null;
        const content = imageOnTop ? <div className="flex h-full flex-col" style={{ gap: c.spacing ?? 24 }}>{image}{text}</div> : <div className={`flex h-full flex-col md:flex-row ${imageOnRight ? "md:flex-row-reverse" : ""}`} style={{ gap: c.spacing ?? 24 }}>{image}{text}</div>;
        return <article className="mx-auto h-full w-full overflow-auto" style={{ maxWidth: c.maxWidthPx ?? 2400, padding: c.padding ?? 0, marginTop: c.marginTop ?? 0, marginBottom: c.marginBottom ?? 0 }}>{content}</article>;
      }
      case "video": {
        const genericEmbed = genericSafety ? getCmsVideoEmbedUrl(c.url) : null;
        if (genericSafety && !genericEmbed) {
          return <div aria-label="Vidéo indisponible" className="h-full w-full rounded-lg bg-white/[0.025]" />;
        }
        const src = String(c.url ?? "");
        const embed = genericSafety ? genericEmbed! : src.includes("youtube.com/watch") ? src.replace("watch?v=", "embed/") : src;
        return (
          <iframe
            src={embed}
            title="Vidéo"
            style={{ width: "100%", height: "100%", border: 0, borderRadius: s.radius ?? 0 }}
            allow={genericSafety ? "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" : undefined}
            referrerPolicy={genericSafety ? "strict-origin-when-cross-origin" : undefined}
            sandbox={genericSafety ? "allow-scripts allow-same-origin allow-presentation" : undefined}
            allowFullScreen
          />
        );
      }
      case "icon":
        return (
          <div className="flex h-full w-full items-center justify-center">
            <svg viewBox="0 0 24 24" style={{ width: c.size ?? 40, height: c.size ?? 40, color: c.color ?? "#c9a86a" }} fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.1 6.6L21 12l-6.9 3.4L12 22l-2.1-6.6L3 12l6.9-3.4L12 2z" />
            </svg>
          </div>
        );
      case "button": {
        const href = genericSafety ? safeCmsHref(c.href) : c.href || "#";
        const buttonStyle = {
          display: "inline-block",
          padding: "14px 30px",
          borderRadius: s.radius ?? 999,
          background: s.bg ?? "#c9a86a",
          color: s.color ?? "#06070c",
          fontSize: s.size ?? 15,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          textDecoration: "none",
          boxShadow: s.shadow ? "0 12px 30px rgba(201,168,106,0.25)" : undefined,
          fontFamily: "'Jost', sans-serif",
          maxWidth: "100%",
          textAlign: "center" as const,
        };
        return (
          <div className="flex h-full w-full items-center justify-center">
            {href ? <Link href={href} style={buttonStyle}>{c.text}</Link> : <span style={buttonStyle}>{c.text}</span>}
          </div>
        );
      }
      case "hero": {
        const href = safeCmsHref(c.buttonHref);
        return <section className="relative flex h-full w-full items-center overflow-hidden" style={{ background: s.bg ?? "#0c0e16", color: s.color ?? "#ece9e2", borderRadius: s.radius ?? 0, textAlign: s.align ?? "left" }}>
          {isValidCmsImageSource(c.imageSrc) && <CmsImage src={c.imageSrc} alt={c.imageAlt ?? ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.38 }} />}
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(6,7,12,.96), rgba(6,7,12,.46))" }} />
          <div className="relative z-10 max-w-3xl px-8 py-10 sm:px-14">
            {c.eyebrow && <p className="mb-3 text-xs tracking-[0.2em] uppercase" style={{ color: s.accent ?? "#c9a86a" }}>{c.eyebrow}</p>}
            <h1 className="font-display text-4xl leading-tight sm:text-6xl">{c.title}</h1>
            {c.subtitle && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-lg">{c.subtitle}</p>}
            {c.buttonLabel && <div className="mt-7">{href ? <Link href={href} className="inline-flex rounded-full px-7 py-3 text-xs font-medium tracking-[0.14em] uppercase" style={{ background: s.accent ?? "#c9a86a", color: "#06070c" }}>{c.buttonLabel}</Link> : <span className="inline-flex rounded-full px-7 py-3 text-xs font-medium tracking-[0.14em] uppercase" style={{ background: s.accent ?? "#c9a86a", color: "#06070c" }}>{c.buttonLabel}</span>}</div>}
          </div>
        </section>;
      }
      case "menu": {
        const items = Array.isArray(c.items) ? c.items : [];
        return <nav aria-label={c.ariaLabel ?? "Navigation"} className={`flex h-full w-full ${c.orientation === "vertical" ? "flex-col items-start" : "flex-row flex-wrap items-center"}`} style={{ justifyContent: "center", gap: s.gap ?? 24, color: s.color ?? "#ece9e2", fontSize: s.size ?? 14 }}>
          {items.map((item: { label?: string; href?: string }, index: number) => {
            const href = safeCmsHref(item.href);
            return href ? <Link key={`${item.href}-${index}`} href={href} className="transition-colors hover:text-gold">{item.label}</Link> : <span key={`invalid-${index}`}>{item.label}</span>;
          })}
        </nav>;
      }
      case "cart":
        return <div className="flex h-full w-full items-center justify-center"><Link href="/cart" className="inline-flex rounded-full px-6 py-3 text-xs font-medium tracking-[0.12em] uppercase" style={{ background: s.bg ?? "#c9a86a", color: s.color ?? "#06070c", borderRadius: s.radius ?? 999, fontSize: s.size ?? 14 }}>{c.label ?? "Voir mon panier"}</Link></div>;
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
            {typeof c.intro === "string" && c.intro.trim() ? <p className="mx-auto -mt-5 mb-8 max-w-2xl text-center text-sm leading-relaxed text-muted">{c.intro}</p> : null}
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
                {c.contactLabel && c.contactHref && (genericSafety ? safeCmsHref(c.contactHref) : c.contactHref) && (
                  <Link href={genericSafety ? safeCmsHref(c.contactHref)! : c.contactHref} className="mt-5 inline-block rounded-full bg-gold px-7 py-3 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">
                    {c.contactLabel}
                  </Link>
                )}
                {c.contactLabel && c.contactHref && genericSafety && !safeCmsHref(c.contactHref) && (
                  <span className="mt-5 inline-block rounded-full bg-gold px-7 py-3 text-sm font-medium tracking-[0.14em] text-night uppercase">{c.contactLabel}</span>
                )}
              </div>
            )}
          </section>
        );
      }
      case "product": {
        const p = products.find((x) => x.slug === c.slug);
        if (!p || (genericSafety && !isActiveGenericCmsProduct(p))) return null;
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
