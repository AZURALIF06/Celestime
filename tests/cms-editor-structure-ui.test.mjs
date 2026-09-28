import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editor = readFileSync(new URL("../src/components/admin/page-editor.tsx", import.meta.url), "utf8");
const cms = readFileSync(new URL("../src/lib/cms.ts", import.meta.url), "utf8");
const libraryStart = editor.indexOf("{editorLibraryGroups.map(([cat, items]) => (");
const canvasStart = editor.indexOf("{/* Canvas */}", libraryStart);
const libraryMarkup = editor.slice(libraryStart, canvasStart);

test("Phase 3B actions and legacy blocks share the same Structure library item list", () => {
  assert.ok(libraryStart >= 0 && canvasStart > libraryStart);
  assert.ok(editor.includes("libraryEntriesByCategory.Structure = ["));
  assert.ok(editor.includes("...PHASE3B_LIBRARY_ENTRIES,"));
  assert.ok(libraryMarkup.includes("{items.map((entry, index) => {"));
  assert.ok(libraryMarkup.includes('if (entry.kind === "element")'));
  assert.ok(libraryMarkup.includes('if (entry.kind === "row")'));
  assert.ok(libraryMarkup.includes('if (entry.kind === "group")'));

  for (const label of [
    'label: "Ligne 1 colonne"',
    'label: "Ligne 2 colonnes (50/50)"',
    'label: "Ligne 3 colonnes"',
    'label: "Ligne 4 colonnes"',
  ]) {
    assert.ok(editor.includes(label), `missing Structure entry: ${label}`);
  }
  assert.ok(libraryMarkup.includes("onClick={() => addRow(entry.preset)}"));
  assert.ok(libraryMarkup.includes("onClick={groupSelection}"));
});

test("legacy Structure library elements remain available after the Phase 3B actions", () => {
  const structureActions = editor.indexOf("...PHASE3B_LIBRARY_ENTRIES,");
  const legacyElements = editor.indexOf("...(libraryEntriesByCategory.Structure ?? [])", structureActions);
  assert.ok(structureActions >= 0 && legacyElements > structureActions, "legacy Structure items follow the Phase 3B entries in the same array");
  for (const label of ["Séparateur", "Espace", "Section · colonne gauche", "Section · colonne droite", "Section · conteneur"]) {
    assert.ok(cms.includes(`t("${label === "Séparateur" ? "divider" : label === "Espace" ? "spacer" : "section"}", "${label}"`), `legacy item missing: ${label}`);
  }
});

test("Phase 3B library entries are added only for generic slugs and their controls require Desktop", () => {
  assert.ok(editor.includes('const PHASE3B_DISABLED_SLUGS = new Set(["accueil", "boutique", "faq", "livraison", "comment-ca-marche"]);'));
  assert.ok(editor.includes("if (!PHASE3B_DISABLED_SLUGS.has(initialSlug)) {"));
  assert.ok(libraryMarkup.includes("disabled={device !== \"desktop\"}"));
  assert.ok(libraryMarkup.includes("disabled={activeMulti.length < 2 || device !== \"desktop\"}"));
});

test("section selection exposes its existing properties and an undoable visual height handle", () => {
  assert.ok(editor.includes("const SECTION_SELECTION_ID = \"__cms_section_selection__\";"));
  assert.ok(editor.includes("title=\"Sélectionner les propriétés de la section\""));
  assert.ok(editor.includes("onMouseDown={(event) => { if (event.target === event.currentTarget) selectSection(section.id); }}"));
  assert.ok(editor.includes("startSectionResize(event, section)"));
  assert.ok(editor.includes("const sectionResizeRef = useRef<"));
  assert.ok(editor.includes("Une page doit conserver au moins une section."));
});

test("group resizing scales local children and supports discrete z-order and canvas alignment", () => {
  assert.ok(editor.includes("resizeCmsGroupToFrame"));
  assert.ok(!editor.includes("Le groupe se déplace sans mise à l’échelle destructive."));
  assert.ok(editor.includes("Mettre au premier plan"));
  assert.ok(editor.includes("Avancer d’un niveau"));
  assert.ok(editor.includes("alignSelected(\"centerX\")"));
  assert.ok(editor.includes('Largeur (px)"><NumInput v={selGroup.w}'));
  assert.ok(editor.includes('Hauteur (px)"><NumInput v={selGroup.h}'));
});

test("Hero, navigation menu and cart shortcut have editable properties and public render cases", () => {
  const renderer = readFileSync(new URL("../src/components/page/element-view.tsx", import.meta.url), "utf8");
  for (const type of ["hero", "menu", "cart"]) {
    assert.ok(cms.includes(`t("${type}"`), `${type} exists in the CMS library`);
    assert.ok(editor.includes(`el.type === "${type}"`), `${type} has editor controls`);
    assert.ok(renderer.includes(`case "${type}"`), `${type} has a public renderer`);
  }
  assert.ok(renderer.includes('<Link href="/cart"'));
});
