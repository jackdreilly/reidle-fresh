import { useSession } from "@/lib/session";
import { useInstall } from "@/lib/pwa";

export default function Account() {
  const install = useInstall();
  return (
    <div class="space-y-6">
      <h1 class="text-2xl uppercase">{useSession().name}</h1>
      {install && (
        <section id="install" class="max-w-md rounded-lg border p-4">
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
    </div>
  );
}

function ShareIcon() {
  return (
    <svg aria-label="Share" class="inline h-4 w-4 -mt-1" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
      <path d="M10 13V2.5M6.5 6 10 2.5 13.5 6M6 9H4.5v8.5h11V9H14" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
