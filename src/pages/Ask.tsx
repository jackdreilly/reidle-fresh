import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { accessToken, config } from "@/lib/supabase";
import { leagueId } from "@/lib/league";

// Ask Reidog: an AI help chat about how Reidle works. The `ask` edge function (supabase/functions/ask) streams
// Gemini's answer back as plain text. The conversation lives in this tab (sessionStorage), so following one of
// Reidog's links and coming back keeps it.

type Turn = { role: "user" | "model"; text: string };
const KEY = "reidle:ask";
const SIGNED_OUT = "You've been signed out on this device.";
const STARTERS = [
  "How does scoring work?", "How do I invite friends?", "What are challenges?", "Why don't I get notifications?",
];

const load = (): Turn[] => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const save = (t: Turn[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch { /* ignore */ } };

/** **bold** and [links](/in-app paths) only: anything else stays plain text. */
function inline(s: string): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/[A-Za-z0-9_\-/#?=.]*)\)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out.push(s.slice(last, m.index));
    out.push(m[1] ? <b>{m[1]}</b> : <a href={m[3]} class="font-medium text-sky-600 underline">{m[2]}</a>);
    last = re.lastIndex;
  }
  out.push(s.slice(last));
  return out;
}

function Answer({ text }: { text: string }) {
  const blocks: ComponentChildren[] = [];
  let items: string[] = [];
  const flush = () => {
    if (items.length) blocks.push(<ul class="list-disc space-y-1 pl-5">{items.map((i) => <li>{inline(i)}</li>)}</ul>);
    items = [];
  };
  for (const line of text.split("\n")) {
    const li = line.match(/^\s*[-*•]\s+(.*)$/) ?? line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (li) { items.push(li[1]); continue; }
    flush();
    if (line.trim()) blocks.push(<p>{inline(line)}</p>);
  }
  flush();
  return <div class="space-y-2">{blocks}</div>;
}

const Dog = ({ size = "h-8 w-8" }: { size?: string }) =>
  <img src="/android-chrome-96x96.webp" alt="" width="32" height="32" class={size + " shrink-0 rounded-full"} />;

export default function Ask({ query }: PageProps) {
  const [turns, setTurns] = useState<Turn[]>(load);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const from = useRef(query.get("from"));
  useEffect(() => { if (turns.length) window.scrollTo(0, document.documentElement.scrollHeight); }, [turns]);

  async function ask(q: string) {
    q = q.trim();
    if (!q || busy) return;
    const history: Turn[] = [...turns, { role: "user", text: q }];
    setTurns([...history, { role: "model", text: "" }]);
    setText("");
    setBusy(true);
    setError("");
    let answer = "";
    try {
      const token = await accessToken();
      if (!token) throw new Error(SIGNED_OUT); // the login ran out on this device (a failed token refresh)
      const league = leagueId();
      const res = await fetch(`${config.URL}/functions/v1/ask`, {
        method: "POST",
        headers: {
          apikey: config.KEY, authorization: `Bearer ${token}`, "content-type": "application/json",
          ...(league ? { "x-league": String(league) } : {}),
        },
        body: JSON.stringify({ messages: history, page: from.current }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.message ?? "Reidog couldn't answer just now.");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += value;
        setTurns([...history, { role: "model", text: answer }]);
      }
      save([...history, { role: "model", text: answer }]);
    } catch (e) {
      // keep the question in the box so nothing is lost
      setTurns(turns);
      setText(q);
      setError((e as Error).message || "Reidog couldn't answer just now.");
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  }

  return (
    <div class="mx-auto max-w-xl space-y-3">
      <div class="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <Dog size="h-11 w-11" />
        <div class="min-w-0 flex-1">
          <h1 class="text-lg font-semibold text-gray-900">Ask Reidog</h1>
          <p class="mt-1 text-sm text-gray-700">Woof! I know how everything in Reidle works: the rules, points, leagues, challenges, notifications and your account. Ask me anything.</p>
        </div>
        {!!turns.length && !busy && (
          <button type="button" class="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
            onClick={() => { setTurns([]); save([]); setError(""); }}>
            New chat
          </button>
        )}
      </div>

      {!turns.length && (
        <div class="flex flex-wrap gap-2" aria-label="Suggested questions">
          {STARTERS.map((s) => (
            <button type="button" onClick={() => ask(s)}
              class="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">{s}</button>
          ))}
        </div>
      )}

      <ul class="space-y-3" aria-label="Conversation with Reidog" aria-live="polite">
        {turns.map((t, i) => t.role === "user"
          ? (
            <li key={i} class="flex justify-end">
              <div class="max-w-[85%] whitespace-break-spaces break-words rounded-2xl bg-sky-500 px-3 py-2 text-[15px] leading-snug text-white">{t.text}</div>
            </li>
          )
          : (
            <li key={i} class="flex items-start gap-2">
              <Dog />
              <div class="min-w-0 max-w-[85%] break-words rounded-2xl bg-gray-100 px-3 py-2 text-[15px] leading-snug text-gray-900">
                {t.text ? <Answer text={t.text} /> : <span class="text-gray-500">Sniffing around…</span>}
              </div>
            </li>
          ))}
      </ul>

      <form class="sticky bottom-0 -mx-4 bg-white px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        {error && (
          <p class="mb-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700 ring-1 ring-rose-200">
            {error}{error === SIGNED_OUT && <> <a href="/sign-in?redirect=/ask" class="font-medium underline">Sign in again</a> to ask Reidog.</>}
          </p>
        )}
        <div class="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100">
          <label for="ask-text" class="sr-only">Your question</label>
          <textarea
            id="ask-text"
            ref={box}
            rows={1}
            maxLength={1000}
            class="block w-full resize-none border-0 bg-transparent p-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
            placeholder="Ask about Reidle…"
            value={text}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); void ask(text); } }}
          />
          <button type="submit" disabled={busy || !text.trim()}
            class="shrink-0 rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40">
            Ask
          </button>
        </div>
        <p class="mt-1 px-1 text-[11px] text-gray-400">Reidog is an AI and can get things wrong. Questions are saved to help improve Reidle.</p>
      </form>
    </div>
  );
}
