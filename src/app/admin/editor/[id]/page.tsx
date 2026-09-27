import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { pages, pageTemplates } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { emptyPage, type CmsPage } from "@/lib/cms";
import PageEditor from "@/components/admin/page-editor";

export default async function AdminEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const rows = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  const page = rows[0];
  if (!page) notFound();
  const templates = (await db.select().from(pageTemplates)).map((t) => ({ id: t.id, name: t.name }));
  const data = (page.draft as unknown as CmsPage) ?? emptyPage();
  return (
    <PageEditor
      pageId={page.id}
      initialData={data}
      initialName={page.name}
      initialSlug={page.slug}
      initialStatus={page.status}
      initialPublished={(page.published as unknown as CmsPage | null) ?? null}
      templates={templates}
    />
  );
}
