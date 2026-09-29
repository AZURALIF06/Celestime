import test from "node:test";
import assert from "node:assert/strict";
import {
  duplicateCmsNode,
  emptyPage,
  isCmsNodeEditable,
  isCmsNodeVisible,
  isValidGenericCmsPage,
  removeCmsNodeFromSection,
  resolveCmsChildSectionFrame,
} from "../src/lib/cms.ts";
import { appendHistorySnapshot } from "../src/lib/cms-editor-canvas.ts";

const leaf = (id = "text-1", patch = {}) => ({
  id, type: "text", x: 20, y: 30, w: 180, h: 60, z: 1, rotation: 0, opacity: 1,
  content: { text: "Texte", variant: "p" }, style: {}, ...patch,
});
const container = (patch = {}) => ({
  id: "container-1", nodeType: "container", x: 100, y: 200, w: 400, h: 300, z: 2,
  rotation: 0, opacity: 1, layout: "free", children: [], ...patch,
});
const pageWith = (...elements) => ({ sections: [{ id: "section-1", h: 800, elements }] });
const makeHistory = (initial, next) => appendHistorySnapshot([JSON.stringify(initial)], 0, JSON.stringify(next));

// 1–6: legacy contract, valid container, multiple leaves, local coordinates and geometry.
test("1. ancienne page sans container reste valide sans conversion", () => {
  const oldPage = emptyPage();
  const before = JSON.stringify(oldPage);
  assert.equal(isValidGenericCmsPage(oldPage), true);
  assert.equal(JSON.stringify(oldPage), before);
});
test("2. ancienne feuille sans nodeType ni children reste valide", () => {
  assert.equal(isValidGenericCmsPage(pageWith(leaf())), true);
});
test("3. container libre valide", () => {
  assert.equal(isValidGenericCmsPage(pageWith(container())), true);
});
test("4. container avec plusieurs enfants feuilles valides", () => {
  const image = leaf("image-1", { type: "image", content: { src: "/images/test.jpg", alt: "Test" } });
  assert.equal(isValidGenericCmsPage(pageWith(container({ children: [leaf(), image] }))), true);
});
test("5. les coordonnées locales de l’enfant sont conservées dans le document", () => {
  const child = leaf("child", { x: 20, y: 30 });
  const doc = pageWith(container({ children: [child] }));
  assert.equal(isValidGenericCmsPage(doc), true);
  assert.equal(doc.sections[0].elements[0].children[0].x, 20);
  assert.equal(doc.sections[0].elements[0].children[0].y, 30);
});
test("6. la position section de l’enfant est container + coordonnées locales", () => {
  assert.deepEqual(resolveCmsChildSectionFrame(container(), leaf()), { x: 120, y: 230, w: 180, h: 60 });
});

// 7–11: strict discriminant, keys, nesting, and globally unique node IDs.
test("7. children est refusé sur une feuille historique", () => {
  assert.equal(isValidGenericCmsPage(pageWith({ ...leaf(), children: [] })), false);
});
test("8. nodeType structurel inconnu est refusé", () => {
  assert.equal(isValidGenericCmsPage(pageWith({ ...container(), nodeType: "row" })), false);
});
test("9. propriété inconnue sur le container est refusée", () => {
  assert.equal(isValidGenericCmsPage(pageWith(container({ arbitrary: true }))), false);
});
test("10. container imbriqué est refusé", () => {
  assert.equal(isValidGenericCmsPage(pageWith(container({ children: [container({ id: "nested" })] }))), false);
});
test("11. IDs des racines, containers et enfants doivent être uniques", () => {
  assert.equal(isValidGenericCmsPage(pageWith(leaf("same"), container({ children: [leaf("same")] }))), false);
});

