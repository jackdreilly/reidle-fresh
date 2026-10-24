import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { rpc } from "@/lib/supabase";
import "./admin.css";

// Owner dashboard (admin_stats / admin_player). Styled by admin.css only: this file is outside the Tailwind scan.

type Day = {
  day: string; active: number; visits: number; minutes: number; views: number; daily: number; challenges: number;
  starts: number; new_players: number; sign_ins: number; sign_ups: number; messages: number; errors: number;
};
type Ev = { at: string; kind: string; name?: string | null; league: number | null; data: Record<string, unknown> };
type Player = {
  name: string; joined: string; login: string; last_seen: string | null; games_7d: number; games_30d: number;
  games_all: number; visits_7d: number; minutes_7d: number; device: string | null; leagues: number;
};
export type AdminData = {
  since: string; today: string; days_span: number;
  kpis: {
    dau: number; wau: number; mau: number; visits_today: number; games_today: number; new_7d: number;
    median_visit_s: number | null; minutes_per_player_day: number | null; players: number; leagues: number;
  };
  days: Day[];
  heatmap: [number, number, number][];
  visit_lengths: Record<string, number>;
  pages: { path: string; views: number; visitors: number; avg_s: number; minutes: number }[];
  entries: { entry: string; n: number }[];
  referrers: { referrer: string; n: number }[];
  devices: Record<string, number>;
  app_share: { app: number; browser: number; dark: number; total: number };
  retention: { week: string; size: number; back: number[] }[];
  funnel: { signed_up: number; played: number; returned: number; verified: number };
  features: Record<string, number>;
  accounts: Record<string, number>;
  leagues: { id: number; name: string; is_public: boolean; members: number; games: number; players: number; messages: number }[];
  players: Player[];
  errors: { message: string; n: number; players: number; last_at: string; path: string | null }[];
  recent: Ev[];
};
type PlayerDetail = {
  name: string; joined: string; login: string; leagues: string[];
  games: { all: number; dailies: number; challenges: number; days: number; best: number | null; median: number | null; wins: number; first: string | null; last: string | null };
  time: { visits_30d: number; minutes_30d: number; median_visit_s: number | null };
  pages: { path: string; views: number; minutes: number }[];
  visits: { started_at: string; active_ms: number; pages: number; device: string | null; pwa: boolean | null; path: string[] }[];
  events: Ev[];
};

/* ---------- formatting ---------- */

const nf = new Intl.NumberFormat();
const n = (x: number | null | undefined) => (x == null ? "–" : nf.format(x));
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
function dur(s: number | null | undefined) {
  if (s == null) return "–";
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
}
function ago(iso: string | null) {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });

/* ---------- building blocks ---------- */

function Card({ id, title, note, children }: { id?: string; title: string; note?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section id={id} class="ad-card">
      <h2>{title}{note && <span class="ad-muted">{note}</span>}</h2>
      {children}
    </section>
  );
}

const Kpi = ({ label, value }: { label: string; value: ComponentChildren }) => (
  <div class="ad-kpi"><b>{value}</b><span>{label}</span></div>
);

