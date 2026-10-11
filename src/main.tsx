import "./index.css";
import { render } from "preact";
import App from "./App";
import { refresh, startRouter } from "./router";
import { detectSignedIn, signedIn } from "./boot";
import { refreshSession } from "./lib/session";
import { loadWordle } from "./lib/wordle";
import { initPwa } from "./lib/pwa";
import { utcToday } from "./lib/time";

render(<App />, document.getElementById("app")!);

// Back in the foreground after a while: fresh shell state (played today, unread) and page data.
initPwa((prevDay, today) => {
  if (!signedIn()) return;
  refreshSession().catch(() => {});
  void refresh(prevDay, today);
}, utcToday);

// No top-level await: lazy route chunks import this entry chunk, which must finish evaluating.
void (async () => {
  const isIn = await detectSignedIn();
  if (isIn) refreshSession().catch(() => {});
  await startRouter();
  // Warm the (cacheable) word lists while the user reads the first page, so Play is instant.
  if (isIn) (window.requestIdleCallback ?? setTimeout)(() => void loadWordle().catch(() => {}));
})();
