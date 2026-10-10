import { Fragment } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { Name } from "@/components/DailyTable";
import MessageText from "@/components/MessageText";
import { rpc } from "@/lib/supabase";
import { patchSession, useSession } from "@/lib/session";
import { fromNow } from "@/lib/time";

type Msg = { message_id: number; name: string; message: string; created_at: string; likes: string[]; confirmed?: boolean };

// Same author within this window reads as one burst: one header, tighter spacing.
const BURST_MS = 5 * 60 * 1000;

const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string) {
  const d = new Date(iso), today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Like({ m, me, onLike }: { m: Msg; me: string | null | undefined; onLike: () => void }) {
  const likes = m.likes ?? [];
  const mine = !!me && likes.includes(me);
  return (
    <form class="inline-flex" onSubmit={(e) => { e.preventDefault(); if (!mine) onLike(); }}>
      <button
        type="submit"
        title={mine ? "You liked this" : "Like"}
        class={"inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs ring-1 transition " +
          (mine ? "cursor-default bg-sky-50 text-sky-800 ring-sky-300"
            : likes.length ? "cursor-pointer bg-white text-gray-600 ring-gray-200 hover:ring-sky-300"
            : "cursor-pointer bg-white text-gray-400 ring-gray-200 hover:ring-sky-300 hover:text-gray-600")}
      >
        <img height="22" width="22" src="/android-chrome-96x96.webp" alt="Reidle Logo" class={"h-[22px] w-[22px] " + (likes.length ? "" : "opacity-60 grayscale")} />
        {likes.length ? <span class="max-w-[14rem] truncate">{likes.map((x) => x.substring(0, 9)).join(", ")}</span> : <span>Like</span>}
      </button>
    </form>
  );
}

function Trash({ onDelete }: { onDelete: () => void }) {
  return (
    <form class="inline-flex" onSubmit={(e) => { e.preventDefault(); if (confirm("Delete this message?")) onDelete(); }}>
      <button type="submit" title="Delete" class="cursor-pointer rounded-full p-1 text-gray-300 hover:bg-rose-50 hover:text-rose-600">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width={1.5} stroke="currentColor" class="h-4 w-4">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
          />
        </svg>
      </button>
    </form>
  );
}

function Composer({ onPost }: { onPost: (text: string) => Promise<boolean> }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  function send(e?: Event) {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    box.current?.focus();
    // shows instantly; if the server refuses it, the text comes back so nothing is lost
    void onPost(t).then((ok) => { if (!ok) setText((cur) => cur || t); });
  }
  return (
    <form class="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100" onSubmit={send}>
      <textarea
        required
        rows={1}
        class="block w-full resize-none border-0 bg-transparent p-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
        placeholder="Your message..."
        autocomplete="off"
        autoFocus
        name="message"
        ref={box}
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.isComposing) void send(e);
        }}
      />
      <div class="mt-2 flex items-center justify-between gap-2">
        <span class="text-xs text-gray-400">
          Try <code class="rounded bg-gray-100 px-1 text-gray-600">/gif cats</code><span class="hidden sm:inline"> · Shift+Enter for a new line</span>
        </span>
        <button
          type="submit"
          disabled={!text.trim()}
          class="cursor-pointer rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </form>
  );
}

