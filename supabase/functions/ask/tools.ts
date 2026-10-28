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
Functions: week_standings(any_date_in_week date, league_id bigint default current) -> jsonb array in standings order of {name, results: {days: [{day, time, score, counted}], totals: {time, score}}} (score = points that day; totals.score = the week's points).
Postgres SQL, read-only, max 50 rows, 3 second limit. Use days_ago or leagues.today for dates, not current_date. Qualify columns when joining (several views have name). Prefer aggregates (count, avg, min, percentile_cont) over listing rows.`;

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
    default: return "game records";
  }
}

/** Keeps a tool result small enough for a fast answer. */
function trim(name: string, v: unknown): unknown {
  if (!v || typeof v !== "object") return v;
  const o = { ...(v as Record<string, unknown>) };
  if (name === "player_stats") {
    if (Array.isArray(o.trend)) o.trend = o.trend.slice(-8);
    delete o.compare;
  }
  if (name === "my_league") delete o.invite_code;
  if (name === "challenges" && Array.isArray(o.history)) o.history = o.history.slice(0, 15);
  return o;
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
