"use client";

// Célestime — canvas public : sections empilées, éléments positionnés librement,
// mise à l'échelle fluide (desktop → mobile) avec overrides responsive.

import { useEffect, useRef, useState } from "react";
import { PAGE_WIDTH, isCmsColumn, isCmsContainer, isCmsGroup, isCmsRow, type CmsElement, type CmsPage, type CmsSection } from "@/lib/cms";
import { cmsColumnRenderStyle, cmsContainerRenderStyle, cmsFlowLeafRenderStyle, cmsGroupRenderStyle, cmsLeafRenderStyle, cmsRowRenderStyle } from "@/lib/cms-structure";
import type { DbProduct } from "@/lib/catalog";
import { ElementView } from "@/components/page/element-view";
import { getCmsBreakpointForWidth, getCmsElementForBreakpoint, resolveCmsElementForBreakpoint, type CmsBreakpoint } from "@/lib/cms-responsive";

export function effectiveEl(el: CmsElement, bp: CmsBreakpoint) {
  return resolveCmsElementForBreakpoint(el, bp);
}

function Section({ section, bp, products, genericSafety }: { section: CmsSection; bp: CmsBreakpoint; products: DbProduct[]; genericSafety: boolean }) {
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
  const renderLeaf = (element: CmsElement, flow = false, localResponsive = false) => {
    const rendered = localResponsive ? getCmsElementForBreakpoint(element, bp) : element;
    if (localResponsive && resolveCmsElementForBreakpoint(element, bp).hidden) return null;
    return <div key={element.id} style={flow ? cmsFlowLeafRenderStyle(rendered) : cmsLeafRenderStyle(rendered)}>
      <ElementView el={rendered} products={products} genericSafety={genericSafety} />
    </div>;
  };
  return (
    <div ref={wrapRef} className="w-full overflow-hidden" style={{ background: section.bg, height: section.h * scale }}>
      <div style={{ width: PAGE_WIDTH, height: section.h, transform: `scale(${scale})`, transformOrigin: "top left" }} className="relative">
        {els.map((node) => {
          if (isCmsContainer(node)) {
            return <div key={node.id} data-cms-node="container" style={cmsContainerRenderStyle(node)}>
              {[...node.children].sort((a, b) => a.z - b.z).map((child) => renderLeaf(child))}
            </div>;
          }
          if (isCmsGroup(node)) {
            return <div key={node.id} data-cms-node="group" style={cmsGroupRenderStyle(node)}>
              {[...node.children].sort((a, b) => a.z - b.z).map((child) => renderLeaf(child, false, true))}
            </div>;
          }
          if (isCmsRow(node)) {
            return <div key={node.id} data-cms-node="row" style={cmsRowRenderStyle(node)}>
              {node.children.map((column) => isCmsColumn(column) ? (
                <div key={column.id} data-cms-node="column" style={cmsColumnRenderStyle(column, node)}>
                  {column.children.map((child) => renderLeaf(child, true))}
                </div>
              ) : null)}
            </div>;
          }
          const eff = effectiveEl(node, bp);
          if (eff.hidden) return null;
          const renderedElement = getCmsElementForBreakpoint(node, bp);
          return (
            <div key={node.id} style={{
              position: "absolute", left: eff.x, top: eff.y, width: eff.w, height: eff.h,
              zIndex: node.z, transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined, opacity: node.opacity,
            }}>
              <ElementView el={renderedElement} products={products} genericSafety={genericSafety} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PageCanvas({ page, products, bp = "desktop", genericSafety = false }: { page: CmsPage; products: DbProduct[]; bp?: CmsBreakpoint | "auto"; genericSafety?: boolean }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [detectedBreakpoint, setDetectedBreakpoint] = useState<CmsBreakpoint>("desktop");
  useEffect(() => {
    if (bp !== "auto") return;
    const node = canvasRef.current;
    if (!node) return;
    const updateBreakpoint = (width: number) => setDetectedBreakpoint(getCmsBreakpointForWidth(width));
    updateBreakpoint(node.clientWidth || window.innerWidth);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? node.clientWidth;
      updateBreakpoint(width || window.innerWidth);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [bp]);
  const activeBreakpoint = bp === "auto" ? detectedBreakpoint : bp;
  return (
    <div ref={canvasRef} data-cms-breakpoint={activeBreakpoint}>
      {page.sections.map((section) => (
        <Section key={section.id} section={section} bp={activeBreakpoint} products={products} genericSafety={genericSafety} />
      ))}
    </div>
  );
}
