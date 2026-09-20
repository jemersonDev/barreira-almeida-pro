import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { barbers } from "../../../../db/schema";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return new Response("Foto não encontrada.", { status: 404 });
  const [barber] = await getDb().select({ photoKey: barbers.photoKey }).from(barbers).where(eq(barbers.id, id)).limit(1);
  if (!barber?.photoKey) return new Response("Foto não encontrada.", { status: 404 });
  const object = await env.BUCKET.get(barber.photoKey);
  if (!object) return new Response("Foto não encontrada.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
