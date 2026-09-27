import { guard } from "@/lib/admin-guard";
import { inspectSiteMap } from "@/lib/cms-inspect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guard();
  if (auth.denied) return auth.denied;

  const inspection = await inspectSiteMap();
  return Response.json(inspection, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
