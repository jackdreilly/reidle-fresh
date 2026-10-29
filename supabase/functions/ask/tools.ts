// Reidog's read-only lookup tools (Gemini function calling). Every tool runs as the asking player, with their own token,
// so it sees exactly what they can see in the app:
//   - the targeted ones call the app's stable page RPCs over GET, which PostgREST runs in a read-only transaction
//   - `query` runs one SELECT over the player-scoped views in schema reidog (see *_reidog_tools.sql for how it's locked down)
// None of them can return today's daily answer: the page RPCs never include it and the views blank it.
// The declarations are the same for everyone, so they sit in Gemini's cached prefix with the system prompt.

export type Call = (fn: string, args: Record<string, unknown>, method?: "GET" | "POST") => Promise<unknown>;
export type ToolLog = { name: string; args?: Record<string, unknown>; ms: number; error?: string };

const SCHEMA = `Views (all already limited to the asking player's own leagues; join on league_id):
- me(name, current_league_id, joined_reidle, leagues): the asking player
- leagues(league_id, league_name, is_public, tz, reset_hour, scoring jsonb, open_invite, created_by, created_at, today date, my_role, is_current, members)
- members(league_id, name, role 'commissioner'|'member', joined_at)
- daily_results(submission_id, league_id, day date, name, time, penalty, rank, played_at, days_ago, current_league, answer, paste): one row per daily game. days_ago: 0 = today, 1 = yesterday (in that league). current_league: true for the league the player is in right now; filter on it unless they ask about another league. time = final seconds including penalties; penalty = the seconds of penalties in it; rank 1 = fastest that day. answer is null for today's word (never revealed). paste = colour grid (null when hidden).
- challenges(challenge_id, league_id, day, days_ago, current_league, created_at, starting_word, answer, set_by, players): answer is null unless the asking player has played it
- challenge_results(submission_id, challenge_id, league_id, name, time, penalty, rank, played_at)
- weekly_winners(league_id, week date (Monday), name)
- messages(message_id, league_id, name, message, likes int, created_at): the league chat
Functions: week_standings(any_date_in_week date, league_id bigint default current) -> jsonb array in standings order of {name, results: {days: [{day, time, score, counted}], totals: {time, score}}} (score = points that day; totals.score = the week's points). power_rankings(league_id bigint default current) -> jsonb (the Past tab's ranking).
Postgres SQL, read-only, max 50 rows, 3 second limit. Never hardcode a league id: use current_league = true, leagues.is_current or (select current_league_id from me). Use days_ago or leagues.today for dates, never current_date or now(). A player plays at most once a day per league, so across leagues count distinct day for "days played". Qualify columns when joining (several views have name). Prefer aggregates (count, avg, min, percentile_cont) over listing rows.`;

export const DECLARATIONS = [
  {
    name: "my_league",
    description: "The current league's settings and members: name, timezone and daily reset hour, scoring rules, who's a commissioner, members with join dates, today's date in the league.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "player_stats",
    description: "A player's stats in the current league (what their stats page shows): games played, wins, fastest and typical times, share of players beaten, clean games without penalties, time distribution and weekly trend. Use the asking player's own nickname for 'my stats'.",
    parameters: { type: "object", properties: { name: { type: "string", description: "nickname" } }, required: ["name"] },
  },
  {
    name: "challenges",
    description: "The current league's challenges: open ones the player hasn't played yet, recent finished ones with winners, and today's and yesterday's challenge leaderboards.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "challenge",
    description: "One challenge by its number: everyone's time and penalties, and its answer only if the asking player has played it.",
    parameters: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
  },
  {
    name: "battles",
    description: "Live battles right now and who is in the Party Room.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "week",
    description: "A week's standings in the current league, in order: each player's points and total time, and their points and time each day. weeks_ago 0 = this week (Monday to Sunday, still running), 1 = last week.",
    parameters: { type: "object", properties: { weeks_ago: { type: "integer" } } },
  },
  {
    name: "rankings",
    description: "The current league's power rankings (the Past tab): points for each weekly finish (1st 10, 2nd 6, 3rd 4, 4th 3, 5th 2, else 1) over the last 8 finished weeks, with weekly wins and each week's place. The best answer to 'who's the best player' or 'who's on top lately'; for all-time, count weekly_winners with the query tool.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "replay",
    description: "One finished game, guess by guess, from its replay: each guess with when it was entered and its colours, and every penalty with what was typed (misspelled or made-up words, ignored clues). Use it for 'what did I misspell', 'how did X solve it', 'where did my penalty come from'. Give name plus days_ago (0 = today) for a daily in the current league, or name plus challenge_id, or a submission_id. Like the app, a game shows only once the asking player has played that same game; the winning guess is never shown.",
    parameters: {
      type: "object",
      properties: { name: { type: "string" }, days_ago: { type: "integer" }, challenge_id: { type: "integer" }, submission_id: { type: "integer" } },
    },
  },
  {
    name: "query",
    description: `Catch-all: run one read-only SQL SELECT for anything the other tools don't cover (a past day's results, head-to-head records, streaks, averages, weekly standings, past winners, chat). ${SCHEMA}`,
    parameters: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] },
  },
];

