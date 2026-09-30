import test from "node:test";
import assert from "node:assert/strict";
import {
  describeCmsRowLayout,
  resolveCmsColumnContentHeight,
  resolveCmsColumnFrames,
  resolveCmsRowHeight,
  resolveCmsRowLayout,
  resolveCmsSectionHeight,
} from "../src/lib/cms-responsive-rows.ts";
import { resolveCmsRowColumnFrames } from "../src/lib/cms.ts";

const leaf = (id, h = 40, patch = {}) => ({
  id, type: "text", x: 0, y: 0, w: 100, h, z: 1, rotation: 0, opacity: 1,
  content: { text: id }, style: {}, ...patch,
});
const column = (id, width, children = [], patch = {}) => ({
  id, nodeType: "column", width, z: 1, opacity: 1, layout: "vertical", gap: 10, children, ...patch,
});
const rowNode = (children, patch = {}) => ({
  id: "row-1", nodeType: "row", x: 0, y: 0, w: 1000, h: 300, z: 1, rotation: 0, opacity: 1,
  layout: "horizontal", gap: 20, alignX: "start", alignY: "start", children, ...patch,
});
const section = (elements) => ({ id: "s1", h: 600, elements });

// 1–3 : compatibilité Phase 3B — sans configuration, rien ne change.
test("1. une rangée sans clé responsive se comporte exactement comme en Phase 3B", () => {
  const row = rowNode([column("a", 50, [leaf("a1")]), column("b", 50, [leaf("b1")])]);
  for (const breakpoint of ["desktop", "tablet", "mobile"]) {
    const layout = resolveCmsRowLayout(row, breakpoint);
    assert.equal(layout.stacked, false, `${breakpoint} ne s’empile pas par défaut`);
    assert.equal(layout.gap, 20);
    assert.deepEqual(layout.columns.map((entry) => entry.width), [50, 50]);
  }
});
test("2. les frames desktop restent celles du résolveur Phase 3B", () => {
  const row = rowNode([column("a", 50, []), column("b", 50, [])]);
  const phase3b = resolveCmsRowColumnFrames(row).map(({ frame }) => [frame.x, frame.w]);
  const phase3c = resolveCmsColumnFrames(row, "desktop").map((frame) => [frame.x, frame.w]);
  assert.deepEqual(phase3c, phase3b);
});
test("3. la hauteur de section n'est jamais réduite", () => {
  const doc = section([rowNode([column("a", 100, [leaf("a1")])], { y: 100 })]);
  assert.equal(resolveCmsSectionHeight(doc, "desktop"), 600);
  assert.equal(resolveCmsSectionHeight({ ...doc, h: 10 }, "mobile"), 400);
});

// 4–6 : exemple 1 — rangée 50/50.
test("4. exemple 1 : 50/50 sur desktop et A puis B empilées sur mobile", () => {
  const row = rowNode([
    column("a", 50, [leaf("a1", 40), leaf("a2", 60)]),
    column("b", 50, [leaf("b1", 50)]),
  ], { responsive: { mobile: { stack: true } } });

  const desktop = resolveCmsColumnFrames(row, "desktop");
  assert.deepEqual(desktop.map((frame) => [frame.x, frame.w]), [[0, 490], [510, 490]]);
  assert.equal(desktop[0].h, 300);

  const mobile = resolveCmsRowLayout(row, "mobile");
  assert.equal(mobile.stacked, true);
  const frames = resolveCmsColumnFrames(row, "mobile", mobile);
  assert.equal(frames[0].w, 1000, "la colonne A occupe toute la largeur");
  assert.equal(frames[1].x, 0, "B passe sous A");
  assert.equal(frames[0].y, 0);
  assert.equal(frames[1].y, resolveCmsColumnContentHeight(row.children[0]) + 20);
  assert.deepEqual(frames.map((frame) => frame.index ?? frame === frames[0] ? 0 : 1), [0, 1]);
});
test("5. exemple 1 : la hauteur empilée est la somme des colonnes plus les écarts", () => {
  const row = rowNode([
    column("a", 50, [leaf("a1", 40), leaf("a2", 60)]), // 40 + 10 + 60 = 110
    column("b", 50, [leaf("b1", 50)]),                 // 50
  ], { responsive: { mobile: { stack: true } } });
  assert.equal(resolveCmsColumnContentHeight(row.children[0]), 110);
  assert.equal(resolveCmsRowHeight(row, "mobile"), 110 + 20 + 50);
  assert.equal(resolveCmsRowHeight(row, "desktop"), 300, "desktop conserve la hauteur d’origine");
});
test("6. exemple 1 : la section grandit pour contenir l’empilement sans rétrécir", () => {
  const row = rowNode([
    column("a", 50, [leaf("a1", 200)]),
    column("b", 50, [leaf("b1", 250)]),
  ], { y: 50, responsive: { mobile: { stack: true } } });
  // Section plus haute que le besoin : elle n'est jamais rétrécie.
  assert.equal(resolveCmsSectionHeight(section([row]), "mobile"), 600);
  // Section trop courte : elle grandit pour contenir l'empilement.
  assert.equal(resolveCmsSectionHeight({ id: "s1", h: 400, elements: [row] }, "mobile"), 50 + 200 + 20 + 250);
  assert.equal(resolveCmsSectionHeight({ id: "s1", h: 400, elements: [row] }, "desktop"), 400);
});

