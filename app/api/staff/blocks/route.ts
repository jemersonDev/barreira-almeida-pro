import { and, eq, gt, inArray, lt } from "drizzle-orm";
import {
  appointments,
  auditLogs,
  barbers,
  scheduleBlocks,
} from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";
const kinds = ["lunch", "personal", "break", "day_off", "vacation"] as const;
type Kind = (typeof kinds)[number];
function uid(p: string) {
  return `${p}_${crypto.randomUUID()}`;
}
export async function GET(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const u = new URL(request.url),
    date =
      u.searchParams.get("date") ||
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return Response.json({ error: "Data inválida." }, { status: 400 });
  const start = new Date(`${date}T00:00:00-03:00`),
    end = new Date(`${date}T23:59:59-03:00`),
    barberId = auth.barberId;
  const blocks = await auth.db
    .select({
      id: scheduleBlocks.id,
      barberId: scheduleBlocks.barberId,
      barberName: barbers.name,
      kind: scheduleBlocks.kind,
      startsAt: scheduleBlocks.startsAt,
      endsAt: scheduleBlocks.endsAt,
      active: scheduleBlocks.active,
    })
    .from(scheduleBlocks)
    .innerJoin(barbers, eq(scheduleBlocks.barberId, barbers.id))
    .where(
      and(
        eq(scheduleBlocks.barberId, barberId),
        eq(scheduleBlocks.active, true),
        gt(scheduleBlocks.endsAt, start),
        lt(scheduleBlocks.startsAt, end),
      ),
    )
    .orderBy(scheduleBlocks.startsAt);
  return Response.json({ profile: auth.profile, barberId, blocks });
}
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const b = (await request.json()) as {
    barberId?: string;
    kind?: Kind;
    date?: string;
    startTime?: string;
    endTime?: string;
  };
  const barberId = auth.barberId;
  if (
    !b.kind ||
    !kinds.includes(b.kind) ||
    !b.date ||
    !b.startTime ||
    !b.endTime
  )
    return Response.json({ error: "Preencha o bloqueio." }, { status: 400 });
  const startsAt = new Date(`${b.date}T${b.startTime}:00-03:00`),
    endsAt = new Date(`${b.date}T${b.endTime}:00-03:00`);
  if (Number.isNaN(startsAt.getTime()) || endsAt <= startsAt)
    return Response.json({ error: "Horário inválido." }, { status: 400 });
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
    .limit(1);
  if (conflict.length)
    return Response.json(
      { error: "Existe atendimento marcado nesse período." },
      { status: 409 },
    );
  const id = uid("blk");
  await auth.db
    .insert(scheduleBlocks)
    .values({ id, barberId, kind: b.kind, startsAt, endsAt, active: true });
  await auth.db
    .insert(auditLogs)
    .values({
      id: uid("log"),
      actorProfileId: auth.profile.id,
      action: "schedule.blocked",
      entity: "schedule_block",
      entityId: id,
      metadata: JSON.stringify({ barberId, kind: b.kind }),
      createdAt: new Date(),
    });
  return Response.json({ ok: true, id }, { status: 201 });
}
export async function DELETE(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id)
    return Response.json({ error: "Bloqueio inválido." }, { status: 400 });
  const [block] = await auth.db
    .select()
    .from(scheduleBlocks)
    .where(eq(scheduleBlocks.id, id))
    .limit(1);
  if (!block)
    return Response.json(
      { error: "Bloqueio não encontrado." },
      { status: 404 },
    );
  if (block.barberId !== auth.barberId)
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  await auth.db
    .update(scheduleBlocks)
    .set({ active: false })
    .where(eq(scheduleBlocks.id, id));
  return Response.json({ ok: true });
}
