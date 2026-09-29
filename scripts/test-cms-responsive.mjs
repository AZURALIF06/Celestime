import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
function loadTypeScriptModule(path, requireShim = require) {
  const source = readFileSync(resolve(root, path), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const transpiledModule = { exports: {} };
  new Function("exports", "require", "module", compiled)(transpiledModule.exports, requireShim, transpiledModule);
  return transpiledModule.exports;
}

const cms = loadTypeScriptModule("src/lib/cms.ts");
const responsive = loadTypeScriptModule("src/lib/cms-responsive.ts", (name) => name === "@/lib/cms" ? cms : require(name));
const canvas = loadTypeScriptModule("src/lib/cms-editor-canvas.ts");
let passed = 0;
function check(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
  passed += 1;
}

const baseElement = {
  id: "responsive-test", type: "text", x: 100, y: 200, w: 500, h: 120,
  z: 1, rotation: 0, opacity: 1, hidden: false, content: { text: "test" }, style: { size: 24 },
};

check("détection auto des breakpoints publics par largeur", () => {
  assert.equal(responsive.getCmsBreakpointForWidth(390), "mobile");
  assert.equal(responsive.getCmsBreakpointForWidth(768), "tablet");
  assert.equal(responsive.getCmsBreakpointForWidth(1200), "desktop");
});
check("fallback Desktop conservé sans override", () => {
  assert.deepEqual(responsive.resolveCmsElementFrame(baseElement, "desktop"), { x: 100, y: 200, w: 500, h: 120 });
  assert.equal(responsive.resolveCmsElementForBreakpoint(baseElement, "desktop").hidden, false);
});
check("fallback Tablette proportionnel sans écriture du document", () => {
  const before = structuredClone(baseElement);
  const local = responsive.getCmsElementFrameInBreakpoint(baseElement, "tablet");
  assert.equal(local.x, 64);
  assert.equal(local.w, 320);
  assert.deepEqual(responsive.resolveCmsElementFrame(baseElement, "tablet"), { x: 100, y: 200, w: 500, h: 120 });
  assert.deepEqual(baseElement, before);
});
check("fallback Mobile proportionnel pour les éléments sans override", () => {
  const local = responsive.getCmsElementFrameInBreakpoint(baseElement, "mobile");
  assert.equal(local.x, 32.5);
  assert.equal(local.y, 65);
  assert.equal(local.w, 162.5);
});
check("override Tablette appliqué avec conversion vers le canvas partagé", () => {
  const element = { ...baseElement, responsive: { tablet: { x: 30, y: 50, w: 480, h: 80 } } };
  const local = responsive.getCmsElementFrameInBreakpoint(element, "tablet");
  assert.deepEqual(local, { x: 30, y: 50, w: 480, h: 80 });
  const resolved = responsive.resolveCmsElementFrame(element, "tablet");
  assert.equal(resolved.x, 30 * 1200 / 768);
  assert.equal(resolved.w, 480 * 1200 / 768);
});
check("override Mobile applique X, Y, largeur et hauteur sans mélange", () => {
  const element = { ...baseElement, responsive: { mobile: { x: 20, y: 100, w: 330, h: 170 } } };
  assert.deepEqual(responsive.getCmsElementFrameInBreakpoint(element, "mobile"), { x: 20, y: 100, w: 330, h: 170 });
  const resolved = responsive.resolveCmsElementFrame(element, "mobile");
  assert.ok(Math.abs(resolved.x - 20 * 1200 / 390) < 1e-9);
  assert.ok(Math.abs(resolved.y - 100 * 1200 / 390) < 1e-9);
  assert.ok(Math.abs(resolved.w - 330 * 1200 / 390) < 1e-9);
  assert.ok(Math.abs(resolved.h - 170 * 1200 / 390) < 1e-9);
});
check("édition Mobile n’écrase ni les valeurs Desktop ni Tablette", () => {
  const initial = { ...baseElement, responsive: { tablet: { x: 60, y: 70 } } };
  const next = responsive.applyCmsElementBreakpointPatch(initial, "mobile", { x: 20, y: 100 });
  assert.equal(next.x, 100);
  assert.equal(next.y, 200);
  assert.deepEqual(next.responsive.tablet, { x: 60, y: 70 });
  assert.deepEqual(next.responsive.mobile, { x: 20, y: 100 });
});
check("édition Desktop n’écrase pas l’override Mobile", () => {
  const initial = { ...baseElement, responsive: { mobile: { x: 20, w: 330 } } };
  const next = responsive.applyCmsElementBreakpointPatch(initial, "desktop", { x: 120, w: 600 });
  assert.equal(next.x, 120);
  assert.equal(next.w, 600);
  assert.deepEqual(next.responsive.mobile, { x: 20, w: 330 });
});
check("visibilité Desktop indépendante", () => {
  const element = responsive.applyCmsElementBreakpointPatch(baseElement, "desktop", { hidden: true });
  assert.equal(responsive.resolveCmsElementForBreakpoint(element, "desktop").hidden, true);
  assert.equal(responsive.resolveCmsElementForBreakpoint(element, "tablet").hidden, true);
});
check("visibilité Tablette surcharge le fallback Desktop", () => {
  const desktopHidden = responsive.applyCmsElementBreakpointPatch(baseElement, "desktop", { hidden: true });
  const tabletVisible = responsive.applyCmsElementBreakpointPatch(desktopHidden, "tablet", { hidden: false });
  assert.equal(responsive.resolveCmsElementForBreakpoint(tabletVisible, "desktop").hidden, true);
  assert.equal(responsive.resolveCmsElementForBreakpoint(tabletVisible, "tablet").hidden, false);
  assert.equal(responsive.resolveCmsElementForBreakpoint(tabletVisible, "mobile").hidden, true);
});
check("visibilité Mobile indépendante de Desktop et Tablette", () => {
  const element = responsive.applyCmsElementBreakpointPatch(baseElement, "mobile", { hidden: true });
  assert.equal(responsive.resolveCmsElementForBreakpoint(element, "mobile").hidden, true);
  assert.equal(responsive.resolveCmsElementForBreakpoint(element, "desktop").hidden, false);
  assert.equal(responsive.resolveCmsElementForBreakpoint(element, "tablet").hidden, false);
});
check("fontSize responsive existant s’applique sans changer le style Desktop", () => {
  const element = responsive.applyCmsElementBreakpointPatch(baseElement, "mobile", { fontSize: 18 });
  assert.equal(element.style.size, 24);
  assert.equal(responsive.getCmsElementFontSizeInBreakpoint(element, "mobile"), 18);
  assert.equal(responsive.getCmsElementForBreakpoint(element, "mobile").style.size, 18 * 1200 / 390);
  assert.equal(responsive.getCmsElementFontSizeInBreakpoint(element, "desktop"), 24);
});
check("réinitialiser une valeur retire seulement l’override sélectionné", () => {
  const element = { ...baseElement, responsive: { tablet: { x: 80 }, mobile: { x: 24 } } };
  const next = responsive.applyCmsElementBreakpointPatch(element, "mobile", { x: null });
  assert.equal(next.responsive.mobile, undefined);
  assert.deepEqual(next.responsive.tablet, { x: 80 });
  assert.equal(next.x, baseElement.x);
});
check("conversion écran vers coordonnées du canvas avec zoom et viewport Mobile", () => {
  const actualScale = (390 / 1200) * 0.5;
  const logicalDelta = canvas.screenDeltaToCanvas(20, actualScale);
  const mobileDelta = logicalDelta * 390 / 1200;
  assert.ok(Math.abs(mobileDelta - 40) < 1e-9);
});
check("snap s’aligne sur les bords du canvas tablette 768", () => {
  const result = canvas.snapFrame({ x: 5, y: 20, w: 100, h: 80 }, {
    enabled: true, gridEnabled: false, canvasWidth: 768, canvasHeight: 900, otherFrames: [], threshold: 8,
  });
  assert.equal(result.frame.x, 0);
  assert.ok(result.guides.some((guide) => guide.axis === "x" && guide.position === 0));
});
check("redimensionnement Mobile écrit uniquement les dimensions Mobile", () => {
  const initial = { ...baseElement, responsive: { mobile: { x: 20, y: 30, w: 200, h: 100 } } };
  const effective = responsive.resolveCmsElementFrame(initial, "mobile");
  const resized = canvas.resizeFrame(effective, "se", 30, 20, 1200, 900, 40);
  const localPatch = responsive.toCmsBreakpointFramePatch({ w: resized.w, h: resized.h }, "mobile");
  const next = responsive.applyCmsElementBreakpointPatch(initial, "mobile", localPatch);
  assert.equal(next.responsive.mobile.x, 20);
  assert.equal(next.responsive.mobile.y, 30);
  assert.ok(Math.abs(next.responsive.mobile.w - 209.75) < 1e-9);
  assert.ok(Math.abs(next.responsive.mobile.h - 106.5) < 1e-9);
  assert.equal(next.x, baseElement.x);
  assert.equal(next.w, baseElement.w);
});
check("document historique sans overrides reste intact", () => {
  const legacy = structuredClone(baseElement);
  assert.deepEqual(responsive.resolveCmsElementFrame(legacy, "mobile"), { x: 100, y: 200, w: 500, h: 120 });
  assert.equal(legacy.responsive, undefined);
});
check("même résolveur partagé par l’éditeur, le renderer et l’aperçu", () => {
  const editorSource = readFileSync(resolve(root, "src/components/admin/page-editor.tsx"), "utf8");
  const rendererSource = readFileSync(resolve(root, "src/app/p/[slug]/page-canvas.tsx"), "utf8");
  const previewSource = readFileSync(resolve(root, "src/components/admin/cms-responsive-preview.tsx"), "utf8");
  assert.match(editorSource, /resolveCmsElementForBreakpoint/);
  assert.match(rendererSource, /resolveCmsElementForBreakpoint/);
  assert.match(previewSource, /<PageCanvas[\s\S]*bp=\{breakpoint\}/);
});

console.log(`${passed} tests responsive passés.`);
