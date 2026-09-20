import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  appointments,
  auditLogs,
  barberServices,
  barbers,
  customers,
  scheduleBlocks,
  services,
} from "../../../db/schema";
import { buildScheduleWindow, scheduleError } from "../../../lib/scheduling";
import { enforceRateLimit, rejectOversizedJson } from "../../../lib/security";
import { sendToProfile } from "../../../lib/firebase-server";

function cleanPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 13);
}
function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const barberId = url.searchParams.get("barber");
  const date = url.searchParams.get("date");
  if (!barberId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return Response.json(
      { error: "barber e date são obrigatórios" },
      { status: 400 },
    );
  const start = new Date(`${date}T00:00:00-03:00`),
    end = new Date(`${date}T23:59:59-03:00`);
  const db = getDb();
  const rows = await db
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.barberId, barberId),
        inArray(appointments.status, ["pending", "confirmed"]),
        gt(appointments.endsAt, start),
        lt(appointments.startsAt, end),
      ),
    );
  const blocks = await db
    .select({
      startsAt: scheduleBlocks.startsAt,
      endsAt: scheduleBlocks.endsAt,
      kind: scheduleBlocks.kind,
    })
    .from(scheduleBlocks)
    .where(
      and(
        eq(scheduleBlocks.barberId, barberId),
        eq(scheduleBlocks.active, true),
        gt(scheduleBlocks.endsAt, start),
        lt(scheduleBlocks.startsAt, end),
      ),
    );
  return Response.json({
    occupied: rows.map((r) => ({
      start: r.startsAt.toISOString(),
      end: r.endsAt.toISOString(),
      kind: "appointment",
    })),
    blocks: blocks.map((r) => ({
      start: r.startsAt.toISOString(),
      end: r.endsAt.toISOString(),
      kind: r.kind,
    })),
  });
}

export async function POST(request: Request) {
  const blockedRequest = enforceRateLimit(request, "public-booking", 12) || rejectOversizedJson(request);
  if (blockedRequest) return blockedRequest;
  try {
    const p = (await request.json()) as {
      barberId?: string;
      serviceId?: string;
      date?: string;
      time?: string;
      name?: string;
      phone?: string;
      consent?: boolean;
    };
    const name = p.name?.trim() || "",
      phone = cleanPhone(p.phone || "");
    if (
      !p.barberId ||
      !p.serviceId ||
      !p.date ||
      !p.time ||
      name.length < 2 ||
      name.length > 80 ||
      phone.length < 10 ||
      !p.consent
    )
      return Response.json(
        { error: "Revise os dados e aceite a autorização." },
        { status: 400 },
      );
    const db = getDb();
    const [barber] = await db
      .select()
      .from(barbers)
      .where(and(eq(barbers.id, p.barberId), eq(barbers.active, true)))
      .limit(1);
    const [service] = await db
      .select({
        id: services.id,
        name: services.name,
        customName: barberServices.customName,
        durationMinutes: barberServices.durationMinutes,
        priceCents: barberServices.priceCents,
      })
      .from(barberServices)
      .innerJoin(services, eq(barberServices.serviceId, services.id))
      .where(
        and(
          eq(barberServices.barberId, p.barberId),
          eq(barberServices.serviceId, p.serviceId),
          eq(barberServices.active, true),
        ),
      )
      .limit(1);
    if (!barber || !service)
      return Response.json(
        { error: "Barbeiro ou serviço indisponível." },
        { status: 404 },
      );
    let startsAt: Date, endsAt: Date;
    try {
      ({ startsAt, endsAt } = buildScheduleWindow(
        p.date,
        p.time,
        service.durationMinutes,
      ));
    } catch (error) {
      return Response.json({ error: scheduleError(error) }, { status: 400 });
    }
    const overlap = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.barberId, barber.id),
          inArray(appointments.status, ["pending", "confirmed"]),
          lt(appointments.startsAt, endsAt),
          gt(appointments.endsAt, startsAt),
        ),
      )
      .limit(1);
    if (overlap.length)
      return Response.json(
        { error: "Este horário acabou de ser reservado. Escolha outro." },
        { status: 409 },
      );
    const blocked = await db
      .select({ id: scheduleBlocks.id })
      .from(scheduleBlocks)
      .where(
        and(
          eq(scheduleBlocks.barberId, barber.id),
          eq(scheduleBlocks.active, true),
          lt(scheduleBlocks.startsAt, endsAt),
          gt(scheduleBlocks.endsAt, startsAt),
        ),
      )
      .limit(1);
    if (blocked.length)
      return Response.json(
        { error: "O barbeiro bloqueou este período." },
        { status: 409 },
      );
    const now = new Date(),
      appointmentId = uid("apt"),
      token = crypto.randomUUID().replaceAll("-", "");
    const ownerAmount = Math.round(
        (service.priceCents * barber.ownerShareBps) / 10000,
      ),
      barberAmount = service.priceCents - ownerAmount;
    const [knownCustomer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.phone, phone))
      .limit(1);
    const customerId = knownCustomer?.id || uid("cus");
    if (knownCustomer)
      await db
        .update(customers)
        .set({ name, consentAt: now })
        .where(eq(customers.id, customerId));
    else
      await db
        .insert(customers)
        .values({
          id: customerId,
          name,
          phone,
          consentAt: now,
          createdAt: now,
        });
    await db
      .insert(appointments)
      .values({
        id: appointmentId,
        barberId: barber.id,
        serviceId: service.id,
        customerId,
        startsAt,
        endsAt,
        status: "pending",
        priceCents: service.priceCents,
        ownerShareBps: barber.ownerShareBps,
        barberShareBps: barber.barberShareBps,
        ownerAmountCents: ownerAmount,
        barberAmountCents: barberAmount,
        publicTokenHash: await sha256(token),
        createdAt: now,
      });
    await db
      .insert(auditLogs)
      .values({
        id: uid("log"),
        actorProfileId: null,
        action: "booking.created",
        entity: "appointment",
        entityId: appointmentId,
        metadata: JSON.stringify({
          barberId: barber.id,
          serviceId: service.id,
          source: "public",
        }),
        createdAt: now,
      });
    await sendToProfile(barber.profileId, { title: "Novo agendamento!", body: `${name} marcou ${service.customName || service.name} às ${p.time}.`, url: "/operacao" });
    return Response.json(
      {
        booking: {
          id: appointmentId,
          token,
          barber: barber.name,
          service: service.customName || service.name,
          priceCents: service.priceCents,
          startsAt: startsAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    if (message.includes("UNIQUE"))
      return Response.json(
        { error: "Horário indisponível. Escolha outro." },
        { status: 409 },
      );
    return Response.json(
      { error: "Não foi possível confirmar agora. Tente novamente." },
      { status: 500 },
    );
  }
}
