import test from "node:test";
import assert from "node:assert/strict";
import {
  CMS_FORM_DEFAULTS,
  CMS_FORM_LIMITS,
  findCmsFormElement,
  isCmsFormUsable,
  isValidCmsFormContent,
  normalizeCmsFormConfig,
  sanitizeCmsFormMultiline,
  sanitizeCmsFormText,
  validateCmsFormSubmission,
} from "../src/lib/cms-form.ts";

const config = (patch = {}) => normalizeCmsFormConfig(patch);
const submission = (values) => validateCmsFormSubmission(config(), values);
const ok = (result) => assert.equal(result.ok, true, JSON.stringify(result));
const ko = (result, field) => {
  assert.equal(result.ok, false, `attendu un refus sur ${field}`);
  if (field) assert.ok(result.errors[field], `erreur attendue sur ${field}`);
};

// 1–5 : configuration Phase 3C, ordre des champs et compatibilité Phase 3B.
test("1. la configuration par défaut couvre nom, e-mail et message", () => {
  const defaults = config();
  const enabled = defaults.fields.filter((field) => field.enabled).map((field) => field.key);
  assert.deepEqual(enabled, ["name", "email", "message"]);
  assert.deepEqual(config().fields.map((field) => field.key), ["name", "email", "phone", "subject", "message"]);
  assert.equal(defaults.fields.find((field) => field.key === "phone").enabled, false);
  assert.equal(defaults.fields.find((field) => field.key === "subject").enabled, false);
});

test("2. l'ordre d'affichage suit l'ordre du tableau fields", () => {
  const ordered = config({ fields: [
    { key: "message", label: "Msg" },
    { key: "email", label: "Mail" },
    { key: "name", label: "Nom" },
  ] });
  assert.deepEqual(ordered.fields.map((field) => field.key), ["message", "email", "name"]);
});

test("3. le contenu Phase 3B `text` reste lu comme titre (aucune régression)", () => {
  assert.equal(config({ text: "Écrivez-nous" }).title, "Écrivez-nous");
  assert.equal(config({}).title, CMS_FORM_DEFAULTS.title);
});

test("4. un champ dupliqué est dédupliqué et un type incohérent avec la clé est corrigé", () => {
  const deduped = config({ fields: [{ key: "name", label: "A" }, { key: "name", label: "B" }, { key: "email", type: "name" }] });
  assert.deepEqual(deduped.fields.map((field) => field.key), ["name", "email"]);
  assert.equal(deduped.fields[1].type, "email");
});

test("5. un champ required mais désactivé ne rend pas le formulaire impossible à soumettre", () => {
  const mixed = config({ fields: [{ key: "name", required: true, enabled: false }, { key: "email", required: true }] });
  assert.equal(mixed.fields[0].required, false);
  assert.equal(mixed.fields[1].required, true);
  ok(validateCmsFormSubmission(mixed, { email: "a@b.fr" }));
});

// 6–12 : validation serveur des saisies.
test("6. le nom est obligatoire quand le champ est actif", () => {
  ko(submission({ email: "a@b.fr", message: "Bonjour" }), "name");
  ko(submission({ name: "  ", email: "a@b.fr", message: "Bonjour" }), "name");
  ok(submission({ name: "Camille", email: "a@b.fr", message: "Bonjour" }));
});

test("7. l'e-mail est obligatoire, formaté et borné", () => {
  ko(submission({ name: "Camille", message: "Bonjour" }), "email");
  for (const bad of ["pas-un-email", "a@b", "a b@c.fr", "<a@b.fr>", "a@@b.fr"]) {
    ko(submission({ name: "Camille", email: bad, message: "Bonjour" }), "email");
  }
  const accepted = submission({ name: "Camille", email: "Camille.Dupont@Exemple.FR", message: "Bonjour" });
  ok(accepted);
  assert.equal(accepted.data.email, "camille.dupont@exemple.fr");
  const tooLong = submission({ name: "Camille", email: `${"a".repeat(250)}@b.fr`, message: "Bonjour" });
  ko(tooLong, "email");
});

