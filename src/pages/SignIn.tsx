import { useEffect, useState } from "preact/hooks";
import StagingTag from "@/components/StagingTag";
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
  return (
    <div class="mx-auto max-w-md p-2">
      <h1 class="m-2 font-bold text-3xl">Reidle <StagingTag /></h1>
      <p class="mx-2 mb-4 text-sm text-gray-600">One word a day, raced against the clock with your friends.</p>
      <main class="space-y-3">
        <section class={card}>
          <h2 class="mb-3 font-semibold">Sign in</h2>
          <LoginOptions after={to} onEmailDone={() => done(true)} />
        </section>
        <section class={card}>
          <h2 class="font-semibold">Just looking?</h2>
          <p class="mt-1 text-sm text-gray-600">Play as a guest in Reidle Global. Save your account any time to keep your stats.</p>
          <button type="button" disabled={busy} class="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => void attempt(() => resumeGuest(guest).then((ok) => { if (!ok) return auth.signInAnonymously(); }), false)}>
            {guest ? `Continue as ${guest.name}` : "Try it as a guest"}
          </button>
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
