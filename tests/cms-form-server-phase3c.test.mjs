import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  CMS_FORM_GUARD,
  createCmsFormRateLimiter,
  decideCmsFormGuard,
  getCmsFormFingerprintSalt,
  hashCmsRequestFingerprint,
  isCmsFormBodyTooLarge,
  readCmsClientIp,
} from "../src/lib/cms-form-guard.ts";

const allow = (decision) => assert.deepEqual(decision, { allowed: true, reason: null, retryAfterSeconds: 0 });

// 1–4 : limitation de débit.
test("1. la fenêtre accepte jusqu’à la limite puis refuse", () => {
  const limiter = createCmsFormRateLimiter(3, 60_000);
  const start = 1_000_000;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    assert.equal(limiter.hit("ip-a", start).allowed, true, `tentative ${attempt}`);
  }
  const refused = limiter.hit("ip-a", start);
  assert.equal(refused.allowed, false);
  assert.equal(refused.retryAfterSeconds, 60);
});
test("2. la fenêtre se réinitialise une fois expirée", () => {
  const limiter = createCmsFormRateLimiter(1, 1000);
  assert.equal(limiter.hit("ip-b", 0).allowed, true);
  assert.equal(limiter.hit("ip-b", 500).allowed, false);
  assert.equal(limiter.hit("ip-b", 1500).allowed, true, "nouvelle fenêtre");
});
test("3. les empreintes sont indépendantes", () => {
  const limiter = createCmsFormRateLimiter(1, 60_000);
  assert.equal(limiter.hit("ip-c", 0).allowed, true);
  assert.equal(limiter.hit("ip-d", 0).allowed, true, "une autre IP n’est pas bloquée");
  assert.equal(limiter.hit("ip-c", 0).allowed, false);
});
test("4. la purge retire les entrées expirées", () => {
  const limiter = createCmsFormRateLimiter(1, 1000);
  limiter.hit("ip-e", 0);
  limiter.hit("ip-f", 0);
  assert.equal(limiter.size(), 2);
  limiter.prune(5000);
  assert.equal(limiter.size(), 0);
  limiter.reset();
  assert.equal(limiter.size(), 0);
});

// 5–8 : décision de garde-fou.
test("5. une soumission normale est autorisée", () => {
  allow(decideCmsFormGuard({ honeypot: "", startedAt: 0, now: 60_000, rateLimit: { allowed: true, retryAfterSeconds: 0 } }));
});
test("6. le champ-piège rempli est refusé", () => {
  for (const value of ["spam", "0", "https://spam.example"]) {
    const decision = decideCmsFormGuard({ honeypot: value, startedAt: 0, now: 60_000, rateLimit: { allowed: true, retryAfterSeconds: 0 } });
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "honeypot");
  }
  // Une valeur vide ou uniquement blanchie vaut "non rempli".
  for (const value of [undefined, "", "   ", "\t"]) {
    allow(decideCmsFormGuard({ honeypot: value, startedAt: 0, now: 60_000, rateLimit: { allowed: true, retryAfterSeconds: 0 } }));
  }
});
test("7. un envoi trop rapide est refusé, un envoi sans horodatage ne l’est pas", () => {
  const now = 60_000;
  assert.equal(decideCmsFormGuard({ honeypot: "", startedAt: now - 200, now, rateLimit: { allowed: true, retryAfterSeconds: 0 } }).reason, "too-fast");
  allow(decideCmsFormGuard({ honeypot: "", startedAt: now - CMS_FORM_GUARD.minFillMs - 1, now, rateLimit: { allowed: true, retryAfterSeconds: 0 } }));
  allow(decideCmsFormGuard({ honeypot: "", startedAt: undefined, now, rateLimit: { allowed: true, retryAfterSeconds: 0 } }));
  allow(decideCmsFormGuard({ honeypot: "", startedAt: "mauvais", now, rateLimit: { allowed: true, retryAfterSeconds: 0 } }));
});
test("8. la limitation de débit prime sur les autres motifs", () => {
  const decision = decideCmsFormGuard({ honeypot: "spam", startedAt: 0, now: 60_000, rateLimit: { allowed: false, retryAfterSeconds: 42 } });
  assert.equal(decision.reason, "rate-limited");
  assert.equal(decision.retryAfterSeconds, 42);
});

