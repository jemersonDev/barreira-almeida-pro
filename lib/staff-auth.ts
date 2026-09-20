import { and, eq, or } from "drizzle-orm";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { barbers, profiles } from "../db/schema";

export async function requireStaffApi() {
  const user = await getChatGPTUser();
  if (!user) return { error: Response.json({ error: "Faça login para continuar." }, { status: 401 }) };

  const db = getDb();
  const email = user.email.trim().toLowerCase();
  const authorizedProfiles: Record<string, string> = {
    "lucas.almeida.barbearia@gmail.com": "profile-lucas",
    "sinvas.barbearia.almeida@gmail.com": "profile-sinvas",
  };
  const authorizedProfileId = authorizedProfiles[email];
  if (!authorizedProfileId)
    return { error: Response.json({ error: "Esta conta não pertence à equipe." }, { status: 403 }) };
  const [profile] = await db.select({ id: profiles.id, name: profiles.name, role: profiles.role })
    .from(profiles)
    .where(and(or(eq(profiles.email, email), eq(profiles.id, authorizedProfileId)), eq(profiles.active, true)))
    .limit(1);
  if (!profile) return { error: Response.json({ error: "Esta conta não pertence à equipe." }, { status: 403 }) };

  const [barber] = await db.select({ id: barbers.id }).from(barbers)
    .where(and(eq(barbers.profileId, profile.id), eq(barbers.active, true))).limit(1);
  if (!barber) return { error: Response.json({ error: "Perfil profissional não configurado." }, { status: 403 }) };

  return { db, profile, barberId: barber.id };
}
