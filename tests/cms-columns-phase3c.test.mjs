import test from "node:test";
import assert from "node:assert/strict";
import {
  canMoveCmsLeafToColumn,
  countCmsTreeNodes,
  describeCmsTarget,
  findCmsColumn,
  findCmsLeaf,
  findCmsLeafParent,
  moveCmsLeafToColumn,
  removeCmsLeaf,
  resolveCmsAddTarget,
  resolveCmsColumnDropTarget,
  resolveCmsOwningColumnId,
  resolveCmsRowColumnGeometry,
} from "../src/lib/cms-columns.ts";
import { appendHistorySnapshot } from "../src/lib/cms-editor-canvas.ts";

const leaf = (id, patch = {}) => ({
  id, type: "text", x: 0, y: 0, w: 100, h: 40, z: 1, rotation: 0, opacity: 1,
  content: { text: `Texte ${id}` }, style: {}, ...patch,
});
const column = (id, width, children = [], patch = {}) => ({
  id, nodeType: "column", width, z: 1, opacity: 1, layout: "vertical", gap: 10, children, ...patch,
});
const rowNode = (id, children, patch = {}) => ({
  id, nodeType: "row", x: 0, y: 0, w: 1000, h: 400, z: 1, rotation: 0, opacity: 1,
  layout: "horizontal", gap: 20, alignX: "start", alignY: "start", children, ...patch,
});
const sectionWith = (...elements) => ({ id: "section-1", h: 800, elements });
const page = (section) => ({ sections: [section] });

// Section → Row → Column → Element : la base Topologie.
const baseSection = () => sectionWith(
  rowNode("row-a", [
    column("col-a", 50, [leaf("a1"), leaf("a2")]),
    column("col-b", 50, [leaf("b1")]),
  ]),
);

// 1–5 : cible d'ajout réellement dérivée de l'arbre.
test("1. une colonne sélectionnée est la cible d'ajout", () => {
  assert.deepEqual(resolveCmsAddTarget(baseSection(), "col-b"), { kind: "column", columnId: "col-b", rowId: "row-a" });
});
test("2. une feuille située dans une colonne cible SA colonne (correction Phase 3B)", () => {
  // Phase 3B ajoutait à la racine de section dès qu'une feuille était sélectionnée.
  assert.deepEqual(resolveCmsAddTarget(baseSection(), "a1"), { kind: "column", columnId: "col-a", rowId: "row-a" });
  assert.deepEqual(resolveCmsAddTarget(baseSection(), "b1"), { kind: "column", columnId: "col-b", rowId: "row-a" });
});
test("3. une rangée sélectionnée ne désigne aucune colonne : la racine reste la cible", () => {
  assert.deepEqual(resolveCmsAddTarget(baseSection(), "row-a"), { kind: "section" });
});
test("4. un conteneur et un groupe sélectionnés restent leur propre cible", () => {
  const withContainers = sectionWith(
    { id: "cont", nodeType: "container", x: 0, y: 0, w: 300, h: 200, z: 1, rotation: 0, opacity: 1, layout: "free", children: [leaf("c1")] },
    { id: "grp", nodeType: "group", x: 0, y: 300, w: 300, h: 200, z: 1, rotation: 0, opacity: 1, layout: "free", children: [leaf("g1")] },
  );
  assert.deepEqual(resolveCmsAddTarget(withContainers, "cont"), { kind: "container", id: "cont" });
  assert.deepEqual(resolveCmsAddTarget(withContainers, "c1"), { kind: "container", id: "cont" });
  assert.deepEqual(resolveCmsAddTarget(withContainers, "grp"), { kind: "group", id: "grp" });
  assert.deepEqual(resolveCmsAddTarget(withContainers, "g1"), { kind: "group", id: "grp" });
  assert.deepEqual(resolveCmsAddTarget(withContainers, null), { kind: "section" });
  assert.deepEqual(resolveCmsAddTarget(withContainers, "fantome"), { kind: "section" });
});
test("5. aucune ambiguïté entre deux colonnes : la feuille désigne une colonne unique", () => {
  assert.equal(resolveCmsOwningColumnId(baseSection(), "a1"), "col-a");
  assert.equal(resolveCmsOwningColumnId(baseSection(), "b1"), "col-b");
  assert.equal(resolveCmsOwningColumnId(baseSection(), "row-a"), null);
  assert.equal(describeCmsTarget(baseSection(), resolveCmsAddTarget(baseSection(), "a2")), "la colonne 1/2 de la rangée");
  assert.equal(describeCmsTarget(baseSection(), resolveCmsAddTarget(baseSection(), "b1")), "la colonne 2/2 de la rangée");
});

