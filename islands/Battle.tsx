import Game from "@/islands/game.tsx";
import { BattleRoundHistory, BattleState } from "@/utils/sql_files.ts";
import {
  ChatMessage,
  PartyChatInput,
  PartyChatToast,
} from "@/components/PartyChat.tsx";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ScoredWord } from "@/utils/wordle.ts";

export default function Page(
  { battle_id, supabase_params, initial_state, name, url }: {
    battle_id: number;
    supabase_params: [string, string];
    initial_state: BattleState;
    name: string;
    url?: string;
  },
) {
  const normalizedInitial: BattleState = useMemo(() => {
    const s = initial_state ?? ({} as BattleState);
    return {
      ...s,
      round: s.round ?? 1,
      round_id: s.round_id ?? `${battle_id}-${s.round ?? 1}`,
      version: s.version ?? (s.history?.length ?? 0),
      leaderboard: s.leaderboard ?? {},
      battle_history: s.battle_history ?? [],
    };
  }, [initial_state, battle_id]);

  const [state, setState] = useState<BattleState>(normalizedInitial);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [users, setUsers] = useState<string[]>([name]);
  const [toastQueue, setToastQueue] = useState<ChatMessage[]>([]);
  const [penaltiesMap, setPenaltiesMap] = useState<Record<string, number>>({});
  const [hasEverJoined, setHasEverJoined] = useState(
    (normalizedInitial.history && normalizedInitial.history.length > 0) || false,
  );

  const supabase = useMemo(() => {
    try {
      const [rawHost, rawKey] = supabase_params ?? [];
      if (!rawHost || !rawKey) return null;
      const host = rawHost.startsWith("http://") || rawHost.startsWith("https://")
        ? rawHost
        : `https://${rawHost}`;
      return createClient(host, rawKey);
    } catch (e) {
      console.error("Failed to create Supabase client:", e);
      return null;
    }
  }, [supabase_params]);

  const channel = useMemo(() => {
    if (!supabase) return null;
    return supabase.channel(`battle:${battle_id}`, {
      config: {
        broadcast: { self: false },
      },
    });
  }, [supabase, battle_id]);

  const addToast = (msg: ChatMessage) => {
    setToastQueue((prev) => [...prev, msg]);
  };

  const handleApplyMove = (payload: {
    id: string;
    round_id: string;
    player: string;
    word: string;
    wordScore: ScoredWord;
    isWin: boolean;
  }) => {
    setState((curr) => {
      if (curr.round_id && payload.round_id && curr.round_id !== payload.round_id) {
        return curr;
      }
      const moveWord = payload.wordScore.map((s) => s.letter).join("");
      const alreadyExists = curr.history.some((w) =>
        w.map((x) => x.letter).join("") === moveWord
      );
      if (alreadyExists) return curr;

      const newHistory = [...curr.history, payload.wordScore];
      const newVersion = (curr.version ?? 0) + 1;
      const msg = payload.isWin ? `${payload.player} Won` : `${payload.player} Played`;

      let newLeaderboard = curr.leaderboard ?? {};
      let newBattleHistory = curr.battle_history ?? [];
      if (payload.isWin) {
        newLeaderboard = {
          ...newLeaderboard,
          [payload.player]: (newLeaderboard[payload.player] ?? 0) + 1,
        };
        newBattleHistory = [
          ...newBattleHistory,
          {
            round: curr.round ?? 1,
            word: curr.game.answer,
            winner: payload.player,
            guesses: newHistory.length,
            completed_at: new Date().toISOString(),
          },
        ];
      }

      const nextState: BattleState = {
        ...curr,
        history: newHistory,
        last_player: payload.player,
        message: msg,
        version: newVersion,
        leaderboard: newLeaderboard,
        battle_history: newBattleHistory,
      };

      supabase?.from("battles").update({
        state: nextState,
        updated_at: new Date().toISOString(),
      }).eq("battle_id", battle_id).then(() => null);

      return nextState;
    });

    addToast({
      id: payload.id || crypto.randomUUID(),
      name: payload.player,
      text: payload.isWin ? "Won the game!" : `played ${payload.word.toUpperCase()}`,
      type: payload.isWin ? "win" : "event",
    });
  };

  const broadcastMove = (wordScore: ScoredWord, wordStr: string, isWin: boolean) => {
    const moveId = crypto.randomUUID();
    const roundId = stateRef.current.round_id || `${battle_id}-${stateRef.current.round ?? 1}`;
    const payload = {
      id: moveId,
      round_id: roundId,
      player: name,
      word: wordStr,
      wordScore,
      isWin,
      timestamp: Date.now(),
    };

    channel?.send({
      type: "broadcast",
      event: "battle_move",
      payload,
    });

    handleApplyMove(payload);
  };

  const broadcastPenalty = (penaltySeconds: number) => {
    const endsAt = Date.now() + (penaltySeconds * 1000);
    setPenaltiesMap((prev) => ({
      ...prev,
      [name]: Math.max(prev[name] ?? 0, endsAt),
    }));

    channel?.send({
      type: "broadcast",
      event: "battle_penalty",
      payload: {
        id: crypto.randomUUID(),
        player: name,
        penaltySeconds,
        endsAt,
      },
    });

    channel?.track({
      name,
      online_at: new Date().toISOString(),
      penalty_ends_at: endsAt,
    });
  };

  const broadcastRestart = (newState: BattleState) => {
    channel?.send({
      type: "broadcast",
      event: "battle_restart",
      payload: newState,
    });
    setState(newState);
    setPenaltiesMap({});
    addToast({
      id: crypto.randomUUID(),
      name: "Battle",
      text: `Round ${newState.round ?? 1} started!`,
      type: "event",
    });
  };

  useEffect(() => {
    if (users.length >= 2 || (state.history && state.history.length > 0)) {
      setHasEverJoined(true);
    }
  }, [users.length, state.history?.length]);

  useEffect(() => {
    if (!channel) return;

    channel
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "battles",
          filter: `battle_id=eq.${battle_id}`,
        },
        ({ new: newRow }: any) => {
          if (!newRow?.state) return;
          const incoming = typeof newRow.state === "string"
            ? JSON.parse(newRow.state)
            : newRow.state;
          if (!incoming) return;

          setState((curr) => {
            const incomingRound = incoming.round ?? 1;
            const currRound = curr.round ?? 1;
            if (
              incomingRound > currRound ||
              (incoming.round_id && incoming.round_id !== curr.round_id &&
                incoming.game?.answer !== curr.game?.answer)
            ) {
              setPenaltiesMap({});
              return {
                ...incoming,
                round: incomingRound,
                round_id: incoming.round_id || `${battle_id}-${incomingRound}`,
                version: incoming.version ?? 0,
                leaderboard: incoming.leaderboard ?? curr.leaderboard ?? {},
                battle_history: incoming.battle_history ?? curr.battle_history ?? [],
              };
            }

            const currCount = curr.history?.length ?? 0;
            const incomingCount = incoming.history?.length ?? 0;
            if (incomingCount < currCount) {
              return curr;
            }

            const currWords = new Set(
              curr.history.map((w: any) => w.map((x: any) => x.letter).join("")),
            );
            const merged = [...curr.history];
            for (const w of (incoming.history ?? [])) {
              const wordStr = w.map((x: any) => x.letter).join("");
              if (!currWords.has(wordStr)) {
                merged.push(w);
                currWords.add(wordStr);
              }
            }

            return {
              ...curr,
              ...incoming,
              history: merged,
              version: Math.max(curr.version ?? 0, incoming.version ?? 0),
              leaderboard: incoming.leaderboard ?? curr.leaderboard ?? {},
              battle_history: incoming.battle_history ?? curr.battle_history ?? [],
            };
          });
        },
      )
      .on("broadcast", { event: "battle_move" }, ({ payload }) => {
        if (payload) {
          handleApplyMove(payload);
        }
      })
      .on("broadcast", { event: "battle_penalty" }, ({ payload }) => {
        if (payload) {
          setPenaltiesMap((prev) => ({
            ...prev,
            [payload.player]: Math.max(prev[payload.player] ?? 0, payload.endsAt),
          }));
          addToast({
            id: payload.id || crypto.randomUUID(),
            name: payload.player,
            text: `entered penalty box (${payload.penaltySeconds}s)!`,
            type: "penalty",
          });
        }
      })
      .on("broadcast", { event: "battle_restart" }, ({ payload }) => {
        if (payload) {
          setState(payload);
          setPenaltiesMap({});
          addToast({
            id: crypto.randomUUID(),
            name: "Battle",
            text: `Round ${payload.round ?? 1} started!`,
            type: "event",
          });
        }
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        if (payload && payload.text) {
          addToast({
            id: payload.id || crypto.randomUUID(),
            name: payload.name || "Anonymous",
            text: payload.text,
            type: "chat",
          });
        }
      });

    channel.on("presence", { event: "sync" }, () => {
      const presenceEntries = Object.values(channel.presenceState()).flat();
      const currentUsers = [
        ...new Set(
          presenceEntries.map((p: any) => p.name).filter(Boolean) as string[],
        ),
      ];
      setUsers(currentUsers.length ? currentUsers : [name]);

      const penaltyUpdates: Record<string, number> = {};
      for (const entry of presenceEntries as any[]) {
        if (entry.name && entry.penalty_ends_at && entry.penalty_ends_at > Date.now()) {
          penaltyUpdates[entry.name] = entry.penalty_ends_at;
        }
      }
      if (Object.keys(penaltyUpdates).length > 0) {
        setPenaltiesMap((prev) => ({ ...prev, ...penaltyUpdates }));
      }

      // Reset leaderboard and battle history when no players remain
      if (currentUsers.length === 0) {
        setState((curr) => ({
          ...curr,
          leaderboard: {},
          battle_history: [],
        }));
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name, online_at: new Date().toISOString() });
      }
    });

    const handleBeforeUnload = () => {
      if (users.length <= 1) {
        supabase?.from("battles").update({
          users: [],
          updated_at: new Date(0).toISOString(),
          state: {
            ...stateRef.current,
            leaderboard: {},
            battle_history: [],
          },
        }).eq("battle_id", battle_id).then(() => null);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      channel.unsubscribe();
    };
  }, [channel, battle_id, name]);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("battles").update({
      updated_at: new Date().toISOString(),
      users,
    }).eq("battle_id", battle_id).then(() => null);

    const interval = setInterval(async () => {
      await supabase.from("battles").update({
        updated_at: new Date().toISOString(),
        users,
      }).eq("battle_id", battle_id);
    }, 10000);
    return () => clearInterval(interval);
  }, [supabase, users, battle_id]);

  const sendChatMessage = (text: string) => {
    if (!channel || !text.trim()) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      name: name || "Anonymous",
      text: text.trim(),
      type: "chat",
    };
    channel.send({
      type: "broadcast",
      event: "chat",
      payload: msg,
    });
    addToast(msg);
  };

  const currentToast = toastQueue[0] ?? null;
  const dismissCurrentToast = () => {
    setToastQueue((prev) => prev.slice(1));
  };

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  return (
    <div class="h-full">
      {(!hasEverJoined && users.length < 2 && (!state?.history || state.history.length === 0)) ||
          !state?.game?.answer || !IS_BROWSER
        ? (
          <div class="m-2 p-2">
            <div>
              Nobody else is in the battle! Share the link with friends to get
              started
            </div>
            <button
              class="m-2 p-2 font-bold hover:bg-gray-200 rounded border-2 border-black flex items-center justify-center"
              onClick={async () => {
                const targetUrl = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
                if (typeof navigator !== "undefined" && navigator.share) {
                  await navigator.share({
                    title: "Battle Me on Reidle!",
                    url: targetUrl,
                  });
                  return;
                }
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(targetUrl).then(() => {
                    alert(
                      "Copied battle link to clipboard, now share link with friends!",
                    );
                  })
                    .catch((e) => {
                      console.error(e);
                      alert("something went wrong");
                    });
                }
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
                {shareUrl}
              </div>
            </div>
            {channel && (
              <div class="mt-4 flex flex-col items-center">
                <PartyChatInput onSendMessage={sendChatMessage} />
              </div>
            )}
            <PartyChatToast
              toast={currentToast}
              onDismiss={dismissCurrentToast}
            />
          </div>
        )
        : (
          <Game
            word={state?.game?.answer}
            startingWord={state?.game?.starting_word}
            isPractice={false}
            battle={{
              battle_id,
              state,
              supabase,
              users,
              sendMessage: sendChatMessage,
              broadcastMove,
              broadcastPenalty,
              broadcastRestart,
              penaltiesMap,
              currentToast,
              dismissToast: dismissCurrentToast,
            }}
            name={name}
          />
        )}
    </div>
  );
}
