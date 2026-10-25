import { useEffect, useState } from "preact/hooks";
import { landingHash } from "@/lib/supabase";
import { auth } from "@/lib/auth-api";
import { afterAuth, finishLink } from "@/lib/auth";
import { refreshSession } from "@/lib/session";
import { setSignedIn } from "@/boot";
import { navigate } from "@/router";

/** Back from Google & co: tokens arrive in the URL hash (gone from location by now: the router drops it). */
export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const err = auth.fromRedirect(landingHash);
      const { to, linked } = afterAuth();
      if (err) {
        setError(/already.*linked|identity.*exists/i.test(err)
          ? "That Google account already has its own Reidle login. Sign out, then sign in with Google to use it."
          : err);
        return;
      }
      setSignedIn(true);
      if (linked) await finishLink();
      const s = await refreshSession();
      await navigate(s.nickname_set === false ? `/nickname?redirect=${encodeURIComponent(to)}` : to, { replace: true });
    })().catch((e) => setError((e as Error).message));
  }, []);
  return (
    <div class="mx-auto max-w-md p-6 text-center">
      {error
        ? <><p class="text-rose-600">{error}</p><a href="/" class="mt-4 inline-block underline">Back to Reidle</a></>
        : <p class="text-gray-500">Signing you in…</p>}
    </div>
  );
}
