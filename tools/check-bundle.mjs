// Fails the build if the first-load payload (entry JS + CSS, gzipped) exceeds its budget.
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BUDGET = { js: 20 * 1024, css: 10 * 1024 }; // bytes, gzipped
const dir = new URL("../dist/assets/", import.meta.url);
const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const entries = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.(js|css))"/g)];
const sizes = { js: 0, css: 0 };
for (const [, file, kind] of entries) sizes[kind] += gzipSync(readFileSync(new URL(file, dir))).length;
console.log(`first load (gzip): js ${(sizes.js / 1024).toFixed(1)}KB / ${BUDGET.js / 1024}KB, css ${(sizes.css / 1024).toFixed(1)}KB / ${BUDGET.css / 1024}KB; chunks: ${readdirSync(dir).filter((f) => f.endsWith(".js")).length}`);
if (sizes.js > BUDGET.js || sizes.css > BUDGET.css) {
  console.error("bundle budget exceeded");
  process.exit(1);
}
