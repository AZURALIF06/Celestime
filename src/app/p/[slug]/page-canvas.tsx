"use client";

// Célestime — canvas public : sections empilées, éléments positionnés librement,
// mise à l'échelle fluide (desktop → mobile) avec overrides responsive.

import { useEffect, useRef, useState } from "react";
import { PAGE_WIDTH, type CmsElement, type CmsPage, type CmsSection } from "@/lib/cms";
import type { DbProduct } from "@/lib/catalog";
import { ElementView } from "@/components/page/element-view";

export function effectiveEl(el: CmsElement, bp: "desktop" | "tablet" | "mobile") {
  const ov = bp !== "desktop" ? el.responsive?.[bp === "tablet" ? "tablet" : "mobile"] : undefined;
  return {
    x: ov?.x ?? el.x,
    y: ov?.y ?? el.y,
    w: ov?.w ?? el.w,
    h: ov?.h ?? el.h,
    hidden: ov?.hidden ?? el.hidden ?? false,
    fontSize: ov?.fontSize,
  };
}

function Section({ section, bp, products }: { section: CmsSection; bp: "desktop" | "tablet" | "mobile"; products: DbProduct[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / PAGE_WIDTH)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const els = [...section.elements].sort((a, b) => a.z - b.z);
  return (
    <div ref={wrapRef} className="w-full overflow-hidden" style={{ background: section.bg, height: section.h * scale }}>
      <div style={{ width: PAGE_WIDTH, height: section.h, transform: `scale(${scale})`, transformOrigin: "top left" }} className="relative">
        {els.map((el) => {
          const eff = effectiveEl(el, bp);
          if (eff.hidden) return null;
          return (
            <div
              key={el.id}
              style={{
                position: "absolute",
                left: eff.x,
                top: eff.y,
                width: eff.w,
                height: eff.h,
                zIndex: el.z,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                opacity: el.opacity,
              }}
            >
              <ElementView el={el} products={products} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PageCanvas({ page, products, bp = "desktop" }: { page: CmsPage; products: DbProduct[]; bp?: "desktop" | "tablet" | "mobile" }) {
  return (
    <div>
      {page.sections.map((s) => (
        <Section key={s.id} section={s} bp={bp} products={products} />
      ))}
    </div>
  );
}
