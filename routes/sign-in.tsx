import { asset } from "$fresh/runtime.ts";
import { ReidleHead } from "@/components/reidle_template.tsx";
import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<string | undefined> = {
  async POST(req, ctx) {
    ctx.state.name =
      ((await req.formData()).get("name") as string | undefined)?.trim()
        .replace(/\s+/gi, "")
        .toLowerCase()
        .slice(0, 15) ?? "";

    const redirectUrl = new URL(req.url).searchParams.get("redirect");
    if (redirectUrl) {
      return new Response("go to redirect", {
        status: 303,
        headers: { location: redirectUrl },
      });
    }

    return new Response("redirect to home", {
      status: 303,
      headers: { location: "/" },
    });
  },
};

export default function Page() {
  return (
    <div class="min-h-screen w-full flex items-center justify-center p-4 bg-gray-50 select-none">
      <ReidleHead title="Sign In" />

      <div class="max-w-sm w-full bg-white border border-gray-200/80 rounded-3xl p-8 shadow-sm text-center">
        <div class="inline-flex p-3 rounded-2xl bg-emerald-50 mb-4 shadow-2xs">
          <img
            src={asset("/android-chrome-96x96.webp")}
            alt="Reidle Logo"
            class="w-12 h-12 rounded-xl"
          />
        </div>

        <h1 class="text-2xl font-black tracking-tight text-gray-900 leading-none">
          REIDLE
        </h1>
        <form method="POST" class="space-y-4 text-left">
          <div>
            <label
              for="name"
              class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
            >
              Choose your player name
            </label>
            <input
              id="name"
              type="text"
              name="name"
              placeholder="e.g. wordmaster"
              required
              autoFocus
              maxLength={15}
              enterkeyhint="go"
              autocapitalize="none"
              autocomplete="username"
              class="w-full px-4 py-3 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-semibold"
            />
          </div>

          <button
            type="submit"
            class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <span>Start Playing</span>
            <span>→</span>
          </button>
        </form>

        <p class="text-[11px] text-gray-400 mt-6 leading-relaxed">
          Forced starting words · Hard rules · Speed timer · Multiplayer
        </p>
      </div>
    </div>
  );
}
