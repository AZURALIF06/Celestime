import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-ui";
import { PageCanvas } from "@/app/p/[slug]/page-canvas";
import { BoutiqueCmsLayout } from "@/components/page/boutique-cms-layout";
import { CommentCaMarcheCmsLayout } from "@/components/page/comment-ca-marche-cms-layout";
import { LivraisonCmsContent } from "@/components/page/livraison-cms-content";
import CmsResponsivePreview from "@/components/admin/cms-responsive-preview";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { getProducts } from "@/lib/catalog";
import { requireAdmin } from "@/lib/auth";
import { emptyPage, hasCmsStructuralNodes, isValidGenericCmsPage, type CmsPage } from "@/lib/cms";
import { isValidBoutiqueCmsPage } from "@/lib/boutique-cms";
import { isValidCommentCaMarcheCmsPage } from "@/lib/comment-ca-marche-cms";
import { isValidLivraisonCmsPage } from "@/lib/livraison-cms";

export const dynamic = "force-dynamic";

export default async function AdminDraftPreview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const row = (await db.select().from(pages).where(eq(pages.id, id)).limit(1))[0];
  if (!row) notFound();

  const draft = (row.draft as unknown as CmsPage) ?? emptyPage();
  const boutiqueProducts = row.slug === "boutique" ? (await getProducts()).filter((product) => product.status === "active") : [];
  const validGenericDraft = !["boutique", "comment-ca-marche", "livraison", "accueil", "faq"].includes(row.slug) && (!hasCmsStructuralNodes(draft) || isValidGenericCmsPage(draft));
  const validBoutiqueDraft = row.slug === "boutique" && isValidBoutiqueCmsPage(draft);
  const validCommentCaMarcheDraft = row.slug === "comment-ca-marche" && isValidCommentCaMarcheCmsPage(draft);
  const validLivraisonDraft = row.slug === "livraison" && isValidLivraisonCmsPage(draft);
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
        ) : row.slug === "comment-ca-marche" ? (
          validCommentCaMarcheDraft ? (
            <div className="overflow-hidden rounded-xl border border-line">
              <CommentCaMarcheCmsLayout page={draft} />
            </div>
          ) : (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">Brouillon Comment ça marche incomplet ou invalide.</p>
          )
        ) : row.slug === "livraison" ? (
          validLivraisonDraft ? (
            <div className="overflow-hidden rounded-xl border border-line">
              <LivraisonCmsContent page={draft} />
            </div>
          ) : (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">Brouillon Livraison incomplet ou invalide.</p>
          )
        ) : row.slug === "accueil" || row.slug === "faq" ? (
          <div className="overflow-hidden rounded-xl border border-line">
            <PageCanvas page={draft} products={[]} slug={row.slug} />
          </div>
        ) : validGenericDraft ? (
          <CmsResponsivePreview page={draft} slug={row.slug} />
        ) : (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">Brouillon générique invalide : il n’est pas rendu dans l’aperçu.</p>
        )}
      </div>
    </AdminShell>
  );
}
