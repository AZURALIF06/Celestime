import test from "node:test";
import assert from "node:assert/strict";
import {
  createCmsGroupFromElements,
  countCmsNodes,
  resolveCmsColumnChildFrames,
  resolveCmsRowColumnFrames,
  duplicateCmsNode,
  emptyPage,
  isCmsNodeEditable,
  isCmsNodeVisibleInSection,
  isValidGenericCmsPage,
  LIBRARY,
  makeElement,
  moveCmsColumnChild,
  removeCmsNodeFromSection,
  resizeCmsGroupToFrame,
} from "../src/lib/cms.ts";
import { appendHistorySnapshot } from "../src/lib/cms-editor-canvas.ts";

const leaf = (id, patch = {}) => ({
  id, type: "text", x: 12, y: 24, w: 180, h: 60, z: 1, rotation: 0, opacity: 1,
  content: { text: "Texte", variant: "p" }, style: {}, ...patch,
});
const column = (id, width = 50, children = [], patch = {}) => ({
  id, nodeType: "column", width, z: 1, opacity: 1, layout: "vertical", gap: 12, children, ...patch,
});
const row = (children = [column("col-a", 50), column("col-b", 50)], patch = {}) => ({
  id: "row-1", nodeType: "row", x: 100, y: 80, w: 1000, h: 320, z: 2,
  rotation: 0, opacity: 1, layout: "horizontal", gap: 20, alignX: "start", alignY: "start", children, ...patch,
});
const group = (children = [leaf("group-a"), leaf("group-b", { x: 220 })], patch = {}) => ({
  id: "group-1", nodeType: "group", x: 30, y: 40, w: 400, h: 180, z: 1,
  rotation: 0, opacity: 1, layout: "free", children, ...patch,
});
const pageWith = (...elements) => ({ sections: [{ id: "section-1", h: 800, elements }] });

// A–B: historical JSON and Phase 3A compatibility.
test("A. une page legacy sans structure reste valide et inchangée", () => {
  const oldPage = emptyPage();
  oldPage.sections[0].elements.push(leaf("legacy"));
  const before = JSON.stringify(oldPage);
  assert.equal(isValidGenericCmsPage(oldPage), true);
  assert.equal(JSON.stringify(oldPage), before);
});
test("B. un conteneur free Phase 3A avec enfants feuilles reste valide", () => {
  const free = { id: "free", nodeType: "container", x: 2, y: 3, w: 500, h: 300, z: 1, rotation: 0, opacity: 1, layout: "free", children: [leaf("free-leaf")] };
  assert.equal(isValidGenericCmsPage(pageWith(free)), true);
});

// C–H: rows, columns, presets and width contracts.
test("C. une rangée horizontale valide", () => assert.equal(isValidGenericCmsPage(pageWith(row())), true));
test("D. une colonne valide dans une rangée", () => assert.equal(isValidGenericCmsPage(pageWith(row([column("only", 100, [leaf("inside")])]))), true));
test("E. un groupe structurel de feuilles valide", () => assert.equal(isValidGenericCmsPage(pageWith(group())), true));
test("E1. le redimensionnement d’un groupe met à l’échelle ses feuilles et leurs overrides sans changer leurs identifiants", () => {
  const original = group([
    leaf("group-a", { x: 10, y: 20, w: 100, h: 40, style: { size: 20 }, responsive: { tablet: { x: 8, y: 12, w: 90, h: 36, fontSize: 18 } } }),
  ]);
  const resized = resizeCmsGroupToFrame(original, { x: 50, y: 60, w: 800, h: 360 });
  assert.deepEqual({ x: resized.x, y: resized.y, w: resized.w, h: resized.h }, { x: 50, y: 60, w: 800, h: 360 });
  assert.deepEqual({ x: resized.children[0].x, y: resized.children[0].y, w: resized.children[0].w, h: resized.children[0].h }, { x: 20, y: 40, w: 200, h: 80 });
  assert.equal(resized.children[0].style.size, 40);
  assert.deepEqual(resized.children[0].responsive.tablet, { x: 16, y: 24, w: 180, h: 72, fontSize: 36 });
  assert.equal(resized.children[0].id, "group-a");
  assert.equal(isValidGenericCmsPage(pageWith(resized)), true);
  const history = appendHistorySnapshot([JSON.stringify(pageWith(original))], 0, JSON.stringify(pageWith(resized)));
  assert.equal(history.changed, true);
  assert.deepEqual(JSON.parse(history.history[0]), pageWith(original));
  assert.deepEqual(JSON.parse(history.history[history.index]), pageWith(resized));
});
test("E2. le regroupement convertit en coordonnées locales en conservant les IDs et les overrides responsive", () => {
  const items = [leaf("one", { x: 100, y: 80, responsive: { tablet: { x: 64, y: 40 } } }), leaf("two", { x: 260, y: 120 })];
  const result = createCmsGroupFromElements(items, "new-group");
  assert.equal(result.x, 100);
  assert.equal(result.y, 80);
  assert.equal(result.children[0].id, "one");
  assert.equal(result.children[0].x, 0);
  assert.equal(result.children[0].responsive.tablet.x, 0);
  assert.equal(result.children[1].x, 160);
  assert.equal(isValidGenericCmsPage(pageWith(result)), true);
});
test("F. preset rangée à deux colonnes 50/50 valide", () => assert.equal(isValidGenericCmsPage(pageWith(row([column("a", 50), column("b", 50)]))), true));
test("G. preset rangée à trois colonnes égales valide", () => assert.equal(isValidGenericCmsPage(pageWith(row([column("a", 100 / 3), column("b", 100 / 3), column("c", 100 / 3)]))), true));
test("H. des proportions contrôlées dont la somme est au plus 100 sont valides", () => {
  assert.equal(isValidGenericCmsPage(pageWith(row([column("a", 30), column("b", 70)]))), true);
  assert.equal(isValidGenericCmsPage(pageWith(row([column("a", 35), column("b", 40)]))), true);
});

