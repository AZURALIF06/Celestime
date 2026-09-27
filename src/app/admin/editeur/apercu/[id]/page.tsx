import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-ui";
import { PageCanvas } from "@/app/p/[slug]/page-canvas";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { emptyPage, type CmsPage } from "@/lib/cms";

export const dynamic = "force-dynamic";

export default async function AdminDraftPreview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const row = (await db.select().from(pages).where(eq(pages.id, id)).limit(1))[0];
  if (!row) notFound();

  const draft = (row.draft as unknown as CmsPage) ?? emptyPage();
  return (
    <AdminShell title={`Aperçu — ${row.name}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 p-4">
          <div>
            <p className="text-sm text-ink">Brouillon : <span className="font-medium">{row.name}</span></p>
            <p className="mt-1 text-xs text-muted">Cette prévisualisation est privée et visible uniquement par un administrateur connecté.</p>
          </div>
          <Link href={`/admin/editor/${row.id}`} className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-night hover:bg-goldsoft">← Retour à l’éditeur</Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-line">
          <PageCanvas page={draft} products={[]} />
        </div>
      </div>
    </AdminShell>
  );
}
