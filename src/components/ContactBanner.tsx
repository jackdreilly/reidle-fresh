import { useState } from "preact/hooks";

const KEY = "reidle:reply-banner";

/**
 * Jack answered on /contact: one banner per reply, on every page until it's read or dismissed. Reading it clears
 * bootstrap's contact_unread (and the menu dot) everywhere; dismissing only hides this banner on this device.
 */
export default function ContactBanner({ at }: { at: string }) {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === at; } catch { return false; } });
  if (hidden) return null;
  const dismiss = () => {
    try { localStorage.setItem(KEY, at); } catch { /* storage unavailable: hidden until reload */ }
    setHidden(true);
  };
  return (
    <div role="region" aria-label="Reply from Jack" class="mx-auto mb-3 flex max-w-xl items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-gray-700">
      <span aria-hidden="true" class="text-lg leading-6">✉️</span>
      <div class="min-w-0 flex-1">
        <b class="text-gray-900">Jack replied to your message.</b>{" "}
        <a href="/contact" class="font-medium text-sky-700 underline">Read it</a>
      </div>
      <button type="button" aria-label="Dismiss" onClick={dismiss} class="-m-1 shrink-0 rounded-lg p-1 text-lg leading-5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">×</button>
    </div>
  );
}
