import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { barberServices, barbers, services } from "../../../db/schema";
import { defaultServiceImage } from "../../../lib/service-image";

export async function GET() {
  try {
    const db = getDb();
    const [activeBarbers, activeServices] = await Promise.all([
      db
        .select({ id: barbers.id, name: barbers.name, instagram: barbers.instagram, photoKey: barbers.photoKey })
        .from(barbers)
        .where(eq(barbers.active, true))
        .orderBy(asc(barbers.name)),
      db
        .select({
          barberId: barberServices.barberId,
          id: services.id,
          name: services.name,
          customName: barberServices.customName,
          duration: barberServices.durationMinutes,
          priceCents: barberServices.priceCents,
          imageKey: barberServices.imageKey,
        })
        .from(barberServices)
        .innerJoin(services, eq(barberServices.serviceId, services.id))
        .where(eq(barberServices.active, true))
        .orderBy(asc(services.sortOrder)),
    ]);

    return Response.json(
      {
        barbers: activeBarbers.map((barber) => ({
          ...barber,
          role: barber.id === "lucas" ? "Proprietário" : "Barbeiro",
          initials: barber.name.slice(0, 2).toUpperCase(),
          photoUrl: barber.photoKey ? `/api/barbers/photo?id=${encodeURIComponent(barber.id)}&v=${encodeURIComponent(barber.photoKey)}` : null,
        })),
        services: activeServices.map((service) => ({
          ...service,
          name: service.customName || service.name,
          price: service.priceCents / 100,
          imageUrl: service.imageKey
            ? `/api/services/photo?barber=${encodeURIComponent(service.barberId)}&service=${encodeURIComponent(service.id)}&v=${encodeURIComponent(service.imageKey)}`
            : defaultServiceImage(service.customName || service.name),
        })),
      },
      {
        headers: { "cache-control": "no-store, no-cache, must-revalidate" },
      },
    );
  } catch {
    return Response.json(
      { error: "Não foi possível carregar o catálogo." },
      { status: 500 },
    );
  }
}
