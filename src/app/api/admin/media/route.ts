// Célestime — médiathèque : les images sont stockées en PostgreSQL (bytea).
// Aucun stockage objet externe : l'upload écrit directement dans media.data,
// ce qui fonctionne aussi bien en local que sur un runtime au disque read-only.
// Auth via guard()

import { desc, eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { media, pages, products } from "@/db/schema";
import { audit } from "@/lib/auth";
import { guard, jsonError } from "@/lib/admin-guard";
import {
  ALLOWED_EXTENSIONS,
  MEDIA_MIGRATION_FILE,
  effectiveMimeType,
  getFileExtension,
  isAllowedExtension,
  mediaUrlFor,
  probeDataColumn,
  readImageSize,
  resolveMediaUrl,
  sanitizeName,
  sniffMimeType,
} from "@/lib/media";

export const runtime = "nodejs";
const OK = ALLOWED_EXTENSIONS;
const MAX_SIZE = 8 * 1024 * 1024; // 8 Mo

/** Projection de liste : jamais `data`, pour ne pas charger les octets inutilement. */
const LIST_COLUMNS = {
  id: media.id,
  name: media.name,
  path: media.path,
  url: media.url,
  size: media.size,
  kind: media.kind,
  mimeType: media.mimeType,
  width: media.width,
  height: media.height,
  storage: media.storage,
  createdAt: media.createdAt,
};

type MediaListItem = {
  id: string;
  name: string;
  path: string;
  url: string | null;
  size: number;
  kind: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  storage: string;
  createdAt: Date;
};

/** Repli si les colonnes ajoutées par les migrations manquent encore en base. */
async function legacyList(): Promise<MediaListItem[]> {
  const res = await pool.query(
    `SELECT id, name, path, size, kind, created_at FROM media ORDER BY created_at DESC`
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    name: String(r.name),
    path: String(r.path),
    url: null,
    size: Number(r.size ?? 0),
    kind: String(r.kind ?? "image"),
    mimeType: null,
    width: null,
    height: null,
    storage: "local",
    createdAt: r.created_at as Date,
  }));
}

