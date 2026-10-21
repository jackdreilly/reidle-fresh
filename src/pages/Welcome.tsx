import { useState } from "preact/hooks";
import { navigate } from "@/router";
import { switchLeague } from "@/lib/session";
import { rpc } from "@/lib/supabase";

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";

/** Signed in but in no league yet: start one, or play with everyone. */
export default function Welcome() {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  return (
    <div class="mx-auto max-w-md space-y-3">
      <h1 class="px-1 text-2xl font-bold text-gray-900">Pick where to play</h1>
      <section class={card}>
        <h2 class="font-semibold">Start a league</h2>
        <p class="mt-1 text-sm text-gray-600">Your own daily word for family, friends or work. Invite them with a link.</p>
        <a href="/leagues/new" class="mt-3 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">Create a league</a>
      </section>
      <section class={card}>
        <h2 class="font-semibold">Play with everyone</h2>
        <p class="mt-1 text-sm text-gray-600">Reidle Global is open to all. You can join private leagues later too.</p>
        <button type="button" disabled={busy} class="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={async () => {
            setBusy(true);
            try {
              await switchLeague(await rpc<number>("join_league", { p_code: "global" }));
              await navigate("/stats/today", { replace: true });
            } finally { setBusy(false); }
          }}>
          Join Reidle Global
        </button>
      </section>
      <section class={card}>
        <h2 class="font-semibold">Got an invite?</h2>
        <form class="mt-2 flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          const c = code.trim().split("/").pop();
          if (c) void navigate(`/join/${encodeURIComponent(c)}`);
        }}>
          <input class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm" placeholder="Paste the invite link"
            value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
          <button type="submit" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Open</button>
        </form>
      </section>
    </div>
  );
}
