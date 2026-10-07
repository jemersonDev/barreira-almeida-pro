import { requireStaffApi } from "../../../../lib/staff-auth";
import { sendToProfile } from "../../../../lib/firebase-server";

export async function POST() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const result = await sendToProfile(auth.profile.id, {
    title: "Teste de notificação",
    body: "Se você viu isso, o aviso de novos agendamentos está funcionando.",
    url: "/operacao",
  });
  return Response.json(result);
}
