"use client";

import Link from "next/link";
import { useCart } from "./cart-context";
import { eur } from "@/lib/pricing";

export function CartButton() {
  const { count, total } = useCart();
  return (
    <Link
      href="/cart"
      className="relative flex h-10 items-center gap-2 rounded-full border border-line px-3.5 text-muted transition-colors hover:border-gold hover:text-ink"
      aria-label={`Panier : ${count} article${count > 1 ? "s" : ""}`}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M6 8h12l-1 12H7L6 8z" strokeLinejoin="round" />
        <path d="M9 8V6a3 3 0 016 0v2" strokeLinecap="round" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-semibold text-night">
          {count}
        </span>
      )}
      <span className="hidden text-sm sm:block">{total > 0 ? eur(total) : ""}</span>
    </Link>
  );
}
