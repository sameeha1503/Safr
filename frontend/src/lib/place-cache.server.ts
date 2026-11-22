import type { Json } from "../integrations/supabase/types";

const memory = new Map<string, { payload: unknown; expires: number }>();
function remember(key: string, payload: unknown, expires: number) {
  for (const [id, entry] of memory)
    if (entry.expires <= Date.now()) memory.delete(id);
  if (memory.size >= 500) memory.delete(memory.keys().next().value!);
  memory.set(key, { payload, expires });
}
function configured() {
  return Boolean(
    process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"],
  );
}
export async function getCached(key: string): Promise<unknown | null> {
  const entry = memory.get(key);
  if (entry && entry.expires > Date.now()) return entry.payload;
  memory.delete(key);
  if (!configured()) return null;
  try {
    const { supabaseAdmin } =
      await import("../integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("place_cache")
      .select("payload,expires_at")
      .eq("key", key)
      .gt("expires_at", new Date().toISOString())
      .abortSignal(AbortSignal.timeout(1000))
      .maybeSingle();
    if (error || !data) return null;
    remember(key, data.payload, Date.parse(data.expires_at));
    return data.payload;
  } catch {
    return null;
  }
}
export async function setCached(
  key: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<void> {
  const expires = Date.now() + ttlSeconds * 1000;
  remember(key, payload, expires);
  if (!configured()) return;
  try {
    const { supabaseAdmin } =
      await import("../integrations/supabase/client.server");
    await supabaseAdmin
      .from("place_cache")
      .upsert({
        key,
        payload: JSON.parse(JSON.stringify(payload)) as Json,
        expires_at: new Date(expires).toISOString(),
      })
      .abortSignal(AbortSignal.timeout(1000));
  } catch {
    /* Cache availability must not block place discovery. */
  }
}
