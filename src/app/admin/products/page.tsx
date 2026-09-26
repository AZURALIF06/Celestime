import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-ui";
import ProductsClient from "./products-client";

export default async function AdminProducts() {
  await requireAdmin();
  return (
    <AdminShell title="Produits">
      <ProductsClient />
    </AdminShell>
  );
}
