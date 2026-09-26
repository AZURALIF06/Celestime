import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-32 text-center">
      <p className="font-display text-7xl text-gold/60">404</p>
      <h1 className="mt-4 font-display text-4xl text-ink">Cette constellation n'existe pas.</h1>
      <p className="mt-3 text-muted">La page demandée est introuvable — retournez vers un ciel connu.</p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-gold px-8 py-3.5 text-sm font-medium tracking-[0.16em] text-night uppercase hover:bg-goldsoft"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}
