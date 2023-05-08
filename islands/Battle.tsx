import Game from "@/islands/game.tsx";
import { BattleState } from "@/utils/sql_files.ts";
import { Database } from "@/utils/supabase.ts";
import { IS_BROWSER } from "https://deno.land/x/fresh@1.1.5/runtime.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";
import { useEffect, useMemo, useState } from "preact/hooks";

export default function Page(
  { battle_id, supabase_params, initial_state, name }: {
    battle_id: number;
    supabase_params: [string, string];
    initial_state: BattleState;
    name: string;
  },
) {
  const [state, setState] = useState<BattleState>(initial_state);
  const [users, setUsers] = useState<string[]>([name]);
  const supabase = useMemo(() =>
    createClient<Database>(
      ...supabase_params,
    ), []);
  useEffect(() => {
    const channel = supabase.channel(`battle:${battle_id}`, {
      config: {
        presence: {
          key: name,
        },
      },
    }).on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "battles",
        filter: `battle_id=eq.${battle_id}`,
      },
      ({ new: { state } }) => {
        setState(state);
      },
    );

    channel.on("presence", { event: "sync" }, () => {
      setUsers(Object.keys(channel.presenceState()));
    });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });
  }, []);
  return (
    <div class="h-full">
      {users.length < 2 || !state?.game?.answer || !IS_BROWSER
        ? (
          <div class="m-2 p-2">
            <div>
              Nobody else is in the battle! Share the link with friends to get
              started
            </div>
            <button
              class="m-2 p-2 font-bold hover:bg-gray-200 rounded border-2 border-black flex items-center justify-center"
              onClick={async () => {
                if (navigator.share) {
                  await navigator.share({
                    title: "Battle Me on Reidle!",
                    url: window.location.href,
                  });
                  return;
                }
                navigator.clipboard.writeText(window.location.href).then(() => {
                  alert(
                    "Copied battle link to clipboard, now share link with friends!",
                  );
                })
                  .catch((e) => {
                    console.error(e);
                    alert("something went wrong");
                  });
              }}
            >
              <svg
                class="h-6 w-6"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
              </svg>
              <span class="px-2">Share</span>
            </button>
            <div>
              <div class="m-2 p-2 rounded shadow inline-block">
                {window.location?.href}
              </div>
            </div>
          </div>
        )
        : (
          <Game
            word={state?.game?.answer}
            startingWord={state?.game?.starting_word}
            isPractice={false}
            battle={{ battle_id, state, supabase, users }}
            name={name}
          />
        )}
    </div>
  );
}
