import type { ComponentChildren } from "preact";
import { DemoTiles } from "@/components/Tour";
import { patchSession, useSession } from "@/lib/session";
import { describeScoring } from "@/lib/leagues";

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";

function Section({ id, title, children }: { id: string; title: string; children: ComponentChildren }) {
  return (
    <section id={id} class={card + " scroll-mt-24"}>
      <h2 class="text-lg font-semibold text-gray-900">{title}</h2>
      <div class="mt-2 space-y-2 text-sm text-gray-700">{children}</div>
    </section>
  );
}

const A = ({ href, children }: { href: string; children: ComponentChildren }) => (
  <a href={href} class="font-medium text-sky-600 underline">{children}</a>
);

const TOPICS: [string, string][] = [
  ["rules", "How a game works"], ["daily", "The daily"], ["scoring", "Points and the week"],
  ["challenges", "Challenges"], ["battles", "Battles"], ["practice", "Practice"],
  ["leagues", "Leagues and invites"], ["account", "Your account"], ["extras", "Chat, alerts and the app"], ["ask", "Ask Reidog"],
];

/** The basics of the site, one card per part. Linked from the menu and the first-visit tour. */
export default function Help() {
  const { league, account } = useSession();
  return (
    <div class="mx-auto max-w-xl space-y-3">
      <div class="flex items-center justify-between gap-2 px-1">
        <h1 class="text-2xl font-bold text-gray-900">Help</h1>
        <button type="button" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          onClick={() => patchSession({ tour_seen: false })}>
          Show the tour again
        </button>
      </div>
      <nav class={card} aria-label="Topics">
        <ul class="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          {TOPICS.map(([id, t]) => <li><a href={`#${id}`} class="text-sky-600 hover:underline">{t}</a></li>)}
        </ul>
      </nav>

      <Section id="rules" title="How a game works">
        <p>Find the hidden five-letter word as fast as you can. Your first guess is already filled in for you. There's no limit on guesses: the clock is what counts.</p>
        <div class="flex flex-col items-center gap-1 py-1">
          <DemoTiles word="CRANE" marks="xyxxg" />
          <DemoTiles word="ROUTE" marks="ggggg" />
        </div>
        <p><b>Green</b>: right letter, right spot. <b>Yellow</b>: the letter is in the word, somewhere else. <b>Gray</b>: not in the word.</p>
        <p>Two rules add time to your clock (you'll see them in the penalty box):</p>
        <ul class="list-disc space-y-1 pl-5">
          <li>Not a real word: <b>+5 seconds</b>.</li>
          <li>Ignoring a clue: <b>+10 seconds</b>. Greens have to stay put, yellows have to be used (in a new spot), and grays can't come back.</li>
        </ul>
      </Section>

      <Section id="daily" title="The daily">
        <p>Each league has one word a day, the same for everyone in it. Tap <A href="/play">Play</A>, then <b>Start</b> when you're ready: the clock doesn't run until you do. You get one go per day, and you can pick up where you left off if you close the page mid-game.</p>
        <p>The day resets at the league's reset time{league ? ` (${league.reset_hour}:00 ${league.tz.replace(/_/g, " ")} for ${league.name})` : ""}. Until you've played, other people's guesses stay hidden. Afterwards the <A href="/stats/today">Leaderboard</A> shows everyone's time, their guesses and a replay of how they got there.</p>
      </Section>

      <Section id="scoring" title="Points and the week">
        <p>Your place each day earns points, and the week (Monday to Sunday) adds them up. The highest total wins the week, and ties go to the lower total time.</p>
        {league?.scoring && <p>{league.name} scores: {describeScoring(league.scoring)}. A commissioner can change this on the <A href="/league">league page</A>.</p>}
        <p>The <A href="/stats/past_winners">Past</A> tab has the power rankings, tennis style: each week's finish earns points (1st 10, 2nd 6, 3rd 4, 4th 3, 5th 2, anyone else who played 1), added up over your last 8 finished weeks, so old weeks drop off as new ones count. Arrows show who moved since last week. Below them is every week's top three, newest first.</p>
        <p>Each player's page has their stats. Tap any name to see it.</p>
      </Section>

      <Section id="challenges" title="Challenges">
        <p>Challenges are extra words you can play any time. Start one and you play a fresh word; everyone else in your league then gets a go at beating your time. Open challenges from others show up with a red count on the Challenges button.</p>
        <p>Winning a challenge earns a point for every player in it, and each challenge you play costs one, so the Challenges leaderboard rewards winning, not just playing lots.</p>
      </Section>

      <Section id="battles" title="Battles">
        <p>Live races against other players on the same word, in real time. Join the <A href="/battles/party_room">Party Room</A> to play whoever's around, or start a new battle and share its link. Battles are open to everyone on Reidle, not just your league, and don't count toward any leaderboard.</p>
      </Section>

      <Section id="practice" title="Practice">
        <p><A href="/practice">Practice</A> gives you unlimited random words with no pressure. Stuck? The hint button counts how many answers are still possible, then fills in one that fits.</p>
      </Section>

      <Section id="leagues" title="Leagues and invites">
        <p>A league is your group: its own daily word, leaderboard, challenges and chat. You can be in several and switch between them from the menu.</p>
        <ul class="list-disc space-y-1 pl-5">
          <li><b>Invite people</b>: open <A href="/league">Invite &amp; league</A> and share the link. Whoever opens it signs in with Google or email right there and joins (private leagues need a login). Anyone not ready to sign in can play as a guest in Reidle Global instead. A commissioner can keep the link to commissioners only.</li>
          <li><b>Start your own</b>: <A href="/leagues/new">create a league</A> for family, friends or work. You become its commissioner and can set its name, reset time, scoring and who can invite.</li>
          <li><b>Reidle Global</b> is open to everyone, and is where guests start out.</li>
        </ul>
      </Section>

      <Section id="account" title="Your account">
        {account === "guest"
          ? <p>You're playing as a <b>guest</b>. Your stats live on this device's sign-in only. <A href="/account#login">Save your account</A> with Google or email to keep them on any device and to join private leagues.</p>
          : <p>Sign in with Google or email to keep your stats on every device. Not ready to sign in? Try it as a guest in Reidle Global, then save your account later without losing anything.</p>}
        <p>Change your nickname, theme (light or dark) and notifications in <A href="/account">Settings</A>.</p>
        <p>To keep improving Reidle, the site notes which pages and invite links you open, how long they're on screen, and anything that breaks. It never records what you type in chat. More in our <a href="/privacy" target="_blank" class="underline">privacy policy</a> and <a href="/tos" target="_blank" class="underline">terms</a>.</p>
      </Section>

      <Section id="extras" title="Chat, alerts and the app">
        <ul class="list-disc space-y-1 pl-5">
          <li><A href="/messages">Messages</A> is your league's chat. A blue dot means something new.</li>
          <li>Turn on notifications in <A href="/account">Settings</A> and pick what you hear about: chat, someone beating your time, new challenges, the new word, a weekly recap, and a daily reminder before the word resets on days you haven't played.</li>
          <li>Add Reidle to your home screen from <A href="/account#install">Settings</A>: it opens full screen and starts instantly. On iPhone, notifications only work from the home-screen app.</li>
        </ul>
      </Section>

      <Section id="ask" title="Ask Reidog">
        <p>Still stuck? <A href="/ask?from=/help">Ask Reidog</A> (also in the menu), our AI help dog. It knows how everything here works, can look up your league's results, stats, standings and challenges, and answers in seconds. It's an AI, so it can get things wrong now and then.</p>
      </Section>
    </div>
  );
}
