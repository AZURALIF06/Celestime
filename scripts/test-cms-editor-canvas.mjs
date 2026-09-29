import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(resolve(process.cwd(), "src/lib/cms-editor-canvas.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const canvasModule = { exports: {} };
new Function("exports", "require", "module", compiled)(canvasModule.exports, require, canvasModule);
const canvas = canvasModule.exports;
let passed = 0;
function check(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
  passed += 1;
}

for (const scale of [1, 0.75, 0.5, 0.25, 1.25, 1.5]) {
  check(`conversion écran → canvas à ${Math.round(scale * 100)} %`, () => {
    assert.equal(canvas.screenDeltaToCanvas(100 * scale, scale), 100);
  });
}
check("un déplacement écran de 100 px vaut 200 px logiques au zoom 50 %", () => {
  assert.equal(canvas.screenDeltaToCanvas(100, 0.5), 200);
});
check("un déplacement écran de 100 px vaut environ 133 px logiques au zoom 75 %", () => {
  assert.equal(canvas.screenDeltaToCanvas(100, 0.75), 100 / 0.75);
});
check("zoom Ajuster suit la largeur visible", () => {
  assert.equal(canvas.canvasFitZoom(1200, 1200, 1), 100);
  assert.equal(canvas.canvasFitZoom(900, 1200, 1), 75);
  assert.equal(canvas.canvasFitZoom(600, 1200, 1), 50);
  assert.equal(canvas.canvasFitZoom(480, 1200, 1), 40);
});
check("échelle invalide sans division par zéro", () => {
  assert.equal(canvas.screenDeltaToCanvas(100, 0), 0);
});
check("déplacement borné aux limites du canvas", () => {
  assert.deepEqual(canvas.clampFrame({ x: -30, y: 900, w: 100, h: 80 }, 1200, 600), { x: 0, y: 520, w: 100, h: 80 });
});
check("redimensionnement ouest conserve le bord opposé et la taille minimale", () => {
  assert.deepEqual(canvas.resizeFrame({ x: 100, y: 100, w: 120, h: 80 }, "w", 200, 0, 1200, 600, 40), { x: 180, y: 100, w: 40, h: 80 });
});
check("redimensionnement nord reste dans la section", () => {
  assert.deepEqual(canvas.resizeFrame({ x: 100, y: 100, w: 120, h: 80 }, "n", 0, -200, 1200, 600, 40), { x: 100, y: 0, w: 120, h: 180 });
});
check("poignées est et sud respectent la taille minimale et les limites", () => {
  assert.deepEqual(canvas.resizeFrame({ x: 100, y: 100, w: 120, h: 80 }, "e", 3000, 0, 250, 250, 40), { x: 100, y: 100, w: 150, h: 80 });
  assert.deepEqual(canvas.resizeFrame({ x: 100, y: 100, w: 120, h: 80 }, "s", 0, 3000, 250, 250, 40), { x: 100, y: 100, w: 120, h: 150 });
});
check("quatre poignées de coin modifient les deux axes", () => {
  const initial = { x: 100, y: 100, w: 120, h: 80 };
  assert.deepEqual(canvas.resizeFrame(initial, "ne", 20, -20, 1200, 600, 40), { x: 100, y: 80, w: 140, h: 100 });
  assert.deepEqual(canvas.resizeFrame(initial, "sw", -20, 20, 1200, 600, 40), { x: 80, y: 100, w: 140, h: 100 });
  assert.deepEqual(canvas.resizeFrame(initial, "nw", 20, 20, 1200, 600, 40), { x: 120, y: 120, w: 100, h: 60 });
  assert.deepEqual(canvas.resizeFrame(initial, "se", -20, -20, 1200, 600, 40), { x: 100, y: 100, w: 100, h: 60 });
});
check("snap sur le centre du canvas avec repère", () => {
  const result = canvas.snapFrame({ x: 548, y: 100, w: 100, h: 80 }, {
    enabled: true, gridEnabled: false, canvasWidth: 1200, canvasHeight: 600, otherFrames: [], threshold: 8,
  });
  assert.equal(result.frame.x, 550);
  assert.ok(result.guides.some((guide) => guide.axis === "x" && guide.position === 600));
});
check("snap sur les bords d’un autre élément", () => {
  const result = canvas.snapFrame({ x: 192, y: 210, w: 100, h: 80 }, {
    enabled: true, gridEnabled: false, canvasWidth: 1200, canvasHeight: 600,
    otherFrames: [{ x: 300, y: 200, w: 120, h: 80 }], threshold: 8,
  });
  assert.equal(result.frame.x, 200);
  assert.ok(result.guides.some((guide) => guide.axis === "x" && guide.position === 300));
});
check("snap désactivé préserve le positionnement libre", () => {
  const frame = { x: 13, y: 27, w: 100, h: 80 };
  assert.deepEqual(canvas.snapFrame(frame, { enabled: false, gridEnabled: true, canvasWidth: 1200, canvasHeight: 600, otherFrames: [] }), { frame, guides: [] });
});
check("snap à la grille optionnel", () => {
  const result = canvas.snapFrame({ x: 38, y: 41, w: 100, h: 80 }, {
    enabled: true, gridEnabled: true, gridSize: 20, threshold: 4, canvasWidth: 1200, canvasHeight: 600, otherFrames: [],
  });
  assert.equal(result.frame.x, 40);
  assert.equal(result.frame.y, 40);
});
check("alignement à droite et centrage horizontal", () => {
  const frame = { x: 10, y: 30, w: 200, h: 80 };
  assert.equal(canvas.alignFrame(frame, "right", 1200, 600).x, 1000);
  assert.equal(canvas.alignFrame(frame, "centerX", 1200, 600).x, 500);
});
check("clic/sélection sans changement ne crée pas d'entrée d'historique", () => {
  const history = ["initial", "modified"];
  const result = canvas.appendHistorySnapshot(history, 1, "modified", 50);
  assert.equal(result.changed, false);
  assert.equal(result.history, history);
  assert.equal(result.index, 1);
});
check("historique limite à 50 entrées et remplace la branche redo", () => {
  const entries = Array.from({ length: 50 }, (_, index) => String(index));
  const result = canvas.appendHistorySnapshot(entries, 30, "new-edit", 50);
  assert.equal(result.changed, true);
  assert.equal(result.history.length, 32);
  assert.equal(result.history.at(-1), "new-edit");
  assert.equal(result.index, 31);
});

console.log(`${passed} tests canvas passés.`);
