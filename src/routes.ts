import type { ComponentType } from "preact";
import { auth, rpc } from "./lib/supabase";
import { clearSession, getSession, refreshSession, today } from "./lib/session";
import { setSignedIn } from "./boot";
import { loadWordle } from "./lib/wordle";
import { normalizeName } from "./lib/credentials";
import { Redirect, type Params } from "./router";

type Page = () => Promise<{ default: ComponentType<any> }>;
export type Route = {
  path: string;
  page?: Page;
  /** Shell chrome. Omit for chrome-less pages (sign-in). */
  layout?: { route: string; title: string; fullPage?: boolean };
  load?: (p: Params, q: URLSearchParams) => Promise<unknown>;
  /** Safe/idempotent read: may be prefetched on hover. */
  prefetchData?: boolean;
  redirect?: (p: Params, q: URLSearchParams) => string | Promise<string>;
  public?: boolean;
};

/** Names from ?vs=, normalised, without duplicates or the page's own player. */
export const compareNames = (name: string, q: URLSearchParams) =>
  [...new Set((q.get("vs") ?? "").split(",").map(normalizeName).filter((n) => n && n !== name))].slice(0, 3);

const read = <T>(fn: string, args?: Record<string, unknown>) => rpc<T>(fn, args);
const alreadyPlayed = (e: unknown, to: string) => {
  if (/already played/i.test((e as Error).message)) throw new Redirect(to);
  throw e;
};

