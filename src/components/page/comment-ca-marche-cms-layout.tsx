import type { CmsPage } from "@/lib/cms";
import { commentCaMarcheRole, COMMENT_CA_MARCHE_STEP_ROLES } from "@/lib/comment-ca-marche-cms";
import Link from "next/link";

function text(page: CmsPage, role: string): string {
  return String(commentCaMarcheRole(page, role)?.content.text ?? "");
}

export function CommentCaMarcheCmsLayout({ page }: { page: CmsPage }) {
  const title = text(page, "mainTitle").split("\n");
  const cta = commentCaMarcheRole(page, "finalCta");

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-center text-[11px] tracking-[0.3em] text-gold uppercase">{text(page, "kicker")}</p>
      <h1 className="mt-3 text-center font-display text-5xl text-ink">
        {title.map((line, index) => <span key={index}>{index > 0 && <br />}{line}</span>)}
      </h1>

      <div className="mt-14 space-y-6">
        {COMMENT_CA_MARCHE_STEP_ROLES.map(({ number, numberRole, titleRole, bodyRole }) => (
          <div key={number} className="grid gap-4 rounded-2xl border border-line bg-surface/50 p-6 sm:grid-cols-[80px_1fr] sm:p-8">
            <p className="font-display text-5xl text-gold/40">{text(page, numberRole)}</p>
            <div>
              <h2 className="text-lg font-medium text-ink">{text(page, titleRole)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text(page, bodyRole)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-2xl border border-line bg-surface/50 p-8">
        <h2 className="text-[11px] tracking-[0.24em] text-gold uppercase">{text(page, "technicalTitle")}</h2>
        <p className="mt-4 text-center font-mono text-xs leading-relaxed text-muted sm:text-sm">
          {text(page, "technicalPrimary")}
        </p>
        <p className="mt-4 text-center text-xs leading-relaxed text-faint">
          {text(page, "technicalSecondary")}
        </p>
      </div>

      <div className="mt-12 text-center">
        <Link
          href={String(cta?.content.href ?? "/create")}
          className="inline-block rounded-full bg-gold px-10 py-4 text-sm font-medium tracking-[0.18em] text-night uppercase transition-all hover:bg-goldsoft"
        >
          {String(cta?.content.text ?? "")}
        </Link>
      </div>
    </div>
  );
}
