import test from "node:test";
import assert from "node:assert/strict";
import {
  areValidNewCmsVisualBlocks,
  isValidGenericCmsPage,
  makeElement,
  LIBRARY,
  resolveCmsButtonHref,
} from "../src/lib/cms.ts";
import { normalizeCmsFormConfig, isValidCmsFormContent, validateCmsFormSubmission } from "../src/lib/cms-form.ts";
import { moveCmsLeafToColumn, resolveCmsAddTarget } from "../src/lib/cms-columns.ts";
import { resolveCmsRowLayout, resolveCmsSectionHeight } from "../src/lib/cms-responsive-rows.ts";

const leaf = (id, patch = {}) => ({
  id, type: "text", x: 0, y: 0, w: 200, h: 40, z: 1, rotation: 0, opacity: 1,
  content: { text: `Texte ${id}` }, style: {}, ...patch,
});
const column = (id, width, children = [], patch = {}) => ({
  id, nodeType: "column", width, z: 1, opacity: 1, layout: "vertical", gap: 10, children, ...patch,
});
const rowNode = (id, children, patch = {}) => ({
  id, nodeType: "row", x: 0, y: 0, w: 1000, h: 300, z: 1, rotation: 0, opacity: 1,
  layout: "horizontal", gap: 20, alignX: "start", alignY: "start", children, ...patch,
});
const doc = (...elements) => ({ sections: [{ id: "section-1", h: 700, elements }] });
const json = (value) => JSON.parse(JSON.stringify(value));

// --- Persistance : le flux création → sauvegarde → rechargement (§14) -------------

test("1. Text : création, modification, sauvegarde et rechargement conservent la valeur", () => {
  const created = makeElement(LIBRARY.find((entry) => entry.type === "text" && entry.label === "Titre"));
  const edited = { ...created, content: { ...created.content, text: "Titre persistant" } };
  const saved = doc(rowNode("row-1", [column("col-a", 100, [edited])]));
  // Round-trip JSON : c'est exactement ce que voit le navigateur au rechargement.
  const reloaded = json(saved);
  assert.equal(isValidGenericCmsPage(reloaded), true);
  assert.equal(reloaded.sections[0].elements[0].children[0].children[0].content.text, "Titre persistant");
  assert.equal(reloaded.sections[0].elements[0].children[0].children[0].id, created.id, "l'ID reste stable");
});

test("2. Button : tel, mailto, interne, externe et nouvel onglet survivent au round-trip", () => {
  const cases = [
    { href: "/boutique", kind: "internal" },
    { href: "https://example.fr/page", kind: "external" },
    { href: "tel:+33612345678", kind: "phone" },
    { href: "mailto:Contact@Exemple.FR", kind: "email" },
  ];
  for (const entry of cases) {
    const element = makeElement(LIBRARY.find((item) => item.type === "button" && item.label === "Bouton"));
    element.content.href = entry.href;
    element.content.newTab = true;
    const saved = json(doc(rowNode("row-1", [column("col-a", 100, [element])])));
    assert.equal(isValidGenericCmsPage(saved), true, `${entry.href} valide`);
    const reloaded = saved.sections[0].elements[0].children[0].children[0];
    assert.equal(reloaded.id, element.id);
    assert.equal(reloaded.content.newTab, true);
    assert.equal(resolveCmsButtonHref(reloaded.content.href).kind, entry.kind);
  }
});

test("3. Button : les destinations dangereuses sont refusées à l’enregistrement ET au rendu", () => {
  for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x", "vbscript:x", "//evil.fr", "/a\\b"]) {
    assert.equal(resolveCmsButtonHref(href), null, `${href} refuse`);
    const element = makeElement(LIBRARY.find((item) => item.type === "button" && item.label === "Bouton"));
    element.content.href = href;
    const page = doc(rowNode("row-1", [column("col-a", 100, [element])]));
    assert.equal(isValidGenericCmsPage(page), false, `${href} refuse au save`);
  }
});