/** What the chat shows while a tool runs ("Looked up ..."). */
export function label(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "my_league": return "your league";
    case "player_stats": return `${String(args.name ?? "a player").slice(0, 20)}'s stats`;
    case "challenges": return "challenges";
    case "challenge": return `challenge #${Number(args.id) || "?"}`;
    case "battles": return "battles";
    case "week": return Number(args.weeks_ago) > 0 ? "that week's standings" : "this week's standings";
    case "rankings": return "power rankings";
    case "replay": return `${String(args.name ?? "a").slice(0, 20)}${args.name ? "'s" : ""} replay`;
    default: return "game records";
  }
}

/** Keeps a tool result small enough for a fast answer. */
function trim(name: string, v: unknown): unknown {
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  const o = { ...(v as Record<string, unknown>) };
  if (name === "player_stats") {
    if (Array.isArray(o.trend)) o.trend = o.trend.slice(-8);
    delete o.compare;
  }
  if (name === "my_league") delete o.invite_code;
  if (name === "challenges" && Array.isArray(o.history)) o.history = o.history.slice(0, 15);
  return o;
}

const nameOf = (v: unknown) => String(v ?? "").trim().slice(0, 40);
const sqlText = (v: string) => `'${v.replace(/'/g, "''")}'`;
const mmss = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

type Event = { time: number; letter?: string; backspace?: boolean; clear?: boolean; score?: { letter: string; score: number }[]; error?: { message: string; penalty: number } };

/** A replay's events -> guesses and penalties, in words the model can explain. The winning guess is left out. */
export function summarizeReplay(playback: { events?: Event[] } | null) {
  const guesses: { at: string; word: string; colours: string }[] = [];
  const penalties: { at: string; typed: string; why: string; seconds: number }[] = [];
  let typed = "", cleared = "";
  let solved: string | null = null;
  for (const e of playback?.events ?? []) {
    if (e.letter) typed += e.letter;
    else if (e.backspace) typed = typed.slice(0, -1);
    else if (e.clear) { cleared = typed; typed = ""; }
    else if (e.score) {
      if (e.score.every((t) => t.score === 0)) solved = mmss(e.time);
      else guesses.push({ at: mmss(e.time), word: e.score.map((t) => t.letter).join("").toUpperCase(), colours: e.score.map((t) => "GY-"[t.score] ?? "?").join("") });
      typed = "";
    } else if (e.error && e.error.penalty > 0) {
      // the game clears the row just before it logs the error, so the attempt is what was cleared
      penalties.push({ at: mmss(e.time), typed: (typed || cleared).toUpperCase(), why: e.error.message, seconds: e.error.penalty });
    }
  }
  return {
    guesses, penalties, solved_at: solved,
    key: "colours: G green, Y yellow, - gray. 'Not a word' = +5s; other reasons (like 'Wrong A @ 2', 'Removed green @ 3', 'At least 2 E's') = ignored a clue, +10s. The first guess is the random starting word.",
  };
}

