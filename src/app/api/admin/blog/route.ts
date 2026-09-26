// Célestime — blog : articles (brouillon, publication, programmation).

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { audit } from "@/lib/auth";
import { guard, jsonError } from "@/lib/admin-guard";

export const runtime = "nodejs";

export async function GET() {
  const g = await guard();
  if (g.denied) return g.denied;
  const rows = await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  return Response.json({ posts: rows });
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Requête invalide.");
  }

  if (body.action === "create") {
    if (!body.title) return jsonError("Le titre est requis.");
    const slug = (body.slug || body.title)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const taken = (await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)))[0];
    if (taken) return jsonError("Cette URL est déjà utilisée.");
    const id = crypto.randomUUID();
    await db.insert(blogPosts).values({
      id,
      slug,
      title: body.title.trim(),
      excerpt: body.excerpt || "",
      body: body.body || "",
      cover: body.cover || null,
      status: body.status || "draft",
      publishedAt: body.status === "published" ? new Date() : body.publishedAt ? new Date(body.publishedAt) : null,
      author: body.author || "Célestime",
      tags: body.tags || [],
      seo: body.seo || {},
    });
    await audit(g.email!, "blog.create", slug);
    return Response.json({ id, slug }, { status: 201 });
  }

  if (body.action === "update") {
    const row = (await db.select().from(blogPosts).where(eq(blogPosts.id, body.id)))[0];
    if (!row) return jsonError("Article introuvable.", 404);
    const patch: any = { updatedAt: new Date() };
    for (const k of ["title", "excerpt", "body", "cover", "author"]) if (typeof body[k] === "string") patch[k] = body[k];
    if (body.status) {
      patch.status = body.status;
      if (body.status === "published") patch.publishedAt = new Date();
    }
    if (Array.isArray(body.tags)) patch.tags = body.tags;
    if (body.seo) patch.seo = body.seo;
    await db.update(blogPosts).set(patch).where(eq(blogPosts.id, row.id));
    return Response.json({ ok: true });
  }

  if (body.action === "delete") {
    await db.delete(blogPosts).where(eq(blogPosts.id, body.id));
    await audit(g.email!, "blog.delete", body.id);
    return Response.json({ ok: true });
  }
  return jsonError("Action inconnue.");
}
