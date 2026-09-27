import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-ui";
import { PageCanvas } from "@/app/p/[slug]/page-canvas";
import { BoutiqueCmsLayout } from "@/components/page/boutique-cms-layout";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { getProducts } from "@/lib/catalog";
import { requireAdmin } from "@/lib/auth";
import { emptyPage, type CmsPage } from "@/lib/cms";
import { isValidBoutiqueCmsPage } from "@/lib/boutique-cms";

export const dynamic = "force-dynamic";

export default async function AdminDraftPreview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const row = (await db.select().from(pages).where(eq(pages.id, id)).limit(1))[0];
  if (!row) notFound();

  const draft = (row.draft as unknown as CmsPage) ?? emptyPage();
  const boutiqueProducts = row.slug === "boutique" ? (await getProducts()).filter((product) => product.status === "active") : [];
  const validBoutiqueDraft = row.slug === "boutique" && isValidBoutiqueCmsPage(draft);
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
        {row.slug === "boutique" ? (
          validBoutiqueDraft ? (
            <div className="overflow-hidden rounded-xl border border-line">
              <BoutiqueCmsLayout page={draft} products={boutiqueProducts} />
            </div>
          ) : (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">Brouillon Boutique invalide : les données du catalogue ne peuvent pas être incluses dans le CMS.</p>
          )
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            <PageCanvas page={draft} products={[]} />
          </div>
        )}
      </div>
    </AdminShell>
  );
}
