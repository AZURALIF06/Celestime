// Célestime — médiathèque stockée en PostgreSQL.
//
// Les octets des images vivent dans la colonne `media.data` (bytea) : aucun
// stockage objet externe (Vercel Blob, S3…) n'est nécessaire, et le disque du
// runtime n'est jamais sollicité — ce qui rend l'upload compatible avec un
// filesystem en lecture seule (serverless Vercel).
//
// Ce module est volontairement sans `fs` et sans import réseau : il ne manipule
// que des buffers et des métadonnées.

/** Route publique qui sert les octets depuis la base. */
export const MEDIA_ROUTE = "/api/media";

/**
 * Taille maximale d'un fichier importé : 4 Mo.
 * Volontairement sous les limites de body des proxys serverless (~4,5 Mo) :
 * au-delà, la requête est rejetée avant d'atteindre le handler et l'erreur
 * remonte au client sous forme d'une page HTML non-JSON — d'où des échecs
 * d'upload qui semblaient « silencieux ».
 */
export const MEDIA_MAX_SIZE = 4 * 1024 * 1024;
export const MEDIA_MAX_SIZE_LABEL = "4 Mo";

const OK_EXT = ["jpg", "jpeg", "png", "webp", "svg", "gif", "avif"] as const;

const OK_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  avif: "image/avif",
};

export const ALLOWED_EXTENSIONS: readonly string[] = OK_EXT;

export function getFileExtension(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase();
}

export function isAllowedExtension(ext: string): boolean {
  return (OK_EXT as readonly string[]).includes(ext);
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

/** URL publique et stable d'une image stockée en base. */
export function mediaUrlFor(id: string): string {
  return `${MEDIA_ROUTE}/${id}`;
}

export function isStoredMediaUrl(u: string | null | undefined): boolean {
  return Boolean(u) && u!.startsWith(MEDIA_ROUTE + "/");
}

/** URL d'affichage d'une ligne `media`, tous stockages confondus.
 *  Ordre : base PostgreSQL, puis URL historique (Blob), puis chemin local. */
export function resolveMediaUrl(row: {
  path: string;
  url?: string | null;
  storage?: string | null;
}): string {
  if (row.storage === "db" || isStoredMediaUrl(row.path)) return row.path;
  if (row.url && row.url.startsWith("http")) return row.url;
  if (row.path && row.path.startsWith("http")) return row.path;
  return row.path;
}

// ---------------------------------------------------------------------------
// Type MIME réel — lu dans les octets, pas dans l'extension.
//
// Plusieurs visuels du catalogue portent une extension .jpg alors que leur
// contenu est du PNG. Comme la route de lecture envoie X-Content-Type-Options:
// nosniff, un MIME déduit de l'extension casserait l'affichage : on se fie
// donc aux octets, l'extension ne servant que de repli.
// ---------------------------------------------------------------------------

export function sniffMimeType(buf: Buffer): string | null {
  try {
    if (buf.length < 12) return null;

    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
    if (buf.subarray(0, 3).toString("latin1") === "GIF") return "image/gif";
    if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") {
      return "image/webp";
    }
    // ISO-BMFF : "....ftyp<brand>"
    if (buf.subarray(4, 8).toString("latin1") === "ftyp") {
      const brand = buf.subarray(8, 12).toString("latin1");
      if (["avif", "avis", "mif1", "msf1"].includes(brand)) return "image/avif";
    }
    // SVG : document texte (l'en-tête peut commencer par XML, un DOCTYPE, un commentaire…)
    const head = buf.subarray(0, 1024).toString("utf8").toLowerCase();
    if (head.includes("<svg")) return "image/svg+xml";

    return null;
  } catch {
    return null;
  }
}

/** MIME de référence d'une image : octets d'abord, extension ensuite. */
export function effectiveMimeType(buf: Buffer, ext: string, declared?: string | null): string {
  return sniffMimeType(buf) ?? (declared && declared.startsWith("image/") ? declared : mimeFromExt(ext));
}

// ---------------------------------------------------------------------------
// Dimensions d'image — lecture d'en-tête, sans dépendance externe.
// Retourne null si le format n'est pas reconnu : les dimensions restent
// optionnelles et ne doivent jamais faire échouer un upload.
// ---------------------------------------------------------------------------

function u16be(b: Buffer, o: number): number {
  return b.readUInt16BE(o);
}
function u32be(b: Buffer, o: number): number {
  return b.readUInt32BE(o);
}
function u24le(b: Buffer, o: number): number {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
}

