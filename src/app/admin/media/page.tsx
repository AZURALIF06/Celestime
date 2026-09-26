import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-ui";
import MediaClient from "./media-client";

export default async function AdminMedia() {
  await requireAdmin();
  return (
    <AdminShell title="Médiathèque">
      <MediaClient />
    </AdminShell>
  );
}
