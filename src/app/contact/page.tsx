import type { Metadata } from "next";
import ContactForm from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Une question sur votre carte du ciel Célestime ? Notre équipe vous répond sous 24 h ouvrées.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
      <div>
        <p className="text-[11px] tracking-[0.3em] text-gold uppercase">Contact</p>
        <h1 className="mt-3 font-display text-5xl text-ink">Parlons de votre ciel</h1>
        <p className="mt-4 leading-relaxed text-muted">
          Une date incertaine, un lieu difficile à trouver, un projet sur mesure (grande série,
          entreprise, musée) : écrivez-nous. Nous répondons sous 24 h ouvrées.
        </p>
        <dl className="mt-8 space-y-4 text-sm">
          <div>
            <dt className="text-[11px] tracking-[0.2em] text-gold uppercase">E-mail</dt>
            <dd className="mt-1 text-ink">bonjour@celestime.fr</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-[0.2em] text-gold uppercase">Atelier</dt>
            <dd className="mt-1 text-ink">Paris, France — sur rendez-vous</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-[0.2em] text-gold uppercase">Horaires</dt>
            <dd className="mt-1 text-ink">Lundi – Vendredi, 10 h – 18 h</dd>
          </div>
        </dl>
      </div>
      <ContactForm />
    </div>
  );
}
