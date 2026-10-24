import type { ComponentChildren } from "preact";
import type { PageProps } from "@/router";

type Day = {
  day: string; active: number; sign_ins: number; sign_ups: number; starts: number;
  daily: number; challenges: number; messages: number; errors: number;
};
type Ev = { at: string; kind: string; name: string | null; league: number | null; data: Record<string, unknown> };
type Err = { at: string; name: string | null; message: string; info: Record<string, unknown> | null };
export type AdminData = {
  since: string;
  days: Day[];
  totals: { players: number; played_7d: number; played_30d: number; leagues: number; accounts: Record<string, number> };
  sign_ups: Record<string, number>;
  devices: Record<string, number>;
  errors: Err[];
  recent: Ev[];
};

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";
const PERIODS = [7, 30, 90];

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const shortDay = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function Card({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class={card}>
      <h2 class="mb-2 font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div class="rounded-xl bg-gray-50 px-3 py-2">
      <div class="text-2xl font-bold tabular-nums text-gray-900">{value}</div>
      <div class="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function Counts({ data }: { data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <p class="text-sm text-gray-500">Nothing yet.</p>;
  return (
    <ul class="flex flex-wrap gap-2 text-sm">
      {rows.map(([k, n]) => <li key={k} class="rounded-full bg-gray-100 px-3 py-1 text-gray-700">{k} <b class="tabular-nums">{n}</b></li>)}
    </ul>
  );
}

const LABELS: Record<string, string> = {
  sign_up: "signed up", sign_in: "signed in", link: "linked", game_start: "started a daily", game_finish: "finished",
  message: "posted in chat", league_create: "created a league", league_join: "joined a league",
};

function describe(e: Ev) {
  const d = e.data;
  if (e.kind === "game_finish") return `finished a ${d.type}${d.time ? ` in ${Number(d.time).toFixed(1)}s` : ""}`;
  if (e.kind === "sign_up" || e.kind === "sign_in") return `${LABELS[e.kind]} (${[d.method, d.device].filter(Boolean).join(", ")})`;
  if (e.kind === "link") return `linked ${d.provider}`;
  if (e.kind === "league_create") return `created league "${d.league}"`;
  return LABELS[e.kind] ?? e.kind;
}

/** Owner-only activity dashboard (admin_stats): daily counts, accounts, browser errors, the latest activity. */
export default function Admin({ data, query }: PageProps<AdminData>) {
  const days = Number(query.get("days") ?? 30);
  const t = data.totals;
  const today = data.days[0];
  const max = Math.max(1, ...data.days.map((d) => d.active));
  return (
    <div class="mx-auto max-w-2xl space-y-3">
      <div class="flex items-center justify-between gap-2 px-1">
        <h1 class="text-2xl font-bold text-gray-900">Admin</h1>
        <nav class="flex gap-1 text-sm" aria-label="Period">
          {PERIODS.map((p) => (
            <a key={p} href={`/admin?days=${p}`}
              class={"rounded-lg border px-3 py-1 " + (p === days ? "border-sky-600 font-semibold text-gray-900" : "border-gray-200 text-gray-600")}>
              {p}d
            </a>
          ))}
        </nav>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <Tile label="active today" value={today?.active ?? 0} />
        <Tile label="played, last 7 days" value={t.played_7d} />
        <Tile label="played, last 30 days" value={t.played_30d} />
        <Tile label="players" value={t.players} />
      </div>

      <Card title="Day by day (Pacific)">
        <div class="-mx-4 overflow-x-auto px-4">
          <table class="w-full text-right text-sm tabular-nums">
            <thead class="text-xs text-gray-500">
              <tr>
                <th class="py-1 text-left font-medium">Day</th>
                <th class="font-medium">Active</th><th class="font-medium">Starts</th><th class="font-medium">Dailies</th>
                <th class="font-medium">Challenges</th><th class="font-medium">Sign-ins</th><th class="font-medium">New</th>
                <th class="font-medium">Chat</th><th class="font-medium">Errors</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.day} class="border-t border-gray-100">
                  <td class="whitespace-nowrap py-1 pr-2 text-left text-gray-700">{shortDay(d.day)}</td>
                  <td class="pl-2">
                    <span class="flex items-center justify-end gap-1">
                      <span class="h-2 rounded bg-sky-500" style={{ width: `${(d.active / max) * 3}rem` }} />
                      {d.active}
                    </span>
                  </td>
                  <td class="pl-2">{d.starts}</td><td class="pl-2">{d.daily}</td><td class="pl-2">{d.challenges}</td>
                  <td class="pl-2">{d.sign_ins}</td><td class="pl-2">{d.sign_ups}</td><td class="pl-2">{d.messages}</td>
                  <td class={"pl-2 " + (d.errors ? "font-semibold text-red-600" : "")}>{d.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="mt-2 text-xs text-gray-500">
          Starts, sign-ins, new players, links and errors are counted from when the activity log was switched on.
          Dailies, challenges and chat go back further.
        </p>
      </Card>

      <div class="grid gap-3 md:grid-cols-3">
        <Card title="Accounts"><Counts data={t.accounts} /></Card>
        <Card title={`New players, ${days}d`}><Counts data={data.sign_ups} /></Card>
        <Card title={`Sign-in devices, ${days}d`}><Counts data={data.devices} /></Card>
      </div>

      <Card title="Browser errors">
        {!data.errors.length ? <p class="text-sm text-gray-500">None so far.</p> : (
          <ul class="space-y-2 text-sm">
            {data.errors.map((e, i) => (
              <li key={i}>
                <div class="text-xs text-gray-500">{when(e.at)} · {e.name ?? "signed out"}{e.info?.path ? ` · ${e.info.path}` : ""}</div>
                <div class="break-words font-mono text-xs text-red-700">{e.message}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Latest activity">
        <ul class="space-y-1 text-sm">
          {data.recent.map((e, i) => (
            <li key={i} class="flex gap-2">
              <span class="w-28 shrink-0 text-xs text-gray-500">{when(e.at)}</span>
              <span class="text-gray-700"><b class="font-semibold text-gray-900">{e.name ?? "someone"}</b> {describe(e)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
