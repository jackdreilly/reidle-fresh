import type { ComponentType } from "preact";
import { auth, rpc } from "./lib/supabase";
import { clearSession } from "./lib/session";
import { setSignedIn } from "./boot";
import { loadWordle } from "./lib/wordle";
import { utcToday } from "./lib/time";
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

const read = <T>(fn: string, args?: Record<string, unknown>) => rpc<T>(fn, args);
const alreadyPlayed = (e: unknown, to: string) => {
  if (/already played/i.test((e as Error).message)) throw new Redirect(to);
  throw e;
};

export const routes: Route[] = [
  { path: "/", redirect: () => "/stats/today" },
  { path: "/stats", redirect: () => "/stats/today" },
  { path: "/stats/today", redirect: () => `/stats/daily/${utcToday()}` },
  { path: "/stats/this_week", redirect: () => `/stats/weekly/${utcToday()}` },
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
    path: "/stats/past_winners", page: () => import("./pages/PastWinners"), prefetchData: true,
    layout: { route: "/stats", title: "Stats" },
    load: () => read("past_winners"),
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
        // Both the target and the pre-filled first guess come from the answer list;
        // typed guesses are still validated against the full word list.
        const word = Math.floor(Math.random() * w.answers.length);
        const startingWord = Math.floor(Math.random() * w.answers.length);
        throw new Redirect(`/practice?word=${word}&startingWord=${startingWord}`);
      }
      return {
        word: w.answers[Math.abs(parseInt(q.get("word") ?? "0") || 0) % w.answers.length],
        // modulo keeps old links (startingWord indexed the full word list) valid
        startingWord: w.answers[Math.abs(parseInt(q.get("startingWord") ?? "0") || 0) % w.answers.length],
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
    load: async (p) => ({ challenge_id: Number(p.id), ...(await read<object>("challenge_page", { p_id: Number(p.id) })) }),
  },
  {
    path: "/challenges/challenge/:id/play", page: () => import("./pages/ChallengePlay"),
    layout: { route: "/play", title: "Challenge", fullPage: true },
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
    load: (p) => read("player_stats", { p_name: p.name }),
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
  { path: "/account", page: () => import("./pages/Account"), layout: { route: "/account", title: "Account" } },
  { path: "/sign-in", page: () => import("./pages/SignIn"), public: true },
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