export const routes: Route[] = [
  // One league: straight to it. Several: the dashboard. None yet: pick one.
  {
    path: "/",
    redirect: async () => {
      const s = getSession().league ? getSession() : await refreshSession();
      return !s.leagues.length ? "/welcome" : s.leagues.length > 1 ? "/leagues" : "/stats/today";
    },
  },
  { path: "/stats", redirect: () => "/stats/today" },
  { path: "/stats/today", redirect: () => `/stats/daily/${today()}` },
  { path: "/stats/this_week", redirect: () => `/stats/weekly/${today()}` },
  {
    path: "/stats/daily/:date", page: () => import("./pages/Daily"), prefetchData: true,
    layout: { route: "/stats", title: "Stats" },
    load: (p) => read("daily_page", { p_day: p.date }),
  },
  {
    path: "/stats/weekly/:date", page: () => import("./pages/Weekly"), prefetchData: true,
    layout: { route: "/stats", title: "Stats" },
    load: (p) => read("weekly_page", { p_week: p.date }),
  },
  {
    path: "/stats/past_winners", page: () => import("./pages/Past"), prefetchData: true,
    layout: { route: "/stats", title: "Stats" },
    load: () => read("past_page", { p_month: null }),
  },
  {
    path: "/play", page: () => import("./pages/Play"),
    layout: { route: "/play", title: "Play", fullPage: true },
    // play_state is a pure read: it never starts the clock or reveals the word (see start_play).
    load: () => Promise.all([read("play_state"), loadWordle()]).then(([d]) => d, (e) => alreadyPlayed(e, "/")),
  },
  {
    path: "/practice", page: () => import("./pages/Practice"),
    layout: { route: "/practice", title: "Practice", fullPage: true },
    load: async (_, q) => {
      const w = await loadWordle();
      if (!q.has("word") || !q.has("startingWord")) {
        const word = Math.floor(Math.random() * w.answers.length);
        const startingWord = Math.floor(Math.random() * w.words.length);
        throw new Redirect(`/practice?word=${word}&startingWord=${startingWord}`);
      }
      return {
        word: w.answers[parseInt(q.get("word") ?? "0")],
        startingWord: w.words[parseInt(q.get("startingWord") ?? "0")],
      };
    },
  },
  {
    path: "/challenges", page: () => import("./pages/Challenges"), prefetchData: true,
    layout: { route: "/challenges", title: "Challenges" },
    load: () => read("challenges_page"),
  },
  {
    path: "/challenges/play",
    redirect: async () => `/challenges/challenge/${await read<number>("challenge_next")}/play`,
  },
  {
    path: "/challenges/challenge/:id", page: () => import("./pages/Challenge"), prefetchData: true,
    layout: { route: "/challenges", title: "Challenge" },
    // + the challenges leaderboard, so a challenge's results and the standings sit on one page.
    load: async (p) => {
      const [c, board] = await Promise.all([
        read<object>("challenge_page", { p_id: Number(p.id) }),
        read<{ today_leaderboard: unknown; yesterday_leaderboard: unknown }>("challenges_page"),
      ]);
      return { challenge_id: Number(p.id), ...c, today_leaderboard: board.today_leaderboard, yesterday_leaderboard: board.yesterday_leaderboard };
    },
  },
  {
    path: "/challenges/challenge/:id/play", page: () => import("./pages/ChallengePlay"),
    layout: { route: "/challenges", title: "Challenge", fullPage: true },
    load: async (p) => {
      const [d] = await Promise.all([read<{ already_played: boolean }>("challenge_play", { p_id: Number(p.id) }), loadWordle()]);
      if (!d) throw new Redirect("/challenges");
      if (d.already_played) throw new Redirect(`/challenges/challenge/${p.id}`);
      return { ...d, challenge_id: Number(p.id) };
    },
  },
  {
    path: "/battles", page: () => import("./pages/Battles"), prefetchData: true,
    layout: { route: "/battles", title: "Battles" },
    load: () => read("battle_home"),
  },
  { path: "/battles/new", redirect: async () => `/battles/${await read<number>("new_battle")}` },
  { path: "/battles/party_room", redirect: () => "/battles/7" },
  {
    path: "/battles/:id", page: () => import("./pages/BattlePage"),
    layout: { route: "/battles", title: "Battle", fullPage: true },
    load: async (p) => {
      const [d] = await Promise.all([read("battle_get", { p_id: Number(p.id) }), loadWordle()]);
      if (!d) throw new Redirect("/battles");
      return { battle_id: Number(p.id), ...(d as object) };
    },
  },
  {
    path: "/submissions/:id/playback", page: () => import("./pages/PlaybackPage"), prefetchData: true,
    layout: { route: "/play", title: "Playback", fullPage: true },
    load: async (p) => (await read("get_playback", { p_id: Number(p.id) })) ?? { events: [] },
  },
  {
    path: "/players/:name", page: () => import("./pages/Player"), prefetchData: true,
    layout: { route: "/players", title: "Player" },
    // ?vs=bob,carol overlays up to 3 other players on the comparable charts (one RPC each, in parallel).
    load: async (p, q) => {
      const vs = compareNames(p.name, q);
      const [main, ...others] = await Promise.all([p.name, ...vs].map((n) => read<object>("player_stats", { p_name: n })));
      return { ...main, compare: others.map((d, i) => ({ name: vs[i], d })) };
    },
  },
  {
    path: "/messages", page: () => import("./pages/Messages"),
    layout: { route: "/messages", title: "Messages" },
    load: () => read("messages_page"),
  },
  {
    path: "/rankings", page: () => import("./pages/Rankings"), prefetchData: true,
    layout: { route: "/rankings", title: "Rankings" },
    load: () => read("rankings"),
  },
  {
    path: "/account", page: () => import("./pages/Account"),
    layout: { route: "/account", title: "Settings" },
    load: () => read("settings_page"),
  },
  { path: "/settings", redirect: () => "/account" },
  { path: "/help", page: () => import("./pages/Help"), layout: { route: "/help", title: "Help" } },
  {
    path: "/admin", page: () => import("./pages/Admin"),
    layout: { route: "/admin", title: "Admin" },
    load: (_, q) => read("admin_page", { p_days: q.get("days") }), // admin_stats + admin_growth; null = 30, the server clamps it
  },
  {
    path: "/leagues", page: () => import("./pages/Leagues"), prefetchData: true,
    layout: { route: "/leagues", title: "Leagues" },
    load: () => read("leagues_page"),
  },
  { path: "/leagues/new", page: () => import("./pages/LeagueNew"), layout: { route: "/leagues", title: "New league" } },
  {
    path: "/league", page: () => import("./pages/League"), prefetchData: true,
    layout: { route: "/league", title: "League" },
    load: () => read("league_page"),
  },
  { path: "/welcome", page: () => import("./pages/Welcome"), layout: { route: "/leagues", title: "Welcome" } },
  // invite links work signed out too (league_preview is open to anon)
  { path: "/join/:code", page: () => import("./pages/Join"), public: true, load: (p) => read("league_preview", { p_code: p.code }) },
  { path: "/sign-in", page: () => import("./pages/SignIn"), public: true },
  { path: "/auth/callback", page: () => import("./pages/AuthCallback"), public: true },
  { path: "/save-account", page: () => import("./pages/SaveAccount"), layout: { route: "/account", title: "Save your account" } },
  { path: "/nickname", page: () => import("./pages/Nickname"), layout: { route: "/account", title: "Nickname" } },
  {
    path: "/sign-out",
    public: true,
    redirect: async () => {
      await auth.signOut();
      setSignedIn(false);
      clearSession();
      return "/sign-in";
    },
  },
];

export const notFound: Route = {
  path: "*", page: () => import("./pages/NotFound"), layout: { route: "", title: "Not found" },
};
