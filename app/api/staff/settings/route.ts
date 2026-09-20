import { asc, eq } from "drizzle-orm";
import {
  auditLogs,
  barberServices,
  barbers,
  services,
} from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";
import { defaultServiceImage } from "../../../../lib/service-image";
function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const [team, catalog] = await Promise.all([
    auth.db
      .select({
        id: barbers.id,
        name: barbers.name,
        ownerShareBps: barbers.ownerShareBps,
        barberShareBps: barbers.barberShareBps,
        active: barbers.active,
      })
      .from(barbers)
      .orderBy(asc(barbers.name)),
    auth.db
      .select({
        id: services.id,
        name: services.name,
        customName: barberServices.customName,
        durationMinutes: barberServices.durationMinutes,
        priceCents: barberServices.priceCents,
        imageKey: barberServices.imageKey,
        active: barberServices.active,
        sortOrder: services.sortOrder,
      })
      .from(barberServices)
      .innerJoin(services, eq(barberServices.serviceId, services.id))
      .where(eq(barberServices.barberId, auth.barberId))
      .orderBy(asc(services.sortOrder)),
  ]);
  const [ownBarber] = await auth.db.select({ name: barbers.name, photoKey: barbers.photoKey }).from(barbers).where(eq(barbers.id, auth.barberId)).limit(1);
  return Response.json(
    {
      profile: { ...auth.profile, barberId: auth.barberId, photoUrl: ownBarber?.photoKey ? `/api/barbers/photo?id=${encodeURIComponent(auth.barberId)}&v=${encodeURIComponent(ownBarber.photoKey)}` : null },
      team: auth.profile.role === "owner" ? team : [],
      services: catalog.map((service) => {
        const name = service.customName || service.name;
        return {
          ...service,
          name,
          customImage: Boolean(service.imageKey),
          imageUrl: service.imageKey
            ? `/api/services/photo?barber=${encodeURIComponent(auth.barberId)}&service=${encodeURIComponent(service.id)}&v=${encodeURIComponent(service.imageKey)}`
            : defaultServiceImage(name),
        };
      }),
    },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } },
  );
}
export async function PATCH(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const body = (await request.json()) as {
    type?: "service" | "services" | "barber";
    id?: string;
    name?: string;
    durationMinutes?: number;
    priceCents?: number;
    active?: boolean;
    ownerShareBps?: number;
    barberShareBps?: number;
    services?: Array<{
      id: string;
      name: string;
      durationMinutes: number | null;
      priceCents: number;
      active: boolean;
    }>;
  };
  if (!body.type)
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  if (body.type === "services") {
    const items = body.services || [];
    if (!items.length)
      return Response.json({ error: "Nenhum serviço para salvar." }, { status: 400 });
    const normalized = items.map((item) => ({
      ...item,
      name: item.name?.trim() || "",
      durationMinutes: Number(item.durationMinutes),
      priceCents: Number(item.priceCents),
    }));
    const invalid = normalized.find(
      (item) =>
        !item.id ||
        item.name.length < 2 ||
        item.name.length > 80 ||
        item.durationMinutes < 5 ||
        item.durationMinutes > 240 ||
        item.durationMinutes % 5 !== 0 ||
        item.priceCents < 100 ||
        item.priceCents > 100000,
    );
    if (invalid)
      return Response.json(
        { error: `Revise o serviço ${invalid.name || "sem nome"}: use preço acima de R$ 1 e duração de 5 a 240 minutos.` },
        { status: 400 },
      );
    for (const item of normalized) {
      await auth.db
        .insert(barberServices)
        .values({
          barberId: auth.barberId,
          serviceId: item.id,
          customName: item.name,
          priceCents: item.priceCents,
          durationMinutes: item.durationMinutes,
          active: item.active !== false,
        })
        .onConflictDoUpdate({
          target: [barberServices.barberId, barberServices.serviceId],
          set: {
            customName: item.name,
            priceCents: item.priceCents,
            durationMinutes: item.durationMinutes,
            active: item.active !== false,
          },
        });
    }
  } else if (body.type === "service") {
    if (!body.id)
      return Response.json({ error: "Dados inválidos." }, { status: 400 });
    const name = body.name?.trim() || "",
      duration = Number(body.durationMinutes),
      price = Number(body.priceCents);
    if (
      name.length < 2 ||
      name.length > 80 ||
      duration < 5 ||
      duration > 240 ||
      duration % 5 !== 0 ||
      price < 100 ||
      price > 100000
    )
      return Response.json(
        { error: "Revise nome, preço e duração do serviço." },
        { status: 400 },
      );
    await auth.db
      .insert(barberServices)
      .values({
        barberId: auth.barberId,
        serviceId: body.id,
        customName: name,
        priceCents: price,
        durationMinutes: duration,
        active: body.active !== false,
      })
      .onConflictDoUpdate({
        target: [barberServices.barberId, barberServices.serviceId],
        set: {
          customName: name,
          priceCents: price,
          durationMinutes: duration,
          active: body.active !== false,
        },
      });
  } else {
    if (!body.id)
      return Response.json({ error: "Dados inválidos." }, { status: 400 });
    if (auth.profile.role !== "owner")
      return Response.json(
        { error: "Área exclusiva do proprietário." },
        { status: 403 },
      );
    const ownerShare = Number(body.ownerShareBps),
      barberShare = Number(body.barberShareBps);
    if (ownerShare < 0 || barberShare < 0 || ownerShare + barberShare !== 10000)
      return Response.json(
        { error: "Os percentuais devem totalizar 100%." },
        { status: 400 },
      );
    if (body.id === "lucas" && ownerShare !== 0)
      return Response.json(
        { error: "Os serviços próprios do Lucas pertencem 100% a ele." },
        { status: 400 },
      );
    await auth.db
      .update(barbers)
      .set({
        ownerShareBps: ownerShare,
        barberShareBps: barberShare,
        active: body.active !== false,
      })
      .where(eq(barbers.id, body.id));
  }
  await auth.db.insert(auditLogs).values({
    id: uid("log"),
    actorProfileId: auth.profile.id,
    action: `settings.${body.type}.updated`,
    entity: body.type,
    entityId: body.id || auth.barberId,
    metadata: JSON.stringify({
      source: "settings",
      priceCents: body.priceCents,
      durationMinutes: body.durationMinutes,
      ownerShareBps: body.ownerShareBps,
      barberShareBps: body.barberShareBps,
      serviceCount: body.services?.length,
    }),
    createdAt: new Date(),
  });
  return Response.json({ ok: true });
}
