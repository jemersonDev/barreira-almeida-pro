import { and, desc, eq, gte, ne } from "drizzle-orm";
import { appointments, barbers, customers, services } from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";

export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const conditions = [gte(appointments.createdAt, since), ne(appointments.status, "cancelled")];
  conditions.push(eq(appointments.barberId, auth.barberId));

  const notifications = await auth.db.select({
    id: appointments.id,
    createdAt: appointments.createdAt,
    startsAt: appointments.startsAt,
    status: appointments.status,
    barberName: barbers.name,
    serviceName: services.name,
    customerName: customers.name,
    customerPhone: customers.phone,
  }).from(appointments)
    .innerJoin(barbers, eq(appointments.barberId, barbers.id))
    .innerJoin(services, eq(appointments.serviceId, services.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(appointments.createdAt))
    .limit(30);

  return Response.json({ profile: auth.profile, notifications });
}
