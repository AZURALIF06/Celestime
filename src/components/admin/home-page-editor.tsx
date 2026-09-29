"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MediaPicker from "@/components/admin/media-picker";
import { createHomeCmsPage, DEFAULT_HOME_CONTENT, extractHomeContent, type HomeEditorialContent } from "@/lib/home-content";
import type { CmsPage } from "@/lib/cms";

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-night px-3 py-2.5 text-sm text-ink" />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-line bg-night px-3 py-2.5 text-sm leading-relaxed text-ink" />
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface/50 p-4 sm:p-6">
      <h2 className="font-display text-xl text-goldsoft">{title}</h2>
      {children}
    </section>
  );
}

export default function HomePageEditor({
  pageId,
  initialData,
  initialStatus,
}: {
  pageId: string;
  initialData: CmsPage;
  initialStatus: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState<HomeEditorialContent>(() => extractHomeContent(initialData) ?? JSON.parse(JSON.stringify(DEFAULT_HOME_CONTENT)) as HomeEditorialContent);
  const [status, setStatus] = useState(initialStatus);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState("");

  const change = (next: HomeEditorialContent) => {
    setContent(next);
    setDirty(true);
    setMessage("");
  };

  const save = async (publish?: boolean | false) => {
    if (saving) return false;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: pageId,
          name: "Accueil",
          slug: "accueil",
          data: createHomeCmsPage(content),
          ...(publish === undefined ? {} : { publish }),
        }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error ?? `Échec de l'enregistrement (HTTP ${response.status}).`);
      if (publish === true) setStatus("published");
      else if (publish === false) setStatus("draft");
      setDirty(false);
      setMessage(publish === true ? "Accueil publié." : publish === false ? "Accueil dépublié ; le fallback public est actif." : "Brouillon enregistré.");
      router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Échec de l'enregistrement.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    if (await save()) router.push(`/admin/editor/${pageId}/preview`);
  };

  const isPublished = status === "published";

  return (
    <div className="min-h-screen bg-night text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <Link href="/admin/editeur" className="rounded-full border border-line px-3 py-2 text-xs text-muted hover:text-ink">← Éditeur du site</Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium text-ink">Accueil</h1>
            <p className="text-xs text-faint">/ · {isPublished ? "publiée" : "brouillon — fallback public conservé"}{dirty ? " · modifications non enregistrées" : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={preview} disabled={saving} className="rounded-full border border-line px-3 py-2 text-xs text-muted disabled:opacity-50">Aperçu du brouillon</button>
            <button onClick={() => void save()} disabled={saving} className="rounded-full border border-gold px-4 py-2 text-xs font-medium text-gold disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer le brouillon"}</button>
            <button onClick={() => void save(true)} disabled={saving} className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-night disabled:opacity-50">{isPublished && !dirty ? "Publier à nouveau" : "Publier"}</button>
            {isPublished && <button onClick={() => void save(false)} disabled={saving} className="rounded-full border border-line px-3 py-2 text-xs text-muted disabled:opacity-50">Dépublier</button>}
          </div>
        </div>
        {message && <p role="status" className="mx-auto mt-2 max-w-5xl text-xs text-goldsoft">{message}</p>}
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-xl border border-line bg-surface/40 p-4 text-xs leading-relaxed text-muted">
          Modifiez uniquement les textes éditoriaux et l’image du coffret. Les liens, le catalogue, les prix, les aperçus astronomiques et leurs configurations restent gérés par le code. Les changements publiés sont validés avant d’être utilisés ; sinon le contenu de secours actuel est conservé.
        </div>

        <Group title="Hero">
          <TextField label="Accroche" value={content.heroEyebrow} onChange={(value) => change({ ...content, heroEyebrow: value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Première ligne du titre" value={content.heroTitle[0]} onChange={(value) => change({ ...content, heroTitle: [value, content.heroTitle[1]] })} />
            <TextField label="Seconde ligne du titre" value={content.heroTitle[1]} onChange={(value) => change({ ...content, heroTitle: [content.heroTitle[0], value] })} />
          </div>
          <TextArea label="Paragraphe" value={content.heroParagraph} onChange={(value) => change({ ...content, heroParagraph: value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Libellé du bouton (lien fixe /create)" value={content.heroPrimaryButton} onChange={(value) => change({ ...content, heroPrimaryButton: value })} />
            <TextField label="Libellé du bouton (lien fixe /boutique)" value={content.heroSecondaryButton} onChange={(value) => change({ ...content, heroSecondaryButton: value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {content.trustMentions.map((value, index) => <TextField key={index} label={`Mention de confiance ${index + 1}`} value={value} onChange={(text) => change({ ...content, trustMentions: content.trustMentions.map((item, i) => i === index ? text : item) as HomeEditorialContent["trustMentions"] })} />)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Légende du rendu" value={content.heroLocationCaption} onChange={(value) => change({ ...content, heroLocationCaption: value })} />
            <TextField label="Mention du rendu" value={content.heroPreviewCaption} onChange={(value) => change({ ...content, heroPreviewCaption: value })} />
          </div>
        </Group>

        <Group title="Les 4 étapes">
          {content.steps.map((step, index) => (
            <div key={index} className="grid gap-4 border-t border-line/60 pt-4 sm:grid-cols-2">
              <TextField label={`Étape ${index + 1} · titre`} value={step.title} onChange={(value) => change({ ...content, steps: content.steps.map((item, i) => i === index ? { ...item, title: value } : item) as HomeEditorialContent["steps"] })} />
              <TextArea label={`Étape ${index + 1} · texte`} value={step.body} onChange={(value) => change({ ...content, steps: content.steps.map((item, i) => i === index ? { ...item, body: value } : item) as HomeEditorialContent["steps"] })} />
            </div>
          ))}
        </Group>

        <Group title="Collection">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Sur-titre" value={content.collectionEyebrow} onChange={(value) => change({ ...content, collectionEyebrow: value })} />
            <TextField label="Titre" value={content.collectionTitle} onChange={(value) => change({ ...content, collectionTitle: value })} />
          </div>
          <TextField label="Libellé du lien (destination fixe /boutique)" value={content.collectionLinkLabel} onChange={(value) => change({ ...content, collectionLinkLabel: value })} />
        </Group>

        <Group title="Coffret cadeau">
          <TextField label="Sur-titre" value={content.giftEyebrow} onChange={(value) => change({ ...content, giftEyebrow: value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Première partie du titre" value={content.giftTitle[0]} onChange={(value) => change({ ...content, giftTitle: [value, content.giftTitle[1]] })} />
            <TextField label="Partie mise en évidence" value={content.giftTitle[1]} onChange={(value) => change({ ...content, giftTitle: [content.giftTitle[0], value] })} />
          </div>
          {content.giftItems.map((item, index) => (
            <div key={index} className="grid gap-4 border-t border-line/60 pt-4 sm:grid-cols-2">
              <TextField label={`Élément ${index + 1} · titre`} value={item.title} onChange={(value) => change({ ...content, giftItems: content.giftItems.map((entry, i) => i === index ? { ...entry, title: value } : entry) as HomeEditorialContent["giftItems"] })} />
              <TextArea label={`Élément ${index + 1} · texte`} value={item.body} onChange={(value) => change({ ...content, giftItems: content.giftItems.map((entry, i) => i === index ? { ...entry, body: value } : entry) as HomeEditorialContent["giftItems"] })} />
            </div>
          ))}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <TextField label="Source de l’image éditoriale" value={content.giftImage} onChange={(value) => change({ ...content, giftImage: value })} />
              <p className="mt-1 text-[11px] text-faint">Utilisez une image locale, /api/media/… ou une URL HTTPS de la médiathèque.</p>
            </div>
            <button onClick={() => setPickerOpen(true)} className="rounded-full bg-gold px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-night hover:bg-goldsoft">Choisir dans la médiathèque</button>
          </div>
          <TextField label="Libellé du bouton (destination fixe /produit/etoiles-de-naissance)" value={content.giftButtonLabel} onChange={(value) => change({ ...content, giftButtonLabel: value })} />
        </Group>

        <Group title="Exemples de créations">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Sur-titre" value={content.examplesEyebrow} onChange={(value) => change({ ...content, examplesEyebrow: value })} />
            <TextField label="Titre" value={content.examplesTitle} onChange={(value) => change({ ...content, examplesTitle: value })} />
          </div>
          <TextArea label="Texte d’introduction" value={content.examplesParagraph} onChange={(value) => change({ ...content, examplesParagraph: value })} />
        </Group>

        <Group title="Témoignages">
          <TextField label="Titre de section" value={content.testimonialsTitle} onChange={(value) => change({ ...content, testimonialsTitle: value })} />
          {content.testimonials.map((testimonial, index) => (
            <div key={index} className="grid gap-4 border-t border-line/60 pt-4 sm:grid-cols-2">
              <TextArea label={`Témoignage ${index + 1}`} value={testimonial.quote} onChange={(value) => change({ ...content, testimonials: content.testimonials.map((item, i) => i === index ? { ...item, quote: value } : item) as HomeEditorialContent["testimonials"] })} />
              <TextField label={`Signature ${index + 1}`} value={testimonial.author} onChange={(value) => change({ ...content, testimonials: content.testimonials.map((item, i) => i === index ? { ...item, author: value } : item) as HomeEditorialContent["testimonials"] })} />
            </div>
          ))}
        </Group>

        <Group title="FAQ de l’accueil">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Sur-titre" value={content.faqEyebrow} onChange={(value) => change({ ...content, faqEyebrow: value })} />
            <TextField label="Titre" value={content.faqTitle} onChange={(value) => change({ ...content, faqTitle: value })} />
          </div>
          {content.faq.map((item, index) => (
            <div key={index} className="grid gap-4 border-t border-line/60 pt-4 sm:grid-cols-2">
              <TextArea label={`Question ${index + 1}`} value={item.question} onChange={(value) => change({ ...content, faq: content.faq.map((entry, i) => i === index ? { ...entry, question: value } : entry) })} rows={2} />
              <TextArea label={`Réponse ${index + 1}`} value={item.answer} onChange={(value) => change({ ...content, faq: content.faq.map((entry, i) => i === index ? { ...entry, answer: value } : entry) })} />
            </div>
          ))}
        </Group>

        <Group title="Appel à l’action final">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Première partie du titre" value={content.finalTitle[0]} onChange={(value) => change({ ...content, finalTitle: [value, content.finalTitle[1]] })} />
            <TextField label="Partie mise en évidence" value={content.finalTitle[1]} onChange={(value) => change({ ...content, finalTitle: [content.finalTitle[0], value] })} />
          </div>
          <TextArea label="Paragraphe" value={content.finalParagraph} onChange={(value) => change({ ...content, finalParagraph: value })} />
          <TextField label="Libellé du bouton (destination fixe /create)" value={content.finalButtonLabel} onChange={(value) => change({ ...content, finalButtonLabel: value })} />
        </Group>

        <div className="flex flex-wrap justify-end gap-2 pb-8">
          <button onClick={preview} disabled={saving} className="rounded-full border border-line px-4 py-2 text-sm text-muted disabled:opacity-50">Aperçu du brouillon</button>
          <button onClick={() => void save()} disabled={saving} className="rounded-full border border-gold px-5 py-2 text-sm text-gold disabled:opacity-50">Enregistrer</button>
          <button onClick={() => void save(true)} disabled={saving} className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-night disabled:opacity-50">Publier l’accueil</button>
        </div>
      </main>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(urls) => { if (urls[0]) change({ ...content, giftImage: urls[0] }); }}
        selectedUrls={[content.giftImage]}
        title="Image éditoriale du coffret"
      />
    </div>
  );
}