export default function Messages({ data }: PageProps<Msg[]>) {
  const { name: myName } = useSession();
  const [messages, setMessages] = useState(data);
  // Optimistic UI: every action shows instantly; the server catches up in the background.
  // Sent-but-unconfirmed messages live apart so a refresh can't drop them.
  const [pending, setPending] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => patchSession({ unread: false }), []);
  const inflight = useRef(0);
  const tempId = useRef(-1);
  async function sync(call: Promise<unknown>, undo: () => void): Promise<boolean> {
    inflight.current++;
    setError(null);
    try {
      await call;
      return true;
    } catch (e) {
      undo();
      setError((e as Error).message || "Something went wrong");
      return false;
    } finally {
      // refresh once the last action settles, so a refresh never undoes an action still in flight
      if (--inflight.current === 0) {
        try { setMessages(await rpc<Msg[]>("messages_page")); } catch { /* keep what we have */ }
        setPending((p) => p.filter((m) => !m.confirmed));
      }
    }
  }
  const like = (id: number) => {
    if (!myName) return;
    const set = (f: (likes: string[]) => string[]) =>
      setMessages((ms) => ms.map((m) => m.message_id === id ? { ...m, likes: f(m.likes ?? []) } : m));
    set((l) => [...l, myName]);
    void sync(rpc("like_message", { p_id: id }), () => set((l) => l.filter((x) => x !== myName)));
  };
  const remove = (id: number) => {
    const before = messages;
    setMessages((ms) => ms.filter((m) => m.message_id !== id));
    void sync(rpc("delete_message", { p_id: id }), () => setMessages(before));
  };
  const post = (text: string) => {
    const temp: Msg = { message_id: tempId.current--, name: myName ?? "", message: text, created_at: new Date().toISOString(), likes: [] };
    setPending((p) => [...p, temp]);
    return sync(
      rpc("post_message", { p_message: text }).then(() => { temp.confirmed = true; }),
      () => setPending((p) => p.filter((m) => m !== temp)),
    );
  };

  // oldest at the top, newest at the bottom next to the composer, like a chat app
  const thread = [...messages].reverse().concat(pending);
  const list = useRef<HTMLUListElement>(null);
  const last = thread[thread.length - 1]?.message_id;
  const toBottom = () => window.scrollTo(0, document.documentElement.scrollHeight);
  useEffect(toBottom, [last]);
  // GIFs and images load after the first paint and push the newest messages down: stay pinned to the
  // bottom while that happens, unless the reader has scrolled up.
  useEffect(() => {
    let pinned = true;
    const onScroll = () => {
      const el = document.documentElement;
      pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    const ro = new ResizeObserver(() => { if (pinned) toBottom(); });
    ro.observe(list.current!);
    addEventListener("scroll", onScroll, { passive: true });
    return () => { ro.disconnect(); removeEventListener("scroll", onScroll); };
  }, []);

  return (
    <div class="mx-auto max-w-2xl">
      {thread.length === 0 && (
        <p class="py-10 text-center text-sm text-gray-400">No messages this month. Say hi 👋</p>
      )}
      <ul ref={list} class="space-y-1 pb-3">
        {thread.map((m, i) => {
          const prev = thread[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          // same author within a few minutes reads as one burst: only its first message gets the header
          const startsBurst = newDay || prev.name !== m.name ||
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > BURST_MS;
          const mine = m.name === myName;
          return (
            <Fragment key={m.message_id}>
              {newDay && (
                <li role="presentation" class="flex items-center gap-3 pt-3 pb-1">
                  <span class="h-px flex-1 bg-gray-200" />
                  <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{dayLabel(m.created_at)}</span>
                  <span class="h-px flex-1 bg-gray-200" />
                </li>
              )}
              <li class={"group flex rounded-2xl px-3 " + (startsBurst ? "pt-3 pb-2 " : "pb-2 ") + (mine ? "bg-sky-50/60" : "hover:bg-gray-50") + (m.message_id < 0 ? " opacity-60" : "")}>
                <div class="min-w-0 flex-1">
                  {startsBurst && (
                    <div class="flex items-baseline gap-2">
                      <span class="font-semibold"><Name name={m.name} class="text-gray-900" /></span>
                      <time class="text-xs text-gray-400" dateTime={m.created_at} title={new Date(m.created_at).toLocaleString()}>
                        {fromNow(m.created_at)}
                      </time>
                    </div>
                  )}
                  <div class="whitespace-break-spaces break-words text-[15px] leading-snug text-gray-800">
                    <MessageText message={m.message} />
                  </div>
                  {m.message_id > 0 && <div class="mt-1.5 flex items-center gap-2">
                    <Like m={m} me={myName} onLike={() => like(m.message_id)} />
                    {!startsBurst && (
                      <time class="text-[11px] text-gray-400 opacity-0 transition group-hover:opacity-100" dateTime={m.created_at}>
                        {clock(m.created_at)}
                      </time>
                    )}
                    {mine && <span class="ml-auto"><Trash onDelete={() => remove(m.message_id)} /></span>}
                  </div>}
                </div>
              </li>
            </Fragment>
          );
        })}
      </ul>
      <div class="sticky bottom-0 -mx-4 -mb-4 bg-white px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && <p class="mb-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700 ring-1 ring-rose-200">Couldn't save that: {error}</p>}
        <Composer onPost={post} />
      </div>
    </div>
  );
}
