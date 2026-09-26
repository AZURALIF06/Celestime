import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const rows = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
    const p = rows[0];
    if (!p) return { title: "Article introuvable" };
    const seo = (p.seo ?? {}) as { title?: string; description?: string };
    return { title: seo.title ?? p.title, description: seo.description ?? p.excerpt };
  } catch {
    return { title: "Article" };
  }
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let rows: (typeof blogPosts.$inferSelect)[] = [];
  try {
    rows = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
  } catch {
    /* base vide */
  }
  const p = rows[0];
  if (!p || p.status !== "published") notFound();
  const paragraphs = String(p.body).split(/\n\s*\n/).filter(Boolean);

  return (
    <article className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <Link href="/blog" className="text-xs tracking-[0.14em] text-muted uppercase hover:text-gold">← Le journal</Link>
      <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">{p.title}</h1>
      <p className="mt-3 text-xs tracking-[0.16em] text-faint uppercase">{p.author} · {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("fr-FR") : ""}</p>
      {p.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.cover} alt={p.title} className="mt-8 w-full rounded-2xl border border-line object-cover" />
      )}
      <div className="mt-8 space-y-5">
        {p.excerpt && <p className="font-display text-xl italic text-goldsoft">{p.excerpt}</p>}
        {paragraphs.map((par, i) => (
          <p key={i} className="leading-relaxed text-muted">{par}</p>
        ))}
      </div>
      {((p.tags as unknown as string[]) ?? []).length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-line pt-6">
          {(p.tags as unknown as string[]).map((t: string) => (
            <span key={t} className="rounded-full border border-line px-3 py-1 text-[11px] tracking-wide text-muted">{t}</span>
          ))}
        </div>
      )}
    </article>
  );
}
