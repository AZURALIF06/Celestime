import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-ui";
import BlogClient from "./blog-client";

export default async function AdminBlog() {
  await requireAdmin();
  return (
    <AdminShell title="Blog">
      <BlogClient />
    </AdminShell>
  );
}
