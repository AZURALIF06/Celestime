import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-ui";
import PagesClient from "./pages-client";

export default async function AdminPages() {
  await requireAdmin();
  return (
    <AdminShell title="Pages">
      <PagesClient />
    </AdminShell>
  );
}
