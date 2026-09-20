import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { barberServices } from "../../../../db/schema";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const barberId = params.get("barber") || "";
  const serviceId = params.get("service") || "";
  if (!barberId || !serviceId) return new Response("Imagem não encontrada.", { status: 404 });

  const [service] = await getDb()
    .select({ imageKey: barberServices.imageKey })
    .from(barberServices)
    .where(and(eq(barberServices.barberId, barberId), eq(barberServices.serviceId, serviceId)))
    .limit(1);
  if (!service?.imageKey) return new Response("Imagem não encontrada.", { status: 404 });

  const object = await env.BUCKET.get(service.imageKey);
  if (!object) return new Response("Imagem não encontrada.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
