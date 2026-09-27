import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-ui";
import SiteMapClient from "./editeur-client";
import { inspectSiteMap } from "@/lib/cms-inspect";

export const dynamic = "force-dynamic";

export default async function SiteEditorPage() {
  await requireAdmin();
  const inspection = await inspectSiteMap();

  return (
    <AdminShell title="Éditeur du site">
      <SiteMapClient {...inspection} />
    </AdminShell>
  );
}