test("4. Image : ajout, remplacement des propriétés et persistance conservent src et alt", () => {
  const image = makeElement(LIBRARY.find((entry) => entry.type === "image" && entry.label === "Image"));
  image.content = { ...image.content, src: "/images/calendrier.jpg", alt: "Calendrier 2027", fit: "contain", radius: 24 };
  const saved = json(doc(rowNode("row-1", [column("col-a", 100, [image])])));
  const reloaded = saved.sections[0].elements[0].children[0].children[0];
  assert.equal(isValidGenericCmsPage(saved), true);
  assert.deepEqual(
    { src: reloaded.content.src, alt: reloaded.content.alt, fit: reloaded.content.fit, radius: reloaded.content.radius },
    { src: "/images/calendrier.jpg", alt: "Calendrier 2027", fit: "contain", radius: 24 },
  );
});

test("5. les colonnes vides sont valides : une page peut garder une structure sans contenu", () => {
  assert.equal(isValidGenericCmsPage(doc(rowNode("row-1", [column("col-a", 50, []), column("col-b", 50, [])]))), true);
});

test("6.areValidNewCmsVisualBlocks ne rejette pas un formulaire Phase 3C", () => {
  const form = makeElement(LIBRARY.find((entry) => entry.type === "form"));
  assert.equal(areValidNewCmsVisualBlocks(doc(rowNode("row-1", [column("col-a", 100, [form])]))), true);
});

// --- Draft / publication (§15) ---------------------------------------------------

test("7. un brouillon valide et sa publication donnent deux documents distincts", () => {
  const draft = doc(rowNode("row-1", [column("col-a", 100, [leaf("a")])]));
  const published = json({ ...draft, sections: [{ ...draft.sections[0], elements: [rowNode("row-1", [column("col-a", 100, [leaf("a"), leaf("b")])])] }] });
  assert.equal(isValidGenericCmsPage(draft), true);
  assert.equal(isValidGenericCmsPage(published), true);
  // Le brouillon n'est PAS modifié par la publication.
  assert.equal(draft.sections[0].elements[0].children[0].children.length, 1);
  assert.equal(published.sections[0].elements[0].children[0].children.length, 2);
});

test("8. un formulaire invalide bloque la publication (fail-closed)", () => {
  const form = makeElement(LIBRARY.find((entry) => entry.type === "form"));
  form.content = { ...form.content, fields: [{ key: "name" }, { key: "name" }] };
  const page = doc(rowNode("row-1", [column("col-a", 100, [form])]));
  assert.equal(isValidGenericCmsPage(page), false, "la publication est refusee");
  // Le mode rendu ne doit pas laisser passer un formulaire non conforme.
  assert.equal(isValidGenericCmsPage(page, { forRendering: true }), false);
});

test("9. un ancien formulaire Phase 3B ({ text }) reste lisible et publiable", () => {
  const legacy = leaf("legacy-form", { type: "form", content: { text: "Écrivez-nous" } });
  const page = doc(legacy);
  assert.equal(isValidGenericCmsPage(page), true, "aucune régression de lecture");
  const config = normalizeCmsFormConfig(legacy.content);
  assert.equal(config.title, "Écrivez-nous");
  assert.deepEqual(config.fields.filter((field) => field.enabled).map((field) => field.key), ["name", "email", "message"]);
  const result = validateCmsFormSubmission(config, { name: "Camille", email: "a@b.fr", message: "Bonjour" });
  assert.equal(result.ok, true);
});

test("10. un ancien formulaire dont `text` dépasse 200 caractères reste valide (borne Phase 3B)", () => {
  const long = "x".repeat(3000);
  const legacy = leaf("legacy-form", { type: "form", content: { text: long } });
  assert.equal(isValidGenericCmsPage(doc(legacy)), true);
  assert.equal(isValidCmsFormContent({ text: long }), true);
  // Le titre rendu reste borné, sans invalider le document.
  assert.equal(normalizeCmsFormConfig({ text: long }).title.length, 200);
});