// I–N: fail-closed validation.
test("I. des largeurs négatives, nulles ou dont la somme dépasse 100 sont refusées", () => {
  assert.equal(isValidGenericCmsPage(pageWith(row([column("a", -1), column("b", 101)]))), false);
  assert.equal(isValidGenericCmsPage(pageWith(row([column("a", 60), column("b", 50)]))), false);
});
test("J. gap négatif, excessif ou non fini est refusé", () => {
  assert.equal(isValidGenericCmsPage(pageWith(row(undefined, { gap: -1 }))), false);
  assert.equal(isValidGenericCmsPage(pageWith(row(undefined, { gap: Infinity }))), false);
  assert.equal(isValidGenericCmsPage(pageWith(row([column("a", 100, [], { gap: 129 })]))), false);
});
test("K. nodeType inconnu est refusé", () => assert.equal(isValidGenericCmsPage(pageWith({ ...group(), nodeType: "stack" })), false));
test("L. propriété inconnue sur un node structurel est refusée", () => assert.equal(isValidGenericCmsPage(pageWith(row(undefined, { arbitrary: true }))), false));
test("M. ID dupliqué entre rangée, colonne et feuille est refusé", () => assert.equal(isValidGenericCmsPage(pageWith(row([column("duplicate", 50), column("other", 50, [leaf("duplicate")])]))), false));
test("N. column hors row, feuille structurelle directe et structures imbriquées sont refusées", () => {
  assert.equal(isValidGenericCmsPage(pageWith(column("orphan", 100))), false);
  assert.equal(isValidGenericCmsPage(pageWith(row([column("a", 100, [group()])]))), false);
  assert.equal(isValidGenericCmsPage(pageWith(group([]))), false);
  assert.equal(isValidGenericCmsPage(pageWith(group([leaf("one")]))), true);
});

// O–S: recursive operations, IDs, deletion, lock and visibility.
test("O. la duplication d’une rangée est récursive et profonde-clone ses feuilles", () => {
  let n = 0;
  const original = row([column("c1", 50, [leaf("l1")]), column("c2", 50, [leaf("l2")])]);
  const copy = duplicateCmsNode(original, () => `copy-${++n}`);
  assert.equal(copy.children.length, 2);
  assert.equal(copy.children[0].children.length, 1);
  copy.children[0].children[0].content.text = "altéré";
  assert.equal(original.children[0].children[0].content.text, "Texte");
});
test("P. tous les IDs changent lors d’une duplication récursive", () => {
  let n = 0;
  const original = row([column("c1", 50, [leaf("l1")]), column("c2", 50, [leaf("l2")])]);
  const copy = duplicateCmsNode(original, () => `new-${++n}`);
  const oldIds = new Set([original.id, ...original.children.flatMap((c) => [c.id, ...c.children.map((child) => child.id)])]);
  const newIds = [copy.id, ...copy.children.flatMap((c) => [c.id, ...c.children.map((child) => child.id)])];
  assert.equal(new Set(newIds).size, newIds.length);
  assert.equal(newIds.some((id) => oldIds.has(id)), false);
});
test("Q. supprimer une rangée retire ses colonnes et tout le sous-arbre", () => {
  const doc = pageWith(leaf("sibling"), row([column("c1", 50, [leaf("a")]), column("c2", 50, [leaf("b")])]));
  const result = removeCmsNodeFromSection(doc.sections[0], "row-1");
  assert.deepEqual(result.elements.map((node) => node.id), ["sibling"]);
  assert.equal(countCmsNodes({ sections: [result] }), 1);
});
test("R. le verrouillage d’une rangée interdit l’édition de colonne et de feuille", () => {
  const locked = row([column("c1", 100, [leaf("child")])], { locked: true });
  const section = pageWith(locked).sections[0];
  assert.equal(isCmsNodeEditable(section, "row-1"), false);
  assert.equal(isCmsNodeEditable(section, "c1"), false);
  assert.equal(isCmsNodeEditable(section, "child"), false);
});
test("S. masquer un parent masque les descendants sans les retirer", () => {
  const hidden = row([column("c1", 100, [leaf("child")])], { hidden: true });
  const section = pageWith(hidden).sections[0];
  assert.equal(isCmsNodeVisibleInSection(section, "child"), false);
  assert.equal(findCmsChildCount(hidden), 2);
  assert.equal(hidden.children[0].children[0].id, "child");
});

