import { useEffect, useRef, useState } from "preact/hooks";
import { auth } from "@/lib/supabase";
import { expectAuth, viaProvider } from "@/lib/auth";
import { googleButton, renderGoogleButton, signInWithGoogleToken } from "@/lib/google";

const quiet = "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100";
const field = "min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm";

/**
 * Google + email code. `link`: add them to the signed-in account (a guest saving their progress, a name-only
 * player locking their name) instead of signing in to another one. `onDone` runs once signed in here (an email
 * code or Google's own button); a redirect to Google lands on /auth/callback instead.
 */
export default function LoginOptions({ after, link = false, onDone }: { after: string; link?: boolean; onDone: () => void | Promise<void> }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await f(); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  const [gsi, setGsi] = useState(googleButton);
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!gsi || !slot.current) return;
    renderGoogleButton(slot.current, link ? "continue_with" : "signin_with", (token, nonce) => void run(async () => {
      await signInWithGoogleToken(token, nonce, link);
      await onDone();
    })).catch(() => setGsi(false)); // Google's script didn't load: fall back to the redirect
  }, [gsi, link]);
  return (
    <div class="space-y-3">
      {gsi
        ? <div ref={slot} class="flex min-h-[44px] w-full justify-center" aria-label={link ? "Link Google" : "Continue with Google"} />
        : (
          <button type="button" disabled={busy} class={"flex w-full items-center justify-center gap-2 " + quiet}
            onClick={() => void run(() => viaProvider("google", after, link))}>
            <GoogleG /> {link ? "Link Google" : "Continue with Google"}
          </button>
        )}
      {!sent
        ? (
          <form class="flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const back = `${location.origin}/auth/callback`;
              expectAuth(after, link);
              await (link ? auth.updateUser({ email: email.trim() }, back) : auth.sendEmailCode(email.trim(), back));
              setSent(true);
            });
          }}>
            <input type="email" required class={field} placeholder="you@example.com" aria-label="Email" value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
            <button type="submit" disabled={busy} class={"shrink-0 " + quiet}>Email me a link</button>
          </form>
        )
        : (
          <form class="space-y-2" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await auth.verifyEmailCode(email.trim(), code.trim(), link ? "email_change" : "email");
              await onDone();
            });
          }}>
            <p class="text-sm text-gray-600">Check <b>{email}</b> and tap the link in our email{typing ? ", or type the code from it" : ""}.</p>
            {!typing && <button type="button" class="text-xs text-gray-500 underline" onClick={() => setTyping(true)}>The email has a code instead?</button>}
            {typing && <div class="flex gap-2">
              <input inputMode="numeric" autoComplete="one-time-code" required class={field} placeholder="123456" aria-label="Code"
                value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
              <button type="submit" disabled={busy} class="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">Confirm</button>
            </div>}
            <button type="button" class="text-xs text-gray-500 underline" onClick={() => { setSent(false); setCode(""); }}>Use another email</button>
          </form>
        )}
      {error && <p class="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function GoogleG() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width="18" height="18">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
