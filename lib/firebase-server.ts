import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { pushSubscriptions } from "../db/schema";

type PushMessage = { title: string; body: string; url: string };
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function accessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value;
  const settings = env as unknown as Record<string, string | undefined>;
  const projectId = settings.FIREBASE_PROJECT_ID;
  const clientEmail = settings.FIREBASE_CLIENT_EMAIL;
  const privateKeyPem = settings.FIREBASE_PRIVATE_KEY?.replaceAll("\\n", "\n");
  if (!projectId || !clientEmail || !privateKeyPem) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({ iss: clientEmail, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claims}`;
  const keyBytes = Uint8Array.from(atob(privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64Url(new Uint8Array(signature))}` }) });
  if (!response.ok) throw new Error("Firebase OAuth recusou a credencial.");
  const result = await response.json() as { access_token: string; expires_in?: number };
  cachedAccessToken = { value: result.access_token, expiresAt: Date.now() + (result.expires_in || 3600) * 1000 };
  return result.access_token;
}

export type PushResult = { configured: boolean; devices: number; delivered: number; failed: { status: number; detail: string }[] };

async function sendTokens(tokens: string[], message: PushMessage): Promise<PushResult> {
  const result: PushResult = { configured: true, devices: tokens.length, delivered: 0, failed: [] };
  if (!tokens.length) return result;
  try {
    const token = await accessToken();
    if (!token) {
      result.configured = false;
      console.error("push_not_configured: faltam FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY");
      return result;
    }
    const projectId = (env as unknown as Record<string, string>).FIREBASE_PROJECT_ID;
    const db = getDb();
    await Promise.all(tokens.map(async registrationToken => {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ message: { token: registrationToken, notification: { title: message.title, body: message.body }, data: { url: message.url }, webpush: { fcmOptions: { link: message.url } } } }) });
      if (response.ok) { result.delivered += 1; return; }
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      result.failed.push({ status: response.status, detail });
      console.error("push_fcm_rejected", response.status, detail);
      if (response.status === 404 || response.status === 410) await db.update(pushSubscriptions).set({ active: false }).where(eq(pushSubscriptions.fcmToken, registrationToken));
    }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    result.failed.push({ status: 0, detail });
    console.error("push_delivery_failed", detail);
  }
  return result;
}

export async function sendToProfile(profileId: string, message: PushMessage) {
  const rows = await getDb().select({ token: pushSubscriptions.fcmToken }).from(pushSubscriptions).where(and(eq(pushSubscriptions.kind, "staff"), eq(pushSubscriptions.profileId, profileId), eq(pushSubscriptions.active, true)));
  if (!rows.length) console.warn("push_no_devices", profileId);
  return sendTokens(rows.map(row => row.token), message);
}

export async function sendToCustomer(appointmentId: string, message: PushMessage) {
  const rows = await getDb().select({ token: pushSubscriptions.fcmToken }).from(pushSubscriptions).where(and(eq(pushSubscriptions.kind, "customer"), eq(pushSubscriptions.appointmentId, appointmentId), eq(pushSubscriptions.active, true)));
  return sendTokens(rows.map(row => row.token), message);
}