// T–X: snapshots, depth/node caps, flow geometry and deterministic resolution.
test("T. une mutation structurelle produit un snapshot undoable et évite le doublon", () => {
  const before = pageWith(row());
  const after = pageWith(row(undefined, { gap: 24 }));
  const first = appendHistorySnapshot([JSON.stringify(before)], 0, JSON.stringify(after));
  assert.equal(first.changed, true);
  const duplicate = appendHistorySnapshot(first.history, first.index, JSON.stringify(after));
  assert.equal(duplicate.changed, false);
  assert.deepEqual(JSON.parse(first.history[first.index - 1]), before);
});
test("U. la topologie bornée rejette un niveau structurel interdit", () => {
  const columnWithStructural = column("c", 100, [group()]);
  assert.equal(isValidGenericCmsPage(pageWith(row([columnWithStructural]))), false);
});
test("V. un total de nœuds supérieur à 1000 est rejeté", () => {
  const sections = Array.from({ length: 3 }, (_, sectionIndex) => ({
    id: `s-${sectionIndex}`, h: 800,
    elements: Array.from({ length: 20 }, (_, rowIndex) => row(Array.from({ length: 4 }, (_, colIndex) => column(`c-${sectionIndex}-${rowIndex}-${colIndex}`, 25,
      Array.from({ length: 5 }, (_, childIndex) => leaf(`l-${sectionIndex}-${rowIndex}-${colIndex}-${childIndex}`)))) , { id: `r-${sectionIndex}-${rowIndex}` })),
  }));
  assert.equal(isValidGenericCmsPage({ sections }), false);
});
test("W. le flow utilise l’ordre children[] et ignore x/y/w sans réécrire les coordonnées conservées", () => {
  const first = leaf("first", { x: 950, y: 700, w: 10, h: 40 });
  const second = leaf("second", { x: 2, y: 1, w: 20, h: 50 });
  const layoutRow = row([column("one", 50, [first, second]), column("two", 50)]);
  const before = JSON.stringify(layoutRow);
  const frames = resolveCmsColumnChildFrames(layoutRow, layoutRow.children[0]);
  assert.equal(frames[0].child.id, "first");
  assert.equal(frames[0].frame.w, frames[1].frame.w);
  assert.equal(frames[1].frame.y, frames[0].frame.y + 40 + layoutRow.children[0].gap);
  assert.equal(JSON.stringify(layoutRow), before);
});
test("X. les frames de colonnes sont déterministes et les feuilles de flux réordonnent par tableau", () => {
  const layoutRow = row([column("a", 30), column("b", 70)]);
  const first = resolveCmsRowColumnFrames(layoutRow).map(({ column: item, frame }) => [item.id, frame.x, frame.w]);
  const second = resolveCmsRowColumnFrames(layoutRow).map(({ column: item, frame }) => [item.id, frame.x, frame.w]);
  assert.deepEqual(first, second);
  const changed = moveCmsColumnChild(column("flow", 100, [leaf("a"), leaf("b")]), "b", -1);
  assert.deepEqual(changed.children.map((child) => child.id), ["b", "a"]);
});

function findCmsChildCount(node) { return node.children?.reduce((sum, child) => sum + 1 + (child.children?.length ?? 0), 0) ?? 0; }

test("Y. les blocs Hero, menu et panier sont de vrais blocs CMS validés et rendus" , () => {
  for (const type of ["hero", "menu", "cart"]) {
    const item = LIBRARY.find((entry) => entry.type === type);
    assert.ok(item, `bloc ${type} disponible dans la bibliothèque`);
    assert.equal(isValidGenericCmsPage(pageWith(makeElement(item))), true);
  }
  const unsafeMenu = makeElement(LIBRARY.find((entry) => entry.type === "menu"));
  unsafeMenu.content.items[0].href = "/cart";
  assert.equal(isValidGenericCmsPage(pageWith(unsafeMenu)), false);
  const unsafeHero = makeElement(LIBRARY.find((entry) => entry.type === "hero"));
  unsafeHero.content.imageSrc = "javascript:alert(1)";
  assert.equal(isValidGenericCmsPage(pageWith(unsafeHero)), false);
});
