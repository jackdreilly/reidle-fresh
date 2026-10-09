import { useState } from "preact/hooks";
import type { PageProps } from "@/router";
import { navigate } from "@/router";
import Game from "@/components/Game";
import TimerText from "@/components/TimerText";
import { rpc } from "@/lib/supabase";
import type { Checkpoint } from "@/lib/types";

type Data = {
  started: boolean;
  winner?: string | null;
  winnersTime?: number | null;
  word?: string;
  startingWord?: string;
  checkpoint?: Checkpoint;
  server_now?: string;
};

/** Server-minus-client clock offset (ms), so timers never depend on the device clock being right. */
const offsetOf = (d: Data) => (d.server_now ? Date.parse(d.server_now) - Date.now() : 0);

export default function Play({ data }: PageProps<Data>) {
  const [game, setGame] = useState<{ data: Data; offset: number } | null>(
    data.started ? { data, offset: offsetOf(data) } : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The ONLY thing that starts the daily clock: an explicit tap -> POST rpc/start_play.
  async function start() {
    setBusy(true);
    setError("");
    try {
      const d = await rpc<Data>("start_play");
      setGame({ data: d, offset: offsetOf(d) });
    } catch (e) {
      if (/already played/i.test((e as Error).message)) return void navigate("/", { replace: true });
      setError("Couldn't start. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (!game) {
    return (
      <div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 class="text-2xl font-bold">Today's Reidle</h1>
        {data.winner && data.winnersTime
          ? <div>Time to beat: <b>{data.winner}</b> <TimerText seconds={data.winnersTime} /></div>
          : null}
        <button
          type="button"
          disabled={busy}
          onClick={start}
          class="rounded-lg bg-linear-to-r from-pink-400 via-pink-500 to-pink-600 px-10 py-3 text-xl font-bold text-white shadow hover:opacity-90 disabled:opacity-50"
        >
          Start
        </button>
        <p class="text-sm text-gray-500">The clock starts when you press Start.</p>
        {error && <p class="text-red-600">{error}</p>}
      </div>
    );
  }
  const d = game.data;
  return (
    <Game
      isPractice={false}
      word={d.word!}
      startingWord={d.startingWord!}
      winner={d.winner ?? undefined}
      winnersTime={d.winnersTime}
      checkpoint={d.checkpoint}
      clockOffset={game.offset}
    />
  );
}
