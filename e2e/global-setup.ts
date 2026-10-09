import { execSync } from "node:child_process";

export default function globalSetup() {
  // Fresh, deterministic fixture (seed.sql is relative to today).
  execSync("npx supabase db reset", { stdio: "ignore" });
}
