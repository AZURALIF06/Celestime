// Célestime — upload direct d'image produit depuis la fiche admin.
//
// Les octets sont insérés dans la table `media` EXISTANTE (colonne bytea
// `media.data`, storage "db") puis servis publiquement par /api/media/<id>.
// Aucun filesystem, aucun stockage objet externe (Vercel Blob…), aucune API
// externe, aucune migration ni changement de schéma.
//
//   POST /api/admin/products/upload-image
//   multipart/form-data — champ : file (un seul fichier par requête)
//
//   201 → { id, url: "/api/media/<id>", name, size, mimeType, width, height }
//   401 → admin non authentifié
//   400 → fichier absent, ou contenu qui n'est pas une véritable image
//         JPG/JPEG/PNG/WebP (type MIME vérifié sur les octets, pas sur
//         l'extension : un .txt renommé .jpg est refusé)
//   413 → plus de 4 Mo

import { db } from "@/db";
import { media } from "@/db/schema";
import { audit } from "@/lib/auth";
import { guard, jsonError } from "@/lib/admin-guard";
import {
  MEDIA_MAX_SIZE,
  MEDIA_MAX_SIZE_LABEL,
  MEDIA_MIGRATION_FILE,
  getFileExtension,
  isMissingSchemaError,
  mediaUrlFor,
  pgErrorCode,
  readImageSize,
  sanitizeName,
  sniffMimeType,
} from "@/lib/media";

export const runtime = "nodejs";

// Formats autorisés pour les visuels produits (plus restrictif que la
// médiathèque générale, qui accepte aussi SVG/GIF/AVIF — pas ici).
const ALLOWED_EXT: readonly string[] = ["jpg", "jpeg", "png", "webp"];
const ALLOWED_MIME: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(req: Request) {
  const g = await guard();
  if (g.denied) return g.denied; // 401

  const form = await req.formData().catch(() => null);
  if (!form) {
    // Body illisible : le plus souvent la requête a été tronquée par une
    // limite de taille (proxy/plateforme) avant d'atteindre le handler.
    return jsonError(
      `Requête d'upload illisible — fichier trop volumineux ? Limite : ${MEDIA_MAX_SIZE_LABEL} par fichier.`,
      413
    );
  }

  const entry = form.get("file");
  if (!entry || typeof (entry as File).arrayBuffer !== "function") {
    return jsonError(
      `Fichier requis (champ "file") — formats JPG, JPEG, PNG ou WebP, ${MEDIA_MAX_SIZE_LABEL} maximum.`
    );
  }
  const file = entry as File;

  // Taille déclarée par le client : refus immédiat sans lire les octets.
  if (file.size > MEDIA_MAX_SIZE) {
    return jsonError(
      `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo) — ${MEDIA_MAX_SIZE_LABEL} maximum par image.`,
      413
    );
  }

  const ext = getFileExtension(file.name || "");
  if (!ALLOWED_EXT.includes(ext)) {
    return jsonError(
      `Format « .${ext || "?"} » non autorisé. Formats acceptés : JPG, JPEG, PNG, WebP.`
    );
  }

  const data = Buffer.from(await file.arrayBuffer());

  // Taille réelle des octets reçus (au cas où la taille déclarée ment).
  if (data.length === 0) {
    return jsonError("Le fichier est vide : aucun octet reçu.");
  }
  if (data.length > MEDIA_MAX_SIZE) {
    return jsonError(
      `Fichier trop volumineux (${(data.length / 1024 / 1024).toFixed(1)} Mo) — ${MEDIA_MAX_SIZE_LABEL} maximum par image.`,
      413
    );
  }

  // Vrai type MIME lu dans les octets du fichier — jamais dans l'extension
  // ni dans l'en-tête Content-Type déclaré par le client.
  const mimeType = sniffMimeType(data);
  if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
    return jsonError(
      "Le contenu du fichier n'est pas une véritable image JPG, PNG ou WebP. L'extension seule ne suffit pas : le fichier a été refusé."
    );
  }

  const id = crypto.randomUUID();
  const baseName =
    sanitizeName((file.name || "image").replace(/\.[^.]+$/, ""))
      .replace(/-+$/g, "")
      .slice(0, 120) || "image";
  const path = mediaUrlFor(id); // "/api/media/<id>"
  const size = readImageSize(data);

  try {
    const [row] = await db
      .insert(media)
      .values({
        id,
        name: baseName,
        path,
        url: null,
        size: data.length,
        kind: ext,
        mimeType,
        width: size?.width ?? null,
        height: size?.height ?? null,
        storage: "db",
        data,
      })
      .returning();

    await audit(g.email!, "product.image.upload", row.path);

    return Response.json(
      {
        id: row.id,
        url: row.path, // "/api/media/<id>"
        name: row.name,
        size: row.size,
        mimeType: row.mimeType,
        width: row.width,
        height: row.height,
      },
      { status: 201 }
    );
  } catch (err) {
    const code = pgErrorCode(err);
    console.error(
      "[product image upload] failed",
      err instanceof Error ? err.message : String(err),
      code ? `SQLSTATE ${code}` : ""
    );
    if (isMissingSchemaError(err)) {
      return jsonError(
        `Upload impossible : la colonne "media.data" est absente de la base. Appliquez ${MEDIA_MIGRATION_FILE} puis réessayez.`,
        503
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(
      `Échec de l'enregistrement de ${file.name} : ${msg}${code ? ` (SQLSTATE ${code})` : ""}`
    );
  }
}
