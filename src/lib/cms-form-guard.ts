// Célestime — Phase 3C : garde-fous anti-abus des soumissions de formulaire.
//
// Aucun service payant, aucune dépendance externe : empreinte SHA-256 pour
// la journalisation, limitation de débit en mémoire par instance, champ-piège
// et contrôle de temps de saisie. Le résultat est toujours decided côté
// serveur ; le client ne peut pas s'auto-valider.

import { createHash } from "node:crypto";

export const CMS_FORM_GUARD = {
  /** Nombre d'envois acceptés par empreinte sur la fenêtre. */
  maxSubmissions: 5,
  windowMs: 10 * 60 * 1000,
  /** Envoi plus rapide que ce délai : comportement incompatible avec un humain. */
  minFillMs: 1500,
  /** Taille maximale du corps JSON de la requête. */
  maxBodyBytes: 16 * 1024,
} as const;

export type CmsFormRejection =
  | "rate-limited"
  | "honeypot"
  | "too-fast"
  | "payload-too-large";

export interface CmsFormGuardDecision {
  allowed: boolean;
  reason: CmsFormRejection | null;
  retryAfterSeconds: number;
}

/**
 * Empreinte non réversible d'une requête. L'adresse IP n'est jamais stockée en
 * clair ; le sel évite que deux sites partagent des empreintes comparables.
 */
export function hashCmsRequestFingerprint(ip: string, userAgent: string, salt: string): string {
  return createHash("sha256").update(`${salt}\u0000${ip}\u0000${userAgent}`).digest("hex").slice(0, 32);
}

/** Salut propre à l'instance : la changer invalide les empreintes. */
export function getCmsFormFingerprintSalt(): string {
  return process.env.CMS_FORM_SALT ?? "celestime-cms-form";
}

/** Normalise un en-tête `x-forwarded-for` sans faire confiance à sa forme. */
export function readCmsClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded ? forwarded.split(",")[0] : "";
  const candidate = (first || headers.get("x-real-ip") || "").trim();
  return candidate.length > 0 && candidate.length <= 64 ? candidate : "unknown";
}

export interface CmsRateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Limitation de débit à fenêtre glissante, en mémoire par instance.
 * Suffisant pour un déploiement serverless simple : l'objectif est de freiner
 * le robot, pas de tenir une garantie distributed.
 */
export function createCmsFormRateLimiter(limit = CMS_FORM_GUARD.maxSubmissions, windowMs = CMS_FORM_GUARD.windowMs) {
  const entries = new Map<string, CmsRateLimitEntry>();
  return {
    /** Enregistre une tentative. Renvoie false si la fenêtre est saturée. */
    hit(key: string, now: number): { allowed: boolean; retryAfterSeconds: number } {
      const current = entries.get(key);
      if (!current || current.resetAt <= now) {
        entries.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      if (current.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
      }
      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
    /** Purge les entrées expirées (appelée périodiquement par la route). */
    prune(now: number): void {
      for (const [key, entry] of entries) if (entry.resetAt <= now) entries.delete(key);
    },
    size(): number {
      return entries.size;
    },
    reset(): void {
      entries.clear();
    },
  };
}

export type CmsFormRateLimiter = ReturnType<typeof createCmsFormRateLimiter>;

/**
 * Décision de garde-fou. `startedAt` est la date déclarée par le navigateur au
 * montage du formulaire ; son absence n'est pas bloquante (pas de faux refus).
 */
export function decideCmsFormGuard(input: {
  honeypot: unknown;
  startedAt: unknown;
  now: number;
  rateLimit: { allowed: boolean; retryAfterSeconds: number };
}): CmsFormGuardDecision {
  if (!input.rateLimit.allowed) {
    return { allowed: false, reason: "rate-limited", retryAfterSeconds: input.rateLimit.retryAfterSeconds };
  }
  if (typeof input.honeypot === "string" && input.honeypot.trim() !== "") {
    return { allowed: false, reason: "honeypot", retryAfterSeconds: 0 };
  }
  if (typeof input.startedAt === "number" && Number.isFinite(input.startedAt) && input.now - input.startedAt < CMS_FORM_GUARD.minFillMs) {
    return { allowed: false, reason: "too-fast", retryAfterSeconds: 0 };
  }
  return { allowed: true, reason: null, retryAfterSeconds: 0 };
}

/** Corps JSON trop volumineux : refusé avant tout traitement. */
export function isCmsFormBodyTooLarge(raw: string): boolean {
  return Buffer.byteLength(raw, "utf8") > CMS_FORM_GUARD.maxBodyBytes;
}