test("11. la validation en mode rendu n'assouplit pas le formulaire", () => {
  const form = makeElement(LIBRARY.find((entry) => entry.type === "form"));
  form.content = { ...form.content, fields: [{ key: "name", type: "email" }] };
  const page = doc(rowNode("row-1", [column("col-a", 100, [form])]));
  assert.equal(isValidGenericCmsPage(page, { forRendering: true }), false);
});

// --- Responsive persisté (§10) ---------------------------------------------------

test("12. les réglages responsive de rangée et de colonne survivent au round-trip", () => {
  const row = rowNode("row-1", [
    column("col-a", 50, [leaf("a")], { responsive: { mobile: { width: 100, order: 1 } } }),
    column("col-b", 50, [leaf("b")], { responsive: { mobile: { width: 100, order: 0 } } }),
  ], { responsive: { mobile: { stack: true, gap: 12 } } });
  const reloaded = json(doc(row));
  assert.equal(isValidGenericCmsPage(reloaded), true);
  const restored = reloaded.sections[0].elements[0];
  assert.deepEqual(restored.responsive, { mobile: { stack: true, gap: 12 } });
  assert.deepEqual(restored.children.map((child) => child.id), ["col-a", "col-b"], "children[] conserve l'ordre Phase 3B");
  const layout = resolveCmsRowLayout(restored, "mobile");
  assert.equal(layout.stacked, true);
  assert.deepEqual(layout.columns.map((entry) => entry.column.id), ["col-b", "col-a"]);
});

test("13. un override responsive invalide est refusé à l’enregistrement", () => {
  const base = doc(rowNode("row-1", [column("col-a", 100, [leaf("a")])]));
  assert.equal(isValidGenericCmsPage(json({ sections: [{ ...base.sections[0], elements: [{ ...base.sections[0].elements[0], responsive: { mobile: { stack: "oui" } } }] }] })), false);
  assert.equal(isValidGenericCmsPage(json({ sections: [{ ...base.sections[0], elements: [{ ...base.sections[0].elements[0], responsive: { mobile: { gap: 9999 } } }] }] })), false);
  assert.equal(isValidGenericCmsPage(json({ sections: [{ ...base.sections[0], elements: [{ ...base.sections[0].elements[0], responsive: { inconnu: {} } }] }] })), false);
  const badColumn = doc(rowNode("row-1", [{ ...column("col-a", 100, [leaf("a")]), responsive: { mobile: { width: 0 } } }]));
  assert.equal(isValidGenericCmsPage(json(badColumn)), false);
});

test("14. la hauteur de section résolue est stable après rechargement", () => {
  const page = doc(rowNode("row-1", [column("col-a", 100, [leaf("a", { h: 180 })])], { y: 40, responsive: { mobile: { stack: true } } }));
  const reloaded = json(page);
  assert.equal(resolveCmsSectionHeight(reloaded.sections[0], "mobile"), resolveCmsSectionHeight(page.sections[0], "mobile"));
  assert.equal(resolveCmsSectionHeight(reloaded.sections[0], "mobile"), 700);
});

// --- Intégrité structurelle après un déplacement (§7, §8) -----------------------

test("15. un déplacement inter-colonnes produit un document publiable", () => {
  const before = doc(rowNode("row-1", [column("col-a", 50, [leaf("a1")]), column("col-b", 50, [])]));
  const moved = moveCmsLeafToColumn(before, "section-1", { leafId: "a1", columnId: "col-b", index: 0 });
  assert.equal(moved.ok, true);
  const after = { sections: [moved.section] };
  assert.equal(isValidGenericCmsPage(after), true, "le document reste publiable");
  assert.equal(after.sections[0].elements[0].children[1].children[0].id, "a1");
});

test("16. la cible d'ajout est stable après un déplacement (cohérence éditeur/serveur)", () => {
  const before = doc(rowNode("row-1", [column("col-a", 50, [leaf("a1")]), column("col-b", 50, [])]));
  const moved = moveCmsLeafToColumn(before, "section-1", { leafId: "a1", columnId: "col-b", index: 0 });
  const target = resolveCmsAddTarget(moved.section, "a1");
  assert.deepEqual(target, { kind: "column", columnId: "col-b", rowId: "row-1" });
});