test("8. le téléphone est facultatif, borné et limité à des caractères raisonnables", () => {
  const withPhone = config({ fields: [{ key: "name" }, { key: "email" }, { key: "phone", enabled: true }, { key: "message" }] });
  ok(validateCmsFormSubmission(withPhone, { name: "Camille", email: "a@b.fr", message: "Bonjour" }));
  ok(validateCmsFormSubmission(withPhone, { name: "Camille", email: "a@b.fr", phone: "+33 6 12 34 56 78", message: "Bonjour" }));
  for (const bad of ["abc", "1234", "+33 6 12 34 56 78 ext", "0123456789012345678901234567890123456789"]) {
    ko(validateCmsFormSubmission(withPhone, { name: "Camille", email: "a@b.fr", phone: bad, message: "Bonjour" }), "phone");
  }
  // Le marquage est retire mais le reste du texte reste : "alert(1)" n'est pas
  // un telephone, la soumission est refusee plutot que stockee.
  ko(validateCmsFormSubmission(withPhone, { name: "Camille", email: "a@b.fr", phone: "<script>alert(1)</script>", message: "Bonjour" }), "phone");
  // Saisie qui se normalise en chaine vide : traitee comme "non renseigne",
  // donc rien n'est stocke ni rendu.
  const emptied = validateCmsFormSubmission(withPhone, { name: "Camille", email: "a@b.fr", phone: "<script>", message: "Bonjour" });
  ok(emptied);
  assert.equal(emptied.data.phone, "");
  // Champ désactivé : la valeur transmise est une clé inattendue (cf. test 11).
  ko(validateCmsFormSubmission(config(), { name: "C", email: "a@b.fr", phone: "+33612345678", message: "Bonjour" }), "form");
});

test("9. le sujet est facultatif et borné à 200 caractères", () => {
  const withSubject = config({ fields: [{ key: "name" }, { key: "email" }, { key: "subject", enabled: true }, { key: "message" }] });
  ok(validateCmsFormSubmission(withSubject, { name: "Camille", email: "a@b.fr", subject: "Devis", message: "Bonjour" }));
  ok(validateCmsFormSubmission(withSubject, { name: "Camille", email: "a@b.fr", subject: "x".repeat(200), message: "Bonjour" }));
  ko(validateCmsFormSubmission(withSubject, { name: "Camille", email: "a@b.fr", subject: "x".repeat(201), message: "Bonjour" }), "subject");
});

test("10. le message est obligatoire, et un message trop long est refusé sans être tronqué", () => {
  ko(submission({ name: "Camille", email: "a@b.fr" }), "message");
  ok(submission({ name: "Camille", email: "a@b.fr", message: "x".repeat(CMS_FORM_LIMITS.message.max) }));
  ko(submission({ name: "Camille", email: "a@b.fr", message: "x".repeat(CMS_FORM_LIMITS.message.max + 1) }), "message");
  // Aucune troncature silencieuse : au-delà de la limite l'envoi est refusé.
  ko(submission({ name: "Camille", email: "a@b.fr", message: "x".repeat(CMS_FORM_LIMITS.message.max * 4) }), "message");
});

test("11. un champ désactivé est ignoré et une clé inconnue fait échouer toute la soumission", () => {
  ok(submission({ name: "Camille", email: "a@b.fr", message: "Bonjour" }));
  ko(submission({ name: "Camille", email: "a@b.fr", message: "Bonjour", company: "ACME" }), "form");
  ko(submission({ name: "Camille", email: "a@b.fr", message: "Bonjour", subject: "pirate" }), "form");
});

test("12. la normalisation retire HTML, controles et caracteres de largeur nulle", () => {
  assert.equal(sanitizeCmsFormText("  <b>Camille</b> Dupont  ", 200), "Camille Dupont");
  // NFKC n'aplatit pas le trait d'union insecable en " - " ASCII ; l'invariant
  // utile est l'absence de caractere invisible et la preservation du mot.
  assert.equal(sanitizeCmsFormText("Jean\u2011Pierre", 200), "Jean\u2010Pierre");
  assert.equal(sanitizeCmsFormText("Jean-Pierre", 200), "Jean-Pierre");
  assert.equal(sanitizeCmsFormText("\ufeffalert(1)", 200), "alert(1)");
  assert.equal(sanitizeCmsFormText("a\u0007b\u001fc", 200), "abc");
  assert.equal(sanitizeCmsFormMultiline("Ligne 1\n\n\n\nLigne 2  ", 5000), "Ligne 1\n\nLigne 2");
  const result = submission({ name: "Camille", email: "a@b.fr", message: "<script>alert(1)</script>Bonjour" });
  ok(result);
  assert.equal(result.data.message.includes("<"), false);
});

