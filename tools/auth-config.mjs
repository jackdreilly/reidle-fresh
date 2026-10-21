#!/usr/bin/env node
// Applies Reidle's Supabase Auth settings to a live project over the Management API, so nobody clicks
// through the dashboard:  SUPABASE_ACCESS_TOKEN=... [GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...] node tools/auth-config.mjs staging|prod
//
//   - guests: anonymous sign-ins; account linking (a guest or name-only player adds Google/email, same account)
//   - email must be confirmed; a changed email is confirmed at the new address only (name-only accounts
//     have a made-up one)
//   - with a custom SMTP server (RESEND_API_KEY secret, or SMTP_HOST/PORT/USER/PASS/SENDER): send from it, and put
//     6-digit codes in the emails so the installed iPhone app can type them in (Supabase's built-in mailer
//     can't change templates and only sends a few emails an hour, to the project's team)
//   - Google when its client id/secret are in the environment (GitHub secrets GOOGLE_CLIENT_ID/SECRET)
// Name-only players keep signing in with their password (their accounts are already confirmed).
const PROJECTS = {
  staging: { ref: 'noxissvouravthzvoapw', site: 'https://reidle-staging.reidle.workers.dev' },
  prod: { ref: 'fjnhsrkjdrmpxidjsfzd', site: 'https://reidle.reillybrothers.net' },
};
const target = PROJECTS[process.argv[2]];
if (!target) die('usage: auth-config.mjs staging|prod');
if (!process.env.SUPABASE_ACCESS_TOKEN) die('SUPABASE_ACCESS_TOKEN is not set');

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const code = (what) => `<h2>Reidle</h2>
<p>Your code to ${what}:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Type it into Reidle, or <a href="{{ .ConfirmationURL }}">tap here</a> on this device.</p>
<p style="color:#888">If you didn't ask for this, ignore this email.</p>`;

const { GOOGLE_CLIENT_ID: gid, GOOGLE_CLIENT_SECRET: gsecret, SMTP_PORT, SMTP_USER, SMTP_SENDER, RESEND_API_KEY } = process.env;
// Resend: host smtp.resend.com, user "resend", password = a sending API key (reillybrothers.net is verified there)
const SMTP_PASS = process.env.SMTP_PASS || RESEND_API_KEY;
const SMTP_HOST = process.env.SMTP_HOST || (RESEND_API_KEY ? 'smtp.resend.com' : '');
const smtp = SMTP_HOST && SMTP_PASS
  ? {
    smtp_host: SMTP_HOST, smtp_port: SMTP_PORT || '465', smtp_user: SMTP_USER || 'resend', smtp_pass: SMTP_PASS,
    smtp_admin_email: SMTP_SENDER || 'reidle@reillybrothers.net', smtp_sender_name: 'Reidle', rate_limit_email_sent: 100,
    mailer_subjects_confirmation: 'Your Reidle code',
    mailer_templates_confirmation_content: code('confirm your email'),
    mailer_subjects_magic_link: 'Your Reidle sign-in code',
    mailer_templates_magic_link_content: code('sign in'),
    mailer_subjects_email_change: 'Your Reidle code',
    mailer_templates_email_change_content: code('confirm your email'),
  }
  : {};
const body = {
  site_url: target.site,
  uri_allow_list: [`${target.site}/**`, 'http://127.0.0.1:3000/**', 'http://localhost:3000/**'].join(','),
  external_anonymous_users_enabled: true,
  security_manual_linking_enabled: true,
  external_email_enabled: true,
  mailer_autoconfirm: false,
  mailer_secure_email_change_enabled: false,
  mailer_otp_length: 6,
  ...smtp,
  ...(gid && gsecret
    ? { external_google_enabled: true, external_google_client_id: gid, external_google_secret: gsecret }
    : {}),
};

const res = await fetch(`https://api.supabase.com/v1/projects/${target.ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
if (!res.ok) die(`${process.argv[2]}: HTTP ${res.status}: ${await res.text()}`);
const live = await res.json();
console.log(`${process.argv[2]} auth settings applied:`, {
  site_url: live.site_url,
  anonymous: live.external_anonymous_users_enabled,
  linking: live.security_manual_linking_enabled,
  confirm_email: !live.mailer_autoconfirm,
  google: live.external_google_enabled,
  custom_smtp: !!live.smtp_host,
});
