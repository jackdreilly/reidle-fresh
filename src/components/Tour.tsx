import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { navigate } from "@/router";
import { patchSession, useSession } from "@/lib/session";
import { rpc } from "@/lib/supabase";

/** Closing the tour (any way) is remembered on the player, so it stays gone on every device. */
export function dismissTour() {
  patchSession({ tour_seen: true });
  rpc("dismiss_tour").catch(() => { /* offline: it shows once more next load, no harm */ });
}

const C = { correct: "var(--correct, #6aaa64)", present: "var(--present, #c9b458)", absent: "var(--absent, #787c7e)" };

/** A word in game tiles; g = green, y = yellow, anything else = gray. */
export function DemoTiles({ word, marks }: { word: string; marks: string }) {
  return (
    <span class="inline-flex gap-1" aria-label={word}>
      {word.split("").map((l, i) => (
        <span
          aria-hidden="true"
          class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-white"
          style={{ backgroundColor: marks[i] === "g" ? C.correct : marks[i] === "y" ? C.present : C.absent }}
        >
          {l}
        </span>
      ))}
    </span>
  );
}

function Row({ color, title, children }: { color: string; title: string; children: ComponentChildren }) {
  return (
    <li class="flex gap-3">
      <span aria-hidden="true" class="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span><b>{title}.</b> {children}</span>
    </li>
  );
}

type Step = { title: string; body: ComponentChildren };

/** First-visit walkthrough: five short cards, skippable at any point. */
export default function Tour() {
  const { name, league, played_today: played, account } = useSession();
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), [i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismissTour(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const steps: Step[] = [
    {
      title: `Welcome to Reidle${name ? `, ${name}` : ""}!`,
      body: (
        <>
          <p>A daily five-letter word race. Everyone in {league ? <b>{league.name}</b> : "your league"} gets the same word each day, and the <b>fastest time</b> wins.</p>
          <p>Here's the 30-second version. You can find all of it again under <b>Help</b> in the menu.</p>
        </>
      ),
    },
    {
      title: "How a game works",
      body: (
        <>
          <p>Your first guess is already filled in. Keep guessing until you find the word: there's no guess limit, only the clock.</p>
          <div class="flex flex-col items-center gap-1 py-1">
            <DemoTiles word="CRANE" marks="xyxxg" />
            <DemoTiles word="ROUTE" marks="ggggg" />
          </div>
          <p><b>Green</b> is the right letter in the right spot, <b>yellow</b> is in the word somewhere else. Every guess must be a real word (+5s if not) and must use all the clues you've found (+10s if not).</p>
        </>
      ),
    },
    {
      title: "Play the daily",
      body: (
        <>
          <p>Tap <b>Play</b> when you're ready. The clock only starts when you press Start, and you get one go per day.</p>
          <p>Your place each day earns points on the <b>Leaderboard</b>. Add them up over the week, and the top scorer takes the week. After you play you can see everyone's guesses and watch their replays.</p>
        </>
      ),
    },
    {
      title: "More ways to play",
      body: (
        <ul class="space-y-2">
          <Row color="#059669" title="Challenges">Play a fresh word, then everyone in your league gets a shot at your time. Beat theirs to take the win.</Row>
          <Row color="#6d28d9" title="Battles">Race other players live on the same word, any time.</Row>
          <Row color="#00A6B5" title="Practice">Unlimited random words, with hints, whenever you like.</Row>
        </ul>
      ),
    },
    {
      title: "Your league",
      body: (
        <>
          <p>A league is your group: its own daily word, leaderboard, challenges and chat. Bring friends in from <b>Invite &amp; league</b> in the menu, or start a new league for family or work.</p>
          {account === "guest" && (
            <p class="rounded-lg bg-gray-50 p-2">You're playing as a guest. <b>Save your account</b> in Settings to keep your stats on any device and join friends' leagues.</p>
          )}
        </>
      ),
    },
  ];
  const last = i === steps.length - 1;
  const step = steps[i];

  return (
    <div class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) dismissTour(); }}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        class="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl outline-none mb-[env(safe-area-inset-bottom)]"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">{i + 1} of {steps.length}</span>
          <button type="button" class="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" onClick={dismissTour}>Skip</button>
        </div>
        <h2 id="tour-title" class="mt-1 text-xl font-bold text-gray-900">{step.title}</h2>
        <div class="mt-2 space-y-2 text-sm text-gray-700">{step.body}</div>
        <div class="mt-4 flex items-center gap-2">
          <span class="flex flex-1 gap-1.5" aria-hidden="true">
            {steps.map((_, k) => <span class={"h-2 w-2 rounded-full " + (k === i ? "bg-sky-600" : "bg-gray-200")} />)}
          </span>
          {i > 0 && (
            <button type="button" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => {
              if (!last) return setI(i + 1);
              dismissTour();
              if (!played) void navigate("/play");
            }}
          >
            {!last ? "Next" : played ? "Done" : "Play today's word"}
          </button>
        </div>
      </div>
    </div>
  );
}
