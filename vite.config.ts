import preact from "@preact/preset-vite";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
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

export default defineConfig({
  plugins: [preact(), tailwind(), precache(), staging()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 3000 },
  preview: { host: "127.0.0.1" },
  build: { target: "es2022", sourcemap: false },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
