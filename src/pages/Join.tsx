import { useEffect, useRef, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { navigate } from "@/router";
import { setSignedIn, signedIn } from "@/boot";
import { refreshSession, switchLeague, useSession } from "@/lib/session";
import { rpc } from "@/lib/supabase";
import { finishLink } from "@/lib/auth";
import { keepGuest, playAsGuest } from "@/lib/guest";
import LoginOptions from "@/components/LoginOptions";
import StagingTag from "@/components/StagingTag";

type Preview = { id: number; name: string; is_public: boolean; members: number; created_by: string | null; member: boolean } | null;

const primary = "rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60";

/**
 * Invite link landing: who's inviting, then the one step that gets you in. Private leagues need a real login
 * (Google or email), offered right here; anyone who'd rather not can play as a guest in Reidle Global instead.
 * Back from a login with `?join=1`, it joins by itself.
 */
export default function Join({ params, query, data }: PageProps<Preview>) {
  const { account } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nameOpen, setNameOpen] = useState(false);
  const here = `/join/${params.code}`;
  const back = `${here}?join=1`; // where a login returns to
  // counted for the owner's invite funnel; the tab's visit id (shared with src/lib/telemetry.ts) ties a signed-out
  // open to the account it turns into
  useEffect(() => {
    if (!data) return;
    let sid: string | null = null;
    try {
      sid = sessionStorage.getItem("reidle:sid");
      if (!sid) sessionStorage.setItem("reidle:sid", sid = crypto.randomUUID());
    } catch { /* storage unavailable */ }
    void rpc("log_invite", { p_code: params.code, p_sid: sid }).catch(() => {});
  }, [params.code, !!data]);
  // the name-only form lives on the sign-in page until name-only sign-in ends (app_flags.legacy_until)
  useEffect(() => { if (!signedIn()) void rpc<boolean>("name_sign_in_open").then(setNameOpen, () => {}); }, []);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await f(); } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const enter = async (code: string) => {
    await switchLeague(await rpc<number>("join_league", { p_code: code }));
    await navigate("/stats/today", { replace: true });
  };
  const join = () => run(() => enter(params.code));
  /** Signed in (or linked) without leaving the page: new accounts pick a nickname, then come back to join. */
  const loggedIn = async (linked: boolean) => {
    setSignedIn(true);
    if (linked) await finishLink();
    const s = await refreshSession();
    if (s.nickname_set === false) await navigate(`/nickname?redirect=${encodeURIComponent(back)}`, { replace: true });
    else await join();
  };
  /** Signed out: a guest (the one kept on this device, else a new one), into this league if it's public, else Global. */
  const guest = () => run(async () => {
    await playAsGuest();
    setSignedIn(true);
    await refreshSession();
    await enter(data?.is_public ? params.code : "global");
  });

  // back from Google or an email link: join without another tap
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || query.get("join") !== "1" || !data || data.member || !signedIn() || !account) return;
    auto.current = true;
    if (account !== "guest" || data.is_public) void join();
  }, [account, !!data]);

  return (
    <div class="mx-auto max-w-md p-4">
      <h1 class="m-2 text-3xl font-bold">Reidle <StagingTag /></h1>
      <section class="mt-4 space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {!data
          ? <p class="text-sm text-gray-600">This invite link isn't valid anymore. Ask for a new one.</p>
          : (
            <>
              <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">You're invited to</div>
              <h2 class="text-2xl font-bold text-gray-900">{data.name}</h2>
              <p class="text-sm text-gray-600">
                {data.members} {data.members === 1 ? "player" : "players"}{data.created_by ? ` · started by ${data.created_by}` : ""}.
                One word a day, same for everyone in the league. Fastest wins.
              </p>
              {data.member
                ? <button type="button" class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white" onClick={() => void switchLeague(data.id).then(() => navigate("/stats/today"))}>You're in. Open {data.name}</button>
                : !signedIn()
                ? (
                  <>
                    <div class="space-y-2 border-t border-gray-200 pt-3">
                      <h3 class="font-semibold text-gray-900">Sign in to join {data.name}</h3>
                      <p class="text-sm text-gray-600">
                        {data.is_public ? "" : "Private leagues need a Google or email login, so everyone knows it's really you. "}
                        New here? This makes your account, and your stats follow you to any device.
                      </p>
                      <LoginOptions after={back} onDone={() => loggedIn(false)} />
                      {nameOpen && <a href={`/sign-in?redirect=${encodeURIComponent(back)}`} class="block text-xs text-gray-500 underline">Played before leagues? Sign in with your name</a>}
                    </div>
                    <p class="border-t border-gray-200 pt-3 text-center text-sm text-gray-500">
                      <span class="mb-2 block">Not ready to sign in?</span>
                      <button type="button" disabled={busy} onClick={() => void guest()} class="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-60">
                        {data.is_public ? "Try it as a guest" : "Play as a guest in Reidle Global"}
                      </button>
                      {!data.is_public && <span class="mt-1 block text-xs">You can join {data.name} later by saving your account.</span>}
                    </p>
                  </>
                )
                : account === "guest" && !data.is_public
                ? (
                  <>
                    <div class="space-y-2 border-t border-gray-200 pt-3">
                      <h3 class="font-semibold text-gray-900">Save your account to join {data.name}</h3>
                      <p class="text-sm text-gray-600">You're playing as a guest. Private leagues need a Google or email login. Linking one keeps your games and nickname.</p>
                      <LoginOptions link after={back} onDone={() => loggedIn(true)} />
                      <p class="text-xs text-gray-500">Already have a Reidle login? <a href={`/sign-out?redirect=${encodeURIComponent(here)}`} onClick={(e) => keepGuest(e, here)} class="underline">Log out</a>, then sign in here.</p>
                    </div>
                    <p class="border-t border-gray-200 pt-3 text-center text-sm text-gray-500">
                      <button type="button" disabled={busy} onClick={() => void run(() => enter("global"))} class="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-60">Keep playing as a guest in Reidle Global</button>
                    </p>
                  </>
                )
                : <button type="button" disabled={busy} onClick={() => void join()} class={primary}>{busy ? "Joining…" : `Join ${data.name}`}</button>}
              {error && <p class="text-sm text-rose-600">{error}</p>}
            </>
          )}
      </section>
    </div>
  );
}
