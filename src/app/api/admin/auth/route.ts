import { adminLogin, adminLogout, audit, currentAdminEmail } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { email?: string; password?: string; logout?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (body.logout) {
    await adminLogout();
    return Response.json({ ok: true });
  }
  if (!body.email || !body.password) {
    return Response.json({ error: "E-mail et mot de passe requis." }, { status: 400 });
  }
  const res = await adminLogin(body.email, body.password);
  if (res.ok) await audit(body.email.trim().toLowerCase(), "login", "admin");
  return Response.json(res);
}

export async function GET() {
  const email = await currentAdminEmail();
  return Response.json({ authenticated: Boolean(email), email });
}
