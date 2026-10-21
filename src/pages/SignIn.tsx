import { useState } from "preact/hooks";
import StagingTag from "@/components/StagingTag";
import Input from "@/components/Input";
import LoginOptions from "@/components/LoginOptions";
import { signIn } from "@/lib/auth";
import { auth } from "@/lib/supabase";
import { refreshSession } from "@/lib/session";
import { setSignedIn } from "@/boot";
import { navigate } from "@/router";

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";

export default function SignIn({ query }: { query: URLSearchParams }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
            onClick={() => void attempt(() => auth.signInAnonymously(), false)}>
            Try it as a guest
          </button>
        </section>
        <details class={card}>
          <summary class="cursor-pointer text-sm font-medium text-gray-700">Played before leagues? Sign in with your name</summary>
          <form class="mt-3 flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget as HTMLFormElement).get("name") as string;
            void attempt(() => signIn(name), false);
          }}>
            <Input class="min-w-0 flex-1" type="text" placeholder="Your name" name="name" required />
            <Input type="submit" disabled={busy} />
          </form>
        </details>
        {error && <div class="m-2 text-sm text-rose-600">{error}</div>}
      </main>
    </div>
  );
}
