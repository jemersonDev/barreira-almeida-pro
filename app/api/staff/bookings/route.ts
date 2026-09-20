import { and, eq, gt, inArray, lt } from "drizzle-orm";
import {
  appointments,
  auditLogs,
  barberServices,
  barbers,
  customers,
  scheduleBlocks,
  services,
} from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";
import { buildScheduleWindow, scheduleError } from "../../../../lib/scheduling";
const uid = (p: string) => `${p}_${crypto.randomUUID()}`;
const phone = (v: string) => v.replace(/\D/g, "").slice(0, 13);
async function hash(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const b = (await request.json()) as {
    barberId?: string;
    serviceId?: string;
    date?: string;
    time?: string;
    name?: string;
    phone?: string;
  };
  const barberId = auth.barberId,
    name = b.name?.trim() || "",
    cleanPhone = phone(b.phone || "");
  if (
    !b.serviceId ||
    !b.date ||
    !b.time ||
    name.length < 2 ||
    name.length > 80 ||
    cleanPhone.length < 10
  )
    return Response.json(
      { error: "Preencha todos os dados do cliente." },
      { status: 400 },
    );
  const [barber] = await auth.db
      .select()
      .from(barbers)
      .where(and(eq(barbers.id, barberId), eq(barbers.active, true)))
      .limit(1),
    [service] = await auth.db
      .select({ id: services.id, name: services.name, durationMinutes: barberServices.durationMinutes, priceCents: barberServices.priceCents })
      .from(barberServices)
      .innerJoin(services, eq(barberServices.serviceId, services.id))
      .where(and(eq(barberServices.barberId, barberId), eq(barberServices.serviceId, b.serviceId), eq(barberServices.active, true)))
      .limit(1);
  if (!barber || !service)
    return Response.json(
      { error: "Barbeiro ou serviço indisponível." },
      { status: 404 },
    );
  let startsAt: Date, endsAt: Date;
  try {
    ({ startsAt, endsAt } = buildScheduleWindow(
      b.date,
      b.time,
      service.durationMinutes,
    ));
  } catch (e) {
    return Response.json({ error: scheduleError(e) }, { status: 400 });
  }
  const conflict = await auth.db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.barberId, barberId),
          inArray(appointments.status, ["pending", "confirmed"]),
          lt(appointments.startsAt, endsAt),
          gt(appointments.endsAt, startsAt),
        ),
      )
      .limit(1),
    blocked = await auth.db
      .select({ id: scheduleBlocks.id })
      .from(scheduleBlocks)
      .where(
        and(
          eq(scheduleBlocks.barberId, barberId),
          eq(scheduleBlocks.active, true),
          lt(scheduleBlocks.startsAt, endsAt),
          gt(scheduleBlocks.endsAt, startsAt),
        ),
      )
      .limit(1);
  if (conflict.length || blocked.length)
    return Response.json({ error: "Horário indisponível." }, { status: 409 });
  const [known] = await auth.db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.phone, cleanPhone))
      .limit(1),
    customerId = known?.id || uid("cus"),
    now = new Date(),
    id = uid("apt"),
    token = crypto.randomUUID().replaceAll("-", "");
  if (known)
    await auth.db
      .update(customers)
      .set({ name, consentAt: now })
      .where(eq(customers.id, customerId));
  else
    await auth.db
      .insert(customers)
      .values({
        id: customerId,
        name,
        phone: cleanPhone,
        consentAt: now,
        createdAt: now,
      });
  const ownerAmount = Math.round(
    (service.priceCents * barber.ownerShareBps) / 10000,
  );
  await auth.db
    .insert(appointments)
    .values({
      id,
      barberId,
      serviceId: service.id,
      customerId,
      startsAt,
      endsAt,
      status: "pending",
      priceCents: service.priceCents,
      ownerShareBps: barber.ownerShareBps,
      barberShareBps: barber.barberShareBps,
      ownerAmountCents: ownerAmount,
      barberAmountCents: service.priceCents - ownerAmount,
      publicTokenHash: await hash(token),
      createdAt: now,
    });
  await auth.db
    .insert(auditLogs)
    .values({
      id: uid("log"),
      actorProfileId: auth.profile.id,
      action: "booking.created_manual",
      entity: "appointment",
      entityId: id,
      metadata: JSON.stringify({ barberId, source: "staff" }),
      createdAt: now,
    });
  return Response.json({ ok: true, id }, { status: 201 });
}
