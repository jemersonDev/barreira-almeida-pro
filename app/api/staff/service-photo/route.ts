import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditLogs, barberServices } from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

async function ownService(barberId: string, serviceId: string, db: ReturnType<typeof getDb>) {
  return db.select({ imageKey: barberServices.imageKey })
    .from(barberServices)
    .where(and(eq(barberServices.barberId, barberId), eq(barberServices.serviceId, serviceId)))
    .limit(1);
}

export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const form = await request.formData();
  const serviceId = String(form.get("serviceId") || "");
  const file = form.get("photo");
  if (!serviceId || !(file instanceof File)) return Response.json({ error: "Escolha uma imagem." }, { status: 400 });
  const [current] = await ownService(auth.barberId, serviceId, auth.db);
  if (!current) return Response.json({ error: "Serviço não encontrado." }, { status: 404 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Envie uma imagem JPG, PNG ou WebP." }, { status: 400 });
  if (file.size < 1 || file.size > 5 * 1024 * 1024) return Response.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 400 });

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if ((file.type === "image/jpeg" && !isJpeg) || (file.type === "image/png" && !isPng) || (file.type === "image/webp" && !isWebp)) {
    return Response.json({ error: "O arquivo não é uma imagem válida." }, { status: 400 });
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `services/${auth.barberId}/${serviceId}/${crypto.randomUUID()}.${extension}`;
  await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable", contentDisposition: "inline" } });
  await auth.db.update(barberServices).set({ imageKey: key }).where(and(eq(barberServices.barberId, auth.barberId), eq(barberServices.serviceId, serviceId)));
  if (current.imageKey) await env.BUCKET.delete(current.imageKey);
  await auth.db.insert(auditLogs).values({ id: uid("log"), actorProfileId: auth.profile.id, action: "service.photo.updated", entity: "service", entityId: serviceId, metadata: JSON.stringify({ contentType: file.type, size: file.size }), createdAt: new Date() });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const serviceId = new URL(request.url).searchParams.get("service") || "";
  const [current] = await ownService(auth.barberId, serviceId, auth.db);
  if (!current) return Response.json({ error: "Serviço não encontrado." }, { status: 404 });
  await auth.db.update(barberServices).set({ imageKey: null }).where(and(eq(barberServices.barberId, auth.barberId), eq(barberServices.serviceId, serviceId)));
  if (current.imageKey) await env.BUCKET.delete(current.imageKey);
  await auth.db.insert(auditLogs).values({ id: uid("log"), actorProfileId: auth.profile.id, action: "service.photo.reset", entity: "service", entityId: serviceId, createdAt: new Date() });
  return Response.json({ ok: true });
}
