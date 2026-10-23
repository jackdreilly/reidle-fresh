import { useEffect } from "preact/hooks";
import { lockedOut, useSession } from "@/lib/session";
import { navigate } from "@/router";

/** "Name-only sign-in ends Oct 28." from bootstrap's legacy_until. */
export const nameOnlyEnds = (t?: string | null) =>
  `Name-only sign-in ${t && Date.parse(t) > Date.now() ? "ends " + new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "is going away soon"}.`;

/**
 * Guests and name-only players: a nudge to link Google or an email. Once name-only sign-in has ended, a
 * name-only player is sent to /save-account until they link one (the server refuses their plays meanwhile).
 */
export default function AccountBanner({ route, fullPage }: { route: string; fullPage?: boolean }) {
  const session = useSession();
  const { account, name } = session;
  const locked = lockedOut(session);
  useEffect(() => {
    if (locked && !/^\/(save-account|nickname)/.test(location.pathname)) void navigate("/save-account", { replace: true });
  }, [locked, route]);
  if (fullPage || route === "/account") return null;
  return account === "legacy" ? (
    <a href="/account#login" class="mx-auto mb-3 block max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-gray-700">
      <b>Lock {name} to you.</b> Anyone who types {name} can sign in as you. {nameOnlyEnds(session.legacy_until)}{" "}
      <span class="font-medium underline">Link Google or email</span>
    </a>
  ) : (
    <a href="/account#login" class="mx-auto mb-3 block max-w-xl rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
      You're playing as a guest (<b>{name}</b>). <span class="underline">Save your account</span> to keep your stats and join friends' leagues.
    </a>
  );
}
