import "./index.css";
import { render } from "preact";
import App from "./App";
import { startRouter } from "./router";
import { detectSignedIn } from "./boot";
import { refreshSession } from "./lib/session";

render(<App />, document.getElementById("app")!);

const signedIn = await detectSignedIn();
if (signedIn) refreshSession().catch(() => {});
await startRouter();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
