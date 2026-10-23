import LoginOptions from "@/components/LoginOptions";
import { finishLink } from "@/lib/auth";
import { refreshSession, useSession } from "@/lib/session";
import { navigate } from "@/router";

/** Name-only sign-in has ended (app_flags.legacy_until): link a real login to keep this account and its history. */
export default function SaveAccount() {
  const { name, account } = useSession();
  if (account && account !== "legacy") { void navigate("/", { replace: true }); return null; }
  return (
    <section class="mx-auto max-w-md space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h1 class="font-semibold text-lg">Keep playing as {name}</h1>
      <p class="text-sm text-gray-600">
        Name-only sign-in has ended. Link Google or an email to this account and carry on: your games, stats and
        leagues all come with you.
      </p>
      <LoginOptions link after="/" onEmailDone={async () => {
        await finishLink();
        const s = await refreshSession();
        await navigate(s.nickname_set === false ? "/nickname?redirect=/" : "/");
      }} />
      <a href="/sign-out" class="block text-center text-sm text-gray-500 underline">Sign out</a>
    </section>
  );
}
