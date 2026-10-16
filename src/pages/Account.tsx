import { useEffect, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { useSession } from "@/lib/session";
import { useInstall } from "@/lib/pwa";
import { rpc } from "@/lib/supabase";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";
import { resetClock } from "@/lib/time";

type Prefs = {
  chat: boolean; results: boolean; beaten: boolean; challenges: boolean; new_day: boolean; recap: boolean;
  reminder_before: number | null;
};
type Toggle = Exclude<keyof Prefs, "reminder_before">;

const TOGGLES: [Toggle, string, string][] = [
  ["chat", "Chat messages", "New messages from everyone else"],
  ["beaten", "Beaten", "Someone beats your time today, or takes 1st from you"],
  ["results", "Today's results", "Someone finishes today's word (their time and rank, never the guesses)"],
  ["challenges", "Challenges", "A new challenge is set, or someone beats your time on one"],
  ["new_day", "New word", "When the new word is up, with yesterday's winner"],
  ["recap", "Weekly recap", "Monday: who won the week and where you finished"],
];
const REMINDER_HOURS = [1, 2, 3, 4, 6, 8, 12];

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";

export default function Account({ data }: PageProps<{ name: string; prefs: Prefs }>) {
  const install = useInstall();
  const name = useSession().name ?? data.name;
  return (
    <div class="mx-auto max-w-md space-y-4">
      <header class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Settings</div>
          <h1 class="truncate text-2xl font-bold text-gray-900">{name}</h1>
        </div>
        <a href={`/players/${name}`} class="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          📊 Game Stats
        </a>
      </header>
      <Notifications initial={data.prefs} />
      {install && (
        <section id="install" class={card}>
          <h2 class="mb-1 font-semibold">Install Reidle</h2>
          {install.kind === "prompt"
            ? (
              <>
                <p class="mb-3 text-sm text-gray-600">Put Reidle on your home screen: it opens full screen and starts instantly.</p>
                <button type="button" onClick={() => void install.install()} class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">
                  Install app
                </button>
              </>
            )
            : (
              <p class="text-sm text-gray-600">
                In Safari, tap <b>Share</b> <ShareIcon /> then <b>Add to Home Screen</b>. Reidle then opens full screen like an app.
              </p>
            )}
        </section>
      )}
      <a href="/sign-out" class="block rounded-lg border border-gray-200 bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100">
        Log Out
      </a>
    </div>
  );
}

function Notifications({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [device, setDevice] = useState<PushState | "busy" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { pushState().then(setDevice, () => setDevice("unsupported")); }, []);

  const save = async (patch: Partial<Prefs>) => {
    const before = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      setPrefs(await rpc<Prefs>("set_notify_prefs", { p: patch }));
    } catch {
      setPrefs(before);
      setNote("Couldn't save that. Try again.");
    }
  };
  const toggleDevice = async () => {
    const was = device;
    setDevice("busy");
    setNote(null);
    try {
      setDevice(await (was === "on" ? disablePush() : enablePush()));
    } catch (e) {
      setDevice(was);
      setNote((e as Error).message || "Couldn't turn on notifications");
    }
  };
  const on = device === "on";

  return (
    <section class={card}>
      <h2 class="font-semibold">Notifications</h2>
      <div class="mt-3 flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
        <div class="min-w-0 text-sm">
          <div class="font-medium text-gray-900">This device</div>
          <div class="text-xs text-gray-500">
            {device === null ? "Checking…"
              : device === "install" ? "On iPhone, add Reidle to your Home Screen (Share, then Add to Home Screen) and open it from there."
              : device === "denied" ? "Blocked. Allow notifications for this site in your browser's settings."
              : device === "unsupported" ? "This browser can't show notifications."
              : on ? "Notifications are on here." : "Off. Turn on to get the ones picked below."}
          </div>
        </div>
        {(device === "on" || device === "off" || device === "busy") && (
          <button
            type="button"
            onClick={toggleDevice}
            disabled={device === "busy"}
            class={"shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 " +
              (on ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100" : "bg-sky-600 text-white")}
          >
            {device === "busy" ? "…" : on ? "Turn off" : "Turn on"}
          </button>
        )}
      </div>
      {note && <p role="status" class="mt-2 text-xs text-rose-600">{note}</p>}
      <p class="mt-3 text-xs text-gray-500">Pick what to hear about. It applies to every device where notifications are on.</p>
      <ul class="mt-1 divide-y divide-gray-100">
        {TOGGLES.map(([key, title, detail]) => (
          <li>
            <label class="flex cursor-pointer items-center justify-between gap-3 py-2.5">
              <span class="min-w-0">
                <span class="block text-sm font-medium text-gray-900">{title}</span>
                <span class="block text-xs text-gray-500">{detail}</span>
              </span>
              <Switch checked={prefs[key]} onChange={(v) => void save({ [key]: v })} label={title} />
            </label>
          </li>
        ))}
        <li class="py-2.5">
          <label class="flex items-center justify-between gap-3">
            <span class="min-w-0">
              <span class="block text-sm font-medium text-gray-900">Reminder</span>
              <span class="block text-xs text-gray-500">If you haven't played yet. The word resets at {resetClock()}.</span>
            </span>
            <select
              class="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
              value={prefs.reminder_before ?? ""}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                void save({ reminder_before: v ? Number(v) : null });
              }}
            >
              <option value="">Off</option>
              {REMINDER_HOURS.map((h) => <option value={h}>{resetClock(h)} ({h}h before)</option>)}
            </select>
          </label>
        </li>
      </ul>
    </section>
  );
}

// Inline styles on purpose: keeps new utility classes out of the first-load CSS budget.
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span class="relative shrink-0">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} class="sr-only"
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span
        aria-hidden="true"
        class="block rounded-full transition-colors"
        style={{ width: 44, height: 26, backgroundColor: checked ? "#0284c7" : "#d1d5db" }}
      >
        <span
          class="absolute rounded-full bg-white shadow transition-transform"
          style={{ top: 3, left: 3, width: 20, height: 20, transform: checked ? "translateX(18px)" : "none" }}
        />
      </span>
    </span>
  );
}

function ShareIcon() {
  return (
    <svg aria-label="Share" class="inline h-4 w-4 -mt-1" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
      <path d="M10 13V2.5M6.5 6 10 2.5 13.5 6M6 9H4.5v8.5h11V9H14" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
