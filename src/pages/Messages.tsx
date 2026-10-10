import { Fragment } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { Name } from "@/components/DailyTable";
import MessageText from "@/components/MessageText";
import { rpc } from "@/lib/supabase";
import { patchSession, useSession } from "@/lib/session";
import { fromNow } from "@/lib/time";

type Msg = { message_id: number; name: string; message: string; created_at: string; likes: string[] };

// Same author within this window reads as one burst: one header, tighter spacing.
const BURST_MS = 5 * 60 * 1000;
const AVATAR = ["bg-sky-500", "bg-pink-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500", "bg-teal-500", "bg-indigo-500"];
const avatarColor = (name: string) => AVATAR[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR.length];

const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string) {
  const d = new Date(iso), today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Avatar({ name }: { name: string }) {
  return (
    <a href={`/players/${name}`} class={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase text-white " + avatarColor(name)}>
      {name.trim().charAt(0)}
    </a>
  );
}

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

function Composer({ onPost }: { onPost: (text: string) => Promise<void> }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(e?: Event) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onPost(t);
      setText("");
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  }
  return (
    <form class="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100" onSubmit={send}>
      <textarea
        required
        rows={2}
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
          disabled={busy || !text.trim()}
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
  useEffect(() => patchSession({ unread: false }), []);
  const reload = async () => setMessages(await rpc<Msg[]>("messages_page"));
  async function act(fn: string, id: number) {
    await rpc(fn, { p_id: id });
    await reload();
  }
  async function post(text: string) {
    await rpc("post_message", { p_message: text });
    await reload();
  }

  return (
    <div class="mx-auto max-w-2xl space-y-4">
      <Composer onPost={post} />
      {messages.length === 0 && (
        <p class="py-10 text-center text-sm text-gray-400">No messages this month. Say hi 👋</p>
      )}
      <ul class="space-y-1">
        {messages.map((m, i) => {
          // newest first: the message above is newer
          const newer = messages[i - 1];
          const newDay = !newer || dayKey(newer.created_at) !== dayKey(m.created_at);
          // the burst header sits on its newest (topmost) message; older ones from the same author tuck under it
          const startsBurst = newDay || newer.name !== m.name ||
            new Date(newer.created_at).getTime() - new Date(m.created_at).getTime() > BURST_MS;
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
              <li class={"group flex gap-3 rounded-2xl px-3 " + (startsBurst ? "pt-3 pb-2 " : "pb-2 ") + (mine ? "bg-sky-50/60" : "hover:bg-gray-50")}>
                <div class="w-9 shrink-0">{startsBurst && <Avatar name={m.name} />}</div>
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
                  <div class="mt-1.5 flex items-center gap-2">
                    <Like m={m} me={myName} onLike={() => void act("like_message", m.message_id)} />
                    {!startsBurst && (
                      <time class="text-[11px] text-gray-400 opacity-0 transition group-hover:opacity-100" dateTime={m.created_at}>
                        {clock(m.created_at)}
                      </time>
                    )}
                    {mine && <span class="ml-auto"><Trash onDelete={() => void act("delete_message", m.message_id)} /></span>}
                  </div>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