export function readImageSize(buf: Buffer): { width: number; height: number } | null {
  try {
    if (buf.length < 12) return null;

    // PNG : signature puis chunk IHDR (24 octets minimum)
    if (
      buf.length >= 24 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf.subarray(12, 16).toString("latin1") === "IHDR"
    ) {
      return { width: u32be(buf, 16), height: u32be(buf, 20) };
    }

    // GIF87a / GIF89a — little endian (10 octets minimum)
    if (buf.length >= 10 && buf.subarray(0, 3).toString("latin1") === "GIF") {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }

    // JPEG : parcours des marqueurs jusqu'au frame SOFn
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let o = 2;
      while (o + 9 < buf.length) {
        if (buf[o] !== 0xff) {
          o++;
          continue;
        }
        const marker = buf[o + 1];
        // Remplissage : octets 0xFF consécutifs
        if (marker === 0xff) {
          o++;
          continue;
        }
        // Marqueurs sans charge utile
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
          o += 2;
          continue;
        }
        const len = u16be(buf, o + 2);
        if (len < 2) return null;
        // SOF0..SOF15 hors DHT/JPG/DAC
        const isSof =
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc;
        if (isSof) {
          return { height: u16be(buf, o + 5), width: u16be(buf, o + 7) };
        }
        o += 2 + len;
      }
      return null;
    }

    // WEBP : RIFF....WEBP puis chunk VP8 / VP8L / VP8X
    if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") {
      const chunk = buf.subarray(12, 16).toString("latin1");
      if (chunk === "VP8X" && buf.length >= 30) {
        return { width: u24le(buf, 24) + 1, height: u24le(buf, 27) + 1 };
      }
      if (chunk === "VP8 " && buf.length >= 30) {
        // En-tête de frame VP8 : width/height sur 14 bits, little-endian.
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (chunk === "VP8L" && buf.length >= 25 && buf[20] === 0x2f) {
        const b0 = buf[21],
          b1 = buf[22],
          b2 = buf[23],
          b3 = buf[24];
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        return { width, height };
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Diagnostics exposés à l'admin
// ---------------------------------------------------------------------------

export interface MediaDiagnostics {
  /** Toujours "postgresql" : le stockage objet externe a été retiré. */
  storage: "postgresql";
  /** La colonne bytea `media.data` est-elle présente en base ? */
  hasDataColumn: boolean;
  dbOk: boolean;
  dbError: string | null;
  mediaCount: number;
  /** Migration à appliquer si hasDataColumn est faux. */
  pendingMigration: string | null;
}

export const MEDIA_MIGRATION_FILE = "drizzle/0002_media_db_storage.sql";

// ---------------------------------------------------------------------------
// Détection des erreurs PostgreSQL.
//
// Drizzle enveloppe l'erreur d'origine du driver : le code SQLSTATE (« 42703 »
// colonne inconnue, « 42P01 » table inconnue, …) n'est PAS dans `e.message`
// mais dans `e.cause.code`. Analyser seulement le message fait donc échouer la
// détection (« colonne media.data absente » jamais reconnue). On remonte ici
// toute la chaîne des `cause` pour retrouver le code.
// ---------------------------------------------------------------------------

const MISSING_SCHEMA_CODES = new Set(["42703", "42P01", "42883"]);

/** Code SQLSTATE PostgreSQL porté par l'erreur ou l'une de ses `cause`. */
export function pgErrorCode(e: unknown): string | null {
  let cur: unknown = e;
  for (let depth = 0; cur && depth < 6; depth++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && /^\d{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return null;
}

/** Vrai si l'erreur correspond à un schéma incomplet (colonne/table absente). */
export function isMissingSchemaError(e: unknown): boolean {
  if (MISSING_SCHEMA_CODES.has(pgErrorCode(e) ?? "")) return true;
  // Repli sur le message (driver sans SQLSTATE), cause incluse.
  const parts: string[] = [];
  let cur: unknown = e;
  for (let depth = 0; cur && depth < 6; depth++) {
    if (cur instanceof Error) parts.push(cur.message);
    cur = (cur as { cause?: unknown }).cause;
  }
  const msg = parts.join(" ").toLowerCase();
  return msg.includes("does not exist") || msg.includes("column") || msg.includes("relation");
}

/** Vérifie la présence de la colonne `data` sans échouer si la table est absente. */
export async function probeDataColumn(
  query: (sql: string) => Promise<{ rows: Array<{ exists: boolean | string }> }>
): Promise<boolean> {
  try {
    const res = await query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'media' AND column_name = 'data'
       ) AS exists`
    );
    const v = res.rows[0]?.exists;
    return v === true || v === "t" || v === "true";
  } catch {
    return false;
  }
}
