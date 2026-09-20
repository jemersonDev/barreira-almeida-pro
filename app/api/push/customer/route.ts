import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { appointments, pushSubscriptions } from "../../../../db/schema";
import { enforceRateLimit, rejectOversizedJson } from "../../../../lib/security";

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const rejected = enforceRateLimit(request, "push-customer", 10) || rejectOversizedJson(request);
  if (rejected) return rejected;
  const body = await request.json() as { appointmentId?: string; bookingToken?: string; token?: string };
  if (!body.appointmentId || !body.bookingToken || !body.token || body.token.length > 4096) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  const db = getDb();
  const [booking] = await db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.id, body.appointmentId), eq(appointments.publicTokenHash, await hash(body.bookingToken)))).limit(1);
  if (!booking) return Response.json({ error: "Agendamento não encontrado." }, { status: 404 });
  const now = new Date();
  const [existing] = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.fcmToken, body.token)).limit(1);
  if (existing) await db.update(pushSubscriptions).set({ kind: "customer", profileId: null, appointmentId: booking.id, active: true, lastSeenAt: now }).where(eq(pushSubscriptions.id, existing.id));
  else await db.insert(pushSubscriptions).values({ id: `push_${crypto.randomUUID()}`, kind: "customer", profileId: null, appointmentId: booking.id, fcmToken: body.token, active: true, createdAt: now, lastSeenAt: now });
  return Response.json({ ok: true });
}
