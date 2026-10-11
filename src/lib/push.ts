// Chat push notifications: opt-in per browser from the Messages page. The browser's push subscription
// is stored with push_subscribe; the `push` edge function (supabase/functions/push) sends the pushes and
// public/sw.js shows them.
import { config, rpc } from "@/lib/supabase";

export type PushState = "unsupported" | "install" | "denied" | "off" | "on";

const FN = `${config.URL}/functions/v1/push`;
const headers = { apikey: config.KEY };

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js");
}

/** What this browser can do right now. "on" also re-saves the subscription (it may now belong to another player). */
export async function pushState(): Promise<PushState> {
  // iPhone/iPad only offer Web Push to the app added to the Home Screen
  if (!supported()) return isIOS() ? "install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = Notification.permission === "granted" ? await (await registration()).pushManager.getSubscription() : null;
  if (!sub) return "off";
  void rpc("push_subscribe", { p_subscription: sub.toJSON() }).catch(() => {});
  return "on";
}

function decodeKey(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

export async function enablePush(): Promise<PushState> {
  if ((await Notification.requestPermission()) !== "granted") return Notification.permission === "denied" ? "denied" : "off";
  const res = await fetch(FN, { headers });
  if (!res.ok) throw new Error("Couldn't reach the notification server");
  const { key } = await res.json();
  const reg = await registration();
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) })
    .catch(() => { throw new Error("This browser couldn't set up notifications (private windows can't)."); });
  try {
    await rpc("push_subscribe", { p_subscription: sub.toJSON() });
  } catch (e) {
    await sub.unsubscribe().catch(() => {});
    throw e;
  }
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const sub = await (await registration()).pushManager.getSubscription();
  if (sub) {
    await rpc("push_unsubscribe", { p_endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}

/** After posting: have the server push the new message to everyone else who opted in. Fire and forget. */
export function notifyNewMessages() {
  void fetch(FN, { method: "POST", headers, keepalive: true }).catch(() => {});
}
