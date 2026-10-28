import { useEffect, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { rpc } from "@/lib/supabase";
import { flushPush } from "@/lib/push";
import { refreshSession } from "@/lib/session";
// ?inline, like Admin.tsx: the stylesheet ships inside this chunk (this file is outside the Tailwind scan too)
import css from "./admin.css?inline";

if (!document.getElementById("admin-css")) document.head.append(Object.assign(document.createElement("style"), { id: "admin-css", textContent: css }));

// One Contact Jack conversation (admin_feedback / admin_reply / admin_feedback_done). Opened from the Inbox on /admin
// or from the push a new message sends.

type Msg = { id: number; from_jack: boolean; body: string; created_at: string; path?: string | null; device?: string | null; league?: string | null };
type Data = {
  name: string; email: string | null; done: boolean; player_seen_at: string | null; messages: Msg[];
  player: { joined: string; login: string; leagues: string[]; games: number; last_game: string | null };
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function AdminInbox({ data }: PageProps<Data>) {
  const [messages, setMessages] = useState(data.messages);
  const [done, setDone] = useState(data.done);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const p = data.player;
  useEffect(() => { refreshSession().catch(() => {}); }, []); // opening it read it: the menu count drops

  async function reply(e: Event) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const m = await rpc<Msg>("admin_reply", { p_name: data.name, p_body: text });
      flushPush();
      setMessages((ms) => [...ms, m]);
      setText("");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const toggleDone = () => {
    setDone(!done);
    void rpc("admin_feedback_done", { p_name: data.name, p_done: !done }).then(() => refreshSession(), () => setDone(done));
  };
  const lastJack = [...messages].reverse().find((m) => m.from_jack);

  return (
    <div class="ad" style={{ maxWidth: "44rem" }}>
      <div class="ad-head">
        <a href="/admin" class="ad-muted">← Inbox</a>
        <button type="button" class={"ad-pill" + (done ? " on" : "")} onClick={toggleDone}>{done ? "Done (reopen)" : "Mark done"}</button>
      </div>
      <section class="ad-card">
        <h2><a href={`/players/${encodeURIComponent(data.name)}`}>{data.name}</a><span class="ad-muted">{p.login}</span></h2>
        <p class="ad-muted">
          Joined {new Date(p.joined).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {p.games} games
          {p.last_game ? ` (last ${when(p.last_game)})` : ""} · {p.leagues.join(", ") || "no league"}
        </p>
        {data.email && <p style={{ marginTop: "4px" }}>Email: <a href={`mailto:${data.email}?subject=${encodeURIComponent("Re: your message about Reidle")}`} style={{ textDecoration: "underline" }}>{data.email}</a></p>}
      </section>
      <section class="ad-card">
        <ul class="ad-convo">
          {messages.map((m) => (
            <li key={m.id} class={m.from_jack ? "jack" : ""}>
              <div class="bubble">{m.body}</div>
              <span class="meta">
                {when(m.created_at)}
                {!m.from_jack && [m.league, m.path, m.device].filter(Boolean).length ? ` · ${[m.league, m.path, m.device].filter(Boolean).join(" · ")}` : ""}
                {m === lastJack && (data.player_seen_at && data.player_seen_at >= m.created_at ? ` · seen ${when(data.player_seen_at)}` : " · not seen yet")}
              </span>
            </li>
          ))}
        </ul>
        <form class="ad-reply" onSubmit={reply} style={{ marginTop: "12px" }}>
          <textarea aria-label={`Reply to ${data.name}`} placeholder={`Reply to ${data.name}…`} maxLength={2000} value={text}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
          <div class="row">
            <span class="ad-muted">They get a push (if they turned notifications on) and a dot in the menu.</span>
            <button type="submit" class="ad-btn" disabled={busy || !text.trim()}>{busy ? "Sending…" : "Send"}</button>
          </div>
          {err && <p class="ad-err">{err}</p>}
        </form>
      </section>
    </div>
  );
}
