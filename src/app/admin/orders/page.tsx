import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-ui";
import OrdersClient from "./orders-client";

export default async function AdminOrders() {
  await requireAdmin();
  return (
    <AdminShell title="Commandes">
      <OrdersClient />
    </AdminShell>
  );
}
