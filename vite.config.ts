import preact from "@preact/preset-vite";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
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

export default defineConfig({
  plugins: [preact(), tailwind(), precache()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 3000 },
  preview: { host: "127.0.0.1" },
  build: { target: "es2022", sourcemap: false },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
