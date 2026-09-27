import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-ui";
import { HomePageLayout } from "@/components/page/home-page-layout";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { extractHomeContent } from "@/lib/home-content";
import type { CmsPage } from "@/lib/cms";

export const dynamic = "force-dynamic";

export default async function HomeDraftPreview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const row = (await db.select().from(pages).where(eq(pages.id, id)).limit(1))[0];
  if (!row || row.slug !== "accueil") notFound();

  const content = extractHomeContent(row.draft as unknown as CmsPage);
  return (
    <AdminShell title="Aperçu — Accueil">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 p-4">
          <div>
            <p className="text-sm text-ink">Brouillon : <span className="font-medium">Accueil</span></p>
            <p className="mt-1 text-xs text-muted">Aperçu privé rendu avec les mêmes composants de présentation et astronomiques que l’accueil public.</p>
          </div>
          <Link href={`/admin/editor/${row.id}`} className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-night hover:bg-goldsoft">← Retour à l’éditeur</Link>
        </div>
        {content ? (
          <div className="overflow-hidden rounded-xl border border-line">
            <HomePageLayout content={content} />
          </div>
        ) : (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">Le brouillon est incomplet ou invalide. L’accueil public reste protégé par son fallback codé en dur.</p>
        )}
      </div>
    </AdminShell>
  );
}
