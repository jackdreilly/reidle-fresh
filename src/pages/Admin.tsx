import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { rpc } from "@/lib/supabase";
// ?inline: the stylesheet ships inside this chunk (a separate CSS chunk would add its name to the first-load bundle)
import css from "./admin.css?inline";

if (!document.getElementById("admin-css")) document.head.append(Object.assign(document.createElement("style"), { id: "admin-css", textContent: css }));

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
type Speed = {
  kinds: { kind: string; n: number; p50: number; p75: number; p90: number }[];
  pages: { path: string; n: number; p50: number; p90: number; first_p50: number | null }[];
};
const KINDS: Record<string, string> = {
  cold: "First page, fresh load", warm: "First page, app cached", nav: "Tapping around", cache: "Shown from the device",
};
const ms = (x: number | null | undefined) => x == null ? "–" : x < 1000 ? `${x} ms` : `${(x / 1000).toFixed(1)} s`;

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
  features: Record<string, number>;
  accounts: Record<string, number>;
  leagues: { id: number; name: string; is_public: boolean; members: number; games: number; players: number; messages: number }[];
  players: Player[];
  errors: { message: string; n: number; players: number; last_at: string; path: string | null }[];
  recent: Ev[];
  growth: Growth;
  speed?: Speed;
  asks?: {
    name: string; question: string; answer: string | null; ms: number | null; at: string;
    tools: { name: string; args?: Record<string, unknown>; ms?: number; error?: string }[] | null;
  }[];
  asks_7d?: number;
};
type Growth = {
  today: string; days_span: number;
  league_kpis: {
    made: number; new_7d: number; new_prev_7d: number; active_7d: number; active_prev_7d: number; with_friends: number;
    players_in_made: number; invite_opens_7d: number; invite_joins_7d: number;
  };
  weeks: {
    week: string; new_leagues: number; total_leagues: number; names: string[]; joins: number; members: number;
    active_leagues: number; games: number; new_players: number; invite_opens: number;
  }[];
  leagues: {
    id: number; name: string; is_public: boolean; created_at: string; created_by: string | null; commissioners: string[];
    members: number; joined_7d: number; joined_prev_7d: number; players_7d: number; players_prev_7d: number;
    games_7d: number; games_prev_7d: number; messages_7d: number; last_game: string | null; invite_opens: number; invite_joins: number;
  }[];
  new_players: NewPlayer[];
  arrivals: { signed_out: number; saw_sign_in: number; became_player: number };
  invites: { league: string; league_id: number; who: string; at: string; signed_in: boolean; joined: boolean; played: boolean; next_day: boolean }[];
};
type NewPlayer = {
  name: string; joined: string; login: string; via: string | null; started: boolean; played: boolean; first_play: string | null;
  next_day: boolean; week: boolean; days: number; saved: boolean; reminder: boolean; prompt: string | null;
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

function Card({ id, title, note, wide, children }: { id?: string; title: string; note?: ComponentChildren; wide?: boolean; children: ComponentChildren }) {
  return (
    <section id={id} class={"ad-card" + (wide ? " ad-wide" : "")}>
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
  invite_open: "opened an invite", reminder_prompt: "answered the reminder prompt",
};
function describe(e: Ev) {
  const d = e.data;
  if (e.kind === "game_finish") return `finished a ${d.type}${d.time ? ` in ${Number(d.time).toFixed(1)}s` : ""}`;
  if (e.kind === "sign_up" || e.kind === "sign_in") return `${KIND[e.kind]} (${[d.method, d.device].filter(Boolean).join(", ")})`;
  if (e.kind === "link") return `linked ${d.provider}`;
  if (e.kind === "reminder_prompt") return d.outcome === "settings" ? "opened reminder settings from the prompt" : "dismissed the reminder prompt";
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

/* ---------- growth: leagues ---------- */

/** Pacific calendar day of a timestamp (the server counts days in Pacific too). */
const pacific = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const addDays = (day: string, k: number) => new Date(Date.parse(day + "T12:00:00Z") + k * 864e5).toISOString().slice(0, 10);

/** "12 ▲3" style: this week's number and the change from the week before. */
function Wow({ now, prev }: { now: number; prev: number }) {
  const d = now - prev;
  return (
    <>
      {n(now)}
      {d !== 0 && <span class={"ad-delta " + (d > 0 ? "up" : "down")} title={`${n(prev)} the week before`}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>}
    </>
  );
}

function WeekChart({ weeks }: { weeks: Growth["weeks"] }) {
  const [hover, setHover] = useState<Growth["weeks"][number] | null>(null);
  const W = 720, H = 150, pad = 24, bw = (W - pad) / weeks.length;
  const max = Math.max(1, ...weeks.map((w) => w.total_leagues));
  const y = (v: number) => H - (v / max) * H;
  const line = weeks.map((w, i) => `${i ? "L" : "M"}${pad + i * bw + bw / 2},${y(w.total_leagues)}`).join(" ");
  return (
    <div class="ad-chart">
      <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Leagues by week" onMouseLeave={() => setHover(null)}>
        {[0, Math.round(max / 2), max].map((t) => (
          <g key={t}>
            <line class="grid" x1={pad} x2={W} y1={y(t)} y2={y(t)} />
            <text class="axis" x={0} y={y(t) + 3}>{n(t)}</text>
          </g>
        ))}
        {weeks.map((w, i) => (
          <g key={w.week} onMouseEnter={() => setHover(w)} onClick={() => setHover(w)}>
            <rect x={pad + i * bw} y={0} width={bw} height={H} fill="transparent" />
            <rect class="bar" x={pad + i * bw + bw * 0.2} y={y(w.new_leagues)} width={bw * 0.6} height={H - y(w.new_leagues)} rx={2} />
            {i % 2 === weeks.length % 2 && <text class="axis" x={pad + i * bw + bw / 2} y={H + 14} text-anchor="middle">{dayLabel(w.week)}</text>}
          </g>
        ))}
        <path class="line" d={line} />
        {weeks.map((w, i) => <circle key={w.week} class="pt" cx={pad + i * bw + bw / 2} cy={y(w.total_leagues)} r={3} />)}
      </svg>
      <div class="ad-tip">
        {hover
          ? <>Week of {dayLabel(hover.week)}: <b>{n(hover.new_leagues)}</b> new ({n(hover.total_leagues)} in all) · {n(hover.joins)} joins · {n(hover.active_leagues)} leagues played · {n(hover.games)} games{hover.names.length ? <> · {hover.names.join(", ")}</> : null}</>
          : <span class="ad-muted"><span class="ad-key bar" /> new leagues each week · <span class="ad-key line" /> leagues in all · tap a week</span>}
      </div>
    </div>
  );
}

function LeagueGrowth({ g }: { g: Growth }) {
  const k = g.league_kpis;
  const weeks = [...g.weeks].reverse();
  return (
    <>
      <div class="ad-kpis">
        <Kpi label="leagues made by players" value={n(k.made)} />
        <Kpi label="new this week (vs last)" value={<Wow now={k.new_7d} prev={k.new_prev_7d} />} />
        <Kpi label="leagues that played this week" value={<Wow now={k.active_7d} prev={k.active_prev_7d} />} />
        <Kpi label="with 2+ members" value={n(k.with_friends)} />
        <Kpi label="players in a made league" value={n(k.players_in_made)} />
        <Kpi label="invite opens → joins (7d)" value={`${n(k.invite_opens_7d)} → ${n(k.invite_joins_7d)}`} />
      </div>
      <h3>Week by week</h3>
      <WeekChart weeks={g.weeks} />
      <div class="ad-scroll">
        <table class="ad-table">
          <thead><tr><th>Week of</th><th>New</th><th>In all</th><th>Joins</th><th>Members</th><th>Played</th><th>Games</th><th>New players</th><th>Invite opens</th><th>New leagues</th></tr></thead>
          <tbody>
            {weeks.map((w, i) => {
              const prev = weeks[i + 1];
              return (
                <tr key={w.week}>
                  <td>{dayLabel(w.week)}</td>
                  <td>{prev ? <Wow now={w.new_leagues} prev={prev.new_leagues} /> : n(w.new_leagues)}</td>
                  <td>{n(w.total_leagues)}</td><td>{n(w.joins)}</td><td>{n(w.members)}</td>
                  <td>{prev ? <Wow now={w.active_leagues} prev={prev.active_leagues} /> : n(w.active_leagues)}</td>
                  <td>{n(w.games)}</td><td>{n(w.new_players)}</td><td>{n(w.invite_opens)}</td>
                  <td class="ad-names">{w.names.join(", ") || <span class="ad-muted">–</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p class="ad-muted">Members = players in a league someone made, counted by when they joined (people who left aren't counted). Played = leagues with a game that week.</p>
      <h3>Every league, newest first</h3>
      <div class="ad-scroll">
        <table class="ad-table">
          <thead><tr><th>League</th><th>Started</th><th>Members</th><th>Joined 7d</th><th>Players 7d</th><th>Games 7d</th><th>Chat 7d</th><th>Last game</th><th>Invites → joins</th></tr></thead>
          <tbody>
            {g.leagues.map((l) => (
              <tr key={l.id}>
                <td>
                  <b>{l.name}</b>{l.is_public ? <span class="ad-muted"> public</span> : null}
                  <div class="ad-muted">{l.commissioners.length ? `run by ${l.commissioners.join(", ")}` : l.created_by ? `by ${l.created_by}` : ""}</div>
                </td>
                <td>{dayLabel(pacific(l.created_at), { month: "short", day: "numeric", year: "2-digit" })}</td>
                <td>{n(l.members)}</td>
                <td><Wow now={l.joined_7d} prev={l.joined_prev_7d} /></td>
                <td><Wow now={l.players_7d} prev={l.players_prev_7d} /></td>
                <td><Wow now={l.games_7d} prev={l.games_prev_7d} /></td>
                <td>{n(l.messages_7d)}</td>
                <td>{ago(l.last_game)}</td>
                <td>{n(l.invite_opens)} → {n(l.invite_joins)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="ad-muted">▲▼ = change from the 7 days before.</p>
    </>
  );
}

/* ---------- growth: funnels ---------- */

/** Each step: how many, the share of the step before, and the share of the first step. */
function Steps({ steps }: { steps: [string, number, number?][] }) {
  const top = steps[0]?.[1] ?? 0;
  return (
    <div class="ad-funnel">
      {steps.map(([l, v, base], i) => {
        const prev = base ?? (i ? steps[i - 1][1] : v);
        const drop = i > 0 && prev > 0 && v / prev < 0.5;
        return (
          <div class="step" key={l}>
            <div class="ad-muted">{l} · <b class="ad-strong">{n(v)}</b>{i > 0 && (base === 0 ? " · too early to tell" : <> · {pct(v, prev)} of {base != null ? `${n(base)} who could` : "the step before"}</>)}</div>
            <div class={"bar" + (drop ? " drop" : "")} style={{ width: `${top ? Math.max(4, (v / top) * 100) : 4}%` }}>{pct(v, top)}</div>
          </div>
        );
      })}
    </div>
  );
}

const yes = (b: boolean, due = true) => <td class={b ? "ad-yes" : due ? "ad-no" : "ad-muted"}>{b ? "✓" : due ? "✗" : "·"}</td>;

function Funnels({ g, open }: { g: Growth; open: (name: string) => void }) {
  const [via, setVia] = useState<"all" | "invite" | "global">("all");
  const [more, setMore] = useState(false);
  const today = g.today;
  const ps = g.new_players.filter((p) => via === "all" || (via === "invite" ? !!p.via : !p.via));
  const played = ps.filter((p) => p.played);
  // the next day has to have happened before it can count
  const couldNext = played.filter((p) => addDays(pacific(p.first_play!), 1) < today);
  const couldWeek = played.filter((p) => addDays(pacific(p.first_play!), 7) < today);
  const inv = g.invites;
  const prompts = ps.reduce<Record<string, number>>((a, p) => {
    const k = p.prompt === "settings" ? "opened settings" : p.prompt === "dismissed" ? "dismissed" : p.played ? "not answered yet" : "hasn't played yet";
    a[k] = (a[k] ?? 0) + 1;
    return a;
  }, {});
  const shown = more ? ps : ps.slice(0, 30);
  return (
    <>
      <div style={{ marginBottom: "6px" }}>
        {([["all", "Everyone"], ["invite", "Came into a league"], ["global", "Only in Reidle Global"]] as const).map(([k, l]) => (
          <button type="button" key={k} class={"ad-pill" + (k === via ? " on" : "")} onClick={() => setVia(k)}>{l}</button>
        ))}
      </div>
      <div class="ad-grid">
        <div>
          <h3>New players</h3>
          <Steps steps={[
            ["Signed up", ps.length],
            ["Started a game", ps.filter((p) => p.started).length],
            ["Finished their first game", played.length],
            ["Played again the next day", couldNext.filter((p) => p.next_day).length, couldNext.length],
            ["Played again within a week", couldWeek.filter((p) => p.week).length, couldWeek.length],
            ["Saved their account", ps.filter((p) => p.saved).length, ps.length],
            ["Daily reminder on", ps.filter((p) => p.reminder).length, played.length],
          ]} />
        </div>
        <div>
          <h3>Invite links</h3>
          {!inv.length ? <p class="ad-muted">No invite opens in this period yet (counted from Oct 25).</p> : (
            <Steps steps={[
              ["Opened an invite", inv.length],
              ["Signed in", inv.filter((i) => i.signed_in).length],
              ["Joined the league", inv.filter((i) => i.joined).length],
              ["Played in it", inv.filter((i) => i.played).length],
              ["Came back the next day", inv.filter((i) => i.next_day).length],
            ]} />
          )}
          <h3>Arrived signed out</h3>
          <Steps steps={[
            ["Visits that started signed out", g.arrivals.signed_out],
            ["Saw the sign-in page", g.arrivals.saw_sign_in],
            ["Became a player in that visit", g.arrivals.became_player, g.arrivals.signed_out],
          ]} />
          <h3>Reminder prompt</h3>
          <HBars rows={sorted(prompts)} />
        </div>
      </div>
      {!!inv.length && (
        <>
          <h3>Invites by league</h3>
          <div class="ad-scroll">
            <table class="ad-table">
              <thead><tr><th>Who</th><th>League</th><th>Opened</th><th>Signed in</th><th>Joined</th><th>Played</th><th>Next day</th></tr></thead>
              <tbody>
                {inv.slice(0, 40).map((i, k) => (
                  <tr key={k}>
                    <td>{i.who}</td><td>{i.league}</td><td>{when(i.at)}</td>
                    {yes(i.signed_in)}{yes(i.joined)}{yes(i.played)}{yes(i.next_day, i.played)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <h3>Where each new player got to</h3>
      {!ps.length ? <p class="ad-muted">Nobody new in this period.</p> : (
        <div class="ad-scroll">
          <table class="ad-table">
            <thead><tr><th>Player</th><th>Joined</th><th>League</th><th>Login</th><th>Started</th><th>Finished</th><th>Next day</th><th>Week</th><th>Days</th><th>Saved</th><th>Reminder</th></tr></thead>
            <tbody>
              {shown.map((p) => {
                const fp = p.first_play && pacific(p.first_play);
                return (
                  <tr key={p.name} class="click" onClick={() => open(p.name)}>
                    <td>{p.name}</td><td>{when(p.joined)}</td><td>{p.via ?? <span class="ad-muted">Global</span>}</td><td>{p.login}</td>
                    {yes(p.started)}{yes(p.played)}
                    {yes(p.next_day, !!fp && addDays(fp, 1) < today)}{yes(p.week, !!fp && addDays(fp, 7) < today)}
                    <td>{n(p.days)}</td>{yes(p.saved)}{yes(p.reminder, p.played)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!more && ps.length > shown.length && <button type="button" class="ad-pill" onClick={() => setMore(true)}>Show all {ps.length}</button>}
      <p class="ad-muted">✗ = didn't (yet) · · = too early to tell. League = the first league they joined other than Reidle Global. Days are Pacific.</p>
    </>
  );
}

/* ---------- answer words ---------- */

type Difficulty = Record<string, { z: number; rank?: number; why?: string; rude?: 1 }>;
type Answer = { word: string; removed_at: string | null; days: number };
const WORD_VIEWS: [string, string][] = [["hard", "Hardest first"], ["rude", "Rude"], ["removed", "Removed"], ["az", "A–Z"]];

/** The answers pool: remove words so they're never drawn again (daily, challenges, battles), sorted by how obscure they are. */
function AnswerWords() {
  const [list, setList] = useState<Answer[] | null>(null);
  const [active, setActive] = useState(0);
  const [diff, setDiff] = useState<Difficulty>({});
  const [view, setView] = useState("hard");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(100);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    rpc<{ active: number; words: Answer[] }>("admin_answers").then((r) => { setList(r.words); setActive(r.active); }, (e) => setErr(String(e.message ?? e)));
    // scores ship in their own chunk (tools/gen-answer-difficulty.py), fetched only here
    import("@/data/answer-difficulty.json").then((m) => setDiff(m.default as Difficulty));
  }, []);
  const info = (w: string) => diff[w.toLowerCase()];
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = (list ?? []).filter((a) => (!s || a.word.toLowerCase().includes(s))
      && (view === "removed" ? !!a.removed_at : view === "rude" ? !!info(a.word)?.rude : true));
    // hand-ranked 100 first, then rarest by word frequency
    const key = (a: Answer) => { const d = info(a.word); return d?.rank ?? 100 + (d?.z ?? 0); };
    return view === "az" ? r : [...r].sort((a, b) => key(a) - key(b));
  }, [list, diff, view, q]);
  async function toggle(a: Answer) {
    setBusy(a.word); setErr("");
    try {
      const r = await rpc<{ removed_at: string | null; active: number }>("admin_set_answer", { p_word: a.word, p_removed: !a.removed_at });
      setList((l) => l && l.map((x) => (x.word === a.word ? { ...x, removed_at: r.removed_at } : x)));
      setActive(r.active);
    } catch (e) { setErr(String((e as Error).message ?? e)); }
    finally { setBusy(null); }
  }
  if (!list) return err ? <p class="ad-err">{err}</p> : <p class="ad-muted">Loading…</p>;
  const removed = list.length - active;
  return (
    <>
      <p class="ad-muted" style={{ marginBottom: "8px" }}>
        {n(active)} words in the pool · {n(removed)} removed. Removed words are never picked again for dailies, challenges or battles
        (today's word stays). Practice still uses the full list. Frequency is the Zipf score: 1 = very rare, 3 = uncommon, 5+ = everyday.
      </p>
      <div style={{ marginBottom: "8px" }}>
        {WORD_VIEWS.map(([k, l]) => (
          <button type="button" key={k} class={"ad-pill" + (k === view ? " on" : "")} onClick={() => { setView(k); setLimit(100); }}>{l}</button>
        ))}
        <input class="ad-search" type="search" placeholder="Find a word" aria-label="Find a word" value={q}
          onInput={(e) => { setQ((e.target as HTMLInputElement).value); setLimit(100); }} />
      </div>
      {err && <p class="ad-err">{err}</p>}
      {!rows.length ? <p class="ad-muted">No words here.</p> : (
        <div class="ad-scroll">
          <table class="ad-table">
            <thead><tr><th>Word</th><th>Hard rank</th><th>Frequency</th><th>Times used</th><th style={{ textAlign: "left" }}>Why it's hard</th><th /></tr></thead>
            <tbody>
              {rows.slice(0, limit).map((a) => {
                const d = info(a.word);
                return (
                  <tr key={a.word} class={a.removed_at ? "ad-gone" : ""}>
                    <td class="ad-strong">{a.word.toUpperCase()}{d?.rude && <span class="ad-pill" style={{ marginLeft: "6px" }}>rude</span>}</td>
                    <td>{d?.rank ?? "–"}</td>
                    <td>{d ? d.z.toFixed(1) : "–"}</td>
                    <td>{n(a.days)}</td>
                    <td class="ad-names">{d?.why ?? ""}</td>
                    <td>
                      <button type="button" class={"ad-pill" + (a.removed_at ? "" : " ad-remove")} disabled={busy === a.word} onClick={() => toggle(a)}>
                        {a.removed_at ? "Put back" : "Remove"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && <button type="button" class="ad-pill" onClick={() => setLimit(limit + 200)}>Show more ({n(rows.length - limit)} left)</button>}
    </>
  );
}

/* ---------- page ---------- */

const PERIODS = [7, 30, 90];
const SECTIONS: [string, string][] = [
  ["overview", "Overview"], ["leagues", "Leagues"], ["funnel", "Funnel"], ["usage", "Usage"], ["pages", "Pages"], ["speed", "Speed"],
  ["players", "Players"], ["retention", "Retention"], ["asks", "Reidog"], ["words", "Words"], ["errors", "Errors"], ["activity", "Activity"],
];
const LENGTHS: [string, string][] = [["under_1m", "under 1 min"], ["1_3m", "1–3 min"], ["3_10m", "3–10 min"], ["10_30m", "10–30 min"], ["over_30m", "30+ min"]];

/** Owner-only dashboard: who plays, when, for how long, what they use, and what breaks. */
export default function Admin({ data }: PageProps<AdminData>) {
  const [player, setPlayer] = useState<string | null>(null);
  const k = data.kpis, span = data.days_span;
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

      <Card id="leagues" title="Leagues" note="weeks start Monday, Pacific">
        <LeagueGrowth g={data.growth} />
      </Card>

      <Card id="funnel" title="Funnel" note={`people who signed up in the last ${span} days`}>
        <Funnels g={data.growth} open={setPlayer} />
      </Card>

      <div id="usage" class="ad-grid">
        <Card title="When people play" note="games by weekday and hour, Pacific" wide>
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

      {data.speed && (
        <Card id="speed" title="Speed" note="from tap (or opening the app) until the page is on screen">
          <div class="ad-scroll">
            <table class="ad-table">
              <thead><tr><th>How</th><th>Pages</th><th>Median</th><th>75%</th><th>90%</th></tr></thead>
              <tbody>
                {data.speed.kinds.map((k) => (
                  <tr key={k.kind}><td>{KINDS[k.kind] ?? k.kind}</td><td>{n(k.n)}</td><td>{ms(k.p50)}</td><td>{ms(k.p75)}</td><td>{ms(k.p90)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>By page</h3>
          <div class="ad-scroll">
            <table class="ad-table">
              <thead><tr><th>Page</th><th>Shown</th><th>Median</th><th>90%</th><th>First page median</th></tr></thead>
              <tbody>
                {data.speed.pages.map((p) => (
                  <tr key={p.path}><td>{p.path}</td><td>{n(p.n)}</td><td>{ms(p.p50)}</td><td>{ms(p.p90)}</td><td>{ms(p.first_p50)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.speed.kinds.length && <p class="ad-muted">Timings are recorded from when this was switched on.</p>}
        </Card>
      )}

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

      {data.asks && (
        <Card id="asks" title="Asked Reidog" note={`${n(data.asks_7d)} questions in 7 days · latest 100`}>
          {!data.asks.length ? <p class="ad-muted">Nobody has asked yet.</p> : data.asks.map((a, i) => (
            <details class="ad-visit" key={i}>
              <summary style={{ cursor: "pointer" }}>
                <span class="ad-muted">{when(a.at)} · </span><b>{a.name}</b>: {a.question}
                {a.tools?.length ? <span class="ad-muted"> · looked up {[...new Set(a.tools.map((t) => t.name))].join(", ")}</span> : null}
              </summary>
              {a.tools?.map((t, j) => (
                <div key={j} class="ad-muted" style={{ fontFamily: "ui-monospace, monospace", fontSize: "12px", whiteSpace: "pre-wrap", marginTop: "4px" }}>
                  {t.name}{t.args && Object.keys(t.args).length ? ` ${Object.values(t.args).join(", ")}` : ""}
                  {t.ms != null ? ` · ${ms(t.ms)}` : ""}{t.error ? ` · ✗ ${t.error}` : ""}
                </div>
              ))}
              <p style={{ whiteSpace: "pre-wrap", color: "var(--ad-sub)", marginTop: "4px" }}>{a.answer ?? "(no answer)"}</p>
              {a.ms != null && <p class="ad-muted">{ms(a.ms)}</p>}
            </details>
          ))}
        </Card>
      )}

      <Card id="words" title="Answer words" note="the pool daily words are drawn from">
        <AnswerWords />
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