// 6–8 : cas A — déplacement dans sa propre colonne.
test("6. cas A : réordonner dans la même colonne conserve l'ordre demandé", () => {
  const source = baseSection();
  const moved = moveCmsLeafToColumn(page(source), "section-1", { leafId: "a2", columnId: "col-a", index: 0 });
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.section.elements[0].children[0].children.map((child) => child.id), ["a2", "a1"]);
});
test("7. cas A : un déplacement sans changement de position est refusé", () => {
  const moved = moveCmsLeafToColumn(page(baseSection()), "section-1", { leafId: "a1", columnId: "col-a", index: 0 });
  assert.deepEqual(moved, { ok: false, reason: "unchanged" });
});
test("8. cas A : insérer en fin de liste fonctionne et ne duplique rien", () => {
  const moved = moveCmsLeafToColumn(page(baseSection()), "section-1", { leafId: "a1", columnId: "col-a", index: 2 });
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.section.elements[0].children[0].children.map((child) => child.id), ["a2", "a1"]);
  assert.equal(moved.section.elements[0].children[0].children.length, 2);
});

// 9–11 : cas B — déplacement vers une autre colonne.
test("9. cas B : une feuille passe de col-a vers col-b, sans doublon", () => {
  const result = moveCmsLeafToColumn(page(baseSection()), "section-1", { leafId: "a1", columnId: "col-b", index: 0 });
  assert.equal(result.ok, true);
  const rowAfter = result.section.elements[0];
  assert.deepEqual(rowAfter.children[0].children.map((child) => child.id), ["a2"]);
  assert.deepEqual(rowAfter.children[1].children.map((child) => child.id), ["a1", "b1"]);
  assert.equal(countCmsTreeNodes(page(result.section)), countCmsTreeNodes(page(baseSection())));
});
test("10. cas B : la feuille conserve exactement son id, son contenu et ses overrides", () => {
  const rich = leaf("a1", { content: { text: "Gardé" }, style: { size: 22 }, responsive: { mobile: { w: 300, fontSize: 14 } } });
  const source = sectionWith(rowNode("row-a", [column("col-a", 50, [rich]), column("col-b", 50, [leaf("b1")])]));
  const result = moveCmsLeafToColumn(page(source), "section-1", { leafId: "a1", columnId: "col-b", index: 0 });
  const moved = findCmsLeaf(result.section, "a1");
  assert.deepEqual(moved.content, { text: "Gardé" });
  assert.deepEqual(moved.style, { size: 22 });
  assert.deepEqual(moved.responsive, { mobile: { w: 300, fontSize: 14 } });
  assert.equal(moved.id, "a1");
});
test("11. cas B : une feuille venue de la racine de section entre dans la colonne", () => {
  const source = sectionWith(leaf("racine"), rowNode("row-a", [column("col-a", 50, []), column("col-b", 50, [])]));
  assert.deepEqual(findCmsLeafParent(source, "racine"), { kind: "section" });
  const result = moveCmsLeafToColumn(page(source), "section-1", { leafId: "racine", columnId: "col-b", index: 0 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.section.elements.map((node) => node.id), ["row-a"]);
  assert.deepEqual(findCmsLeafParent(result.section, "racine"), { kind: "column", id: "col-b", rowId: "row-a" });
});

// 12–14 : cas C — déplacement entre deux rangées.
test("12. cas C : une feuille traverse deux rangées de la même section", () => {
  const source = sectionWith(
    rowNode("row-a", [column("col-a", 100, [leaf("a1")])], { y: 0, h: 300 }),
    rowNode("row-b", [column("col-b", 100, [])], { y: 400, h: 300 }),
  );
  const result = moveCmsLeafToColumn(page(source), "section-1", { leafId: "a1", columnId: "col-b", index: 0 });
  assert.equal(result.ok, true);
  assert.deepEqual(findCmsLeafParent(result.section, "a1"), { kind: "column", id: "col-b", rowId: "row-b" });
  assert.deepEqual(result.section.elements[0].children[0].children, []);
  assert.deepEqual(result.section.elements[1].children[0].children.map((child) => child.id), ["a1"]);
});
test("13. cas C : une structure ne peut pas devenir feuille de colonne", () => {
  const source = baseSection();
  const result = moveCmsLeafToColumn(page(source), "section-1", { leafId: "row-a", columnId: "col-a", index: 0 });
  assert.deepEqual(result, { ok: false, reason: "leaf-not-found" });
});
test("14. une feuille d'un conteneur peut rejoindre une colonne", () => {
  const source = sectionWith(
    { id: "cont", nodeType: "container", x: 0, y: 0, w: 300, h: 200, z: 1, rotation: 0, opacity: 1, layout: "free", children: [leaf("c1", { x: 40, y: 60 })] },
    rowNode("row-a", [column("col-a", 100, [])]),
  );
  const result = moveCmsLeafToColumn(page(source), "section-1", { leafId: "c1", columnId: "col-a", index: 0 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.section.elements[0].children.map((child) => child.id), []);
  assert.deepEqual(findCmsLeafParent(result.section, "c1"), { kind: "column", id: "col-a", rowId: "row-a" });
});

// 15–16 : cas D — position précise déterminée par le pointeur.
test("15. cas D : la cible de dépôt est la colonne réellement survolée", () => {
  const source = sectionWith(rowNode("row-a", [column("col-a", 50, [leaf("a1")]), column("col-b", 50, [leaf("b1")])]));
  // row.w=1000, gap=20 => col-a : x 0→490, col-b : x 510→1000
  assert.equal(resolveCmsColumnDropTarget(source, { x: 100, y: 50 })?.columnId, "col-a");
  assert.equal(resolveCmsColumnDropTarget(source, { x: 700, y: 50 })?.columnId, "col-b");
  assert.equal(resolveCmsColumnDropTarget(source, { x: 500, y: 50 }), null, "l écart entre colonnes n’est pas une cible");
  assert.equal(resolveCmsColumnDropTarget(source, { x: 700, y: 5000 }), null, "hors de la rangée");
});
test("16. cas D : l'index d'insertion est la position la plus proche du pointeur", () => {
  const children = [leaf("h1", { h: 100 }), leaf("h2", { h: 100 }), leaf("h3", { h: 100 })];
  const source = sectionWith(rowNode("row-a", [column("col-a", 100, children)]));
  const frame = resolveCmsRowColumnGeometry(source.elements[0])[0];
  assert.equal(resolveCmsColumnDropTarget(source, { x: frame.x + 10, y: frame.y + 10 }).index, 0);
  assert.equal(resolveCmsColumnDropTarget(source, { x: frame.x + 10, y: frame.y + 150 }).index, 1);
  assert.equal(resolveCmsColumnDropTarget(source, { x: frame.x + 10, y: frame.y + 250 }).index, 2);
  assert.equal(resolveCmsColumnDropTarget(source, { x: frame.x + 10, y: frame.y + 350 }).index, 3, "apres le dernier enfant");
});
test("16b. la géométrie de dépôt reproduit la résolution Phase 3B (écart soustrait avant %)", () => {
  const source = sectionWith(rowNode("row-a", [column("col-a", 50, []), column("col-b", 50, [])], { w: 1000, gap: 20 }));
  const frames = resolveCmsRowColumnGeometry(source.elements[0]);
  assert.deepEqual(frames.map((frame) => [frame.x, frame.w]), [[0, 490], [510, 490]]);
});

// 17–19 : garde-fous structurels.
test("17. un verrouillage bloque le déplacement et l'ajout", () => {
  const source = sectionWith(rowNode("row-a", [
    column("col-a", 50, [leaf("a1")], { locked: true }),
    column("col-b", 50, [leaf("b1")]),
  ]));
  assert.equal(canMoveCmsLeafToColumn(source, "a1", "col-b"), "locked");
  const result = moveCmsLeafToColumn(page(source), "section-1", { leafId: "a1", columnId: "col-b", index: 0 });
  assert.deepEqual(result, { ok: false, reason: "locked" });
});
test("18. une feuille verrouillée ou une colonne inexistante est refusée", () => {
  const source = sectionWith(rowNode("row-a", [column("col-a", 50, [leaf("a1", { locked: true })]), column("col-b", 50, [])]));
  assert.equal(moveCmsLeafToColumn(page(source), "section-1", { leafId: "a1", columnId: "col-b", index: 0 }).ok, false);
  assert.equal(moveCmsLeafToColumn(page(source), "section-1", { leafId: "fantome", columnId: "col-b", index: 0 }).ok, false);
  assert.equal(moveCmsLeafToColumn(page(source), "section-fantome", { leafId: "a1", columnId: "col-a", index: 0 }).ok, false);
});
test("19. une colonne pleine refuse l'arrivée d'une nouvelle feuille", () => {
  const full = Array.from({ length: 100 }, (_, index) => leaf(`f${index}`, { h: 10 }));
  const source = sectionWith(rowNode("row-a", [column("col-a", 50, [leaf("a1")]), column("col-b", 50, full)]));
  assert.equal(canMoveCmsLeafToColumn(source, "a1", "col-b"), "column-full");
});

// 20 : annulation — la structure est restaurable à l'identique.
test("20. l'annulation Phase 3B restaure structure, ordre, IDs et propriétés", () => {
  const before = page(baseSection());
  const beforeIds = JSON.stringify(before);
  const result = moveCmsLeafToColumn(before, "section-1", { leafId: "a1", columnId: "col-b", index: 0 });
  assert.equal(result.ok, true);
  // Snapshot unique avant/apres : l'annulation rejoue l'entree precedente.
  const history = appendHistorySnapshot([beforeIds], 0, JSON.stringify(page(result.section)));
  assert.equal(history.changed, true);
  assert.equal(history.index, 1);
  assert.deepEqual(JSON.parse(history.history[history.index - 1]), JSON.parse(beforeIds));
  assert.deepEqual(
    JSON.parse(history.history[history.index - 1]).sections[0].elements[0].children[0].children.map((child) => child.id),
    ["a1", "a2"],
  );
});
test("20b. retirer une feuille la détache sans toucher aux autres", () => {
  const detached = removeCmsLeaf(baseSection(), "a2");
  assert.deepEqual(findCmsLeaf(detached, "a2"), null);
  assert.deepEqual(detached.elements[0].children[0].children.map((child) => child.id), ["a1"]);
});
test("20c. la recherche de colonne retourne rangée et colonne correspondantes", () => {
  assert.equal(findCmsColumn(baseSection(), "col-b").row.id, "row-a");
  assert.equal(findCmsColumn(baseSection(), "inconnu"), null);
});
