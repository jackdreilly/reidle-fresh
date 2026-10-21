#!/usr/bin/env node
// Sets up reillybrothers.net as Reidle's email sending domain in Resend, so sign-in emails reach anyone:
//   RESEND_API_KEY=... [CLOUDFLARE_API_TOKEN=...] node tools/resend-setup.mjs
// Adds the domain in Resend if missing, puts its DNS records (DKIM, SPF, bounce MX) into the Cloudflare zone when
// the token may edit DNS (otherwise prints them to add by hand), then asks Resend to verify. Safe to re-run.
const DOMAIN = 'reillybrothers.net';
const { RESEND_API_KEY: key, CLOUDFLARE_API_TOKEN: cf } = process.env;
if (!key) die('RESEND_API_KEY is not set');

function die(msg) {
  console.error(msg);
  process.exit(1);
}

async function resend(path, init = {}) {
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) die(`Resend ${path}: HTTP ${res.status}: ${JSON.stringify(body)}${res.status === 401 || res.status === 403 ? '\n(the key needs "Full access" to manage domains)' : ''}`);
  return body;
}

async function cloudflare(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cf}`, 'Content-Type': 'application/json' },
  });
  return res.json();
}

let domain = (await resend('/domains')).data.find((d) => d.name === DOMAIN);
if (!domain) domain = await resend('/domains', { method: 'POST', body: JSON.stringify({ name: DOMAIN, region: 'us-east-1' }) });
domain = await resend(`/domains/${domain.id}`);
console.log(`Resend domain ${DOMAIN}: ${domain.status}`);

const records = domain.records.map((r) => ({
  type: r.type, name: r.name === '@' || !r.name ? DOMAIN : `${r.name}.${DOMAIN}`, content: r.value,
  ...(r.priority != null ? { priority: Number(r.priority) } : {}), status: r.status,
}));
let added = false;
if (cf) {
  const zone = (await cloudflare(`/zones?name=${DOMAIN}`)).result?.[0];
  if (!zone) console.log('Cloudflare: this token cannot see the zone (needs Zone > DNS > Edit for reillybrothers.net)');
  else {
    added = true;
    for (const r of records) {
      const existing = (await cloudflare(`/zones/${zone.id}/dns_records?type=${r.type}&name=${r.name}`)).result ?? [];
      if (existing.some((e) => e.content.replace(/"/g, '') === r.content.replace(/"/g, ''))) continue;
      const out = await cloudflare(`/zones/${zone.id}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({ type: r.type, name: r.name, content: r.content, ttl: 1, proxied: false, ...(r.priority != null ? { priority: r.priority } : {}) }),
      });
      if (out.success) console.log(`Cloudflare: added ${r.type} ${r.name}`);
      else { added = false; console.log(`Cloudflare: could not add ${r.type} ${r.name}: ${JSON.stringify(out.errors)}`); }
    }
  }
}
if (!added) {
  console.log('Add these DNS records in Cloudflare (DNS only, not proxied):');
  for (const r of records) console.log(`  ${r.type}\t${r.name}\t${r.priority ?? ''}\t${r.content}\t(${r.status})`);
}
if (domain.status !== 'verified') {
  await resend(`/domains/${domain.id}/verify`, { method: 'POST' });
  console.log('Asked Resend to verify (takes a few minutes; re-run to see the status).');
}
