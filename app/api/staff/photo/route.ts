import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { auditLogs, barbers } from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) return Response.json({ error: "Escolha uma foto." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Envie uma imagem JPG, PNG ou WebP." }, { status: 400 });
  if (file.size < 1 || file.size > 5 * 1024 * 1024) return Response.json({ error: "A foto deve ter no máximo 5 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if ((file.type === "image/jpeg" && !isJpeg) || (file.type === "image/png" && !isPng) || (file.type === "image/webp" && !isWebp))
    return Response.json({ error: "O conteúdo do arquivo não corresponde a uma imagem válida." }, { status: 400 });

  const [current] = await auth.db.select({ photoKey: barbers.photoKey }).from(barbers).where(eq(barbers.id, auth.barberId)).limit(1);
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `barbers/${auth.barberId}/${crypto.randomUUID()}.${extension}`;
  await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable", contentDisposition: "inline" } });
  await auth.db.update(barbers).set({ photoKey: key }).where(eq(barbers.id, auth.barberId));
  if (current?.photoKey) await env.BUCKET.delete(current.photoKey);
  await auth.db.insert(auditLogs).values({ id: uid("log"), actorProfileId: auth.profile.id, action: "profile.photo.updated", entity: "barber", entityId: auth.barberId, metadata: JSON.stringify({ contentType: file.type, size: file.size }), createdAt: new Date() });
  return Response.json({ ok: true, photoUrl: `/api/barbers/photo?id=${encodeURIComponent(auth.barberId)}&v=${encodeURIComponent(key)}` });
}
