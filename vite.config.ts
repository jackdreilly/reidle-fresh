import preact from "@preact/preset-vite";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import { defineConfig, type Plugin } from "vitest/config";

// Stamps dist/sw.js with this build's hashed assets (precached on install) and a build id
// (the cache name, so a deploy retires the previous build's cache).
const precache = (): Plugin => {
  let dist = "";
  return {
    name: "reidle-sw-precache",
    apply: "build",
    configResolved(c) { dist = resolve(c.root, c.build.outDir) + "/"; },
    closeBundle() {
      const assets = readdirSync(dist + "assets").sort().map((f) => "/assets/" + f);
      const build = createHash("sha256").update(assets.join()).digest("hex").slice(0, 10);
      const sw = readFileSync(dist + "sw.js", "utf8");
      writeFileSync(dist + "sw.js", `self.__PRECACHE__ = ${JSON.stringify(assets)};\nself.__BUILD__ = "${build}";\n` + sw);
    },
  };
};

// Staging build only: badged icons from public-staging/ replace the prod ones, and the app is named
// "Reidle Staging" with a teal theme colour, so an installed staging app is easy to tell from prod.
// (Regenerate the icons with tools/gen-staging-icons.py.) Prod builds are untouched.
const TEAL = "#0d9488";
const staging = (): Plugin => {
  let dist = "", on = false;
  return {
    name: "reidle-staging",
    apply: "build",
    configResolved(c) { dist = resolve(c.root, c.build.outDir) + "/"; on = c.mode === "staging"; },
    transformIndexHtml(html) {
      if (!on) return html;
      return html
        .replace("<title>Reidle</title>", "<title>Reidle Staging</title>")
        .replace('name="theme-color" content="#ffffff"', `name="theme-color" content="${TEAL}"`)
        .replace('name="apple-mobile-web-app-title" content="Reidle"', 'name="apple-mobile-web-app-title" content="Reidle Stg"');
    },
    closeBundle() {
      if (!on) return;
      const dir = resolve(dist, "../public-staging") + "/";
      for (const f of readdirSync(dir)) copyFileSync(dir + f, dist + f);
      const m = JSON.parse(readFileSync(dist + "manifest.webmanifest", "utf8"));
      Object.assign(m, { name: "Reidle Staging", short_name: "Reidle Stg", theme_color: TEAL });
      writeFileSync(dist + "manifest.webmanifest", JSON.stringify(m, null, 2));
    },
  };
};

// iOS "Add to Home Screen" showed a plain letter instead of the logo even though /apple-touch-icon.png serves
// fine, so the 180px icon (64 colours, ~11KB) is inlined into index.html: nothing left for iOS to fetch.
// Staging inlines its badged copy from public-staging/.
const touchIcon = (): Plugin => {
  let file = "";
  return {
    name: "reidle-touch-icon",
    apply: "build",
    configResolved(c) { file = resolve(c.root, c.mode === "staging" ? "public-staging" : "public", "apple-touch-icon.png"); },
    transformIndexHtml(html) {
      return html.replace('href="/apple-touch-icon.png?v=2"', `href="data:image/png;base64,${readFileSync(file).toString("base64")}"`);
    },
  };
};

// Cloudflare Web Analytics (privacy-friendly page views, no cookies): the beacon loads deferred from Cloudflare,
// outside the bundle budget, only when the build has a site token (VITE_CF_BEACON_TOKEN; public, like the
// Supabase key). spa: true counts client-side route changes as page views.
const beacon = (): Plugin => {
  let token = "";
  return {
    name: "reidle-cf-beacon",
    apply: "build",
    configResolved(c) { token = loadEnv(c.mode, c.root, "VITE_").VITE_CF_BEACON_TOKEN ?? ""; },
    transformIndexHtml(html) {
      if (!token) return html;
      const cfg = JSON.stringify({ token, spa: true });
      return html.replace("</body>",
        `  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${cfg}'></script>\n  </body>`);
    },
  };
};

export default defineConfig({
  plugins: [preact(), tailwind(), precache(), staging(), touchIcon(), beacon()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 3000 },
  preview: { host: "127.0.0.1" },
  build: { target: "es2022", sourcemap: false },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
