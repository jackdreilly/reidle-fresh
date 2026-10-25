import { patchSession } from "@/lib/session";
import { rpc } from "@/lib/supabase";
import { navigate } from "@/router";

/**
 * New players, after their first finished game: a card suggesting a daily reminder, linking to the notification
 * settings. Either answer hides it for good, on every device (dismiss_reminder_prompt flips players.reminder_prompt_seen).
 */
export default function ReminderPrompt() {
  const close = (outcome: "settings" | "dismissed") => {
    patchSession({ reminder_prompt: false });
    void rpc("dismiss_reminder_prompt", { p_outcome: outcome }).catch(() => {});
  };
  return (
    <div role="region" aria-label="Daily reminder" class="mx-auto mb-3 flex max-w-xl items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-gray-700">
      <span aria-hidden="true" class="text-lg leading-6">⏰</span>
      <div class="min-w-0 flex-1">
        <b class="text-gray-900">Want a nudge each day?</b> Reidle can remind you before the word resets, only on days you haven't played yet.{" "}
        <a href="/account#notifications" onClick={(e) => {
          e.preventDefault();
          close("settings");
          // the router drops #hashes: scroll to the Notifications card once Settings is up
          void navigate("/account").then(() => setTimeout(() => document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth" }), 50));
        }} class="font-medium text-sky-700 underline">Set up a reminder</a>
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => close("dismissed")} class="-m-1 shrink-0 rounded-lg p-1 text-lg leading-5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">×</button>
    </div>
  );
}
