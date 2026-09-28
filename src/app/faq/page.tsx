import type { Metadata } from "next";
import Link from "next/link";
import { ElementView } from "@/components/page/element-view";
import { FAQ_CONTENT } from "@/lib/faq-content";
import { getPublishedFaq } from "@/lib/faq-cms";
import { isCmsContainer, isCmsStructuralNode, type CmsElement } from "@/lib/cms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Tout savoir sur les cartes du ciel Célestime : ce que représente le ciel, les informations à fournir, l'heure approximative, le message personnalisé, les formats, le coffret et la livraison.",
};

function faqStructuredData(items: { question: string; answer: string }[]) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }).replace(/</g, "\\u003c");
}

function FaqFallback() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-center text-[11px] tracking-[0.3em] text-gold uppercase">Aide Célestime</p>
      <h1 className="mt-3 text-center font-display text-5xl text-ink">Questions fréquentes</h1>
      <div className="mt-10 space-y-3">
        {FAQ_CONTENT.map((f) => (
          <details key={f.q} className="group rounded-xl border border-line bg-surface/50">
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-ink">
              {f.q}
              <span className="text-gold transition-transform duration-300 group-open:rotate-45">+</span>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-12 rounded-2xl border border-line bg-surface/50 p-8 text-center">
        <h2 className="font-display text-2xl text-ink">Une autre question ?</h2>
        <p className="mt-2 text-sm text-muted">Notre équipe vous répond sous 24 h ouvrées, sous le même ciel que vous.</p>
        <Link href="/contact" className="mt-5 inline-block rounded-full bg-gold px-7 py-3 text-sm font-medium tracking-[0.14em] text-night uppercase hover:bg-goldsoft">
          Nous contacter
        </Link>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_CONTENT.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </div>
  );
}

export default async function FaqPage() {
  const cmsFaq = await getPublishedFaq();
  if (!cmsFaq) return <FaqFallback />;

  const items = (cmsFaq.element.content.items as { question: string; answer: string }[]).filter(
    (item) => typeof item?.question === "string" && typeof item?.answer === "string"
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <ElementView el={cmsFaq.element} />
      {cmsFaq.page.sections.flatMap((section) => section.elements)
        .filter((element): element is CmsElement => !isCmsStructuralNode(element) && element.type === "text" && element.content?.role === "editorialBlock")
        .map((element) => <div key={element.id} className="mt-6"><ElementView el={element} /></div>)}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqStructuredData(items) }} />
    </main>
  );
}
