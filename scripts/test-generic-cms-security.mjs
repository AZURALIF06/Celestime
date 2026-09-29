import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/lib/cms.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cmsModule = { exports: {} };
new Function("exports", "require", "module", "__filename", "__dirname", compiled)(
  cmsModule.exports,
  require,
  cmsModule,
  resolve(root, "src/lib/cms.ts"),
  resolve(root, "src/lib"),
);
const cms = cmsModule.exports;

let passed = 0;
let failed = 0;
function check(name, assertion) {
  try {
    assertion();
    console.log(`PASS ${name}`);
    passed++;
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}
async function checkAsync(name, assertion) {
  try {
    await assertion();
    console.log(`PASS ${name}`);
    passed++;
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

const validPage = (element = {}) => ({
  sections: [{
    id: "section-1",
    h: 500,
    elements: [{
      id: "element-1",
      type: "text",
      x: 0,
      y: 0,
      w: 500,
      h: 80,
      z: 1,
      rotation: 0,
      opacity: 1,
      content: { text: "Page de test", variant: "h1" },
      style: {},
      ...element,
    }],
  }],
});

check("A. élément CMS standard valide accepté", () => assert.equal(cms.isValidGenericCmsPage(validPage()), true));
check("A2. élément historique avec champs CMS connus accepté", () => {
  const historical = validPage({
    locked: true,
    hidden: false,
    link: "/boutique",
    responsive: {
      tablet: { x: 12, y: 20, w: 450, h: 70, hidden: false, fontSize: 20 },
      mobile: { x: 8, y: 14, w: 320, h: 90 },
    },
    style: { fontFamily: "serif", size: 24, weight: 600, color: "#ece9e2", align: "center" },
  });
  assert.equal(cms.isValidGenericCmsPage(historical), true);
});
check("A3. nouveau bloc valide accepté", () => {
  const page = validPage({ type: "gallery", content: { images: [], columns: 2 } });
  assert.equal(cms.isValidGenericCmsPage(page), true);
  assert.equal(cms.areValidNewCmsVisualBlocks(page), true);
});
check("A4. propriété inconnue à la racine d'un nouveau bloc refusée", () => {
  const page = validPage({ type: "gallery", content: { images: [], columns: 2 }, editorOnly: true });
  assert.equal(cms.isValidGenericCmsPage(page), false);
  assert.equal(cms.areValidNewCmsVisualBlocks(page), false);
});
check("A5. propriété inconnue dans un nouveau bloc refusée", () => {
  const page = validPage({ type: "gallery", content: { images: [], columns: 2, futureOption: true } });
  assert.equal(cms.isValidGenericCmsPage(page), false);
  assert.equal(cms.areValidNewCmsVisualBlocks(page), false);
});
check("B. page sans sections", () => assert.equal(cms.isValidGenericCmsPage({ sections: [] }), false));
check("C. élément mal formé", () => assert.equal(cms.isValidGenericCmsPage(validPage({ h: "grand" })), false));
check("D. image invalide rejetée à la publication et rendue sans crash", () => {
  const page = validPage({ type: "image", content: { src: "javascript:alert(1)", alt: "test" } });
  assert.equal(cms.isValidCmsImageSource("javascript:alert(1)"), false);
  assert.equal(cms.isValidGenericCmsPage(page), false);
  assert.equal(cms.isValidGenericCmsPage(page, { forRendering: true }), true);
  const renderer = readFileSync(resolve(root, "src/components/page/element-view.tsx"), "utf8");
  assert.ok(renderer.includes("function CmsImage"));
  assert.ok(renderer.includes("onError={() => setFailedSrc(safeSrc)}"));
});
check("E. lien javascript refusé et inerte au rendu", () => {
  const page = validPage({ type: "button", content: { text: "Ouvrir", href: "javascript:alert(1)" } });
  assert.equal(cms.isValidGenericCmsPage(page), false);
  assert.equal(cms.isValidGenericCmsPage(page, { forRendering: true }), true);
  assert.equal(cms.safeCmsHref("javascript:alert(1)"), null);
  const renderer = readFileSync(resolve(root, "src/components/page/element-view.tsx"), "utf8");
  assert.ok(renderer.includes("genericSafety ? safeCmsHref(c.href) : c.href || \"#\""));
});
check("F. URL protocol-relative refusée", () => {
  assert.equal(cms.isValidCmsLink("//evil.example/path"), false);
  assert.equal(cms.safeCmsHref("//evil.example/path"), null);
});
check("G. URL externe HTTPS autorisée", () => assert.equal(cms.isValidCmsLink("https://example.org/page"), true));
check("Liens relatifs usuels préservés et parcours sensibles protégés", () => {
  assert.equal(cms.isValidCmsLink("/create?product=etoiles-de-nous-deux"), true);
  assert.equal(cms.isValidCmsLink("/boutique"), true);
  for (const path of ["/cart", "/checkout", "/confirmation/123", "/account", "/api/stripe/checkout", "/admin/pages", "/%2fapi/stripe/checkout", "/x/%252e%252e/api/cart"]) {
    assert.equal(cms.isValidCmsLink(path), false, `${path} should be blocked`);
  }
});
check("H. iframe non autorisé rejeté", () => {
  assert.equal(cms.getCmsVideoEmbedUrl("https://evil.example/embed/abcdef"), null);
  assert.equal(cms.isValidGenericCmsPage(validPage({ type: "video", content: { url: "https://evil.example/embed/abcdef" } })), false);
  const renderer = readFileSync(resolve(root, "src/components/page/element-view.tsx"), "utf8");
  assert.ok(renderer.includes("genericSafety && !genericEmbed"));
  assert.ok(renderer.includes("aria-label=\"Vidéo indisponible\""));
});
check("I. iframe YouTube autorisé et normalisé", () => {
  assert.equal(cms.getCmsVideoEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ"), "https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert.equal(cms.getCmsVideoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert.equal(cms.getCmsVideoEmbedUrl("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert.equal(cms.isValidGenericCmsPage(validPage({ type: "video", content: { url: "https://www.youtube.com/embed/dQw4w9WgXcQ" } })), true);
});
check("J. SEO title et description", () => {
  const metadata = cms.getCmsPageMetadata({ title: "Titre CMS", description: "Description CMS" });
  assert.equal(metadata.title, "Titre CMS");
  assert.equal(metadata.description, "Description CMS");
});
check("K. noindex", () => assert.deepEqual(cms.getCmsPageMetadata({ noindex: true }).robots, { index: false, follow: true }));
check("L. canonical interne valide", () => {
  assert.equal(cms.getValidCmsCanonical("/p/a-propos"), "https://www.celestime.fr/p/a-propos");
  assert.equal(cms.getValidCmsCanonical("https://evil.example/canonical"), null);
});
check("M. ogImage validée", () => {
  const metadata = cms.getCmsPageMetadata({ ogImage: "/images/naissance.jpg" });
  assert.deepEqual(metadata.openGraph.images, [{ url: "/images/naissance.jpg" }]);
  assert.equal(cms.getCmsPageMetadata({ ogImage: "javascript:alert(1)" }).openGraph, undefined);
});
check("N. bloc product refusé", () => assert.equal(cms.isValidGenericCmsPage(validPage({ type: "product", content: { slug: "x" } })), false));
check("O. bloc productGrid refusé", () => assert.equal(cms.isValidGenericCmsPage(validPage({ type: "productGrid", content: {} })), false));
check("P. produit inactif jamais affiché dans le rendu générique", () => {
  assert.equal(cms.isActiveGenericCmsProduct({ status: "inactive" }), false);
  assert.equal(cms.isActiveGenericCmsProduct({ status: "active" }), true);
  const renderer = readFileSync(resolve(root, "src/components/page/element-view.tsx"), "utf8");
  assert.ok(renderer.includes("genericSafety && !isActiveGenericCmsProduct(p)"));
});
await checkAsync("Q. erreur de lecture DB contrôlée", async () => {
  assert.equal(await cms.safelyReadCmsPage(async () => { throw new Error("db offline"); }), null);
  assert.deepEqual(await cms.safelyReadCmsPage(async () => ({ status: "published" })), { status: "published" });
  const route = readFileSync(resolve(root, "src/app/p/[slug]/page.tsx"), "utf8");
  assert.ok(route.includes("safelyReadCmsPage(() => db.select()"));
  assert.ok(route.includes("if (!page || page.status !== \"published\" || !page.published) notFound()"));
});
check("R. validateurs spécialisés existants conservés", () => {
  const api = readFileSync(resolve(root, "src/app/api/admin/pages/route.ts"), "utf8");
  for (const validator of ["isValidHomeCmsPage", "isValidBoutiqueCmsPage", "isValidFaqCmsPage", "isValidLivraisonCmsPage", "isValidCommentCaMarcheCmsPage"]) {
    assert.ok(api.includes(validator), `${validator} remains in the admin API`);
  }
  const renderer = readFileSync(resolve(root, "src/components/page/element-view.tsx"), "utf8");
  assert.ok(renderer.includes("genericSafety = false"), "specialized ElementView callers keep legacy behavior by default");
  for (const route of ["src/app/page.tsx", "src/app/boutique/page.tsx", "src/app/faq/page.tsx", "src/app/livraison/page.tsx", "src/app/comment-ca-marche/page.tsx"]) {
    readFileSync(resolve(root, route), "utf8");
  }
});

console.log(`\nVérifications ciblées : ${passed} réussies, ${failed} échouées.`);
if (failed > 0) process.exitCode = 1;
