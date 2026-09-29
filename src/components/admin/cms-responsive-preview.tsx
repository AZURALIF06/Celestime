"use client";

import { useState } from "react";
import { PageCanvas } from "@/app/p/[slug]/page-canvas";
import type { CmsPage } from "@/lib/cms";
import { CMS_BREAKPOINT_WIDTH, type CmsBreakpoint } from "@/lib/cms-responsive";
import type { DbProduct } from "@/lib/catalog";

const MODES: { value: CmsBreakpoint; label: string }[] = [
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablette" },
  { value: "mobile", label: "Mobile" },
];

export default function CmsResponsivePreview({ page, products = [] }: { page: CmsPage; products?: DbProduct[] }) {
  const [breakpoint, setBreakpoint] = useState<CmsBreakpoint>("desktop");
  const width = CMS_BREAKPOINT_WIDTH[breakpoint];
  return (
    <section aria-label="Aperçu responsive du brouillon" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface/60 p-3">
        <span className="mr-2 text-xs text-muted">Aperçu :</span>
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            aria-pressed={breakpoint === mode.value}
            onClick={() => setBreakpoint(mode.value)}
            className={`rounded-full border px-3 py-1.5 text-xs ${breakpoint === mode.value ? "border-gold bg-gold text-night" : "border-line text-muted hover:text-ink"}`}
          >
            {mode.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-faint">{width} px de référence</span>
      </div>
      <div className="overflow-auto rounded-xl border border-line bg-night/60 p-3">
        <div className="mx-auto" style={{ width, maxWidth: "100%" }}>
          <PageCanvas page={page} products={products} bp={breakpoint} />
        </div>
      </div>
    </section>
  );
}
