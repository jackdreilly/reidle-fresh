import { useEffect, useRef, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { rpc } from "@/lib/supabase";
import { patchSession } from "@/lib/session";
import { enablePush, flushPush, pushState, type PushState } from "@/lib/push";
import { fromNow } from "@/lib/time";

type Msg = { id: number; from_jack: boolean; body: string; created_at: string };
type Data = { messages: Msg[]; email: string | null; account: string };

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";

function device() {
  const ua = navigator.userAgent;
  const os = /iphone|ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? "iOS"
    : /android/i.test(ua) ? "Android" : /macintosh/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows" : /linux|cros/i.test(ua) ? "Linux" : "other";
  return os + (matchMedia("(display-mode: standalone)").matches ? " app" : "");
}

/** After a message: how the player will hear back (push on this device, or saving a guest account). */
function HearBack({ account }: { account: string }) {
  const [state, setState] = useState<PushState | "busy" | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { pushState().then(setState, () => setState("unsupported")); }, []);
  const turnOn = async () => {
    setState("busy");
    setErr("");
    try { setState(await enablePush()); } catch (e) { setState("off"); setErr((e as Error).message); }
  };
  return (
    <div class="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-gray-700">
      <p><b class="text-gray-900">Sent.</b> Jack gets a notification now, and his reply will show up here.</p>
      {(state === "off" || state === "busy") && (
        <p>
          <button type="button" onClick={turnOn} disabled={state === "busy"}
            class="rounded-full bg-sky-500 px-3 py-1 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-40">
            {state === "busy" ? "…" : "Notify me when Jack replies"}
          </button>
        </p>
      )}
      {state === "install" && <p>To get a notification on iPhone, add Reidle to your Home Screen (Share, then Add to Home Screen) and open it from there.</p>}
      {state === "on" && <p>Notifications are on, so you'll hear about his reply on this device.</p>}
      {err && <p class="text-rose-700">{err}</p>}
      {account === "guest" && (
        <p>You're playing as a guest, so replies show up on this device only. <a href="/account#login" class="font-medium text-sky-700 underline">Save your account</a> to see them anywhere.</p>
      )}
    </div>
  );
}

/** Contact Jack: a private conversation with the owner (send_feedback, answered from /admin/inbox). */
export default function Contact({ data, query }: PageProps<Data>) {
  const [messages, setMessages] = useState(data.messages);
  const [text, setText] = useState(query.get("text") ?? "");
  const [email, setEmail] = useState(data.email ?? "");
  const [showEmail, setShowEmail] = useState(!!data.email);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => patchSession({ contact_unread: null }), []);
  const last = messages[messages.length - 1]?.id;
  useEffect(() => { if (messages.length > 2) window.scrollTo(0, document.documentElement.scrollHeight); }, [last]);

  async function send(e: Event) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    try {
      const m = await rpc<Msg>("send_feedback", {
        p_body: body, p_path: query.get("from"), p_device: device(), p_email: showEmail ? email.trim() || null : null,
      });
      flushPush();
      setMessages((ms) => [...ms, m]);
      setText("");
      setSent(true);
    } catch (err) {
      setError((err as Error).message || "Couldn't send that. Try again?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="mx-auto max-w-xl space-y-3">
      <div class={card + " flex items-start gap-3"}>
        <img src="/android-chrome-96x96.webp" alt="" width="44" height="44" class="h-11 w-11 shrink-0 rounded-full" />
        <div>
          <h1 class="text-lg font-semibold text-gray-900">Contact Jack</h1>
          <p class="mt-1 text-sm text-gray-700">
            Jack made Reidle. Questions, bugs, ideas, or just hello: he reads every message and usually replies within a day.
          </p>
        </div>
      </div>

      {!!messages.length && (
        <ul class="space-y-2" aria-label="Your conversation with Jack">
          {messages.map((m) => (
            <li key={m.id} class={"flex flex-col " + (m.from_jack ? "items-start" : "items-end")}>
              <div class={"max-w-[85%] whitespace-break-spaces break-words rounded-2xl px-3 py-2 text-[15px] leading-snug " +
                (m.from_jack ? "bg-gray-100 text-gray-900" : "bg-sky-500 text-white")}>
                {m.body}
              </div>
              <span class="mt-0.5 px-1 text-xs text-gray-400">
                {m.from_jack ? "Jack · " : ""}<time dateTime={m.created_at} title={new Date(m.created_at).toLocaleString()}>{fromNow(m.created_at)}</time>
              </span>
            </li>
          ))}
        </ul>
      )}

      {sent && <HearBack account={data.account} />}

      <form class={card + " space-y-2"} onSubmit={send}>
        <label for="contact-text" class="sr-only">Your message</label>
        <textarea
          id="contact-text"
          ref={box}
          rows={4}
          maxLength={2000}
          required
          class="block w-full resize-y rounded-lg border border-gray-200 p-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
          placeholder={messages.length ? "Write back…" : "What's on your mind?"}
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        />
        {showEmail
          ? (
            <label class="block text-sm text-gray-700">
              Your email, if you'd also like a reply by email (optional)
              <input type="email" autocomplete="email" maxLength={200} value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                class="mt-1 block w-full rounded-lg border border-gray-200 p-2 text-sm text-gray-900 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100" />
            </label>
          )
          : <button type="button" class="text-sm text-sky-600 hover:underline" onClick={() => setShowEmail(true)}>Prefer a reply by email? Add your address</button>}
        {error && <p class="rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700 ring-1 ring-rose-200">{error}</p>}
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-gray-400">Jack sees your name, your league and the page you came from.</span>
          <button type="submit" disabled={busy || !text.trim()}
            class="shrink-0 rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
