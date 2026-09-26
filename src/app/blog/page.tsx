import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Le journal céleste",
  description: "Le blog Célestime : lire les constellations, choisir son ciel, histoires et conseils.",
};

export default async function BlogIndex() {
  let posts: (typeof blogPosts.$inferSelect)[] = [];
  try {
    posts = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.status, "published"))
      .orderBy(desc(blogPosts.publishedAt));
  } catch {
    /* base vide */
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-center text-[11px] tracking-[0.3em] text-gold uppercase">Le journal céleste</p>
      <h1 className="mt-3 text-center font-display text-5xl text-ink">Le blog Célestime</h1>
      {posts.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-line p-14 text-center">
          <p className="text-sm text-muted">Les premiers articles arrivent.</p>
          <p className="mt-2 text-xs text-faint">En attendant, parcourez la boutique et personnalisez votre ciel.</p>
          <Link href="/boutique" className="mt-6 inline-block rounded-full bg-gold px-7 py-3 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">
            Voir la boutique
          </Link>
        </div>
      ) : (
        <div className="mt-12 space-y-6">
          {posts.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface/50 p-5 transition-colors hover:border-gold/50 sm:flex-row">
              {p.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover} alt="" className="h-44 w-full rounded-xl object-cover sm:w-64" />
              )}
              <div>
                <h2 className="font-display text-2xl text-ink group-hover:text-goldsoft">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.excerpt}</p>
                <p className="mt-3 text-xs tracking-[0.14em] text-faint uppercase">{p.author} · {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("fr-FR") : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
