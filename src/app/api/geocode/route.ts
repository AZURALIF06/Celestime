import { geocode } from "@/lib/geo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return Response.json({ error: "Veuillez saisir au moins deux caractères." }, { status: 400 });
  }
  if (q.length > 60) {
    return Response.json({ error: "Recherche trop longue." }, { status: 400 });
  }
  try {
    const res = await geocode(q);
    if (res.results.length === 0) {
      return Response.json({
        results: [],
        notFound: "Nous n'avons pas trouvé cette ville. Essayez avec une autre formulation.",
      });
    }
    return Response.json({ results: res.results });
  } catch {
    return Response.json({
      results: [],
      notFound: "Le service de localisation est momentanément indisponible. Réessayez dans un instant.",
    });
  }
}