// 7–9 : exemple 2 — rangée 3 colonnes.
test("7. exemple 2 : trois colonnes égales sur desktop", () => {
  const row = rowNode([column("a", 100 / 3, []), column("b", 100 / 3, []), column("c", 100 / 3, [])]);
  const frames = resolveCmsColumnFrames(row, "desktop");
  assert.equal(frames.length, 3);
  assert.equal(Math.round(frames[0].w), 320);
  assert.equal(Math.round(frames[1].w), 320);
  assert.equal(Math.round(frames[2].w), 320);
});
test("8. exemple 2 : A puis B puis C empilées sur mobile dans l’ordre du tableau", () => {
  const row = rowNode([
    column("a", 100 / 3, [leaf("a1", 30)]),
    column("b", 100 / 3, [leaf("b1", 40)]),
    column("c", 100 / 3, [leaf("c1", 50)]),
  ], { responsive: { mobile: { stack: true } } });
  const frames = resolveCmsColumnFrames(row, "mobile");
  assert.deepEqual(frames.map((frame) => [frame.y, frame.h]), [[0, 30], [50, 40], [110, 50]]);
  assert.equal(resolveCmsRowHeight(row, "mobile"), 30 + 40 + 50 + 20 * 2);
});
test("9. exemple 2 : l’ordre responsive inverse l’affichage sans toucher au tableau children", () => {
  const row = rowNode([
    column("a", 100 / 3, [leaf("a1", 30)], { responsive: { mobile: { order: 2 } } }),
    column("b", 100 / 3, [leaf("b1", 40)]),
    column("c", 100 / 3, [leaf("c1", 50)], { responsive: { mobile: { order: 0 } } }),
  ], { responsive: { mobile: { stack: true } } });
  const layout = resolveCmsRowLayout(row, "mobile");
  assert.deepEqual(layout.columns.map((entry) => entry.column.id), ["c", "b", "a"]);
  assert.deepEqual(layout.columns.map((entry) => entry.index), [2, 1, 0]);
  assert.deepEqual(row.children.map((child) => child.id), ["a", "b", "c"], "children[] reste inchangé");
});

// 10–12 : exemple 3 — largeurs personnalisées et gap.
test("10. exemple 3 : 30/70 respecte les proportions sur desktop", () => {
  const row = rowNode([column("a", 30, []), column("b", 70, [])]);
  const frames = resolveCmsColumnFrames(row, "desktop");
  assert.equal(frames[0].w, 294);
  assert.equal(frames[1].w, 686);
  assert.equal(frames[0].w + frames[1].w + 20, 1000);
});
test("11. exemple 3 : des largeurs tablette distinctes du desktop sont appliquées", () => {
  const row = rowNode([
    column("a", 30, [], { responsive: { tablet: { width: 50 } } }),
    column("b", 70, [], { responsive: { tablet: { width: 50 } } }),
  ]);
  assert.deepEqual(resolveCmsRowLayout(row, "desktop").columns.map((entry) => entry.width), [30, 70]);
  assert.deepEqual(resolveCmsRowLayout(row, "tablet").columns.map((entry) => entry.width), [50, 50]);
});
test("12. le gap est configurable par appareil et borné", () => {
  const row = rowNode([column("a", 50, []), column("b", 50, [])], { responsive: { tablet: { gap: 8 }, mobile: { gap: 9999 } } });
  assert.equal(resolveCmsRowLayout(row, "desktop").gap, 20);
  assert.equal(resolveCmsRowLayout(row, "tablet").gap, 8);
  assert.equal(resolveCmsRowLayout(row, "mobile").gap, 128, "gap borné à la limite Phase 3B");
});

