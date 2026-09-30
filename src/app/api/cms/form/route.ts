// Célestime — Phase 3C : traitement serveur des formulaires CMS.
//
// Principes non négociables :
//  - la configuration fait autorité depuis la version PUBLIÉE de la page en
//    base, jamais depuis le corps de la requête ;
//  - aucune saisie utilisateur n'est rendue en HTML, en réponse ou ailleurs ;
//  - la réponse « succès » n'est retournée qu'après écriture effective en base ;
//  - aucun secret n'est lu ni exposé côté navigateur ;
//  - aucun service payant : le stockage est la base PostgreSQL existante et
//    la notification webhook est facultative, lue uniquement côté serveur.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cmsFormSubmissions, pages } from "@/db/schema";
import {
  findCmsFormElement,
  isCmsFormUsable,
  normalizeCmsFormConfig,
  validateCmsFormSubmission,
} from "@/lib/cms-form";
import {
  createCmsFormRateLimiter,
  decideCmsFormGuard,
  getCmsFormFingerprintSalt,
  hashCmsRequestFingerprint,
  isCmsFormBodyTooLarge,
  readCmsClientIp,
} from "@/lib/cms-form-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createCmsFormRateLimiter();

const REJECTION_STATUS: Record<string, number> = {
  "rate-limited": 429,
  honeypot: 400,
  "too-fast": 400,
  "payload-too-large": 413,
};

const REJECTION_MESSAGE: Record<string, string> = {
  "rate-limited": "Trop d’envois depuis ce poste. Merci de réessayer plus tard.",
  honeypot: "Requête invalide.",
  "too-fast": "Requête invalide.",
  "payload-too-large": "Requête trop volumineuse.",
};

function failure(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

/** Notification facultative, lue dans l'environnement serveur uniquement. */
async function notifySubmission(payload: {
  title: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  const endpoint = process.env.CMS_FORM_WEBHOOK_URL;
  if (!endpoint) return false;
  // Refus explicite des schémas dangereux : le secret reste côté serveur.
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (isCmsFormBodyTooLarge(raw)) {
    return failure(REJECTION_MESSAGE["payload-too-large"], REJECTION_STATUS["payload-too-large"]);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return failure("Requête invalide.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return failure("Requête invalide.", 400);
  const payload = body as Record<string, unknown>;
  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const elementId = typeof payload.elementId === "string" ? payload.elementId.trim() : "";
  if (!slug || slug.length > 128 || !elementId || elementId.length > 128) return failure("Requête invalide.", 400);

  const now = Date.now();
  limiter.prune(now);
  const ip = readCmsClientIp(req.headers);
  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 200);
  const fingerprint = hashCmsRequestFingerprint(ip, userAgent, getCmsFormFingerprintSalt());

  const decision = decideCmsFormGuard({
    honeypot: payload._hp,
    startedAt: payload.startedAt,
    now,
    rateLimit: limiter.hit(fingerprint, now),
  });
  if (!decision.allowed) {
    const status = REJECTION_STATUS[decision.reason ?? ""] ?? 400;
    return Response.json(
      { ok: false, error: REJECTION_MESSAGE[decision.reason ?? ""] ?? "Requête invalide." },
      { status, headers: decision.retryAfterSeconds ? { "Retry-After": String(decision.retryAfterSeconds) } : undefined },
    );
  }

  // 1. La configuration fait autorité : version publiée de la page, en base.
  let published: unknown = null;
  try {
    const rows = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
    const page = rows[0];
    published = page && page.status === "published" ? page.published : null;
  } catch {
    return failure("Le service est momentanément indisponible.", 503);
  }
  if (!published) return failure("Formulaire introuvable.", 404);

  const element = findCmsFormElement(published, elementId);
  if (!element) return failure("Formulaire introuvable.", 404);
  const config = normalizeCmsFormConfig(element.content);
  if (!isCmsFormUsable(config)) return failure("Formulaire introuvable.", 404);

  // 2. Validation serveur. Les messages d'erreur sont produits par le serveur,
  //    ils ne réutilisent jamais la valeur transmise par le client.
  const result = validateCmsFormSubmission(config, payload.values);
  if (!result.ok) {
    return Response.json({ ok: false, error: config.errorMessage, fields: result.errors }, { status: 422 });
  }

  // 3. Persistance AVANT toute réponse de succès.
  const data = result.data;
  let insertedId: number | null = null;
  try {
    const rows = await db.insert(cmsFormSubmissions).values({
      pageSlug: slug,
      elementId,
      formName: config.title,
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
      ipHash: fingerprint,
      userAgent,
    }).returning({ id: cmsFormSubmissions.id });
    insertedId = rows[0]?.id ?? null;
  } catch {
    return failure("Le service est momentanément indisponible.", 503);
  }

  // 4. Notification facultative : uniquement l'identifiant réellement inséré.
  if (insertedId !== null) {
    const notified = await notifySubmission({
      title: config.title,
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
    });
    if (notified) {
      try {
        await db.update(cmsFormSubmissions).set({ status: "notified" }).where(eq(cmsFormSubmissions.id, insertedId));
      } catch {
        /* la soumission est déjà enregistrée : l'échec de marquage est sans conséquence */
      }
    }
  }

  return Response.json({ ok: true, message: config.successMessage });
}