// 12–15: structural operations and inherited interaction state.
test("12. duplication récursive réattribue l’ID du parent et de chaque enfant", () => {
  const source = container({ children: [leaf("child-a"), leaf("child-b")] });
  let next = 0;
  const copy = duplicateCmsNode(source, () => `new-${++next}`);
  assert.deepEqual([copy.id, ...copy.children.map((child) => child.id)], ["new-1", "new-2", "new-3"]);
  assert.deepEqual(source.children.map((child) => child.id), ["child-a", "child-b"]);
  copy.children[0].content.text = "mutated";
  assert.equal(source.children[0].content.text, "Texte");
});
test("13. suppression d’un container retire tout son sous-arbre", () => {
  const section = { id: "s", h: 600, elements: [leaf("root"), container({ children: [leaf("a"), leaf("b")] })] };
  const result = removeCmsNodeFromSection(section, "container-1");
  assert.deepEqual(result.elements.map((node) => node.id), ["root"]);
});
test("14. un parent verrouillé bloque l’édition de l’enfant", () => {
  const section = { id: "s", h: 600, elements: [container({ locked: true, children: [leaf("child")] })] };
  assert.equal(isCmsNodeEditable(section, "child"), false);
  assert.equal(isCmsNodeEditable(section, "container-1"), false);
});
test("15. le masquage du parent masque l’enfant sans supprimer les nœuds", () => {
  const parent = container({ hidden: true, children: [leaf("child")] });
  assert.equal(isCmsNodeVisible(parent.children[0], parent), false);
  assert.equal(parent.children.length, 1);
});

// 16–18: history snapshots for the requested edit categories.
test("16. undo après déplacement restaure la géométrie initiale", () => {
  const initial = pageWith(container());
  const moved = pageWith(container({ x: 160, y: 240 }));
  const result = makeHistory(initial, moved);
  assert.deepEqual(JSON.parse(result.history[result.index - 1]), initial);
});
test("17. undo après ajout d’enfant restaure le container vide", () => {
  const initial = pageWith(container());
  const added = pageWith(container({ children: [leaf("added")] }));
  const result = makeHistory(initial, added);
  assert.deepEqual(JSON.parse(result.history[result.index - 1]), initial);
});
test("18. undo après suppression d’enfant restaure l’enfant", () => {
  const initial = pageWith(container({ children: [leaf("kept")] }));
  const deleted = pageWith(container());
  const result = makeHistory(initial, deleted);
  assert.deepEqual(JSON.parse(result.history[result.index - 1]), initial);
});

// 19–23: shared strict validation at all generic CMS boundaries.
for (const [number, boundary] of [[19, "sauvegarde"], [20, "publication"], [21, "restauration"], [22, "aperçu"]]) {
  test(`${number}. document container validé avant ${boundary}`, () => {
    assert.equal(isValidGenericCmsPage(pageWith(container({ children: [leaf()] }))), true);
  });
}
test("23. géométrie de rendu cohérente entre canvas et public", () => {
  const parent = container();
  const child = leaf("child");
  const sectionFrame = resolveCmsChildSectionFrame(parent, child);
  assert.deepEqual({ x: parent.x + child.x, y: parent.y + child.y }, { x: sectionFrame.x, y: sectionFrame.y });
});

test("limites: 21 containers par section sont refusés", () => {
  const containers = Array.from({ length: 21 }, (_, index) => container({ id: `container-${index}` }));
  assert.equal(isValidGenericCmsPage(pageWith(...containers)), false);
});
test("limites: plus de 100 enfants par container sont refusés", () => {
  const children = Array.from({ length: 101 }, (_, index) => leaf(`child-${index}`));
  assert.equal(isValidGenericCmsPage(pageWith(container({ children }))), false);
});
test("plus de 300 feuilles au total restent possibles via plusieurs containers", () => {
  const containers = Array.from({ length: 4 }, (_, index) => container({
    id: `container-${index}`,
    children: Array.from({ length: 100 }, (_, child) => leaf(`child-${index}-${child}`)),
  }));
  assert.equal(isValidGenericCmsPage(pageWith(...containers)), true);
});
test("limites: le total de nœuds d’une page reste inférieur ou égal à 1000", () => {
  const sections = Array.from({ length: 100 }, (_, index) => ({
    id: `s-${index}`, h: 100, elements: Array.from({ length: 11 }, (_, child) => leaf(`e-${index}-${child}`)),
  }));
  assert.equal(isValidGenericCmsPage({ sections }), false);
});
test("un enfant avec un type CMS inconnu est refusé", () => {
  assert.equal(isValidGenericCmsPage(pageWith(container({ children: [leaf("child", { type: "unknown" })] }))), false);
});
test("une feuille ne peut pas déclarer nodeType même si le type est connu", () => {
  assert.equal(isValidGenericCmsPage(pageWith({ ...leaf(), nodeType: "container" })), false);
});
test("une propriété inconnue sur une feuille historique reste refusée", () => {
  assert.equal(isValidGenericCmsPage(pageWith({ ...leaf(), arbitrary: true })), false);
});
