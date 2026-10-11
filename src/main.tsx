import "./index.css";
import { render } from "preact";
import App from "./App";
import { navigate, startRouter } from "./router";
import { detectSignedIn } from "./boot";
import { refreshSession } from "./lib/session";
import { loadWordle } from "./lib/wordle";

render(<App />, document.getElementById("app")!);

// No top-level await: lazy route chunks import this entry chunk, which must finish evaluating.
void (async () => {
  const signedIn = await detectSignedIn();
  if (signedIn) refreshSession().catch(() => {});
  await startRouter();
  // Warm the (cacheable) word lists while the user reads the first page, so Play is instant.
  if (signedIn) (window.requestIdleCallback ?? setTimeout)(() => void loadWordle().catch(() => {}));
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // a tapped chat notification asks an already-open tab to go to the chat
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "navigate" && typeof e.data.url === "string") void navigate(e.data.url);
    });
  }
})();
