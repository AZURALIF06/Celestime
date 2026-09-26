import { requireAdmin } from "@/lib/auth";
import DashboardClient from "./dashboard-client";
import { AdminShell } from "@/components/admin/admin-ui";

export default async function AdminDashboard() {
  await requireAdmin();
  return (
    <AdminShell title="Tableau de bord">
      <DashboardClient />
    </AdminShell>
  );
}
