import "./index.css";
import { render } from "preact";
import App from "./App";
import { navigate, refresh, startRouter } from "./router";
import { loadWordle } from "./routes";
import { detectSignedIn, signedIn } from "./boot";
import { refreshSession, today } from "./lib/session";
import { initPwa } from "./lib/pwa";
import { initTheme } from "./lib/theme";

initTheme();
render(<App />, document.getElementById("app")!);

// Back in the foreground after a while: fresh shell state (played today, unread) and page data.
initPwa((prevDay, today) => {
  if (!signedIn()) return;
  refreshSession().catch(() => {});
  void refresh(prevDay, today);
}, today);

// No top-level await: lazy route chunks import this entry chunk, which must finish evaluating.
void (async () => {
  const isIn = await detectSignedIn();
  if (isIn) refreshSession().catch(() => {});
  await startRouter();
  // Warm the (cacheable) word lists while the user reads the first page, so Play is instant,
  // and load usage + error reporting (src/lib/telemetry.ts), off the first load
  (window.requestIdleCallback ?? setTimeout)(() => {
    import("./lib/telemetry");
    if (isIn) void loadWordle().catch(() => {});
  });
  // a tapped chat notification asks an already-open tab to go to the chat
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data?.type === "navigate" && typeof e.data.url === "string") void navigate(e.data.url);
  });
})();
