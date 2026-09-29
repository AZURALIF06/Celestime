import type { CmsPage } from "@/lib/cms";
import { LegalShell } from "@/app/legal/sections";
import { livraisonRole, LIVRAISON_CONTENT_ROLES } from "@/lib/livraison-cms";

function text(page: CmsPage, role: string): string {
  return String(livraisonRole(page, role)?.content.text ?? "");
}

/** Keep the shared legal shell and semantic heading/paragraph markup used by the original page. */
export function LivraisonCmsContent({ page }: { page: CmsPage }) {
  const contact = livraisonRole(page, "legalContact");
  return (
    <LegalShell
      title={text(page, "legalTitle")}
      updated={text(page, "updatedValue")}
      eyebrow={text(page, "legalEyebrow")}
      updatedLabel={text(page, "updatedLabel")}
      contactText={text(page, "legalContact")}
      contactHref={String(contact?.link ?? "/contact")}
    >
      {LIVRAISON_CONTENT_ROLES.flatMap(({ headingRole, bodyRole }, index) => [
        <h2 key={`heading-${index}`}>{text(page, headingRole)}</h2>,
        <p key={`body-${index}`}>{text(page, bodyRole)}</p>,
      ])}
    </LegalShell>
  );
}
