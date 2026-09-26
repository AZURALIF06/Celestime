"use client";

// Célestime — aperçus vivants : de vraies créations Célestime calculées en direct
// (produit, fond et forme du catalogue Célestime).

import { StarMapCanvas, useSky } from "./starmap-canvas";
import type { CreationConfig } from "@/lib/types";

function DemoCard({ config, label, sub }: { config: CreationConfig; label: string; sub: string }) {
  const sky = useSky(config);
  return (
    <figure className="group">
      <div className="overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/40 transition-transform duration-500 group-hover:scale-[1.015]">
        <div className="relative">
          <StarMapCanvas config={config} sky={sky.sky} className="aspect-[3/4] w-full" maxRenderPx={900} />
          {label && (
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-night/70 px-3 py-1 text-[10px] tracking-[0.2em] text-goldsoft uppercase backdrop-blur-sm">
              {label}
            </span>
          )}
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs tracking-[0.14em] text-muted uppercase">{sub}</figcaption>
    </figure>
  );
}

const base: Omit<CreationConfig, "name" | "message" | "day" | "month" | "year" | "hour" | "minute" | "location" | "background" | "shape" | "productId" | "occasion"> = {
  timeApprox: false,
  framed: false,
  size: "A4",
  quantity: 1,
};

export const DEMO_CANNES: CreationConfig = {
  ...base,
  productId: "etoiles-de-naissance",
  occasion: "naissance",
  name: "Camille",
  message: "",
  day: "25",
  month: "02",
  year: "2025",
  hour: "12",
  minute: "00",
  location: { name: "Cannes", country: "France", latitude: 43.5513, longitude: 7.0127, timezone: "Europe/Paris" },
  background: "saphir",
  shape: "medaillon",
};

export const DEMO_PARIS: CreationConfig = {
  ...base,
  productId: "etoiles-de-nous-deux",
  occasion: "mariage",
  name: "Louise & Arnaud",
  message: "",
  day: "14",
  month: "09",
  year: "2024",
  hour: "17",
  minute: "30",
  location: { name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris" },
  background: "rubis",
  shape: "coeur",
};

export const DEMO_NEWYORK: CreationConfig = {
  ...base,
  productId: "etoiles-de-rencontre",
  occasion: "rencontre",
  name: "Élise",
  message: "",
  day: "14",
  month: "02",
  year: "2020",
  hour: "19",
  minute: "45",
  location: { name: "New York City", country: "États-Unis", latitude: 40.7143, longitude: -74.006, timezone: "America/New_York" },
  background: "emeraude",
  shape: "coeur",
};

export function ShowcaseGallery() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <DemoCard config={DEMO_CANNES} label="A4 · Saphir · Medaillon" sub="Étoiles de Naissance — Cannes" />
      <DemoCard config={DEMO_PARIS} label="A3 · Rubis · Cœur" sub="Étoiles de Nous Deux — Paris" />
      <DemoCard config={DEMO_NEWYORK} label="A4 · Émeraude · Cœur" sub="Étoiles de Rencontre — New York" />
    </div>
  );
}

export function HeroCanvas() {
  const sky = useSky(DEMO_CANNES);
  return <StarMapCanvas config={DEMO_CANNES} sky={sky.sky} className="aspect-[3/4] w-full" maxRenderPx={1000} />;
}
