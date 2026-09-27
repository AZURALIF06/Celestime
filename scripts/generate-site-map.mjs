import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const root = process.cwd();
const appRoot = join(root, "src", "app");
const output = join(root, "src", "lib", "generated", "site-map.json");
const pageFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name === "page.tsx") pageFiles.push(full);
  }
}

function routeFromPage(file) {
  const relativePath = relative(appRoot, dirname(file)).split(sep).join("/");
  const segments = relativePath
    ? relativePath.split("/").filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@"))
    : [];
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

function lastModified(file) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cI", "--", relative(root, file)], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || statSync(file).mtime.toISOString();
  } catch {
    return statSync(file).mtime.toISOString();
  }
}

function collectMedia(source) {
  const refs = new Set();
  const pattern = /(?:\/images\/[^\s"'`<>)}]+|\/media\/[^\s"'`<>)}]+|\/api\/media\/[a-zA-Z0-9_-]+|https?:\/\/[^\s"'`<>)}]+\.(?:png|jpe?g|webp|gif|avif|svg)(?:\?[^\s"'`<>)}]*)?)/gi;
  for (const match of source.matchAll(pattern)) refs.add(match[0].replace(/[),.;]+$/, ""));
  return [...refs];
}

walk(appRoot);
const routeFiles = pageFiles.map((file) => {
  const path = routeFromPage(file);
  const source = readFileSync(file, "utf8");
  const dynamic = /\[[^\]]+\]/.test(path);
  return {
    path,
    file: relative(root, file).split(sep).join("/"),
    kind: path.startsWith("/admin") ? "admin" : dynamic ? "dynamic" : "static",
    sourceType: path.startsWith("/admin") ? "administration" : "code",
    lastModified: lastModified(file),
    media: collectMedia(source),
  };
}).sort((a, b) => a.path.localeCompare(b.path, "fr"));

// Le catalogue est importé par plusieurs routes, et porte les visuels réellement
// utilisés par la boutique et les fiches produit. On référence sa source sans
// attribuer arbitrairement chaque image à une page particulière.
const catalogFile = join(root, "src", "lib", "options.ts");
const catalogMedia = collectMedia(readFileSync(catalogFile, "utf8")).map((url) => ({
  url,
  source: "src/lib/options.ts",
}));

const sourceDates = routeFiles.map((route) => Date.parse(route.lastModified)).filter(Number.isFinite);
const data = {
  // Stable across identical builds: this is the latest source timestamp included,
  // not the wall-clock time at which the build happened.
  generatedAt: new Date(sourceDates.length ? Math.max(...sourceDates) : 0).toISOString(),
  routes: routeFiles,
  sharedMedia: catalogMedia,
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Cartographie générée : ${routeFiles.length} routes, ${catalogMedia.length} références média partagées → ${relative(root, output)}`);
