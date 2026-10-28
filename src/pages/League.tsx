import { useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { navigate } from "@/router";
import { refreshSession, switchLeague, useSession } from "@/lib/session";
import { rpc } from "@/lib/supabase";
import { hourLabel } from "@/lib/time";
import type { LeagueBrief, Scoring } from "@/lib/types";
import { describeScoring, inviteUrl, presetOf, PRESETS, shareInvite, tzChoices } from "@/lib/leagues";

type Member = { name: string; role: "commissioner" | "member"; joined_at: string };
type Data = LeagueBrief & { invite_code: string | null; open_invite: boolean; created_by: string | null; members: Member[]; banned?: string[] | null };

const GLOBAL = 2; // Reidle Global, everyone's public league (leagues migration)
const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";
const field = "rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm";
const quiet = "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100";

/** The current league: invite link, members, and (commissioner) settings. */
export default function League({ data: initial, query }: PageProps<Data>) {
  const [data, setData] = useState(initial);
  const [find, setFind] = useState("");
  const shown = data.members.filter((m) => m.name.includes(find.trim().toLowerCase()));
  const [note, setNote] = useState<string | null>(query.has("created") ? "Your league is ready. Invite your friends with the link below." : null);
  const { name: me, leagues } = useSession();
  const boss = data.role === "commissioner";

  const save = async (fn: string, args: Record<string, unknown>, ok?: string) => {
    try {
      setData(await rpc<Data>(fn, args));
      setNote(ok ?? null);
      void refreshSession();
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  return (
    <div class="mx-auto max-w-md space-y-4">
      <header class="flex items-center justify-between gap-3 px-1">
        <div class="min-w-0">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{data.is_public ? "Public league" : "League"}</div>
          <h1 class="truncate text-2xl font-bold text-gray-900">{data.name}</h1>
          <div class="text-xs text-gray-500">New word at {hourLabel(data.reset_hour)} ({data.tz.replace(/_/g, " ")})</div>
        </div>
        {leagues.length > 1 && <a href="/leagues" class={"shrink-0 " + quiet}>All leagues</a>}
      </header>
      {note && <p role="status" class="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{note}</p>}

      <section class={card}>
        <h2 class="font-semibold">Invite friends</h2>
        {data.invite_code === null ? (
          <p class="mt-1 text-sm text-gray-600">Only the commissioner can invite people to {data.name}. Ask them for the link.</p>
        ) : (<>
        <p class="mt-1 text-sm text-gray-600">Anyone with this link can join {data.name}.</p>
        <div class="mt-3 flex items-center gap-2">
          <input readOnly value={inviteUrl(data.invite_code!)} aria-label="Invite link" class={"min-w-0 flex-1 " + field}
            onFocus={(e) => (e.target as HTMLInputElement).select()} />
          <button type="button" class="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white"
            onClick={async () => {
              const r = await shareInvite(data.name, data.invite_code!);
              setNote(r === "copied" ? "Invite link copied." : r === "failed" ? "Couldn't share. Copy the link instead." : null);
            }}>
            Share
          </button>
        </div>
        {boss && !data.is_public && (
          <button type="button" class="mt-2 text-xs text-gray-500 underline"
            onClick={() => confirm("Make a new link? The old one stops working.") && void save("update_league", { p: { new_invite: true } }, "New invite link made. The old one no longer works.")}>
            Reset link
          </button>
        )}
        </>)}
      </section>

      {boss && <Settings data={data} save={save} />}

      <section class={card}>
        <h2 class="font-semibold">Players ({data.members.length})</h2>
        <p class="mt-1 text-xs text-gray-500">Scoring: {describeScoring(data.scoring)}</p>
        {data.members.length > 8 && (
          <input type="search" class={"mt-2 w-full " + field} placeholder="Find a player" aria-label="Find a player" value={find}
            onInput={(e) => setFind((e.target as HTMLInputElement).value)} />
        )}
        <ul class="mt-2 max-h-80 divide-y divide-gray-100 overflow-y-auto">
          {shown.length === 0 && <li class="py-2 text-sm text-gray-500">No player named “{find}”.</li>}
          {shown.map((m) => (
            <li class="flex items-center justify-between gap-2 py-2">
              <a href={`/players/${m.name}`} class="min-w-0 truncate text-sm font-medium text-gray-900">
                {m.name}{m.role === "commissioner" && <span class="ml-1 text-xs text-gray-500">· commissioner</span>}
              </a>
              {boss && m.name !== me && !data.is_public && (
                <select class={field} value="" aria-label={`Manage ${m.name}`}
                  onChange={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    (e.target as HTMLSelectElement).value = "";
                    if (v === "remove" && !confirm(`Remove ${m.name} from ${data.name}? They can rejoin with the invite link.`)) return;
                    if (v === "ban" && !confirm(`Ban ${m.name} from ${data.name}? They're removed and can't rejoin.`)) return;
                    void save("set_member", { p_name: m.name, p_role: v });
                  }}>
                  <option value="">Manage…</option>
                  {m.role === "member"
                    ? <option value="commissioner">Make commissioner</option>
                    : <option value="member">Make regular player</option>}
                  <option value="remove">Remove from league</option>
                  <option value="ban">Ban from league</option>
                </select>
              )}
            </li>
          ))}
        </ul>
        {boss && !!data.banned?.length && (
          <div class="mt-3 border-t border-gray-100 pt-3">
            <h3 class="text-sm font-medium text-gray-900">Banned</h3>
            <ul class="mt-1 space-y-1">
              {data.banned.map((b) => (
                <li class="flex items-center justify-between gap-2 text-sm text-gray-600">
                  <span class="truncate">{b}</span>
                  <button type="button" class="text-xs text-gray-500 underline" onClick={() => void save("set_member", { p_name: b, p_role: "unban" }, `${b} can join again.`)}>
                    Unban
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {!leagues.some((l) => l.id === GLOBAL) && (
        <section class={card}>
          <h2 class="font-semibold">🌍 Reidle Global</h2>
          <p class="mt-1 text-sm text-gray-600">Everyone's league: race the daily word against players everywhere, on top of {data.name}. Leave any time.</p>
          <button type="button" class={"mt-3 " + quiet} onClick={async () => {
            try {
              await switchLeague(await rpc<number>("join_league", { p_code: "global" }));
              await navigate("/stats/today");
            }
            catch (e) { setNote((e as Error).message); }
          }}>
            Join Reidle Global
          </button>
        </section>
      )}
      <a href="/leagues/new" class={"block w-full text-center " + quiet}>+ Start another league</a>
      <button type="button" class={"w-full " + quiet}
        onClick={async () => {
          if (!confirm(`Leave ${data.name}? Your past games stay in its history.`)) return;
          await rpc("leave_league", { p_league: data.id });
          const s = await refreshSession();
          await navigate(s.leagues.length ? "/" : "/welcome", { replace: true });
        }}>
        Leave {data.name}
      </button>
    </div>
  );
}

function Settings({ data, save }: { data: Data; save: (fn: string, args: Record<string, unknown>, ok?: string) => Promise<void> }) {
  const [name, setName] = useState(data.name);
  const [tz, setTz] = useState(data.tz);
  const [hour, setHour] = useState(data.reset_hour);
  const [preset, setPreset] = useState(presetOf(data.scoring));
  const [custom, setCustom] = useState((data.scoring.points ?? []).join(", "));
  const [noShow, setNoShow] = useState(data.scoring.no_show ?? 0);
  const [bestOf, setBestOf] = useState<number | null>(data.scoring.best_of ?? null);
  const [openInvite, setOpenInvite] = useState(data.open_invite);

  const scoring = (): Scoring => {
    const base = preset === "custom"
      ? { mode: "table" as const, points: custom.split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n)) }
      : PRESETS.find((p) => p.id === preset)!.scoring;
    return { ...base, no_show: noShow, best_of: bestOf };
  };

  return (
    <section class={card}>
      <h2 class="font-semibold">Commissioner settings</h2>
      <form class="mt-3 space-y-3 text-sm" onSubmit={(e) => {
        e.preventDefault();
        void save("update_league", { p: { name, tz, reset_hour: hour, scoring: scoring(), open_invite: openInvite } }, "Saved.");
      }}>
        <label class="block">
          <span class="block font-medium text-gray-900">Name</span>
          <input class={"mt-1 w-full " + field} value={name} maxLength={40} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </label>
        <div>
          <span class="block font-medium text-gray-900">New word every day at</span>
          <div class="mt-1 flex gap-2">
            <select class={field} value={hour} onChange={(e) => setHour(Number((e.target as HTMLSelectElement).value))}>
              {Array.from({ length: 24 }, (_, h) => <option value={h}>{hourLabel(h)}</option>)}
            </select>
            <select class={"min-w-0 flex-1 " + field} value={tz} onChange={(e) => setTz((e.target as HTMLSelectElement).value)}>
              {tzChoices(data.tz).map((z) => <option value={z}>{z.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <span class="mt-1 block text-xs text-gray-500">Changing it moves today's deadline for everyone.</span>
        </div>
        <div>
          <span class="block font-medium text-gray-900">Daily points</span>
          <div class="mt-1 space-y-1">
            {[...PRESETS, { id: "custom", label: "Custom", detail: "Your own points by place" }].map((p) => (
              <label class="flex items-start gap-2">
                <input type="radio" name="preset" checked={preset === p.id} onChange={() => setPreset(p.id)} style={{ marginTop: 3 }} />
                <span><b class="font-medium">{p.label}</b> <span class="text-xs text-gray-500">{p.detail}</span></span>
              </label>
            ))}
          </div>
          {preset === "custom" && (
            <input class={"mt-2 w-full " + field} value={custom} placeholder="e.g. 10, 6, 4, 3, 2, 1" aria-label="Points by place"
              onInput={(e) => setCustom((e.target as HTMLInputElement).value)} />
          )}
        </div>
        <div class="flex flex-wrap gap-3">
          <label>
            <span class="block font-medium text-gray-900">Missed day</span>
            <input type="number" class={"mt-1 " + field} style={{ width: 90 }} value={noShow} min={-1000} max={1000}
              onInput={(e) => setNoShow(Number((e.target as HTMLInputElement).value) || 0)} />
          </label>
          <label>
            <span class="block font-medium text-gray-900">Week counts</span>
            <select class={"mt-1 " + field} value={bestOf ?? ""} onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              setBestOf(v ? Number(v) : null);
            }}>
              <option value="">Every day</option>
              {[3, 4, 5, 6].map((n) => <option value={n}>Best {n} days</option>)}
            </select>
          </label>
        </div>
        {!data.is_public && (
          <div>
            <span class="block font-medium text-gray-900">Who can invite</span>
            <div class="mt-1 space-y-1">
              <label class="flex items-start gap-2">
                <input type="radio" name="invite" checked={openInvite} onChange={() => setOpenInvite(true)} style={{ marginTop: 3 }} />
                <span><b class="font-medium">Open invite</b> <span class="text-xs text-gray-500">Every player sees the invite link</span></span>
              </label>
              <label class="flex items-start gap-2">
                <input type="radio" name="invite" checked={!openInvite} onChange={() => setOpenInvite(false)} style={{ marginTop: 3 }} />
                <span><b class="font-medium">Commissioners only</b> <span class="text-xs text-gray-500">Players don't see the link</span></span>
              </label>
            </div>
          </div>
        )}
        <button type="submit" class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">Save</button>
      </form>
    </section>
  );
}
