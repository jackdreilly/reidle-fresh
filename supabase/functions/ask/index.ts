// Ask Reidog (see supabase/migrations/*_ask_reidog.sql): answers questions about Reidle with Gemini, streamed as plain
// text. POST { messages: [{ role: "user" | "model", text }] } with the player's own Authorization + apikey headers and
// the app's x-league header: ask_begin runs as the player (PostgREST checks the token, the daily cap and the league),
// so this function needs no service key and keeps verify_jwt = false (config.toml). The Gemini key is the function
// secret GEMINI_API_KEY (set by CI from the GitHub secret); GEMINI_MODEL overrides the model.
import { SYSTEM_PROMPT } from "./prompt.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-flash-lite-latest";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-league",
  "access-control-allow-methods": "POST, OPTIONS",
};

type Turn = { role: "user" | "model"; text: string };
type Who = {
  id: number; name: string; account: string; played_today: boolean; leagues: number;
  league: {
    name?: string; tz?: string; reset_hour?: number; is_public?: boolean; open_invite?: boolean; members?: number;
    role?: string | null; scoring?: { mode: string; points?: number[]; no_show?: number; best_of?: number | null };
  } | null;
};

const fail = (status: number, message: string) => Response.json({ message }, { status, headers: CORS });

// As the player: the same headers the app sends to PostgREST.
async function rpc<T>(req: Request, fn: string, args: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = {
    apikey: req.headers.get("apikey") ?? "", authorization: req.headers.get("authorization") ?? "", "content-type": "application/json",
  };
  const league = req.headers.get("x-league");
  if (league) headers["x-league"] = league;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message ?? `HTTP ${res.status}`), { status: res.status });
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function scoring(s: NonNullable<Who["league"]>["scoring"]) {
  if (!s) return "Classic (40, 20, 10, 7, 6, 5, 4, 3, 2, 1)";
  const base = s.mode === "field" ? "Beat the field (1 point for playing + 1 for each player beaten)" : `points by place: ${(s.points ?? []).join(", ")}`;
  return base + (s.no_show ? `; ${s.no_show} for a missed day` : "") + (s.best_of ? `; only the best ${s.best_of} days count` : "");
}

/** The per-player note at the start of the conversation (after the shared system prompt, so caching still works). */
function context(w: Who, page: string | null) {
  const l = w.league;
  const hour = l?.reset_hour ?? 0;
  const at = `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`;
  return [
    "[Player context]",
    `Nickname: ${w.name}. Account: ${w.account === "guest" ? "guest (not saved yet)" : w.account === "legacy" ? "old name-only account (needs Google or email linked)" : "saved (Google or email)"}.`,
    l ? `Current league: ${l.name}${l.is_public ? " (public)" : ""}, ${l.members ?? "?"} members, ${l.role === "commissioner" ? "they are a commissioner" : "regular player"}. New word every day at ${at} ${(l.tz ?? "UTC").replace(/_/g, " ")}. Scoring: ${scoring(l.scoring)}. Invite link visible to ${l.open_invite === false ? "commissioners only" : "every player"}.` : "Not in a league yet.",
    `In ${w.leagues} league${w.leagues === 1 ? "" : "s"}. Played today's daily: ${w.played_today ? "yes" : "no"}.`,
    page ? `They opened this chat from: ${page}.` : "",
  ].filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return fail(405, "POST a question");
  // a signed-in player sends their JWT; the bare publishable key means the app has no login on this device
  if (!/^Bearer ey/.test(req.headers.get("authorization") ?? "")) return fail(401, "You've been signed out on this device.");
  if (!GEMINI_KEY) return fail(503, "Reidog is asleep right now (no API key yet). Try again later!");

  let body: { messages?: Turn[]; page?: string };
  try { body = await req.json(); } catch { return fail(400, "Bad request"); }
  const turns = (body.messages ?? []).filter((t) => (t.role === "user" || t.role === "model") && typeof t.text === "string" && t.text.trim())
    .slice(-12).map((t) => ({ role: t.role, text: t.text.slice(0, 2000) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  const question = turns[turns.length - 1];
  if (!question || question.role !== "user") return fail(400, "Ask a question first");

  let who: Who;
  try {
    who = await rpc<Who>(req, "ask_begin", { p_question: question.text });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return fail(status === 401 || status === 403 ? 401 : 400, (e as Error).message);
  }

  const contents = turns.map((t, i) => ({
    role: t.role,
    parts: i === 0 ? [{ text: context(who, typeof body.page === "string" ? body.page.slice(0, 100) : null) }, { text: t.text }] : [{ text: t.text }],
  }));
  const started = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "x-goog-api-key": GEMINI_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
    }),
  });
  if (!res.ok || !res.body) {
    console.error("gemini", res.status, await res.text().catch(() => ""));
    return fail(502, "Reidog couldn't think of an answer just now. Try again in a moment!");
  }

  // Gemini's server-sent events -> the answer's text, as it arrives
  let answer = "";
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(out) {
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            try {
              const chunk = JSON.parse(line.slice(5));
              const text = (chunk.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
              if (text) { answer += text; out.enqueue(enc.encode(text)); }
            } catch { /* partial or non-JSON line */ }
          }
        }
      } catch (e) {
        console.error("stream", e);
      } finally {
        if (!answer) out.enqueue(enc.encode("Woof, I lost my train of thought. Could you ask that again?"));
        out.close();
        await rpc(req, "ask_finish", { p_id: who.id, p_answer: answer || "(no answer)", p_ms: Date.now() - started, p_model: MODEL })
          .catch((e) => console.error("ask_finish", e));
      }
    },
  });
  return new Response(stream, { headers: { ...CORS, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
});
