import type { Metadata } from "next";
import CheckoutView from "@/components/checkout-view";

export const metadata: Metadata = { title: "Commande" };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-[11px] tracking-[0.3em] text-gold uppercase">Dernière étape</p>
      <h1 className="mt-2 font-display text-5xl text-ink">Finaliser ma commande</h1>
      <CheckoutView />
    </div>
  );
}
