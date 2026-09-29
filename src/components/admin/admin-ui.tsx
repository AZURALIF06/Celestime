"use client";

// Célestime — coquille d'administration + petits composants partagés.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin/dashboard", label: "Tableau de bord", icon: "▦" },
  { href: "/admin/pages", label: "Pages", icon: "◧" },
  { href: "/admin/editeur", label: "Éditeur du site", icon: "⌘" },
  { href: "/admin/products", label: "Produits", icon: "◆" },
  { href: "/admin/orders", label: "Commandes", icon: "≡" },
  { href: "/admin/commerce", label: "Commerce", icon: "⬡" },
  { href: "/admin/media", label: "Médiathèque", icon: "▤" },
  { href: "/admin/blog", label: "Blog", icon: "✎" },
  { href: "/admin/settings", label: "Site & menu", icon: "⚙" },
];

export function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-night text-ink">
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 border-r border-line bg-surface transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="border-b border-line px-5 py-4">
          <p className="font-display text-lg tracking-[0.2em] text-ink">CÉLESTIME</p>
          <p className="text-[10px] tracking-[0.24em] text-gold uppercase">Administration</p>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <span className="w-4 text-center text-gold/70">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full space-y-1 border-t border-line p-3">
          <Link href="/" target="_blank" className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-raised hover:text-ink">
            ↗ Voir le site
          </Link>
          <button
            onClick={async () => {
              await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logout: true }) });
              router.push("/admin/login");
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-raised"
          >
            Se déconnecter
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-night/90 px-4 py-3 backdrop-blur">
          <button onClick={() => setOpen(true)} className="rounded-lg border border-line px-2.5 py-1.5 text-sm lg:hidden" aria-label="Menu">☰</button>
          <h1 className="font-display text-2xl text-ink">{title}</h1>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-4">
      <p className="text-[11px] tracking-[0.16em] text-faint uppercase">{label}</p>
      <p className={`mt-1 font-display text-3xl tabular-nums ${accent ? "text-gold" : "text-ink"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export const inputCls = "w-full rounded-lg border border-line bg-night px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-gold";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] tracking-wide text-faint uppercase">{label}</span>
      {children}
    </label>
  );
}

export function euro(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export const STATUS_LABELS: Record<string, string> = {
  en_attente: "En attente",
  payee: "Payée",
  en_preparation: "En préparation",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
  remboursee: "Remboursée",
};
