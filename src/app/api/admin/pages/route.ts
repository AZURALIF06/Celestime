import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pageTemplates, pageVersions, pages } from "@/db/schema";
import { guard, jsonError } from "@/lib/admin-guard";
import { audit } from "@/lib/auth";
import { areValidNewCmsVisualBlocks, emptyPage, hasCmsStructuralNodes, isValidGenericCmsPage, type CmsPage } from "@/lib/cms";
import { createBoutiqueCmsPage, hasBoutiqueProductBlocks, hasBoutiqueUnsafeNavigation, isValidBoutiqueCmsPage } from "@/lib/boutique-cms";
import { createFaqCmsPage, isValidFaqCmsPage } from "@/lib/faq-cms";
import { createCommentCaMarcheCmsPage, isValidCommentCaMarcheCmsPage } from "@/lib/comment-ca-marche-cms";
import { createLivraisonCmsPage, isValidLivraisonCmsPage } from "@/lib/livraison-cms";
import { createHomeCmsPage, isValidHomeCmsPage } from "@/lib/home-content";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied;
  const idParam = new URL(req.url).searchParams.get("id");
  if (idParam) {
    const row = (await db.select().from(pages).where(eq(pages.id, idParam)))[0];
    if (!row) return Response.json({ error: "Page introuvable." }, { status: 404 });
    return Response.json({ page: { ...row, draft: row.draft, published: row.published }, status: row.status });
  }
  const rows = await db.select().from(pages).orderBy(desc(pages.updatedAt));
  return Response.json({
    pages: rows.map((r) => ({
      id: r.id, slug: r.slug, name: r.name, status: r.status, updatedAt: r.updatedAt, seo: r.seo,
    })),
    templates: (await db.select().from(pageTemplates)).map((t) => ({ id: t.id, name: t.name, description: t.description })),
  });
}

