import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { shippingZones, taxRates } from "@/db/schema";
import { AdminShell } from "@/components/admin/admin-ui";
import SettingsClient from "./settings-client";

export default async function AdminSettings() {
  await requireAdmin();
  let zones: { id: number; code: string; label: string; costCents: number; freeFromCents: number; delay: string }[] = [];
  let taxes: { id: number; code: string; label: string; ratePerThousand: number }[] = [];
  try {
    zones = await db.select().from(shippingZones);
    taxes = await db.select().from(taxRates);
  } catch {
    /* base vide */
  }
  return (
    <AdminShell title="Site & menu">
      <SettingsClient initialZones={zones} initialTaxes={taxes} />
    </AdminShell>
  );
}
