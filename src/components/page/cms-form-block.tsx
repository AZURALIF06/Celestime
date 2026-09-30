"use client";

// Célestime — Phase 3C : rendu réel du bloc Formulaire.
//
// La soumission part réellement vers POST /api/cms/form. Aucun setTimeout,
// aucun alert, aucune simulation : l'état « succès » n'est atteint qu'après une
// réponse 200 du serveur, qui n'est lui-même envoyé qu'après écriture en base.
// Les valeurs ne sont jamais injectées en HTML : React les échappe, et le
// serveur les a déjà normalisées.

import { useEffect, useRef, useState } from "react";
import type { CmsElement } from "@/lib/cms";
import {
  isCmsFormUsable,
  normalizeCmsFormConfig,
  type CmsFormConfig,
  type CmsFormFieldConfig,
} from "@/lib/cms-form";

type CmsFormStatus = "idle" | "submitting" | "success" | "error";

const INPUT_CLASS =
  "w-full rounded-lg border border-line bg-night px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-gold disabled:opacity-60";

function fieldInput(field: CmsFormFieldConfig, value: string, disabled: boolean, onChange: (value: string) => void) {
  if (field.type === "message") {
    return (
      <textarea
        rows={field.rows}
        className={`${INPUT_CLASS} resize-y`}
        value={value}
        disabled={disabled}
        required={field.required}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <input
      type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
      inputMode={field.type === "phone" ? "tel" : field.type === "email" ? "email" : undefined}
      autoComplete={field.type === "email" ? "email" : field.type === "name" ? "name" : field.type === "phone" ? "tel" : undefined}
      className={INPUT_CLASS}
      value={value}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function CmsFormBlock({ el, slug }: { el: CmsElement; slug: string }) {
  const style = el.style ?? {};
  const config: CmsFormConfig = normalizeCmsFormConfig(el.content);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<CmsFormStatus>("idle");
  const [feedback, setFeedback] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const startedAt = useRef<number>(0);
  const busy = status === "submitting";

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  if (!slug || !isCmsFormUsable(config)) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-faint" style={{ background: style.bg ?? "#0c0e16", borderRadius: style.radius ?? 16, border: "1px solid #22263a" }}>
        Formulaire non configuré.
      </div>
    );
  }

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        data-cms-form-state="success"
        className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-auto p-4 text-center"
        style={{ background: style.bg ?? "#0c0e16", borderRadius: style.radius ?? 16, border: "1px solid #22263a" }}
      >
        <p className="text-sm text-ink">{feedback || config.successMessage}</p>
        <button
          type="button"
          onClick={() => { setStatus("idle"); setValues({}); setFieldErrors({}); setFeedback(""); startedAt.current = Date.now(); }}
          className="text-[11px] text-muted underline hover:text-ink"
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setStatus("submitting");
    setFeedback("");
    setFieldErrors({});
    try {
      // Le champ-piège est RELU depuis le DOM : sans cela il serait décoratif
      // et n'arrêterait aucun robot.
      const formData = new FormData(event.currentTarget);
      const honeypot = String(formData.get("_hp") ?? "");
      const response = await fetch("/api/cms/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          elementId: el.id,
          values,
          startedAt: startedAt.current,
          _hp: honeypot,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string; fields?: Record<string, string> } | null;
      if (response.ok && payload?.ok) {
        setFeedback(typeof payload.message === "string" ? payload.message : config.successMessage);
        setStatus("success");
        return;
      }
      if (payload?.fields && typeof payload.fields === "object") setFieldErrors(payload.fields);
      setFeedback(typeof payload?.error === "string" ? payload.error : config.errorMessage);
      setStatus("error");
    } catch {
      // Panne réseau : état d'erreur explicite, jamais un faux succès.
      setFeedback(config.errorMessage);
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={submit}
      data-cms-form-state={status}
      className="flex h-full w-full flex-col gap-2.5 overflow-auto p-4"
      style={{ background: style.bg ?? "#0c0e16", borderRadius: style.radius ?? 16, border: "1px solid #22263a" }}
    >
      {config.title && <p className="text-sm font-medium text-ink">{config.title}</p>}
      {config.description && <p className="text-xs leading-relaxed text-muted">{config.description}</p>}

      {/* Piège anti-robot : invisible et hors tabulation. */}
      <div aria-hidden="true" className="hidden" style={{ position: "absolute", left: "-9999px" }}>
        <label htmlFor={`${el.id}-hp`}>Ne pas remplir</label>
        <input id={`${el.id}-hp`} name="_hp" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {config.fields.filter((field) => field.enabled).map((field) => (
        <div key={field.key}>
          <label htmlFor={`${el.id}-${field.key}`} className="mb-1 block text-[11px] text-muted">
            {field.label}
            {field.required ? <span aria-hidden="true"> *</span> : null}
          </label>
          {fieldInput(field, values[field.key] ?? "", busy, (value) => setValues((current) => ({ ...current, [field.key]: value })))}
          {fieldErrors[field.key] ? (
            <p role="alert" className="mt-1 text-[11px] text-danger">{fieldErrors[field.key]}</p>
          ) : null}
        </div>
      ))}

      {status === "error" && feedback ? (
        <p role="alert" className="text-[11px] text-danger">{feedback}</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-gold py-2.5 text-xs font-medium tracking-[0.14em] text-night uppercase disabled:opacity-60"
      >
        {busy ? "Envoi en cours…" : config.submitLabel}
      </button>
    </form>
  );
}

export default CmsFormBlock;