// 9–12 : confidentialité.
test("9. l’empreinte est un SHA-256 tronqué et ne contient pas l’IP en clair", () => {
  const fingerprint = hashCmsRequestFingerprint("203.0.113.9", "Mozilla/5.0", "salt");
  assert.equal(fingerprint.length, 32);
  assert.match(fingerprint, /^[0-9a-f]{32}$/);
  assert.equal(fingerprint.includes("203.0.113.9"), false);
  assert.equal(fingerprint, createHash("sha256").update("salt\u0000203.0.113.9\u0000Mozilla/5.0").digest("hex").slice(0, 32));
});
test("10. le sel change l’empreinte", () => {
  assert.notEqual(
    hashCmsRequestFingerprint("203.0.113.9", "UA", "sel-a"),
    hashCmsRequestFingerprint("203.0.113.9", "UA", "sel-b"),
  );
  assert.equal(typeof getCmsFormFingerprintSalt(), "string");
});
test("11. l’IP lue est la première valeur de x-forwarded-for, bornée", () => {
  assert.equal(readCmsClientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" })), "198.51.100.1");
  assert.equal(readCmsClientIp(new Headers({ "x-real-ip": "198.51.100.7" })), "198.51.100.7");
  assert.equal(readCmsClientIp(new Headers({})), "unknown");
  assert.equal(readCmsClientIp(new Headers({ "x-forwarded-for": "x".repeat(200) })), "unknown");
});
test("12. un corps trop volumineux est refusé avant traitement", () => {
  assert.equal(isCmsFormBodyTooLarge("x".repeat(CMS_FORM_GUARD.maxBodyBytes)), false);
  assert.equal(isCmsFormBodyTooLarge("x".repeat(CMS_FORM_GUARD.maxBodyBytes + 1)), true);
});

// 13–15 : contrôles structurels sur la route et le composant.
const route = readFileSync(new URL("../src/app/api/cms/form/route.ts", import.meta.url), "utf8");
const blockSource = readFileSync(new URL("../src/components/page/cms-form-block.tsx", import.meta.url), "utf8");
// On analyse le CODE, commentaires exclus : les interdits ne doivent pas
// pouvoir être "satisfaits" ou déclenchés par la seule documentation.
const block = blockSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("13. la route écrit en base avant de répondre succès et n’expose aucun secret au client", () => {
  const insertAt = route.indexOf("db.insert(cmsFormSubmissions)");
  const successAt = route.indexOf("ok: true");
  assert.ok(insertAt > 0 && successAt > insertAt, "l’écriture précède la réponse de succès");
  assert.ok(route.includes("process.env.CMS_FORM_WEBHOOK_URL"), "notification facultative lue côté serveur");
  assert.equal(route.includes('Response.json({ ok: true'), true);
  // Aucun secret ni URL d'admin n'est renvoyé au navigateur.
  for (const leak of ["DATABASE_URL", "CMS_FORM_WEBHOOK_URL", "POSTGRES"]) {
    assert.equal(route.includes(`${leak} }`), false, `${leak} ne fuit pas dans une réponse`);
  }
  assert.equal(/Response\.json\([^)]*process\.env/.test(route), false);
});
test("14. le composant ne simule aucun succès", () => {
  assert.ok(block.includes('fetch("/api/cms/form"'), "la soumission part réellement vers le serveur");
  assert.ok(block.includes("if (response.ok && payload?.ok)"), "l’état succès dépend de la réponse serveur");
  // Aucun des interdits du cahier des charges.
  for (const forbidden of ["setTimeout", "alert(", "console.log", "simulate"]) {
    assert.equal(block.includes(forbidden), false, `${forbidden} absent du formulaire`);
  }
  // La saisie utilisateur n'est jamais injectée en HTML.
  assert.equal(block.includes("dangerouslySetInnerHTML"), false);
  // Le champ-piege doit etre RELU depuis le DOM, sinon il ne bloque aucun robot.
  assert.ok(block.includes('formData.get("_hp")'), "le piege est lu depuis le formulaire");
  assert.ok(!block.includes('_hp: ""'), "la valeur du piege n’est pas codee en dur");
});
test("15. la route refuse les schémas dangereux et exige la version publiée", () => {
  assert.ok(route.includes('page.status === "published"'), "la configuration vient de la version publiée");
  assert.ok(route.includes("findCmsFormElement"), "le formulaire est localisé par identifiant stable");
  assert.ok(route.includes("validateCmsFormSubmission"), "la validation fait autorité côté serveur");
  assert.ok(!route.includes("payload.formConfig"), "la configuration n’est jamais acceptée depuis le client");
});
