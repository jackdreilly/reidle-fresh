import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import StagingTag from "@/components/StagingTag";
import { DemoTiles } from "@/components/Tour";
import Input from "@/components/Input";
import LoginOptions from "@/components/LoginOptions";
import { signIn } from "@/lib/auth";
import { auth, config, rpc } from "@/lib/supabase";
import { refreshSession } from "@/lib/session";
import { setSignedIn } from "@/boot";
import { navigate } from "@/router";

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";

/** The guest account a guest left on this device when signing out (auth.signOut). */
type Kept = { rt: string; name: string };
function savedGuest(): Kept | null {
  try {
    const [rt, name] = JSON.parse(localStorage.getItem("reidle:guest") ?? "null") as [string, string];
    return { rt, name };
  } catch { return null; }
}

/** Back into the kept guest account; false if there is none or it no longer works. */
async function resumeGuest(kept: Kept | null): Promise<boolean> {
  if (!kept) return false;
  try { localStorage.removeItem("reidle:guest"); } catch { /* ignore */ }
  const res = await fetch(`${config.URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers: { apikey: config.KEY, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: kept.rt }),
  }).catch(() => null);
  if (!res?.ok) return false;
  const t = await res.json();
  return !auth.fromRedirect("#" + new URLSearchParams({ access_token: t.access_token, refresh_token: t.refresh_token, expires_in: String(t.expires_in) }));
}

export default function SignIn({ query }: { query: URLSearchParams }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [guest] = useState(savedGuest);
  // the name-only form goes once name-only sign-in has ended (app_flags.legacy_until)
  const [nameOpen, setNameOpen] = useState(true);
  useEffect(() => { void rpc<boolean>("name_sign_in_open").then(setNameOpen, () => {}); }, []);
  const to = (() => { const r = query.get("redirect"); return r && r.startsWith("/") ? r : "/"; })();

  const done = async (askNickname: boolean) => {
    setSignedIn(true);
    const s = await refreshSession();
    await navigate(askNickname && s.nickname_set === false ? `/nickname?redirect=${encodeURIComponent(to)}` : to, { replace: true });
  };
  const attempt = async (f: () => Promise<unknown>, askNickname: boolean) => {
    setBusy(true);
    setError("");
    try {
      await f();
      await done(askNickname);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  const playAsGuest = () => void attempt(() => resumeGuest(guest).then((ok) => { if (!ok) return auth.signInAnonymously(); }), false);
  return (
    <div class="mx-auto max-w-md px-4 py-8">
      <header class="text-center">
        <img src="/dog.webp" alt="" width="112" height="112" class="mx-auto rounded-full"
          style={{ width: 112, height: 112, objectFit: "contain", padding: 10, background: "#fdf2e9", boxShadow: "0 0 0 4px var(--color-white, #fff), 0 2px 10px rgb(0 0 0 / .12)" }} />
        <h1 class="mt-3 text-3xl font-bold text-gray-900">Reidle <StagingTag /></h1>
        <p class="mt-2 text-gray-600">A daily word puzzle you race your friends at.</p>
        <div class="mt-4 flex flex-col items-center gap-1" aria-hidden="true">
          <DemoTiles word="CRANE" marks="xyxxg" />
          <DemoTiles word="ROUTE" marks="ggggg" />
        </div>
      </header>
      <main class="mt-6 space-y-4">
        <ol class={card + " space-y-3 text-sm text-gray-700"}>
          <Step n={1} title="Find the word">Everyone gets the same five-letter word each day. Green and yellow tiles tell you how close you are.</Step>
          <Step n={2} title="Beat the clock">Your time is your score, so the fastest solve wins the day.</Step>
          <Step n={3} title="Play with friends">Start a league, share the invite link, and see who takes the week.</Step>
        </ol>
        <div>
          <button type="button" disabled={busy} onClick={playAsGuest}
            class="w-full rounded-xl bg-sky-600 px-4 py-3 text-lg font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-60">
            {guest ? `Continue as ${guest.name}` : "Play now"}
          </button>
          <p class="mt-2 text-center text-xs text-gray-500">No sign-up needed. Save your account any time to keep your stats.</p>
        </div>
        <section class={card}>
          <h2 class="mb-3 text-center text-sm font-semibold text-gray-700">Already playing? Sign in</h2>
          <LoginOptions after={to} onEmailDone={() => done(true)} />
        </section>
        {nameOpen && <details class={card}>
          <summary class="cursor-pointer text-sm font-medium text-gray-700">Played before leagues? Sign in with your name</summary>
          <form class="mt-3 flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget as HTMLFormElement).get("name") as string;
            void attempt(() => signIn(name), false);
          }}>
            <Input class="min-w-0 flex-1" type="text" placeholder="Your name" name="name" required />
            <Input type="submit" disabled={busy} />
          </form>
        </details>}
        {error && <div class="m-2 text-sm text-rose-600">{error}</div>}
      </main>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ComponentChildren }) {
  return (
    <li class="flex gap-3">
      <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-bold text-sky-700">{n}</span>
      <span><b class="text-gray-900">{title}.</b> {children}</span>
    </li>
  );
}
