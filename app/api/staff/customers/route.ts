import { asc, eq } from "drizzle-orm";
import { appointments, customers, services } from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";

export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;

  const rows = await auth.db
    .select({
      customerId: customers.id,
      name: customers.name,
      phone: customers.phone,
      startsAt: appointments.startsAt,
      status: appointments.status,
      serviceName: services.name,
    })
    .from(appointments)
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .where(eq(appointments.barberId, auth.barberId))
    .orderBy(asc(customers.name), appointments.startsAt);

  const now = Date.now();
  const grouped = new Map<string, {
    id: string; name: string; phone: string; total: number; completed: number;
    noShows: number; cancelled: number; lastAppointment: string | null;
    nextAppointment: string | null; lastService: string | null;
  }>();
  for (const row of rows) {
    const current = grouped.get(row.customerId) || {
      id: row.customerId, name: row.name, phone: row.phone, total: 0,
      completed: 0, noShows: 0, cancelled: 0, lastAppointment: null,
      nextAppointment: null, lastService: null,
    };
    current.total += 1;
    if (row.status === "completed") current.completed += 1;
    if (row.status === "no_show") current.noShows += 1;
    if (row.status === "cancelled") current.cancelled += 1;
    const time = row.startsAt.getTime();
    if (time < now && (!current.lastAppointment || time > new Date(current.lastAppointment).getTime())) {
      current.lastAppointment = row.startsAt.toISOString();
      current.lastService = row.serviceName;
    }
    if (time >= now && ["pending", "confirmed"].includes(row.status) && (!current.nextAppointment || time < new Date(current.nextAppointment).getTime()))
      current.nextAppointment = row.startsAt.toISOString();
    grouped.set(row.customerId, current);
  }

  return Response.json({ profile: auth.profile, customers: [...grouped.values()] });
}
