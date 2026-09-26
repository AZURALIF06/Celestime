import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-ui";
import CommerceClient from "./commerce-client";

export default async function AdminCommerce() {
  await requireAdmin();
  return (
    <AdminShell title="Commerce">
      <CommerceClient />
    </AdminShell>
  );
}
