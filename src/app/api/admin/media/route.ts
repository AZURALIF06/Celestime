// Célestime — médiathèque : upload Vercel Blob persistant + fallback local dev
// Compatible Vercel : pas de fs en prod, utilisation @vercel/blob
// Auth via guard()

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { media, pages, products } from "@/db/schema";
import { audit } from "@/lib/auth";
import { guard, jsonError } from "@/lib/admin-guard";
import {
  isBlobEnabled,
  getBlobDiagnostics,
  uploadToBlob,
  deleteFromBlob,
  uploadToLocal,
  deleteFromLocal,
  resolveMediaUrl,
  getFileExtension,
  isAllowedExtension,
} from "@/lib/blob";

export const runtime = "nodejs";
const OK = ["jpg", "jpeg", "png", "webp", "svg", "gif", "avif"];
const MAX_SIZE = 8 * 1024 * 1024; // 8 Mo

export async function GET() {
  const g = await guard();
  if (g.denied) return g.denied;

  let rows: any[] = [];
  let dbError: string | null = null;
  let dbHasNewColumns = true;

  try {
    rows = await db.select().from(media).orderBy(desc(media.createdAt));
  } catch (e: any) {
    dbError = e?.message ?? String(e);
    console.warn("[media] select failed, fallback", e?.message);
    // Si colonnes url/storage manquent encore en prod (migration non appliquée), fallback requête brute
    if (dbError && (dbError.includes("column") || dbError.includes("does not exist") || dbError.includes("url") || dbError.includes("storage"))) {
      dbHasNewColumns = false;
    }
    try {
      // @ts-ignore
      const { pool } = await import("@/db");
      const res = await pool.query(`SELECT id, name, path, size, kind, created_at FROM media ORDER BY created_at DESC`);
      rows = res.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        path: r.path,
        url: r.path?.startsWith("http") ? r.path : null,
        size: r.size,
        kind: r.kind,
        createdAt: r.created_at,
        storage: r.path?.startsWith("http") ? "blob" : "local",
        mimeType: null,
      }));
    } catch (e2: any) {
      dbError = `${dbError} | fallback failed: ${e2?.message}`;
      rows = [];
    }
  }

  // Où est utilisée chaque image (pages + produits)
  let allPages: any[] = [];
  let allProducts: any[] = [];
  try {
    allPages = await db.select().from(pages);
    allProducts = await db.select().from(products);
  } catch {}

  const usage: Record<string, string[]> = {};
  for (const p of allPages) {
    const json = JSON.stringify([p.draft, p.published]).toLowerCase();
    for (const m of rows) {
      const checkUrls = [m.path, m.url].filter(Boolean).map((u: string) => u.toLowerCase());
      if (checkUrls.some((u) => json.includes(u))) {
        const key = m.url ?? m.path;
        (usage[key] ??= []).push(`Page ${p.name}`);
        if (m.path !== key) (usage[m.path] ??= []).push(`Page ${p.name}`);
      }
    }
  }
  for (const p of allProducts) {
    const imgs = (p.images as unknown as string[] | null) ?? [];
    for (const m of rows) {
      const urls = [m.path, m.url].filter(Boolean);
      for (const u of urls) {
        if (imgs.includes(u) || imgs.includes(m.path)) {
          (usage[u] ??= []).push(`Produit ${p.name}`);
          if (m.path) (usage[m.path] ??= []).push(`Produit ${p.name}`);
        }
      }
    }
  }

  // Normalise les lignes pour le front
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    path: r.path,
    url: r.url ?? (r.path?.startsWith("http") ? r.path : null),
    displayUrl: resolveMediaUrl(r),
    size: r.size,
    kind: r.kind,
    mimeType: r.mimeType ?? r.mime_type ?? null,
    storage: r.storage ?? (r.path?.startsWith("http") ? "blob" : "local"),
    createdAt: r.createdAt ?? r.created_at,
  }));

  const diag = getBlobDiagnostics();

  return Response.json({
    items,
    usage,
    blobEnabled: isBlobEnabled(),
    diagnostics: {
      ...diag,
      dbHasNewColumns,
      dbError,
      mediaCount: items.length,
    },
  });
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied;

  const ctype = req.headers.get("content-type") ?? "";

  if (ctype.includes("application/json")) {
    let j: any;
    try {
      j = await req.json();
    } catch {
      return jsonError("Requête invalide.");
    }

    if (j?.action === "rename") {
      if (!j.id || !j.name) return jsonError("Nom requis.");
      try {
        await db.update(media).set({ name: String(j.name).slice(0, 200) }).where(eq(media.id, j.id));
      } catch (e: any) {
        // fallback si colonne manquante
        if (e?.message?.includes("column")) {
          // @ts-ignore
          const { pool } = await import("@/db");
          await pool.query(`UPDATE media SET name=$1 WHERE id=$2`, [String(j.name).slice(0, 200), j.id]);
        } else {
          return jsonError(`Erreur DB renommage: ${e?.message ?? e}`);
        }
      }
      return Response.json({ ok: true });
    }

    if (j?.action === "delete") {
      if (!j.id) return jsonError("ID requis.");
      let row: any = null;
      try {
        const all = await db.select().from(media);
        row = all.find((m: any) => m.id === j.id);
      } catch {
        try {
          const { pool } = await import("@/db");
          const res = await pool.query(`SELECT * FROM media WHERE id=$1`, [j.id]);
          row = res.rows[0];
        } catch {}
      }

      if (row) {
        const urlToDelete = row.url ?? row.path;
        if (urlToDelete?.startsWith("http")) {
          await deleteFromBlob(urlToDelete);
        } else {
          await deleteFromLocal(row.path);
        }
      }

      try {
        await db.delete(media).where(eq(media.id, j.id));
      } catch (e: any) {
        if (e?.message?.includes("column") || e?.message?.includes("does not exist")) {
          const { pool } = await import("@/db");
          await pool.query(`DELETE FROM media WHERE id=$1`, [j.id]);
        } else {
          return jsonError(`Erreur DB suppression: ${e?.message ?? e}`);
        }
      }

      await audit(g.email!, "media.delete", j.id);
      return Response.json({ ok: true });
    }

    if (j?.action === "check") {
      // Endpoint diagnostic pour admin
      const diag = getBlobDiagnostics();
      let dbCheck: any = { ok: true };
      try {
        const test = await db.select().from(media).limit(1);
        dbCheck = { ok: true, hasNewColumns: true, count: test.length };
      } catch (e: any) {
        dbCheck = { ok: false, error: e?.message, hasNewColumns: false };
      }
      return Response.json({ blob: diag, db: dbCheck });
    }

    return jsonError("Action inconnue.");
  }

  // Upload multipart/form-data (un ou plusieurs fichiers)
  const form = await req.formData().catch(() => null);
  if (!form) return jsonError("Formulaire invalide.");

  const files = form.getAll("file") as File[];
  const single = form.get("file") as File | null;
  const list = files.length > 0 ? files : single ? [single] : [];

  if (list.length === 0) return jsonError("Fichier requis (JPG, PNG, WEBP, SVG, GIF, AVIF).");

  const uploaded: any[] = [];
  const blobEnabled = isBlobEnabled();
  const isProd = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

  // En production, on exige Blob
  if (isProd && !blobEnabled) {
    return jsonError(
      "Upload impossible : BLOB_READ_WRITE_TOKEN absent. En production Vercel, le stockage local est en lecture seule. Créez un Blob Store dans Vercel Dashboard > Storage > Blob Store > Create Store > Connect to project Celestime, puis redeployez. Voir https://vercel.com/docs/storage/vercel-blob"
    );
  }

  for (const file of list) {
    if (typeof (file as any).arrayBuffer !== "function") continue;
    const ext = getFileExtension(file.name);
    if (!OK.includes(ext) || !isAllowedExtension(ext)) {
      return jsonError(`Format .${ext} non supporté. Autorisés : ${OK.join(", ")}`);
    }
    if (file.size > MAX_SIZE) return jsonError(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo) — 8 Mo max.`);
    // validation mime basique
    if (file.type && !file.type.startsWith("image/") && file.type !== "image/svg+xml") {
      return jsonError("Le fichier doit être une image.");
    }

    const id = crypto.randomUUID();
    const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "image";

    try {
      if (blobEnabled) {
        const { url } = await uploadToBlob(file, id);
        // Insertion DB avec url + path = url pour compat
        const rowData: any = {
          id,
          name: baseName,
          path: url, // compat : path contient l'URL complète
          url,
          size: file.size,
          kind: ext,
          mimeType: (file as any).type || null,
          storage: "blob",
        };
        try {
          const [row] = await db.insert(media).values(rowData).returning();
          uploaded.push({
            id: row.id,
            name: row.name,
            path: row.path,
            url: (row as any).url ?? url,
            displayUrl: url,
            size: row.size,
            kind: row.kind,
            storage: "blob",
            createdAt: row.createdAt,
          });
        } catch (e: any) {
          // fallback si colonnes manquantes (migration non appliquée)
          if (e?.message?.includes("column") || e?.message?.includes("does not exist")) {
            try {
              const { pool } = await import("@/db");
              await pool.query(
                `INSERT INTO media (id, name, path, size, kind) VALUES ($1,$2,$3,$4,$5)`,
                [id, baseName, url, file.size, ext]
              );
              uploaded.push({
                id,
                name: baseName,
                path: url,
                url,
                displayUrl: url,
                size: file.size,
                kind: ext,
                storage: "blob",
                createdAt: new Date().toISOString(),
              });
            } catch (e2: any) {
              return jsonError(`Upload Blob OK mais insertion DB échouée (migration manquante ?): ${e2?.message ?? e2}. URL Blob: ${url}`);
            }
          } else {
            return jsonError(`Insertion DB échouée: ${e?.message ?? e}. URL Blob créée: ${url} mais non enregistrée.`);
          }
        }
        await audit(g.email!, "media.upload.blob", url);
      } else {
        // fallback local dev uniquement (non prod)
        try {
          const { url, path: publicPath } = await uploadToLocal(file, id);
          const rowData: any = {
            id,
            name: baseName,
            path: publicPath,
            url: null,
            size: file.size,
            kind: ext,
            mimeType: (file as any).type || null,
            storage: "local",
          };
          try {
            const [row] = await db.insert(media).values(rowData).returning();
            uploaded.push({
              id: row.id,
              name: row.name,
              path: row.path,
              url: (row as any).url ?? null,
              displayUrl: publicPath,
              size: row.size,
              kind: row.kind,
              storage: "local",
              createdAt: row.createdAt,
            });
          } catch (e: any) {
            if (e?.message?.includes("column")) {
              const { pool } = await import("@/db");
              await pool.query(`INSERT INTO media (id, name, path, size, kind) VALUES ($1,$2,$3,$4,$5)`, [
                id,
                baseName,
                publicPath,
                file.size,
                ext,
              ]);
              uploaded.push({
                id,
                name: baseName,
                path: publicPath,
                url: null,
                displayUrl: publicPath,
                size: file.size,
                kind: ext,
                storage: "local",
                createdAt: new Date().toISOString(),
              });
            } else throw e;
          }
          await audit(g.email!, "media.upload.local", publicPath);
        } catch (e: any) {
          return jsonError(`Upload local échoué (normal en prod Vercel sans Blob): ${e?.message ?? e}`);
        }
      }
    } catch (err: any) {
      console.error("[media upload] failed", err);
      return jsonError(`Échec upload ${file.name} : ${err?.message ?? "erreur inconnue"}`);
    }
  }

  return Response.json({ items: uploaded, ok: true, blobEnabled }, { status: 201 });
}
