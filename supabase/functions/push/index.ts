// Chat push notifications (see supabase/migrations/*_chat_push.sql).
//   GET  -> { key }: the VAPID public key browsers subscribe with
//   POST -> pushes every recent message nobody pushed yet to the other players' subscribed browsers.
// The Messages page POSTs after each message it sends. Each message is claimed once in the database, so
// repeated or stray calls are harmless; that is why this function needs no auth (verify_jwt = false).
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// VAPID "sub": how a push service can reach the sender. Apple requires a mailto: or https: URL.
const CONTACT = "https://reidle.reillybrothers.net";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const headers: Record<string, string> = { apikey: SERVICE_KEY, "content-type": "application/json" };
  if (SERVICE_KEY.startsWith("eyJ")) headers.authorization = `Bearer ${SERVICE_KEY}`; // legacy JWT key
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${fn}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

type Keys = { public_key: string; private_jwk: webpush.ExportedVapidKeys };
let server: Promise<{ app: webpush.ApplicationServer; key: string }> | null = null;
function appServer() {
  return server ??= (async () => {
    let keys = await rpc<Keys | null>("push_keys");
    if (!keys) {
      const fresh = await webpush.generateVapidKeys({ extractable: true });
      keys = await rpc<Keys>("push_keys", {
        p_public: await webpush.exportApplicationServerKey(fresh),
        p_private: await webpush.exportVapidKeys(fresh),
      });
    }
    const vapidKeys = await webpush.importVapidKeys(keys.private_jwk);
    return { app: await webpush.ApplicationServer.new({ contactInformation: CONTACT, vapidKeys }), key: keys.public_key };
  })().catch((e) => { server = null; throw e; });
}

type Claimed = { message_id: number; name: string; message: string; subscriptions: webpush.PushSubscription[] };

function preview(message: string) {
  if (/^\/gif\b/i.test(message)) return "sent a GIF";
  const text = message.replace(/\s+/g, " ").trim();
  return text.length > 160 ? text.slice(0, 159) + "…" : text;
}

async function pushAll(): Promise<{ sent: number; gone: number; failed: number }> {
  const claimed = await rpc<Claimed[]>("push_claim");
  if (!claimed.length) return { sent: 0, gone: 0, failed: 0 };
  const { app } = await appServer();
  const gone = new Set<string>();
  let sent = 0, failed = 0;
  await Promise.all(claimed.flatMap((m) => {
    const payload = JSON.stringify({ title: m.name, body: preview(m.message), url: "/messages", tag: `chat-${m.message_id}` });
    return m.subscriptions.map(async (sub) => {
      try {
        await app.subscribe(sub).pushTextMessage(payload, { ttl: 24 * 3600 });
        sent++;
      } catch (e) {
        const status = e instanceof webpush.PushMessageError ? e.response.status : 0;
        if (status === 404 || status === 410) gone.add(sub.endpoint);
        else { failed++; console.error("push failed", status || e); }
      }
    });
  }));
  if (gone.size) await rpc("push_gone", { p_endpoints: [...gone] });
  return { sent, gone: gone.size, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = req.method === "GET" ? { key: (await appServer()).key } : await pushAll();
    return Response.json(body, { headers: CORS });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500, headers: CORS });
  }
});
