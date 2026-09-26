"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json());
    if (res.ok) router.push("/admin/dashboard");
    else setError(res.error ?? "Erreur de connexion.");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-night px-4">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-2xl tracking-[0.24em] text-ink">CÉLESTIME</p>
        <p className="mt-1 text-center text-[10px] tracking-[0.3em] text-gold uppercase">Espace d'administration</p>
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-line bg-surface/60 p-6">
          <div>
            <label htmlFor="a-email" className="mb-1 block text-[11px] tracking-wide text-faint uppercase">E-mail</label>
            <input id="a-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-line bg-night px-3 py-2.5 text-sm text-ink focus:border-gold" placeholder="admin@celestime.fr" />
          </div>
          <div>
            <label htmlFor="a-pass" className="mb-1 block text-[11px] tracking-wide text-faint uppercase">Mot de passe</label>
            <input id="a-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-line bg-night px-3 py-2.5 text-sm text-ink focus:border-gold" placeholder="••••••••••" />
          </div>
          {error && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">{error}</p>}
          <button disabled={loading} className="w-full rounded-full bg-gold py-3 text-sm font-medium tracking-[0.16em] text-night uppercase transition-all hover:bg-goldsoft disabled:opacity-60">
            {loading ? "Connexion…" : "Se connecter"}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-faint">
            Accès réservé au propriétaire. Journal des opérations activé.
            <br />
            <span className="text-muted">Démo : admin@celestime.fr / celestime2025</span>
          </p>
        </form>
      </div>
    </div>
  );
}
