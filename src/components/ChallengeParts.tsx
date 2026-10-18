import type { ComponentChildren } from "preact";

/** Small letter tiles for a 5-letter word: green = the answer, gray = the starting word, "?" = still hidden. */
export function Tiles({ word, tone }: { word?: string | null; tone: "green" | "gray" }) {
  const letters = (word ?? "?????").toUpperCase().split("");
  return (
    <span class="inline-flex gap-0.5" aria-label={word ? word.toUpperCase() : "hidden word"}>
      {letters.map((l) => (
        <span
          aria-hidden="true"
          class={"inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold " +
            (!word ? "bg-gray-200 text-gray-400" : tone === "green" ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700")}
        >
          {l}
        </span>
      ))}
    </span>
  );
}

export const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
};

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Primary green call to action, shared by every challenge screen. */
export function ChallengeButton(
  { href, onClick, children, disabled, secondary }: {
    href?: string;
    onClick?: () => void;
    children: ComponentChildren;
    disabled?: boolean;
    secondary?: boolean;
  },
) {
  const cls = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition active:scale-95 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:opacity-50 " +
    (secondary
      ? "bg-white text-green-700 ring-1 ring-green-300 hover:bg-green-50"
      : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:opacity-90");
  return href
    ? <a href={href} class={cls}>{children}</a>
    : <button type="button" class={cls} disabled={disabled} onClick={onClick}>{children}</button>;
}

/** "Next challenge" when some are waiting for you, otherwise "New challenge" (both go through challenge_next). */
export function NextChallenge({ pending, secondary }: { pending: number; secondary?: boolean }) {
  return (
    <ChallengeButton href="/challenges/play" secondary={secondary}>
      {pending ? `Next challenge · ${pending} open` : "New challenge"}
    </ChallengeButton>
  );
}

export function Target() {
  return (
    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />
    </svg>
  );
}