export async function runTool(call: Call, name: string, args: Record<string, unknown>): Promise<{ result: unknown; log: ToolLog }> {
  const started = Date.now();
  const shown: Record<string, unknown> = {};
  try {
    let result: unknown;
    switch (name) {
      case "my_league": result = await call("league_page", {}, "GET"); break;
      case "player_stats":
        shown.name = String(args.name ?? "").slice(0, 40);
        result = await call("player_stats", { p_name: shown.name }, "GET");
        if (result == null) result = { error: `No player called ${shown.name} in this league` };
        break;
      case "challenges": result = await call("challenges_page", {}, "GET"); break;
      case "challenge":
        shown.id = Number(args.id);
        result = (await call("challenge_page", { p_id: shown.id }, "GET")) ?? { error: "No such challenge in this league" };
        break;
      case "battles": result = await call("battle_home", {}, "GET"); break;
      case "week": {
        shown.weeks_ago = Math.max(0, Math.min(520, Math.trunc(Number(args.weeks_ago) || 0)));
        const rows = await call("ask_query", { p_sql: `select week_standings((select today from leagues where is_current) - 7 * ${shown.weeks_ago}) as s` });
        // deno-lint-ignore no-explicit-any
        const s = ((rows as any[])?.[0]?.s ?? []) as any[];
        result = s.map((p, i) => ({
          // a missed day counts a penalty time in total_seconds (the tie-break)
          place: i + 1, name: p.name, points: p.results?.totals?.score, total_seconds: p.results?.totals?.time,
          // deno-lint-ignore no-explicit-any
          played: (p.results?.days ?? []).filter((d: any) => d.submission_id != null).map((d: any) => ({ day: d.day, seconds: d.time, points: d.score, counted: d.counted })),
        })).slice(0, 30);
        break;
      }
      case "rankings": {
        const rows = await call("ask_query", { p_sql: "select power_rankings() as r" });
        // deno-lint-ignore no-explicit-any
        result = (rows as any[])?.[0]?.r ?? { error: "No finished weeks yet" };
        break;
      }
      case "replay": {
        let id = Number(args.submission_id) || 0;
        if (!id) {
          shown.name = nameOf(args.name);
          if (!shown.name) throw new Error("Give a name (with days_ago or challenge_id) or a submission_id");
          const sql = args.challenge_id != null
            ? `select submission_id from challenge_results where challenge_id = ${(shown.challenge_id = Math.trunc(Number(args.challenge_id)) || 0)} and name = ${sqlText(shown.name as string)}`
            : `select submission_id from daily_results where current_league and days_ago = ${(shown.days_ago = Math.max(0, Math.trunc(Number(args.days_ago) || 0)))} and name = ${sqlText(shown.name as string)}`;
          // deno-lint-ignore no-explicit-any
          id = Number(((await call("ask_query", { p_sql: sql })) as any[])?.[0]?.submission_id) || 0;
          if (!id) { result = { error: `${shown.name} has no game there` }; break; }
        }
        shown.submission_id = id;
        const playback = await call("get_playback", { p_id: id }, "GET");
        result = playback == null
          ? { error: "That replay is hidden: the asking player hasn't played that game yet (or it isn't in their leagues)." }
          : summarizeReplay(playback as { events?: Event[] });
        break;
      }
      case "query":
        shown.sql = String(args.sql ?? "").slice(0, 4000);
        result = await call("ask_query", { p_sql: shown.sql });
        break;
      default: throw new Error(`Unknown tool ${name}`);
    }
    let out = trim(name, result);
    if (JSON.stringify(out).length > 12000) out = { truncated: true, start: JSON.stringify(out).slice(0, 12000) };
    return { result: out, log: { name, args: shown, ms: Date.now() - started } };
  } catch (e) {
    const error = (e as Error).message.slice(0, 300);
    return { result: { error }, log: { name, args: shown, ms: Date.now() - started, error } };
  }
}
