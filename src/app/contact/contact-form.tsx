"use client";

import { useState } from "react";
import { track } from "@/lib/track";

export default function ContactForm() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    track("contact_message", { email: form.email });
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-gold/40 bg-gold/5 p-10 text-center">
        <svg viewBox="0 0 24 24" className="h-10 w-10 text-gold" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 12.5l5 5 11-11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="mt-4 font-display text-2xl text-ink">Message reçu.</h2>
        <p className="mt-2 text-sm text-muted">Nous vous répondons sous 24 h ouvrées, sous le même ciel que vous.</p>
      </div>
    );
  }

  const input = "w-full rounded-lg border border-line bg-night px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-gold";

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-surface/50 p-6">
      <div>
        <label htmlFor="ct-name" className="mb-1.5 block text-xs tracking-wide text-muted">Votre nom</label>
        <input id="ct-name" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Camille Dupont" required />
      </div>
      <div>
        <label htmlFor="ct-email" className="mb-1.5 block text-xs tracking-wide text-muted">E-mail</label>
        <input id="ct-email" type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="camille@exemple.fr" required />
      </div>
      <div>
        <label htmlFor="ct-msg" className="mb-1.5 block text-xs tracking-wide text-muted">Votre message</label>
        <textarea id="ct-msg" rows={5} className={`${input} resize-none`} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Racontez-nous votre moment…" required />
      </div>
      <button type="submit" className="w-full rounded-full bg-gold py-3.5 text-sm font-medium tracking-[0.16em] text-night uppercase transition-all hover:bg-goldsoft">
        Envoyer le message
      </button>
    </form>
  );
}