// 13–17 : validation de la configuration à l'enregistrement CMS.
test("13. une configuration Phase 3C valide est acceptée", () => {
  assert.equal(isValidCmsFormContent(normalizeCmsFormConfig({
    title: "Contact", description: "d", fields: [{ key: "name", type: "name", label: "N", enabled: true, required: true, placeholder: "p", rows: 4 }],
    submitLabel: "Envoyer", successMessage: "ok", errorMessage: "ko",
  })), true);
});

test("14. une clé de content inconnue est refusée à l'enregistrement", () => {
  assert.equal(isValidCmsFormContent({ text: "a", recipient: "pirate@evil.fr" }), false);
  assert.equal(isValidCmsFormContent({ text: "a", webhook: "https://evil.fr" }), false);
  assert.equal(isValidCmsFormContent({ text: "a" }), true);
});

test("15. champs invalides ou dupliqués sont refusés à l'enregistrement", () => {
  assert.equal(isValidCmsFormContent({ fields: [{ key: "unknown" }] }), false);
  assert.equal(isValidCmsFormContent({ fields: [{ key: "name" }, { key: "name" }] }), false);
  assert.equal(isValidCmsFormContent({ fields: [{ key: "name", type: "email" }] }), false);
  assert.equal(isValidCmsFormContent({ fields: [{ key: "name", required: "oui" }] }), false);
  assert.equal(isValidCmsFormContent({ fields: [{ key: "name", rows: 1 }] }), false);
  assert.equal(isValidCmsFormContent({ fields: [{ key: "name", arbitrary: true }] }), false);
});

test("16. les messages de succès et d'erreur sont configurables et bornés", () => {
  assert.equal(config({ successMessage: "Merci !", errorMessage: "Oups" }).successMessage, "Merci !");
  assert.equal(config({ successMessage: "x".repeat(2000) }).successMessage.length, 1000);
  assert.equal(isValidCmsFormContent({ successMessage: "x".repeat(1001) }), false);
});

test("17. un formulaire sans champ actif est signalé comme inutilisable", () => {
  assert.equal(isCmsFormUsable(config({ fields: [{ key: "name", enabled: false }] })), false);
  assert.equal(isCmsFormUsable(config()), true);
});

// 18–20 : localisation autoritaire du formulaire dans un document publié.
const publishedPage = {
  sections: [{
    id: "s1", h: 600,
    elements: [{
      id: "row-1", nodeType: "row", x: 0, y: 0, w: 1200, h: 300, z: 1, rotation: 0, opacity: 1,
      layout: "horizontal", gap: 16, alignX: "start", alignY: "start",
      children: [
        { id: "col-a", nodeType: "column", width: 50, z: 1, opacity: 1, layout: "vertical", gap: 8, children: [
          { id: "form-el", type: "form", x: 0, y: 0, w: 400, h: 300, z: 1, rotation: 0, opacity: 1, content: { text: "Écrivez-nous" }, style: {} },
        ] },
        { id: "col-b", nodeType: "column", width: 50, z: 1, opacity: 1, layout: "vertical", gap: 8, children: [
          { id: "text-el", type: "text", x: 0, y: 0, w: 400, h: 80, z: 1, rotation: 0, opacity: 1, content: { text: "Hi" }, style: {} },
        ] },
      ],
    }],
  }],
};

test("18. le formulaire est retrouvé par identifiant à l'intérieur d'une colonne", () => {
  const found = findCmsFormElement(publishedPage, "form-el");
  assert.ok(found);
  assert.equal(found.id, "form-el");
  assert.equal(normalizeCmsFormConfig(found.content).title, "Écrivez-nous");
});

test("19. un identifiant inconnu ou un élément non-formulaire ne retourne aucun formulaire", () => {
  assert.equal(findCmsFormElement(publishedPage, "nope"), null);
  assert.equal(findCmsFormElement(publishedPage, "text-el"), null);
  assert.equal(findCmsFormElement({ sections: [] }, "form-el"), null);
  assert.equal(findCmsFormElement(null, "form-el"), null);
});

test("20. la configuration serveur fait autorité : assouplir le client n'aide pas l'attaquant", () => {
  // Le serveur ne reçoit que `values`; la configuration vient de la page publiée.
  const publishedConfig = normalizeCmsFormConfig(findCmsFormElement(publishedPage, "form-el").content);
  const attacked = validateCmsFormSubmission(publishedConfig, { name: "", email: "pas-un-email", message: "" });
  ko(attacked, "name");
  ko(attacked, "email");
  ko(attacked, "message");
});
