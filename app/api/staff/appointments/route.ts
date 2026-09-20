import { and, eq, gte, lt, ne } from "drizzle-orm";
import { appointments, auditLogs, barbers, customers, services } from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";
import { sendToCustomer } from "../../../../lib/firebase-server";

const allowedStatuses = ["confirmed", "completed", "cancelled", "no_show"] as const;
type AllowedStatus = typeof allowedStatuses[number];
function uid(prefix:string){return `${prefix}_${crypto.randomUUID()}`}

export async function GET(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Data inválida." }, { status: 400 });
  const starts = new Date(`${date}T00:00:00-03:00`), ends = new Date(`${date}T24:00:00-03:00`);

  const conditions = [gte(appointments.startsAt, starts), lt(appointments.startsAt, ends), ne(appointments.status, "cancelled")];
  conditions.push(eq(appointments.barberId, auth.barberId));

  const rows = await auth.db.select({
    id: appointments.id, startsAt: appointments.startsAt, endsAt: appointments.endsAt,
    status: appointments.status, priceCents: appointments.priceCents, paymentMethod: appointments.paymentMethod,
    ownerAmountCents: appointments.ownerAmountCents, barberAmountCents: appointments.barberAmountCents,
    barberId: appointments.barberId, barberName: barbers.name,
    serviceName: services.name, customerName: customers.name, customerPhone: customers.phone,
  }).from(appointments)
    .innerJoin(barbers, eq(appointments.barberId, barbers.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(appointments.startsAt);

  const safeRows = rows.map(row => auth.profile.role === "owner" ? row : {
    id: row.id, startsAt: row.startsAt, endsAt: row.endsAt, status: row.status,
    priceCents: row.priceCents, barberAmountCents: row.barberAmountCents,
    ownerAmountCents: row.ownerAmountCents, barberId: row.barberId, barberName: row.barberName,
    serviceName: row.serviceName, customerName: row.customerName, customerPhone: row.customerPhone,
  });
  const [ownBarber] = await auth.db.select({ photoKey: barbers.photoKey }).from(barbers).where(eq(barbers.id, auth.barberId)).limit(1);
  return Response.json({ profile: { ...auth.profile, photoUrl: ownBarber?.photoKey ? `/api/barbers/photo?id=${encodeURIComponent(auth.barberId)}&v=${encodeURIComponent(ownBarber.photoKey)}` : null }, appointments: safeRows });
}

export async function PATCH(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const body = await request.json() as { id?: string; status?: AllowedStatus; paymentMethod?:"pix"|"cash"|"card" };
  if (!body.id || !body.status || !allowedStatuses.includes(body.status)) return Response.json({ error: "Ação inválida." }, { status: 400 });

  const [booking] = await auth.db.select({ id: appointments.id, barberId: appointments.barberId, currentStatus: appointments.status, startsAt: appointments.startsAt, barberName: barbers.name })
    .from(appointments).innerJoin(barbers, eq(appointments.barberId, barbers.id)).where(eq(appointments.id, body.id)).limit(1);
  if (!booking) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });
  if (booking.barberId !== auth.barberId) return Response.json({ error: "Você não pode alterar este atendimento." }, { status: 403 });
  if (["completed", "cancelled", "no_show"].includes(booking.currentStatus)) return Response.json({ error: "Este atendimento já foi encerrado." }, { status: 409 });

  if(body.status==="completed"&&!(["pix","cash","card"] as const).includes(body.paymentMethod as "pix"|"cash"|"card"))return Response.json({error:"Escolha a forma de pagamento."},{status:400});
  await auth.db.update(appointments).set({ status: body.status, paymentMethod: body.status==="completed"?body.paymentMethod:null }).where(eq(appointments.id, booking.id));
  await auth.db.insert(auditLogs).values({
    id: uid("log"), actorProfileId: auth.profile.id, action: `appointment.${body.status}`,
    entity: "appointment", entityId: booking.id,
    metadata: JSON.stringify({ from: booking.currentStatus, to: body.status }), createdAt: new Date(),
  });
  if (body.status === "confirmed" || body.status === "cancelled") {
    const when = booking.startsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    await sendToCustomer(booking.id, body.status === "confirmed" ? { title: "Agendamento confirmado!", body: `${booking.barberName} confirmou seu horário em ${when}.`, url: "/meu-agendamento" } : { title: "Agendamento cancelado", body: `Seu horário de ${when} foi cancelado.`, url: "/meu-agendamento" });
  }
  return Response.json({ ok: true, status: body.status });
}
