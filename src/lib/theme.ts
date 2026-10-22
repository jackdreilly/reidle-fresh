// Light (the default) / dark / follow the system. The class is set by the inline script in index.html before first paint;
// the dark palette (src/dark.css) is a separate stylesheet, fetched only when dark is on.
import darkCss from "../dark.css?url";

export type Theme = "system" | "light" | "dark";
const KEY = "reidle:theme";
const media = matchMedia("(prefers-color-scheme: dark)");

export function getTheme(): Theme {
  try { return (localStorage.getItem(KEY) as Theme) || "light"; } catch { return "light"; }
}

export function applyTheme(t: Theme = getTheme()) {
  const dark = t === "dark" || (t === "system" && media.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  // index.html paints the page dark before the CSS loads; clear that when switching back to light
  document.documentElement.style.background = dark ? "#0d1117" : "";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#161b22" : "#ffffff");
  if (dark && !document.getElementById("dark-css")) {
    const l = Object.assign(document.createElement("link"), { id: "dark-css", rel: "stylesheet", href: darkCss });
    document.head.append(l);
  }
}

export function setTheme(t: Theme) {
  try { t === "light" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
}

export function initTheme() {
  applyTheme();
  media.addEventListener?.("change", () => applyTheme());
}
