import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { event?: string; data?: unknown };
    if (body && typeof body.event === "string" && body.event.length <= 60) {
      await db.insert(analyticsEvents).values({
        event: body.event,
        data: (body.data ?? {}) as never,
      });
    }
  } catch {
    /* silencieux */
  }
  return Response.json({ ok: true });
}
