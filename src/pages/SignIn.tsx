import { useState } from "preact/hooks";
import Input from "@/components/Input";
import { signIn } from "@/lib/auth";
import { refreshSession } from "@/lib/session";
import { setSignedIn } from "@/boot";
import { navigate } from "@/router";

export default function SignIn({ query }: { query: URLSearchParams }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: Event) {
    e.preventDefault();
    const name = new FormData(e.currentTarget as HTMLFormElement).get("name") as string;
    setBusy(true);
    setError("");
    try {
      await signIn(name);
      setSignedIn(true);
      await refreshSession();
      const to = query.get("redirect");
      await navigate(to && to.startsWith("/") ? to : "/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <div class="m-2">
      <nav><h1 class="m-2 font-bold text-3xl">Reidle</h1></nav>
      <main class="m-2">
        <h2 class="text-2xl">Sign in</h2>
        <div>Just put your name to start playing Reidle!</div>
        <form onSubmit={submit}>
          <Input class="m-4" autoFocus type="text" placeholder="Your name" name="name" required />
          <Input type="submit" disabled={busy} />
        </form>
        {error && <div class="m-4 text-red-600">{error}</div>}
      </main>
    </div>
  );
}
