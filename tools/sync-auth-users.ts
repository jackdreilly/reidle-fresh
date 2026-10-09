// Creates a Supabase auth user for every player that has none (e.g. after cloning prod data,
// which deliberately never copies the auth schema). Idempotent.
//   SUPABASE_URL=... SERVICE_ROLE_KEY=... DB_URL=... node tools/sync-auth-users.ts
import { execFileSync } from "node:child_process";
import { credentials } from "../src/lib/credentials.ts";

const { SUPABASE_URL, SERVICE_ROLE_KEY, DB_URL } = process.env;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DB_URL) {
  console.error("need SUPABASE_URL, SERVICE_ROLE_KEY, DB_URL");
  process.exit(1);
}

const names = execFileSync("psql", [DB_URL, "-At", "-c", "select name from players where user_id is null order by name"])
  .toString().split("\n").filter(Boolean);

let created = 0;
for (const name of names) {
  const { email, password } = await credentials(name);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }),
  });
  if (res.ok) created++;
  else if (res.status !== 422) console.error(`failed for ${name}: ${res.status} ${await res.text()}`);
}
console.log(`auth users: ${created} created, ${names.length - created} already existed or failed`);
