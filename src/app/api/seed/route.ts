import { ensureSeed } from "@/db/seed";

export const runtime = "nodejs";

export async function POST() {
  try {
    await ensureSeed();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
