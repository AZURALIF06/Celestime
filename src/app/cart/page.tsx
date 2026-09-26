import type { Metadata } from "next";
import CartView from "@/components/cart-view";

export const metadata: Metadata = { title: "Votre panier" };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-[11px] tracking-[0.3em] text-gold uppercase">Presque votre ciel</p>
      <h1 className="mt-2 font-display text-5xl text-ink">Votre panier</h1>
      <CartView />
    </div>
  );
}