const SPECIAL_CMS_SLUGS = new Set(["accueil", "boutique", "faq", "livraison", "comment-ca-marche"]);

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Requête invalide.");
  }

  switch (body.action) {
    case "connectFaq": {
      const existing = (await db.select().from(pages).where(eq(pages.slug, "faq")))[0];
      if (existing) return Response.json({ id: existing.id, slug: existing.slug, existing: true });

      const id = crypto.randomUUID();
      await db.insert(pages).values({
        id,
        slug: "faq",
        name: "FAQ",
        status: "draft",
        draft: createFaqCmsPage(),
        published: null,
        seo: {
          title: "FAQ",
          description: "Questions fréquentes Célestime.",
          noindex: true,
        },
      });
      await audit(g.email!, "page.connect_faq", "faq");
      return Response.json({ id, slug: "faq", existing: false }, { status: 201 });
    }
    case "connectBoutique": {
      const existing = (await db.select().from(pages).where(eq(pages.slug, "boutique")))[0];
      if (existing) return Response.json({ id: existing.id, slug: existing.slug, existing: true });

      const id = crypto.randomUUID();
      await db.insert(pages).values({
        id,
        slug: "boutique",
        name: "Boutique",
        status: "draft",
        draft: createBoutiqueCmsPage(),
        published: null,
        seo: {
          title: "Boutique",
          description: "Éléments éditoriaux de la boutique Célestime.",
          noindex: true,
        },
      });
      await audit(g.email!, "page.connect_boutique", "boutique");
      return Response.json({ id, slug: "boutique", existing: false }, { status: 201 });
    }
    case "connectCommentCaMarche": {
      const existing = (await db.select().from(pages).where(eq(pages.slug, "comment-ca-marche")))[0];
      if (existing) return Response.json({ id: existing.id, slug: existing.slug, existing: true });

      const id = crypto.randomUUID();
      await db.insert(pages).values({
        id,
        slug: "comment-ca-marche",
        name: "Comment ça marche",
        status: "draft",
        draft: createCommentCaMarcheCmsPage(),
        published: null,
        seo: {
          title: "Comment ça marche",
          description: "Éléments éditoriaux de la page Comment ça marche.",
          noindex: true,
        },
      });
      await audit(g.email!, "page.connect_comment_ca_marche", "comment-ca-marche");
      return Response.json({ id, slug: "comment-ca-marche", existing: false }, { status: 201 });
    }
    case "connectLivraison": {
      const existing = (await db.select().from(pages).where(eq(pages.slug, "livraison")))[0];
      if (existing) return Response.json({ id: existing.id, slug: existing.slug, existing: true });

      const id = crypto.randomUUID();
      await db.insert(pages).values({
        id,
        slug: "livraison",
        name: "Livraison",
        status: "draft",
        draft: createLivraisonCmsPage(),
        published: null,
        seo: {
          title: "Livraison",
          description: "Délais, tarifs et modalités de livraison des cartes du ciel Célestime.",
          noindex: true,
        },
      });
      await audit(g.email!, "page.connect_livraison", "livraison");
      return Response.json({ id, slug: "livraison", existing: false }, { status: 201 });
    }
    case "connectHome": {
      const existing = (await db.select().from(pages).where(eq(pages.slug, "accueil")))[0];
      if (existing) return Response.json({ id: existing.id, slug: existing.slug, existing: true });

      const id = crypto.randomUUID();
      await db.insert(pages).values({
        id,
        slug: "accueil",
        name: "Accueil",
        status: "draft",
        draft: createHomeCmsPage(),
        published: null,
        seo: { title: "Célestime — Cartes du ciel personnalisées", description: "", noindex: true },
      });
      await audit(g.email!, "page.connect_home", "accueil");
      return Response.json({ id, slug: "accueil", existing: false }, { status: 201 });
    }
    case "create": {
      if (!body.name || typeof body.name !== "string") return jsonError("Le nom de la page est requis.");
      let slug = slugify(body.slug || body.name);
      if (!slug) return jsonError("URL invalide.");
      if (slug === "accueil") return jsonError("L’URL de la page d’accueil est réservée.");
      if (slug === "boutique") return jsonError("L’URL Boutique est réservée ; utilisez l’action de connexion Boutique au CMS.");
      const existing = await db.select().from(pages).where(eq(pages.slug, slug));
      if (existing.length > 0) {
        let i = 2;
        while ((await db.select().from(pages).where(eq(pages.slug, `${slug}-${i}`))).length > 0) i++;
        slug = `${slug}-${i}`;
      }
      let data: CmsPage;
      if (body.templateId) {
        const t = (await db.select().from(pageTemplates).where(eq(pageTemplates.id, body.templateId)))[0];
        if (t && hasCmsStructuralNodes(t.data) && !isValidGenericCmsPage(t.data)) return jsonError("Ce modèle contient un container invalide et ne peut pas être utilisé.");
        data = t ? (t.data as CmsPage) : emptyPage();
      } else {
        data = emptyPage();
      }
      const id = crypto.randomUUID();
      await db.insert(pages).values({ id, slug, name: body.name.trim(), status: "draft", draft: data, seo: { title: body.name, description: "", noindex: true } });
      await audit(g.email!, "page.create", slug);
      return Response.json({ id, slug }, { status: 201 });
    }
    case "update": {
      const row = (await db.select().from(pages).where(eq(pages.id, body.id)))[0];
      if (!row) return jsonError("Page introuvable.", 404);
      if (body.data !== undefined && !areValidNewCmsVisualBlocks(body.data)) {
        return jsonError("Les réglages d’un nouveau bloc visuel sont invalides ; vérifiez ses médias et ses propriétés.");
      }
      if (body.data !== undefined && SPECIAL_CMS_SLUGS.has(row.slug) && hasCmsStructuralNodes(body.data)) {
        return jsonError("Les conteneurs de la Phase 3A sont réservés aux pages génériques.");
      }
      if (!SPECIAL_CMS_SLUGS.has(row.slug) && body.data !== undefined && hasCmsStructuralNodes(body.data) && !isValidGenericCmsPage(body.data)) {
        return jsonError("Container ou contenu enfant invalide : vérifiez la structure, les blocs, les liens et les médias avant l’enregistrement.");
      }
      if (!SPECIAL_CMS_SLUGS.has(row.slug) && body.publish === true && !isValidGenericCmsPage(body.data ?? row.draft)) {
        return jsonError("Contenu de page générique invalide : vérifiez les sections, les blocs, les liens et les médias avant publication.");
      }
      if (row.slug === "accueil") {
        if (body.slug && slugify(body.slug) !== "accueil") return jsonError("L’URL de la page d’accueil est réservée.");
        if (body.publish === true && !isValidHomeCmsPage(body.data ?? row.draft)) {
          return jsonError("Le contenu éditorial de l’accueil est incomplet ou invalide ; la publication a été refusée.");
        }
      }
      if (row.slug === "faq") {
        if (body.slug && slugify(body.slug) !== "faq") return jsonError("L’URL de la page FAQ est réservée.");
        if (body.publish === true && !isValidFaqCmsPage(body.data ?? row.draft)) {
          return jsonError("Le contenu FAQ est incomplet ou invalide ; vérifiez les questions, réponses et le lien de contact avant publication.");
        }
      }
      if (row.slug === "livraison") {
        if (body.slug && slugify(body.slug) !== "livraison") return jsonError("L’URL de la page Livraison est réservée.");
        if (body.publish === true && !isValidLivraisonCmsPage(body.data ?? row.draft)) {
          return jsonError("Le contenu Livraison est incomplet ou invalide ; la publication a été refusée.");
        }
      }
      if (row.slug === "comment-ca-marche") {
        if (body.slug && slugify(body.slug) !== "comment-ca-marche") return jsonError("L’URL de la page Comment ça marche est réservée.");
        if (body.publish === true && !isValidCommentCaMarcheCmsPage(body.data ?? row.draft)) {
          return jsonError("Le contenu Comment ça marche est incomplet ou invalide ; la publication a été refusée.");
        }
      }
      if (row.slug === "boutique") {
        if (body.slug && slugify(body.slug) !== "boutique") return jsonError("L’URL de la page Boutique est réservée.");
        if (hasBoutiqueProductBlocks(body.data ?? row.draft)) {
          return jsonError("Le catalogue produit reste applicatif et ne peut pas être enregistré dans le CMS Boutique.");
        }
        if (hasBoutiqueUnsafeNavigation(body.data ?? row.draft)) {
          return jsonError("Seul le bouton CTA Boutique peut naviguer, et sa destination est verrouillée sur /create.");
        }
        if (body.publish === true && !isValidBoutiqueCmsPage(body.data ?? row.draft)) {
          return jsonError("Le contenu éditorial Boutique est incomplet ou invalide ; la publication a été refusée.");
        }
      }
      const patch: any = { updatedAt: new Date() };
      if (body.data) patch.draft = body.data;
      if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
      if (body.seo) patch.seo = body.seo;
      if (body.slug) {
        const slug = slugify(body.slug);
        if (slug === "accueil" && row.slug !== "accueil") return jsonError("L’URL de la page d’accueil est réservée.");
        if (slug === "boutique" && row.slug !== "boutique") return jsonError("L’URL Boutique est réservée ; utilisez l’action de connexion Boutique au CMS.");
        const taken = (await db.select().from(pages).where(eq(pages.slug, slug)))[0];
        if (taken && taken.id !== row.id) return jsonError("Cette URL est déjà utilisée.");
        patch.slug = slug;
      }
      if (body.publish === true) {
        const current = body.data ?? row.draft;
        patch.published = current;
        patch.status = "published";
        await db.insert(pageVersions).values({ pageId: row.id, label: "Publication", data: current });
        await audit(g.email!, "page.publish", row.slug);
      }
      if (body.publish === false && row.status === "published") {
        patch.status = "draft";
        await audit(g.email!, "page.unpublish", row.slug);
      }
      if (body.saveVersion && body.publish !== true) {
        const versionData = body.data ?? row.draft;
        if (!SPECIAL_CMS_SLUGS.has(row.slug) && hasCmsStructuralNodes(versionData) && !isValidGenericCmsPage(versionData)) {
          return jsonError("Le container ou son contenu est invalide et ne peut pas être enregistré comme version.");
        }
        await db.insert(pageVersions).values({ pageId: row.id, label: body.saveVersion || "Version manuelle", data: versionData });
      }
      await db.update(pages).set(patch).where(eq(pages.id, row.id));
      return Response.json({ ok: true, slug: patch.slug ?? row.slug });
    }
    case "duplicate": {
      const row = (await db.select().from(pages).where(eq(pages.id, body.id)))[0];
      if (!row) return jsonError("Page introuvable.", 404);
      if (hasCmsStructuralNodes(row.draft) && (SPECIAL_CMS_SLUGS.has(row.slug) || !isValidGenericCmsPage(row.draft))) return jsonError("La structure du brouillon ne peut pas être dupliquée car elle est invalide pour cette page.");
      const id = crypto.randomUUID();
      const slug = `${row.slug}-copie`;
      await db.insert(pages).values({
        id, slug, name: `${row.name} (copie)`, status: "draft", draft: row.draft, published: null, seo: row.seo,
      });
      return Response.json({ id, slug }, { status: 201 });
    }
    case "delete": {
      const row = (await db.select().from(pages).where(eq(pages.id, body.id)))[0];
      if (!row) return jsonError("Page introuvable.", 404);
      await db.delete(pages).where(eq(pages.id, row.id));
      await audit(g.email!, "page.delete", row.slug);
      return Response.json({ ok: true });
    }
    case "versions": {
      const rows = (await db.select().from(pageVersions).where(eq(pageVersions.pageId, body.id))).sort((a, b) => +b.createdAt - +a.createdAt);
      return Response.json({ versions: rows.map((r) => ({ id: r.id, label: r.label, createdAt: r.createdAt })) });
    }
    case "restore": {
      const v = (await db.select().from(pageVersions).where(eq(pageVersions.id, body.versionId)))[0];
      if (!v) return jsonError("Version introuvable.", 404);
      const owner = (await db.select().from(pages).where(eq(pages.id, v.pageId)))[0];
      if (owner && SPECIAL_CMS_SLUGS.has(owner.slug) && hasCmsStructuralNodes(v.data)) {
        return jsonError("Les conteneurs de la Phase 3A ne peuvent pas être restaurés sur une page spécialisée.");
      }
      if (owner && !SPECIAL_CMS_SLUGS.has(owner.slug) && !isValidGenericCmsPage(v.data)) {
        return jsonError("Cette version contient une page générique invalide et ne peut pas être restaurée.");
      }
      if (owner?.slug === "boutique" && hasBoutiqueProductBlocks(v.data)) {
        return jsonError("Cette version contient des blocs catalogue interdits sur la page Boutique.");
      }
      if (owner?.slug === "boutique" && hasBoutiqueUnsafeNavigation(v.data)) {
        return jsonError("Cette version contient un lien Boutique non autorisé ; seul le CTA /create est permis.");
      }
      await db.update(pages).set({ draft: v.data, updatedAt: new Date() }).where(eq(pages.id, v.pageId));
      await audit(g.email!, "page.restore", String(v.pageId));
      return Response.json({ ok: true, data: v.data });
    }
    case "saveTemplate": {
      const row = (await db.select().from(pages).where(eq(pages.id, body.id)))[0];
      if (!row) return jsonError("Page introuvable.", 404);
      if (SPECIAL_CMS_SLUGS.has(row.slug) && hasCmsStructuralNodes(row.draft)) return jsonError("Les conteneurs de la Phase 3A ne sont pas disponibles sur les pages spécialisées.");
      if (!SPECIAL_CMS_SLUGS.has(row.slug) && hasCmsStructuralNodes(row.draft) && !isValidGenericCmsPage(row.draft)) return jsonError("Le container ou son contenu est invalide et ne peut pas être enregistré dans un modèle.");
      if (row.slug === "boutique" && hasBoutiqueProductBlocks(row.draft)) {
        return jsonError("Le modèle Boutique ne peut pas contenir de blocs catalogue.");
      }
      if (row.slug === "boutique" && hasBoutiqueUnsafeNavigation(row.draft)) {
        return jsonError("Le modèle Boutique ne peut contenir que le CTA verrouillé sur /create, sans lien CMS libre.");
      }
      const id = await db.insert(pageTemplates).values({
        name: body.name || `Modèle ${row.name}`,
        description: body.description || `Créé à partir de « ${row.name} »`,
        data: row.draft,
      }).returning();
      return Response.json({ id: id[0].id }, { status: 201 });
    }
    case "deleteTemplate": {
      await db.delete(pageTemplates).where(eq(pageTemplates.id, body.id));
      return Response.json({ ok: true });
    }
    default:
      return jsonError("Action inconnue.");
  }
}
