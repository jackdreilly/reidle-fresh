import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import StagingTag from "@/components/StagingTag";
import { DemoTiles } from "@/components/Tour";
import Input from "@/components/Input";
import LoginOptions from "@/components/LoginOptions";
import { signIn } from "@/lib/auth";
import { rpc } from "@/lib/supabase";
import { playAsGuest as startGuest, savedGuest } from "@/lib/guest";
import { refreshSession } from "@/lib/session";
import { setSignedIn } from "@/boot";
import { navigate } from "@/router";

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";

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
  const playAsGuest = () => void attempt(() => startGuest(guest), false);
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
        <section class={card}>
          <h2 class="mb-1 text-center text-lg font-semibold text-gray-900">Sign in to play</h2>
          <p class="mb-4 text-center text-xs text-gray-500">New here? This makes your account. Your stats follow you to any device.</p>
          <LoginOptions after={to} onDone={() => done(true)} />
        </section>
        <p class="text-center text-sm text-gray-500">
          <button type="button" disabled={busy} onClick={playAsGuest} class="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-60">
            {guest ? `Continue as ${guest.name} (guest)` : "Not ready? Try it as a guest"}
          </button>
          <span class="mt-1 block text-xs">{guest ? "Back to the guest you played as on this device." : "No sign-up. Save your account any time to keep your stats."}</span>
        </p>
        <ol class={card + " space-y-3 text-sm text-gray-700"}>
          <Step n={1} title="Find the word">Everyone gets the same five-letter word each day. Green and yellow tiles tell you how close you are.</Step>
          <Step n={2} title="Beat the clock">Your time is your score, so the fastest solve wins the day.</Step>
          <Step n={3} title="Play with friends">Start a league, share the invite link, and see who takes the week.</Step>
        </ol>
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
      <p class="mt-6 text-center text-xs text-gray-500">
        <a href="/privacy" target="_blank" class="underline">Privacy</a> · <a href="/tos" target="_blank" class="underline">Terms</a>
      </p>
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
