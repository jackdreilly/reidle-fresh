import { useEffect, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { navigate } from "@/router";
import { refreshSession, useSession } from "@/lib/session";
import { rpc } from "@/lib/supabase";
import { normalizeName } from "@/lib/credentials";

/** Pick (or change) your nickname: unique across Reidle, shown in every league. */
export default function Nickname({ query }: PageProps) {
  const { name } = useSession();
  const [value, setValue] = useState(name ?? "");
  const [free, setFree] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const want = normalizeName(value);
  useEffect(() => {
    setFree(null);
    if (!/^[a-z0-9_]{3,15}$/.test(want)) return;
    const t = setTimeout(() => void rpc<boolean>("nickname_free", { p_name: want }).then(setFree, () => {}), 250);
    return () => clearTimeout(t);
  }, [want]);
  const to = query.get("redirect") ?? "/";
  return (
    <form class="mx-auto max-w-md space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError("");
      try {
        await rpc("set_nickname", { p_name: want });
        await refreshSession();
        await navigate(to.startsWith("/") ? to : "/", { replace: true });
      } catch (err) {
        setError((err as Error).message);
        setBusy(false);
      }
    }}>
      <h1 class="text-xl font-bold text-gray-900">Pick your nickname</h1>
      <p class="text-sm text-gray-600">It's how everyone sees you on leaderboards and in chat. You can change it later in Settings.</p>
      <input class="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm" autoFocus maxLength={15} value={value}
        aria-label="Nickname" onInput={(e) => setValue((e.target as HTMLInputElement).value)} />
      <p class="text-xs text-gray-500">
        {!/^[a-z0-9_]{3,15}$/.test(want) ? "3 to 15 letters, numbers or _"
          : want === name ? "That's you now." : free === null ? "Checking…" : free ? `${want} is free ✓` : `${want} is taken`}
      </p>
      {error && <p class="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={busy || !(want === name || free)} class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {want === name ? "Keep it" : "Save"}
      </button>
    </form>
  );
}
