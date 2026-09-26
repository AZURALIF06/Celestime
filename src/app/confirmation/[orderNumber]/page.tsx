import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eur } from "@/lib/pricing";
import type { CartItem, CustomerInfo } from "@/lib/types";

export const metadata: Metadata = { title: "Confirmation de commande" };

export default async function ConfirmationPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const rows = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  const row = rows[0];

  const customer = row ? (row.customer as unknown as CustomerInfo) : null;
  const items = row ? ((row.items as unknown as CartItem[]) ?? []) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 bg-gold/10">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-gold" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M4 12.5l5 5 11-11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mt-6 text-[11px] tracking-[0.3em] text-gold uppercase">Merci{customer ? `, ${customer.fullName.split(" ")[0]}` : ""}</p>
        <h1 className="mt-3 font-display text-5xl text-ink">Votre ciel est entre de bonnes mains.</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Commande <span className="text-gold">{orderNumber}</span> confirmée. Un récapitulatif a été
          envoyé{customer ? ` à ${customer.email}` : ""}. La fabrication commence dès réception.
        </p>
      </div>

      {row ? (
        <div className="mt-12 rounded-2xl border border-line bg-surface/50 p-6">
          <h2 className="text-[11px] tracking-[0.24em] text-muted uppercase">Détails</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-faint">Créations</dt>
              <dd className="text-ink tabular-nums">{items.reduce((s, i) => s + i.quantity, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-faint">Articles</dt>
              <dd className="text-ink tabular-nums">{eur(row.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-faint">Livraison</dt>
              <dd className="text-ink">{row.shipping === 0 ? "Offerte" : eur(row.shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="text-ink">Total TTC</dt>
              <dd className="font-display text-2xl text-gold tabular-nums">{eur(row.total)}</dd>
            </div>
          </dl>
          <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            {items.map((it) => (
              <li key={it.id} className="flex justify-between gap-4">
                <span className="text-ink">
                  {it.config.name || "Création Célestime"}
                  <span className="text-faint"> · {it.config.size} · {it.config.location ? it.config.location.name : ""}</span>
                </span>
                <span className="text-muted tabular-nums">{eur(it.unitPrice * it.quantity)}</span>
              </li>
            ))}
          </ul>
          {customer && (
            <p className="mt-5 rounded-lg bg-raised px-4 py-3 text-xs leading-relaxed text-muted">
              Livraison à l'adresse : {customer.address}, {customer.zip} {customer.city}, {customer.country}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-12 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          Cette commande ne figure pas dans notre registre (démo locale). Retrouvez le détail depuis{" "}
          <Link href="/account" className="text-gold hover:underline">
            Mon compte
          </Link>
          .
        </div>
      )}

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/account" className="rounded-full bg-gold px-7 py-3 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">
          Suivre ma commande
        </Link>
        <Link href="/create" className="rounded-full border border-line px-7 py-3 text-sm tracking-[0.14em] text-ink uppercase hover:border-gold">
          Créer un autre ciel
        </Link>
      </div>
      <p className="mt-6 text-center text-xs text-faint">
        Paiement simulé (démonstration) — statut de la commande : confirmée, en préparation.
      </p>
    </div>
  );
}
