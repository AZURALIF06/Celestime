import { currentAdminEmail } from "./auth";

export async function guard(): Promise<{ email: string | null; denied: Response | null }> {
  const email = await currentAdminEmail();
  if (!email) return { email: null, denied: Response.json({ error: "Non autorisé. Connectez-vous." }, { status: 401 }) };
  return { email, denied: null };
}

export function jsonError(msg: string, status = 400) {
  return Response.json({ error: msg }, { status });
}
