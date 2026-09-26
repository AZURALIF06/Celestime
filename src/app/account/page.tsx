import type { Metadata } from "next";
import AccountView from "@/components/account-view";

export const metadata: Metadata = {
  title: "Mon compte",
  description: "Suivez vos commandes Célestime, retouchez vos créations, dupliquez-les et retrouvez vos fichiers.",
};

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="text-[11px] tracking-[0.3em] text-gold uppercase">Mon compte Célestime</p>
      <h1 className="mt-2 font-display text-5xl text-ink">Mes cieux, mes commandes</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Vos créations non finalisées sont conservées sur cet appareil ; vos commandes le sont ici.
      </p>
      <AccountView />
    </div>
  );
}