// 13–15 : visibilité et déterminisme.
test("13. une colonne masquée sur un appareil ne prend plus de place", () => {
  const row = rowNode([
    column("a", 50, [leaf("a1", 30)], { responsive: { mobile: { hidden: true } } }),
    column("b", 50, [leaf("b1", 40)]),
  ], { responsive: { mobile: { stack: true } } });
  const frames = resolveCmsColumnFrames(row, "mobile");
  assert.equal(frames[0].w, 0);
  assert.equal(frames[1].w, 1000, "la colonne restante occupe toute la largeur");
  assert.equal(resolveCmsRowHeight(row, "mobile"), 40, "la colonne masquée ne contribue pas à la hauteur");
});
test("14. le masquage desktop reste prioritaire et le mobile hérite du desktop", () => {
  const row = rowNode([column("a", 100, [leaf("a1")], { hidden: true }), column("b", 100, [])]);
  assert.equal(resolveCmsRowLayout(row, "mobile").columns[0].hidden, true);
  const explicit = rowNode([column("a", 100, [leaf("a1")]), column("b", 100, [], { responsive: { mobile: { hidden: true } } })]);
  assert.equal(resolveCmsRowLayout(explicit, "mobile").columns[1].hidden, true);
  assert.equal(resolveCmsRowLayout(explicit, "desktop").columns[1].hidden, false);
});
test("15. la résolution est déterministe et idempotente", () => {
  const row = rowNode([column("a", 50, [leaf("a1", 30)]), column("b", 50, [leaf("b1", 40)])], { responsive: { mobile: { stack: true } } });
  const first = JSON.stringify(resolveCmsColumnFrames(row, "mobile"));
  const second = JSON.stringify(resolveCmsColumnFrames(row, "mobile"));
  assert.equal(first, second);
  const doc = section([row]);
  assert.equal(resolveCmsSectionHeight(doc, "mobile"), resolveCmsSectionHeight(doc, "mobile"));
});

// 16–18 : alignements Phase 3B, colonnes vides, et gains d'affichage.
test("16. les alignements center/end/between sont préservés comme en Phase 3B", () => {
  for (const alignX of ["center", "end", "between", "start"]) {
    const row = rowNode([column("a", 30, []), column("b", 30, [])], { alignX });
    const phase3b = resolveCmsRowColumnFrames(row).map(({ frame }) => [frame.x, frame.w]);
    const phase3c = resolveCmsColumnFrames(row, "desktop").map((frame) => [frame.x, frame.w]);
    assert.deepEqual(phase3c, phase3b, `alignement ${alignX}`);
  }
});
test("17. une colonne vide a une hauteur nulle mais reste affichable", () => {
  assert.equal(resolveCmsColumnContentHeight(column("a", 100, [])), 0);
  const row = rowNode([column("a", 50, []), column("b", 50, [leaf("b1", 40)])], { responsive: { mobile: { stack: true } } });
  const frames = resolveCmsColumnFrames(row, "mobile");
  assert.equal(frames[0].h, 0);
  assert.equal(frames[1].h, 40);
});
test("18. les enfants masqués ne contribuent pas à la hauteur de colonne", () => {
  assert.equal(resolveCmsColumnContentHeight(column("a", 100, [leaf("x", 40), leaf("y", 40, { hidden: true })])), 40);
  assert.equal(resolveCmsColumnContentHeight(column("a", 100, [leaf("x", 40), leaf("y", 40, { hidden: true }), leaf("z", 20)])), 70);
});
test("19. le résumé de disposition est lisible et déterministe", () => {
  const row = rowNode([column("a", 50, [leaf("a1", 30)]), column("b", 50, [leaf("b1", 40)])], { responsive: { mobile: { stack: true } } });
  assert.equal(describeCmsRowLayout(row, "desktop"), "horizontale · 1:50% / 2:50% · gap 20px · hauteur 300px");
  assert.equal(describeCmsRowLayout(row, "mobile"), "empilée · 1:100% / 2:100% · gap 20px · hauteur 90px");
});
