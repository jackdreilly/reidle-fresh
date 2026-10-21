import { useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { navigate } from "@/router";
import { signedIn } from "@/boot";
import { switchLeague, useSession } from "@/lib/session";
import { rpc } from "@/lib/supabase";
import StagingTag from "@/components/StagingTag";

type Preview = { id: number; name: string; is_public: boolean; members: number; created_by: string | null; member: boolean } | null;

/** Invite link landing: who's inviting, then one tap (after signing in) to join. */
export default function Join({ params, data }: PageProps<Preview>) {
  const { account } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const here = `/join/${params.code}`;
  const join = async () => {
    setBusy(true);
    setError("");
    try {
      const id = await rpc<number>("join_league", { p_code: params.code });
      await switchLeague(id);
      await navigate("/stats/today", { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
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
                ? <a href={`/sign-in?redirect=${encodeURIComponent(here)}`} class="inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">Sign in to join</a>
                : account === "guest" && !data.is_public
                ? <a href={`/account?redirect=${encodeURIComponent(here)}#login`} class="inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">Save your account to join</a>
                : <button type="button" disabled={busy} onClick={() => void join()} class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Joining…" : `Join ${data.name}`}</button>}
              {error && <p class="text-sm text-rose-600">{error}</p>}
            </>
          )}
      </section>
    </div>
  );
}
