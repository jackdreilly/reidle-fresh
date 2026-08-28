import Game from "@/islands/game.tsx";
import { BattleState } from "@/utils/sql_files.ts";
import {
  ChatMessage,
  ChatModal,
  ChatToast,
} from "@/components/PartyChat.tsx";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { useEffect, useMemo, useState } from "preact/hooks";

export default function Page(
  { battle_id, supabase_params, initial_state, name, url }: {
    battle_id: number;
    supabase_params: [string, string];
    initial_state: BattleState;
    name: string;
    url?: string;
  },
) {
  const [state, setState] = useState<BattleState>(initial_state);
  const [users, setUsers] = useState<string[]>([name]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestToast, setLatestToast] = useState<ChatMessage | null>(null);
  const [showWaitingChat, setShowWaitingChat] = useState(false);

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
        broadcast: { self: true },
      },
    });
  }, [supabase, battle_id]);

  useEffect(() => {
    if (!channel) return;
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "battles",
        filter: `battle_id=eq.${battle_id}`,
      },
      ({ new: { state } }) => {
        if (state) setState(state);
      },
    ).on("broadcast", { event: "chat" }, ({ payload }) => {
      if (payload && payload.text) {
        const msg: ChatMessage = {
          id: payload.id || crypto.randomUUID(),
          name: payload.name || "Anonymous",
          text: payload.text,
          time: payload.time || Date.now(),
        };
        setMessages((prev) => [...prev.slice(-49), msg]);
        setLatestToast(msg);
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const presenceEntries = Object.values(channel.presenceState()).flat();
      const currentUsers = presenceEntries
        .map((p: any) => p.name)
        .filter(Boolean);
      setUsers(currentUsers.length ? currentUsers : [name]);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name, online_at: new Date().toISOString() });
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [channel, battle_id, name]);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("battles").update({
      updated_at: new Date().toISOString(),
      users,
    }).eq("battle_id", battle_id).then((_) => null);
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
    channel.send({
      type: "broadcast",
      event: "chat",
      payload: {
        id: crypto.randomUUID(),
        name: name || "Anonymous",
        text: text.trim(),
        time: Date.now(),
      },
    });
  };

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

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
                <button
                  type="button"
                  class="p-2 hover:bg-gray-200 rounded border-2 border-black flex items-center justify-center gap-2 cursor-pointer font-bold text-sm"
                  onClick={() => setShowWaitingChat(true)}
                >
                  <span class="text-base">💬</span>
                  <span>Party Chat {messages.length > 0 ? `(${messages.length})` : ""}</span>
                </button>
              </div>
            )}
            <ChatToast
              toast={latestToast}
              onOpenChat={() => setShowWaitingChat(true)}
              onDismiss={() => setLatestToast(null)}
            />
            {showWaitingChat && (
              <ChatModal
                messages={messages}
                onSendMessage={sendChatMessage}
                onClose={() => setShowWaitingChat(false)}
                currentName={name}
              />
            )}
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
              messages,
              sendMessage: sendChatMessage,
              latestToast,
              clearLatestToast: () => setLatestToast(null),
            }}
            name={name}
          />
        )}
    </div>
  );
}
