import preact from "@preact/preset-vite";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import postcss from "postcss";
import { Scanner } from "@tailwindcss/oxide";
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
    writeBundle() {
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

// A per-chunk stylesheet (components/game.chunk.css) is a Tailwind sheet for its own files, which index.css leaves
// out of its scan, so it loads with the game chunk instead of the first load. Left alone they would repeat
// utilities the first-load sheet already has, and a repeat (loaded later, same layer) beats that sheet's ordering
// elsewhere: a repeated `hidden` would override `md:block` on another page. So each drops every utility whose class
// index.css also generates (same scan as Tailwind's: src/ and index.html minus its `@source not` files) and only
// adds what its chunk alone uses. Done in transform, so the file hash covers the result. Only one such sheet: two
// would order their shared utilities by which loaded last. The build also fails if one of the left-out files ends up
// in a chunk without the sheet (imported from a page outside the game), where it would render unstyled.
const chunkCss = (): Plugin => {
  let root = "", build = false;
  let main: Set<string> | null = null;
  const mainCandidates = () => {
    if (main && build) return main; // the dev server rescans: the files change
    const not = notFiles().map((pattern) => ({ base: resolve(root, "src"), pattern, negated: true }));
    const scanner = new Scanner({ sources: [
      { base: resolve(root, "src"), pattern: "**/*", negated: false },
      { base: root, pattern: "index.html", negated: false },
      ...not,
    ] });
    return (main = new Set(scanner.scan()));
  };
  const notFiles = () => [...readFileSync(resolve(root, "src/index.css"), "utf8").matchAll(/@source not "\.\/([^"]+)"/g)]
    .map((m) => m[1]);
  let sheet = "";
  const cls = /\.((?:\\.|[^\\\s:,>+~.\[#()*])+)/;
  return {
    name: "reidle-chunk-css",
    configResolved(c) { root = c.root; build = c.command === "build"; },
    transform(code, id) {
      if (!id.split("?")[0].endsWith(".chunk.css")) return;
      const file = id.split("?")[0];
      if (sheet && sheet !== file) this.error(`only one *.chunk.css is supported (${sheet}, ${file})`);
      sheet = file;
      const have = mainCandidates();
      const ast = postcss.parse(code);
      ast.walkAtRules("layer", (layer) => {
        if (layer.params !== "utilities") return;
        layer.walkRules((r) => {
          const m = r.selector.match(cls);
          if (m && have.has(m[1].replace(/\\(.)/g, "$1"))) r.remove();
        });
      });
      for (let empty = true; empty;) {
        empty = false;
        ast.walkAtRules((a) => { if (a.nodes && !a.nodes.length) { a.remove(); empty = true; } });
      }
      return { code: ast.toString(), map: null };
    },
    generateBundle(_, bundle) {
      // (Admin.tsx is styled by its own plain admin.css)
      const left = new Set(notFiles().filter((f) => !f.endsWith("Admin.tsx")).map((f) => resolve(root, "src", f)));
      for (const c of Object.values(bundle)) {
        if (c.type !== "chunk" || !c.moduleIds.some((m) => left.has(m))) continue;
        const css = (c as { viteMetadata?: { importedCss: Set<string> } }).viteMetadata?.importedCss ?? new Set();
        if (![...css].some((f) => !f.startsWith("assets/index-"))) {
          this.error(`${c.fileName} has ${c.moduleIds.filter((m) => left.has(m)).join(", ")} without its stylesheet: import it only from the game, or take it out of the @source not list in src/index.css`);
        }
      }
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
  plugins: [preact(), tailwind(), chunkCss(), precache(), staging(), touchIcon(), beacon()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 3000 },
  preview: { host: "127.0.0.1" },
  build: {
    target: "es2022",
    sourcemap: false,
    // every browser that runs an es2022 build has native modulepreload: no polyfill in the first load
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // Libraries in chunks of their own: they change far less often than the app, so after a deploy a
        // returning player's browser (and the service worker) still has them cached.
        manualChunks: (id) =>
          id.includes("/node_modules/preact/") ? "preact" : id.includes("/node_modules/@supabase/") ? "realtime" : undefined,
      },
    },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
