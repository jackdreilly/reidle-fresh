import { useState } from "preact/hooks";
import { navigate } from "@/router";
import { switchLeague, useSession } from "@/lib/session";
import { rpc } from "@/lib/supabase";
import { hourLabel } from "@/lib/time";
import { localTz } from "@/lib/leagues";

const field = "rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm";

/** Name it, go. Reset time defaults to your midnight; everything else lives in league settings. */
export default function LeagueNew() {
  const { account } = useSession();
  const [name, setName] = useState("");
  const [hour, setHour] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tz = localTz();
  if (account === "guest") {
    return (
      <div class="mx-auto max-w-md space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h1 class="text-xl font-bold text-gray-900">Create a league</h1>
        <p class="text-sm text-gray-600">Private leagues need a real login so your friends know it's you.</p>
        <a href="/account#login" class="inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">Sign in to create one</a>
      </div>
    );
  }
  return (
    <form class="mx-auto max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError("");
      try {
        const id = await rpc<number>("create_league", { p_name: name, p_tz: tz, p_reset_hour: hour });
        await switchLeague(id);
        await navigate("/league?created=1", { replace: true });
      } catch (err) {
        setError((err as Error).message);
        setBusy(false);
      }
    }}>
      <h1 class="text-xl font-bold text-gray-900">Create a league</h1>
      <label class="block text-sm">
        <span class="block font-medium text-gray-900">League name</span>
        <input class={"mt-1 w-full " + field} autoFocus required maxLength={40} placeholder="e.g. The Reillys" value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <label class="block text-sm">
        <span class="block font-medium text-gray-900">New word every day at</span>
        <select class={"mt-1 " + field} value={hour} onChange={(e) => setHour(Number((e.target as HTMLSelectElement).value))}>
          {Array.from({ length: 24 }, (_, h) => <option value={h}>{hourLabel(h)}</option>)}
        </select>
        <span class="ml-2 text-xs text-gray-500">{tz.replace(/_/g, " ")} time</span>
      </label>
      <p class="text-xs text-gray-500">You'll be its commissioner: you can change the time and how points work later.</p>
      {error && <p class="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={busy || !name.trim()} class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Creating…" : "Create league"}
      </button>
    </form>
  );
}