function HBars({ rows, fmt = n }: { rows: [string, number][]; fmt?: (x: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p class="ad-muted">Nothing yet.</p>;
  return (
    <div>
      {rows.map(([label, v]) => (
        <div class="ad-hbar" key={label}>
          <span class="lab" title={label}>{label}</span>
          <span class="track"><span class="fill" style={{ display: "block", width: `${(v / max) * 100}%` }} /></span>
          <span class="num">{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

const sorted = (o: Record<string, number>): [string, number][] => Object.entries(o).sort((a, b) => b[1] - a[1]);

/* ---------- daily chart ---------- */

const METRICS: [keyof Day, string][] = [
  ["active", "Active players"], ["visits", "Visits"], ["minutes", "Minutes on site"], ["daily", "Dailies"],
  ["challenges", "Challenges"], ["new_players", "New players"], ["messages", "Chat messages"], ["errors", "Errors"],
];

function DailyChart({ days }: { days: Day[] }) {
  const [metric, setMetric] = useState<keyof Day>("active");
  const [hover, setHover] = useState<Day | null>(null);
  const vals = days.map((d) => Number(d[metric]) || 0);
  const max = Math.max(1, ...vals);
  const W = 720, H = 180, pad = 24, bw = (W - pad) / days.length;
  const ticks = [0, Math.round(max / 2), max];
  const label = METRICS.find((m) => m[0] === metric)![1];
  const every = Math.ceil(days.length / 8);
  return (
    <div class="ad-chart">
      <div style={{ marginBottom: "8px" }}>
        {METRICS.map(([k, l]) => (
          <button type="button" key={k} class={"ad-pill" + (k === metric ? " on" : "")} onClick={() => setMetric(k)}>{l}</button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`${label} per day`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line class="grid" x1={pad} x2={W} y1={H - (t / max) * H} y2={H - (t / max) * H} />
            <text class="axis" x={0} y={H - (t / max) * H + 3}>{n(t)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const h = (vals[i] / max) * H;
          return (
            <g key={d.day} onMouseEnter={() => setHover(d)} onClick={() => setHover(d)}>
              <rect x={pad + i * bw} y={0} width={bw} height={H} fill="transparent" />
              <rect class="bar" x={pad + i * bw + bw * 0.15} y={H - h} width={bw * 0.7} height={Math.max(h, vals[i] ? 1 : 0)} rx={2} />
              {i % every === 0 && <text class="axis" x={pad + i * bw + bw / 2} y={H + 14} text-anchor="middle">{dayLabel(d.day)}</text>}
            </g>
          );
        })}
      </svg>
      <div class="ad-tip">
        {hover
          ? <>{dayLabel(hover.day, { weekday: "short", month: "short", day: "numeric" })}: <b>{n(Number(hover[metric]))}</b> {label.toLowerCase()} · {n(hover.active)} active · {n(hover.visits)} visits · {n(hover.minutes)} min · {n(hover.daily)} dailies</>
          : <span class="ad-muted">Total {n(vals.reduce((a, b) => a + b, 0))} · tap or hover a day for details</span>}
      </div>
    </div>
  );
}

/* ---------- heatmap ---------- */

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function Heatmap({ cells }: { cells: [number, number, number][] }) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const [d, h, c] of cells) grid[d][h] = c;
  const max = Math.max(1, ...cells.map((c) => c[2]));
  return (
    <div class="ad-heat">
      <span />
      {Array.from({ length: 24 }, (_, h) => <span key={h} style={{ textAlign: "center" }}>{h % 6 === 0 ? (h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`) : ""}</span>)}
      {grid.map((row, d) => [
        <span class="lbl" key={"l" + d}>{DOW[d]}</span>,
        ...row.map((c, h) => <i key={`${d}-${h}`} title={`${DOW[d]} ${h}:00 · ${c} games`} style={{ opacity: c ? 0.15 + 0.85 * (c / max) : 0.05 }} />),
      ])}
    </div>
  );
}

/* ---------- players ---------- */

type SortKey = keyof Player;
const PLAYER_COLS: [SortKey, string][] = [
  ["last_seen", "Last seen"], ["games_7d", "Games 7d"], ["games_30d", "30d"], ["games_all", "All"],
  ["visits_7d", "Visits 7d"], ["minutes_7d", "Min 7d"], ["leagues", "Leagues"], ["login", "Login"], ["device", "Device"], ["joined", "Joined"],
];

function Players({ players, open }: { players: Player[]; open: (name: string) => void }) {
  const [sort, setSort] = useState<SortKey>("last_seen");
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    const f = players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    return f.sort((a, b) => {
      const x = a[sort], y = b[sort];
      if (x == null) return 1;
      if (y == null) return -1;
      return typeof x === "number" ? (y as number) - x : String(y).localeCompare(String(x));
    });
  }, [players, sort, q]);
  const shown = all || q ? rows : rows.slice(0, 40);
  const live = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < 15 * 60_000;
  return (
    <>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
        <input class="ad-search" placeholder="Find a player" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <span class="ad-muted">{rows.length} players · tap one for details · tap a column to sort</span>
      </div>
      <div class="ad-scroll">
        <table class="ad-table">
          <thead>
            <tr>
              <th class="sort" onClick={() => setSort("name")}>Player</th>
              {PLAYER_COLS.map(([k, l]) => <th key={k} class="sort" onClick={() => setSort(k)}>{l}{sort === k ? " ▾" : ""}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.name} class="click" onClick={() => open(p.name)}>
                <td><span class={"ad-dot" + (live(p.last_seen) ? " live" : "")} />{p.name}</td>
                <td>{ago(p.last_seen)}</td>
                <td>{n(p.games_7d)}</td><td>{n(p.games_30d)}</td><td>{n(p.games_all)}</td>
                <td>{n(p.visits_7d)}</td><td>{n(p.minutes_7d)}</td><td>{n(p.leagues)}</td>
                <td>{p.login}</td><td>{p.device ?? "–"}</td><td>{dayLabel(p.joined.slice(0, 10), { month: "short", day: "numeric", year: "2-digit" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!all && !q && rows.length > 40 && <button type="button" class="ad-pill" onClick={() => setAll(true)}>Show all {rows.length}</button>}
    </>
  );
}

function PlayerSheet({ name, close }: { name: string; close: () => void }) {
  const [d, setD] = useState<PlayerDetail | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { rpc<PlayerDetail>("admin_player", { p_name: name }).then(setD, (e) => setErr(String(e.message ?? e))); }, [name]);
  return (
    <div class="ad-sheet" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={name}>
        <div><button type="button" class="close" onClick={close} aria-label="Close">×</button><h2>{name}</h2></div>
        {err && <p class="ad-err">{err}</p>}
        {!d ? !err && <p class="ad-muted">Loading…</p> : (
          <>
            <p class="ad-muted">
              Joined {dayLabel(d.joined.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })} · {d.login} · {d.leagues.join(", ") || "no league"}
            </p>
            <div class="ad-kpis">
              <Kpi label="games" value={n(d.games.all)} />
              <Kpi label="days played" value={n(d.games.days)} />
              <Kpi label="daily wins" value={n(d.games.wins)} />
              <Kpi label="best daily" value={d.games.best == null ? "–" : `${d.games.best.toFixed(1)}s`} />
              <Kpi label="median time" value={d.games.median == null ? "–" : `${d.games.median}s`} />
              <Kpi label="visits, 30d" value={n(d.time.visits_30d)} />
              <Kpi label="minutes, 30d" value={n(d.time.minutes_30d)} />
              <Kpi label="median visit" value={dur(d.time.median_visit_s)} />
            </div>
            {!!d.pages.length && <><h3>Where they spend time (30d)</h3><HBars rows={d.pages.map((p) => [p.path, p.minutes])} fmt={(m) => `${m} min`} /></>}
            <h3>Recent visits</h3>
            {!d.visits.length ? <p class="ad-muted">No visits recorded yet.</p> : d.visits.map((v) => (
              <div class="ad-visit" key={v.started_at}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <span>{when(v.started_at)}</span>
                  <span class="ad-muted">{dur(v.active_ms / 1000)} · {v.pages} pages · {v.device ?? "?"}{v.pwa ? " app" : ""}</span>
                </div>
                <div class="ad-path">{v.path.map((p, i) => <span key={i}>{p}</span>)}</div>
              </div>
            ))}
            <h3>Latest moments</h3>
            <Feed events={d.events.map((e) => ({ ...e, name }))} />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- activity feed ---------- */

const KIND: Record<string, string> = {
  sign_up: "signed up", sign_in: "signed in", link: "linked", game_start: "started a daily", game_finish: "finished",
  message: "posted in chat", league_create: "created a league", league_join: "joined a league", error: "hit an error",
};
function describe(e: Ev) {
  const d = e.data;
  if (e.kind === "game_finish") return `finished a ${d.type}${d.time ? ` in ${Number(d.time).toFixed(1)}s` : ""}`;
  if (e.kind === "sign_up" || e.kind === "sign_in") return `${KIND[e.kind]} (${[d.method, d.device].filter(Boolean).join(", ")})`;
  if (e.kind === "link") return `linked ${d.provider}`;
  if (e.kind === "league_create") return `created league "${d.league}"`;
  if (e.kind === "error") return <>hit an error: <span class="ad-err">{String(d.message)}</span></>;
  return KIND[e.kind] ?? e.kind;
}

function Feed({ events, filter = true }: { events: Ev[]; filter?: boolean }) {
  const [kind, setKind] = useState("");
  const [more, setMore] = useState(false);
  const kinds = [...new Set(events.map((e) => e.kind))];
  const picked = kind ? events.filter((e) => e.kind === kind) : events;
  const shown = more ? picked : picked.slice(0, 25);
  return (
    <>
      {filter && kinds.length > 1 && (
        <div style={{ marginBottom: "6px" }}>
          <button type="button" class={"ad-pill" + (!kind ? " on" : "")} onClick={() => setKind("")}>all</button>
          {kinds.map((k) => <button type="button" key={k} class={"ad-pill" + (k === kind ? " on" : "")} onClick={() => setKind(k)}>{KIND[k] ?? k}</button>)}
        </div>
      )}
      <ul class="ad-feed">
        {shown.map((e, i) => (
          <li key={i}><time>{when(e.at)}</time><span><b>{e.name ?? "someone"}</b> {describe(e)}</span></li>
        ))}
      </ul>
      {picked.length > shown.length && <button type="button" class="ad-pill" onClick={() => setMore(true)}>Show {picked.length - shown.length} more</button>}
    </>
  );
}

/* ---------- page ---------- */

const PERIODS = [7, 30, 90];
const SECTIONS: [string, string][] = [
  ["overview", "Overview"], ["usage", "Usage"], ["pages", "Pages"], ["players", "Players"], ["retention", "Retention"],
  ["leagues", "Leagues"], ["errors", "Errors"], ["activity", "Activity"],
];
const LENGTHS: [string, string][] = [["under_1m", "under 1 min"], ["1_3m", "1–3 min"], ["3_10m", "3–10 min"], ["10_30m", "10–30 min"], ["over_30m", "30+ min"]];

/** Owner-only dashboard: who plays, when, for how long, what they use, and what breaks. */
export default function Admin({ data }: PageProps<AdminData>) {
  const [player, setPlayer] = useState<string | null>(null);
  const k = data.kpis, f = data.funnel, span = data.days_span;
  const totals = data.days.reduce((a, d) => ({ visits: a.visits + d.visits, minutes: a.minutes + d.minutes }), { visits: 0, minutes: 0 });
  return (
    <div class="ad">
      <div class="ad-head">
        <h1>Admin</h1>
        <div class="ad-seg" role="group" aria-label="Period">
          {PERIODS.map((p) => <a key={p} href={`/admin?days=${p}`} class={p === span ? "on" : ""}>{p} days</a>)}
        </div>
      </div>
      <nav class="ad-nav" aria-label="Sections">
        {SECTIONS.map(([id, l]) => <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }}>{l}</a>)}
      </nav>

      <div id="overview" class="ad-kpis">
        <Kpi label="active today" value={n(k.dau)} />
        <Kpi label="active this week" value={n(k.wau)} />
        <Kpi label="active this month" value={n(k.mau)} />
        <Kpi label="stickiness (day ÷ month)" value={pct(k.dau, k.mau)} />
        <Kpi label="games today" value={n(k.games_today)} />
        <Kpi label="visits today" value={n(k.visits_today)} />
        <Kpi label="median visit (7d)" value={dur(k.median_visit_s)} />
        <Kpi label="minutes a player a day (7d)" value={k.minutes_per_player_day ?? "–"} />
        <Kpi label="new players (7d)" value={n(k.new_7d)} />
        <Kpi label="players · leagues" value={`${n(k.players)} · ${n(k.leagues)}`} />
      </div>

      <Card title="Day by day" note={`last ${span} days, Pacific`}>
        <DailyChart days={data.days} />
      </Card>

      <div id="usage" class="ad-grid">
        <Card title="When people play" note="games by weekday and hour, Pacific">
          <Heatmap cells={data.heatmap} />
        </Card>
        <Card title="How long a visit lasts" note={`${n(totals.visits)} visits · ${n(totals.minutes)} min`}>
          <HBars rows={LENGTHS.map(([key, l]) => [l, data.visit_lengths[key] ?? 0])} />
          <h3>Devices</h3>
          <HBars rows={sorted(data.devices)} />
          <p class="ad-muted" style={{ marginTop: "6px" }}>
            {pct(data.app_share.app, data.app_share.total)} from the Home Screen app · {pct(data.app_share.dark, data.app_share.total)} in dark mode
          </p>
        </Card>
        <Card title="New players" note={`signed up in the last ${span} days`}>
          <div class="ad-funnel">
            {([["Signed up", f.signed_up], ["Finished a game", f.played], ["Came back another day", f.returned], ["Saved their account", f.verified]] as [string, number][]).map(([l, v]) => (
              <div class="step" key={l}>
                <div class="ad-muted">{l} · {n(v)} ({pct(v, f.signed_up)})</div>
                <div class="bar" style={{ width: `${f.signed_up ? Math.max(4, (v / f.signed_up) * 100) : 4}%` }}>{n(v)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="What gets used" note={`last ${span} days`}>
          <HBars rows={[
            ["Dailies", data.features.dailies], ["Challenges", data.features.challenges], ["Practice (views)", data.features.practice_views],
            ["Battles", data.features.battles], ["Chat messages", data.features.messages], ["Players chatting", data.features.chatters],
            ["Players with alerts on", data.features.push_players],
          ]} />
          <h3>Accounts</h3>
          <HBars rows={sorted(data.accounts)} />
        </Card>
      </div>

      <Card id="pages" title="Pages" note={`last ${span} days`}>
        <div class="ad-scroll">
          <table class="ad-table">
            <thead><tr><th>Page</th><th>Views</th><th>Visitors</th><th>Avg time</th><th>Total min</th></tr></thead>
            <tbody>
              {data.pages.map((p) => (
                <tr key={p.path}><td>{p.path}</td><td>{n(p.views)}</td><td>{n(p.visitors)}</td><td>{dur(p.avg_s)}</td><td>{n(p.minutes)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.pages.length && <p class="ad-muted">Visits are counted from when this page was switched on.</p>}
        <div class="ad-grid" style={{ marginTop: "8px" }}>
          <div><h3>Visits start on</h3><HBars rows={data.entries.map((e) => [e.entry, e.n])} /></div>
          <div><h3>Came from</h3><HBars rows={data.referrers.map((r) => [r.referrer, r.n])} /></div>
        </div>
      </Card>

      <Card id="players" title="Players" note="green dot = here in the last 15 min">
        <Players players={data.players} open={setPlayer} />
      </Card>

      <Card id="retention" title="Retention" note="players by the week of their first game: share who played again">
        <div class="ad-scroll">
          <table class="ad-table ad-cohort">
            <thead><tr><th>First week</th><th>Players</th><th>+1 wk</th><th>+2 wk</th><th>+3 wk</th><th>+4 wk</th></tr></thead>
            <tbody>
              {data.retention.map((c) => (
                <tr key={c.week}>
                  <td>{dayLabel(c.week)}</td><td>{n(c.size)}</td>
                  {c.back.map((b, i) => {
                    const due = new Date(c.week + "T00:00:00Z").getTime() + (i + 1) * 7 * 864e5 <= new Date(data.today + "T00:00:00Z").getTime();
                    const r = c.size ? b / c.size : 0;
                    return due
                      ? <td key={i} class="c" style={{ background: `rgb(14 165 233 / ${0.2 + 0.8 * r})` }} title={`${b} of ${c.size}`}>{pct(b, c.size)}</td>
                      : <td key={i} class="ad-muted">·</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card id="leagues" title="Leagues" note={`games and chat in the last ${span} days`}>
        <div class="ad-scroll">
          <table class="ad-table">
            <thead><tr><th>League</th><th>Members</th><th>Players</th><th>Games</th><th>Chat</th></tr></thead>
            <tbody>
              {data.leagues.map((l) => (
                <tr key={l.id}><td>{l.name}{l.is_public ? " (public)" : ""}</td><td>{n(l.members)}</td><td>{n(l.players)}</td><td>{n(l.games)}</td><td>{n(l.messages)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card id="errors" title="Browser errors" note="grouped by message">
        {!data.errors.length ? <p class="ad-muted">None in this period.</p> : (
          <div class="ad-scroll">
            <table class="ad-table">
              <thead><tr><th>Message</th><th>Times</th><th>Players</th><th>Last</th></tr></thead>
              <tbody>
                {data.errors.map((e) => (
                  <tr key={e.message}>
                    <td style={{ whiteSpace: "normal", minWidth: "220px" }}><div class="ad-err">{e.message}</div><div class="ad-muted">{e.path}</div></td>
                    <td>{n(e.n)}</td><td>{n(e.players)}</td><td>{ago(e.last_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card id="activity" title="Latest activity">
        <Feed events={data.recent} />
      </Card>

      {player && <PlayerSheet name={player} close={() => setPlayer(null)} />}
    </div>
  );
}
