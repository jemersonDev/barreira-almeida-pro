import { eq } from "drizzle-orm";
import { pushSubscriptions } from "../../../../db/schema";
import { requireStaffApi } from "../../../../lib/staff-auth";
import { rejectOversizedJson } from "../../../../lib/security";

export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const rejected = rejectOversizedJson(request);
  if (rejected) return rejected;
  const body = await request.json() as { token?: string };
  const token = body.token?.trim() || "";
  if (token.length < 40 || token.length > 4096) return Response.json({ error: "Registro de aparelho inválido." }, { status: 400 });
  const now = new Date();
  const [existing] = await auth.db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.fcmToken, token)).limit(1);
  if (existing) await auth.db.update(pushSubscriptions).set({ kind: "staff", profileId: auth.profile.id, appointmentId: null, active: true, lastSeenAt: now }).where(eq(pushSubscriptions.id, existing.id));
  else await auth.db.insert(pushSubscriptions).values({ id: `push_${crypto.randomUUID()}`, kind: "staff", profileId: auth.profile.id, appointmentId: null, fcmToken: token, active: true, createdAt: now, lastSeenAt: now });
  return Response.json({ ok: true });
}
