// Célestime — helper Vercel Blob avec fallback local pour dev
// Utilise @vercel/blob en production (BLOB_READ_WRITE_TOKEN requis)
// En dev sans token, fallback vers public/media (ou /tmp) pour ne pas bloquer

import { promises as fs } from "fs";
import path from "path";

const OK_EXT = ["jpg", "jpeg", "png", "webp", "svg", "gif", "avif"];
const OK_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  avif: "image/avif",
};

export function isBlobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function getBlobDiagnostics() {
  return {
    hasToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN ? process.env.BLOB_READ_WRITE_TOKEN.slice(0, 8) + "..." : null,
    isVercel: Boolean(process.env.VERCEL),
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
  };
}

export function getFileExtension(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase();
}

export function isAllowedExtension(ext: string): boolean {
  return OK_EXT.includes(ext);
}

export function mimeFromExt(ext: string): string {
  return OK_MIME[ext] ?? "application/octet-stream";
}

export function sanitizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

// Upload vers Vercel Blob
export async function uploadToBlob(
  file: File | { name: string; type?: string; arrayBuffer: () => Promise<ArrayBuffer>; size: number },
  id: string
): Promise<{ url: string; pathname: string; contentType: string }> {
  if (!isBlobEnabled()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN absent. Créez un Blob Store dans Vercel Dashboard > Storage > Blob > Create Store > Connect to project Celestime, puis redeployez."
    );
  }

  const ext = getFileExtension(file.name);
  const safeExt = ext === "jpeg" ? "jpg" : ext;
  const pathname = `celestime/${id}.${safeExt}`;

  // dynamic import pour éviter erreur si package absent en dev
  let put: any;
  try {
    const mod = await import("@vercel/blob");
    put = mod.put;
  } catch (e: any) {
    throw new Error(`Package @vercel/blob non disponible: ${e?.message ?? e}`);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const contentType = (file as any).type || mimeFromExt(safeExt);

  try {
    const result = await put(pathname, buf, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return { url: result.url, pathname: result.pathname ?? pathname, contentType };
  } catch (e: any) {
    // Erreurs typiques Vercel Blob
    const msg = e?.message ?? String(e);
    if (msg.includes("token") || msg.includes("BLOB_READ_WRITE_TOKEN") || msg.includes("No token")) {
      throw new Error(
        `Vercel Blob : token manquant ou invalide. Vérifiez que le Blob Store est connecté au projet Celestime dans Vercel Dashboard. Erreur d'origine: ${msg}`
      );
    }
    throw new Error(`Vercel Blob put() échoué: ${msg}`);
  }
}

// Suppression Blob
export async function deleteFromBlob(urlOrPath: string): Promise<void> {
  if (!isBlobEnabled()) return;
  if (!urlOrPath) return;
  // Ne supprimer que si c'est une URL blob
  const isBlobUrl =
    urlOrPath.includes("blob.vercel-storage.com") ||
    urlOrPath.includes("public.blob.vercel-storage") ||
    urlOrPath.startsWith("celestime/");

  if (!isBlobUrl) return;

  try {
    const { del } = await import("@vercel/blob");
    await del(urlOrPath);
  } catch (e) {
    console.warn("[blob] delete failed", urlOrPath, e);
    // ne pas throw, on continue suppression DB
  }
}

// Fallback local (dev uniquement)
export async function uploadToLocal(
  file: File | { name: string; arrayBuffer: () => Promise<ArrayBuffer>; size: number },
  id: string
): Promise<{ url: string; path: string }> {
  // En production Vercel, le filesystem est read-only sauf /tmp
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  if (isProd && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Upload impossible en production sans Vercel Blob. BLOB_READ_WRITE_TOKEN absent. Créez un Blob Store dans Vercel Dashboard > Storage > Blob Store."
    );
  }

  const ext = getFileExtension(file.name);
  const safeExt = ext === "jpeg" ? "jpg" : ext;
  const fname = `${id}.${safeExt}`;
  const dir = path.join(process.cwd(), "public", "media");
  await fs.mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, fname), buf);
  const publicPath = `/media/${fname}`;
  return { url: publicPath, path: publicPath };
}

export async function deleteFromLocal(filePath: string): Promise<void> {
  if (!filePath) return;
  // sécurité: seulement /media/ ou /tmp
  if (!filePath.startsWith("/media/")) return;
  try {
    await fs.unlink(path.join(process.cwd(), "public", filePath));
  } catch {}
}

// Helper: obtient l'URL d'affichage depuis une ligne media DB (compat ancien/nouveau)
export function resolveMediaUrl(row: { url?: string | null; path: string }): string {
  // priorité à url (blob), sinon path (legacy)
  if (row.url && row.url.startsWith("http")) return row.url;
  if (row.path && row.path.startsWith("http")) return row.path;
  return row.path; // /media/... ou /images/...
}

// Helper: vérifie si un chemin est une image blob
export function isBlobUrl(u: string): boolean {
  if (!u) return false;
  return u.startsWith("https://") && (u.includes("blob.vercel-storage") || u.includes("vercel-storage.com"));
}
