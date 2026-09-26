// Célestime — médiathèque : upload, liste, renommage, suppression, usages.

import { promises as fs } from "fs";
import path from "path";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { media, pages, products } from "@/db/schema";
import { audit } from "@/lib/auth";
import { guard, jsonError } from "@/lib/admin-guard";

export const runtime = "nodejs";
const DIR = path.join(process.cwd(), "public", "media");
const OK = ["jpg", "jpeg", "png", "webp", "svg", "gif", "avif"];

export async function GET(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied;
  const rows = await db.select().from(media).orderBy(desc(media.createdAt));
  // Où est utilisée chaque image (pages + produits)
  const allPages = await db.select().from(pages);
  const allProducts = await db.select().from(products);
  const usage: Record<string, string[]> = {};
  for (const p of allPages) {
    const json = JSON.stringify([p.draft, p.published]).toLowerCase();
    for (const m of rows) {
      if (json.includes(m.path.toLowerCase())) (usage[m.path] ??= []).push(`Page ${p.name}`);
    }
  }
  for (const p of allProducts) {
    const imgs = (p.images as unknown as string[] | null) ?? [];
    for (const m of rows) {
      if (imgs.includes(m.path)) (usage[m.path] ??= []).push(`Produit ${p.name}`);
    }
  }
  return Response.json({ items: rows, usage });
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied;
  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) {
    let j: any;
    try {
      j = await req.json();
    } catch {
      return jsonError("Requête invalide.");
    }
    if (j?.action === "rename") {
      await db.update(media).set({ name: j.name }).where(eq(media.id, j.id));
      return Response.json({ ok: true });
    }
    if (j?.action === "delete") {
      const all = await db.select().from(media);
      const row = all.find((m) => m.id === j.id);
      await db.delete(media).where(eq(media.id, j.id));
      if (row) {
        await fs.unlink(path.join(process.cwd(), "public", row.path)).catch(() => {});
      }
      await audit(g.email!, "media.delete", j.id);
      return Response.json({ ok: true });
    }
    return jsonError("Action inconnue.");
  }
  // Upload (multipart/form-data)
  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file || typeof file.arrayBuffer !== "function") return jsonError("Fichier requis (JPG, PNG, WEBP, SVG, GIF, AVIF).");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!OK.includes(ext)) return jsonError(`Format .${ext} non supporté.`);
  if (file.size > 8 * 1024 * 1024) return jsonError("Fichier trop volumineux (8 Mo max).");
  await fs.mkdir(DIR, { recursive: true });
  const id = crypto.randomUUID();
  const fname = `${id}.${ext === "jpeg" ? "jpg" : ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(DIR, fname), buf);
  const [row] = await db.insert(media).values({
    id,
    name: file.name.replace(/\.[^.]+$/, ""),
    path: `/media/${fname}`,
    size: file.size,
    kind: ext,
  }).returning();
  await audit(g.email!, "media.upload", row.path);
  return Response.json({ item: row }, { status: 201 });
}
