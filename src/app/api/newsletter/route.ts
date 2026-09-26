import { db } from "@/db";
import { newsletterSubs } from "@/db/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }
  try {
    await db.insert(newsletterSubs).values({ email: email.toLowerCase() });
  } catch {
    /* doublon possible */
  }
  return Response.json({ ok: true });
}
