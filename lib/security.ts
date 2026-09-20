type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

export function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs = 10 * 60_000,
): Response | null {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  if (store.size > 1_000) {
    for (const [storedKey, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(storedKey);
    }
  }
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  current.count += 1;
  if (current.count <= limit) return null;
  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return Response.json(
    { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
    { status: 429, headers: { "retry-after": String(retryAfter), "cache-control": "no-store" } },
  );
}

export function rejectOversizedJson(request: Request, maxBytes = 16_384): Response | null {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("application/json"))
    return Response.json({ error: "Formato da solicitação inválido." }, { status: 415 });
  const length = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(length) && length > maxBytes)
    return Response.json({ error: "Solicitação muito grande." }, { status: 413 });
  return null;
}
