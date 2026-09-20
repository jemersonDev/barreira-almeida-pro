import { and, eq, gte, lte } from "drizzle-orm";
import { appointments, barbers, customers, services } from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function day(value: string, end = false) {
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}-03:00`);
}

export async function GET(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  if (!datePattern.test(from) || !datePattern.test(to))
    return Response.json({ error: "Informe um período válido." }, { status: 400 });

  const startsAt = day(from);
  const endsAt = day(to, true);
  if (startsAt > endsAt || endsAt.getTime() - startsAt.getTime() > 366 * 86400000)
    return Response.json({ error: "O período deve ter no máximo 366 dias." }, { status: 400 });

  const rows = await auth.db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      priceCents: appointments.priceCents,
      paymentMethod: appointments.paymentMethod,
      serviceName: services.name,
      customerName: customers.name,
      customerPhone: customers.phone,
      barberName: barbers.name,
    })
    .from(appointments)
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .innerJoin(barbers, eq(appointments.barberId, barbers.id))
    .where(and(eq(appointments.barberId, auth.barberId), gte(appointments.startsAt, startsAt), lte(appointments.startsAt, endsAt)))
    .orderBy(appointments.startsAt);

  return Response.json({ profile: auth.profile, appointments: rows });
}
