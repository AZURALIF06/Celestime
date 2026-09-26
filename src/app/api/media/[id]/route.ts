// Célestime — lecture publique des images de la médiathèque.
// Sert les octets stockés dans `media.data` (bytea). Le contenu d'un id est
// immuable, d'où un cache navigateur/CDN d'un an.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { MEDIA_MIGRATION_FILE, effectiveMimeType, sanitizeName } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^[a-zA-Z0-9-]{1,64}$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!ID_RE.test(id)) {
    return new Response("Identifiant d'image invalide.", { status: 400 });
  }

  let row: {
    id: string;
    name: string;
    kind: string;
    mimeType: string | null;
    data: Buffer | null;
  } | undefined;

  try {
    const rows = await db
      .select({
        id: media.id,
        name: media.name,
        kind: media.kind,
        mimeType: media.mimeType,
        data: media.data,
      })
      .from(media)
      .where(eq(media.id, id))
      .limit(1);
    row = rows[0];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[media] read failed", msg);
    if (msg.includes("column") || msg.includes("does not exist")) {
      return new Response(
        `Médiathèque indisponible : la colonne "media.data" est absente. Appliquez ${MEDIA_MIGRATION_FILE} sur la base.`,
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
    return new Response("Image indisponible.", { status: 503 });
  }

  if (!row || !row.data || row.data.length === 0) {
    return new Response("Image introuvable.", { status: 404 });
  }

  // On se fie aux octets : un .jpg contenant du PNG serait illisible avec nosniff.
  const contentType = effectiveMimeType(row.data, row.kind, row.mimeType);

  const filename = sanitizeName(`${row.name}.${row.kind}`) || `${row.id}.bin`;

  return new Response(new Uint8Array(row.data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(row.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      // Une SVG uploadée peut embarquer du script : on la neutralise.
      ...(contentType === "image/svg+xml"
        ? { "Content-Security-Policy": "default-src 'none'; sandbox;" }
        : {}),
    },
  });
}