export async function GET() {
  const g = await guard();
  if (g.denied) return g.denied;

  let rows: MediaListItem[] = [];
  let dbError: string | null = null;

  try {
    rows = await db
      .select(LIST_COLUMNS)
      .from(media)
      .orderBy(desc(media.createdAt));
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
    console.warn("[media] select failed, fallback legacy", dbError);
    try {
      rows = await legacyList();
      dbError = null;
    } catch (e2) {
      dbError = `${dbError} | fallback failed: ${e2 instanceof Error ? e2.message : String(e2)}`;
      rows = [];
    }
  }

  const hasDataColumn = await probeDataColumn((sql) => pool.query(sql));

  // Où est utilisée chaque image (pages + produits)
  let allPages: { name: string; draft: unknown; published: unknown }[] = [];
  let allProducts: { name: string; images: unknown }[] = [];
  try {
    allPages = await db
      .select({ name: pages.name, draft: pages.draft, published: pages.published })
      .from(pages);
    allProducts = await db.select({ name: products.name, images: products.images }).from(products);
  } catch {
    /* la détection d'usage est un confort, pas un bloquant */
  }

  const usage: Record<string, string[]> = {};
  const addUsage = (key: string | null | undefined, label: string) => {
    if (!key) return;
    const list = usage[key] ?? (usage[key] = []);
    if (!list.includes(label)) list.push(label);
  };

  for (const p of allPages) {
    const json = JSON.stringify([p.draft, p.published]).toLowerCase();
    for (const m of rows) {
      const needles = [m.path, m.url].filter(Boolean).map((u) => u!.toLowerCase());
      if (needles.some((u) => json.includes(u))) {
        addUsage(m.path, `Page ${p.name}`);
        addUsage(m.url, `Page ${p.name}`);
      }
    }
  }
  for (const p of allProducts) {
    const imgs = (p.images as string[] | null) ?? [];
    for (const m of rows) {
      const candidates = [m.path, m.url].filter(Boolean) as string[];
      if (candidates.some((u) => imgs.includes(u))) {
        addUsage(m.path, `Produit ${p.name}`);
        addUsage(m.url, `Produit ${p.name}`);
      }
    }
  }

  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    path: r.path,
    url: r.url ?? null,
    displayUrl: resolveMediaUrl(r),
    size: r.size,
    kind: r.kind,
    mimeType: r.mimeType,
    width: r.width,
    height: r.height,
    storage: r.storage ?? "db",
    createdAt: r.createdAt,
  }));

  return Response.json({
    items,
    usage,
    // Le stockage est toujours la base : plus de token à provisionner.
    storage: "postgresql",
    dbStorageReady: hasDataColumn,
    diagnostics: {
      storage: "postgresql",
      hasDataColumn,
      dbOk: dbError === null,
      dbError,
      mediaCount: items.length,
      pendingMigration: hasDataColumn ? null : MEDIA_MIGRATION_FILE,
    },
  });
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied;

  const ctype = req.headers.get("content-type") ?? "";

  if (ctype.includes("application/json")) {
    let j: { action?: string; id?: string; name?: string };
    try {
      j = await req.json();
    } catch {
      return jsonError("Requête invalide.");
    }

    if (j?.action === "rename") {
      if (!j.id || !j.name) return jsonError("Nom requis.");
      try {
        await db.update(media).set({ name: String(j.name).slice(0, 200) }).where(eq(media.id, j.id));
        await audit(g.email!, "media.rename", j.id);
      } catch (e) {
        return jsonError(`Erreur DB renommage: ${e instanceof Error ? e.message : String(e)}`);
      }
      return Response.json({ ok: true });
    }

    if (j?.action === "delete") {
      if (!j.id) return jsonError("ID requis.");
      try {
        // Les octets vivent dans la ligne : supprimer la ligne suffit.
        await db.delete(media).where(eq(media.id, j.id));
      } catch (e) {
        return jsonError(`Erreur DB suppression: ${e instanceof Error ? e.message : String(e)}`);
      }
      await audit(g.email!, "media.delete", j.id);
      return Response.json({ ok: true });
    }

    if (j?.action === "check") {
      const hasDataColumn = await probeDataColumn((sql) => pool.query(sql));
      let dbCheck: { ok: boolean; error?: string; count?: number; hasDataColumn: boolean };
      try {
        const test = await db.select({ id: media.id }).from(media).limit(1);
        dbCheck = { ok: true, count: test.length, hasDataColumn };
      } catch (e) {
        dbCheck = { ok: false, error: e instanceof Error ? e.message : String(e), hasDataColumn };
      }
      return Response.json({
        storage: "postgresql",
        db: dbCheck,
        pendingMigration: hasDataColumn ? null : MEDIA_MIGRATION_FILE,
      });
    }

    return jsonError("Action inconnue.");
  }

  // Upload multipart/form-data (un ou plusieurs fichiers)
  const hasDataColumn = await probeDataColumn((sql) => pool.query(sql));
  if (!hasDataColumn) {
    return jsonError(
      `Upload impossible : la colonne "media.data" est absente de la base. Appliquez ${MEDIA_MIGRATION_FILE} puis réessayez.`,
      503
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError("Formulaire invalide.");

  const files = form.getAll("file") as File[];
  const single = form.get("file") as File | null;
  const list = files.length > 0 ? files : single ? [single] : [];

  if (list.length === 0) return jsonError("Fichier requis (JPG, PNG, WEBP, SVG, GIF, AVIF).");

  const uploaded: Record<string, unknown>[] = [];

  for (const file of list) {
    if (typeof file.arrayBuffer !== "function") continue;

    const ext = getFileExtension(file.name);
    if (!isAllowedExtension(ext) || !OK.includes(ext)) {
      return jsonError(`Format .${ext} non supporté. Autorisés : ${OK.join(", ")}`);
    }
    if (file.size > MAX_SIZE) {
      return jsonError(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo) — 8 Mo max.`);
    }
    const id = crypto.randomUUID();
    const baseName =
      sanitizeName(file.name.replace(/\.[^.]+$/, "")).replace(/-+$/g, "").slice(0, 120) || "image";
    const path = mediaUrlFor(id);

    try {
      const data = Buffer.from(await file.arrayBuffer());

      // Contrôle sur les octets réels, pas sur le type déclaré : certains clients
      // annoncent application/octet-stream pour un .webp parfaitement valide.
      if (!sniffMimeType(data) && !(file.type || "").startsWith("image/")) {
        return jsonError("Le contenu du fichier n'est pas une image reconnue.");
      }
      if (data.length > MAX_SIZE) {
        return jsonError(`Fichier trop volumineux (${(data.length / 1024 / 1024).toFixed(1)} Mo) — 8 Mo max.`);
      }

      const size = readImageSize(data);

      const [row] = await db
        .insert(media)
        .values({
          id,
          name: baseName,
          path,
          url: null,
          size: data.length,
          kind: ext,
          // MIME lu dans les octets : plusieurs visuels .jpg sont en réalité des PNG.
          mimeType: effectiveMimeType(data, ext, file.type),
          width: size?.width ?? null,
          height: size?.height ?? null,
          storage: "db",
          data,
        })
        .returning();

      uploaded.push({
        id: row.id,
        name: row.name,
        path: row.path,
        url: null,
        displayUrl: row.path,
        size: row.size,
        kind: row.kind,
        mimeType: row.mimeType,
        width: row.width,
        height: row.height,
        storage: row.storage,
        createdAt: row.createdAt,
      });

      await audit(g.email!, "media.upload.db", row.path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[media upload] failed", msg);
      return jsonError(`Échec upload ${file.name} : ${msg}`);
    }
  }

  return Response.json({ items: uploaded, ok: true, storage: "postgresql" }, { status: 201 });
}
