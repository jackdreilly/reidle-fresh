import { PageProps } from "$fresh/server.ts";
import { asset } from "$fresh/runtime.ts";
import { Name } from "@/components/daily_table.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { runSql, Schemas } from "@/utils/sql_files.ts";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import moment from "npm:moment";
import MessageView from "@/islands/Message.tsx";

type Message = Schemas["message_reads"]["output"][number];
interface Data {
  messages: Message[];
  name?: string;
}

export const handler: SessionHandler<Data> = {
  async POST(req, ctx) {
    const name = ctx.state.name;
    const message = (await req.formData()).get("message") as string ?? "";
    if (message.trim()) {
      await ctx.state.connection.queryArray`
          INSERT INTO
          messages (
            name,
            message
            )
            VALUES (
              ${name},
              ${message}
              )`;
    }
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
  async GET(_, ctx) {
    const name = ctx.state.name;
    return ctx.state.render(ctx, {
      messages: await runSql({
        file: "message_reads",
        connection: ctx.state.connection,
        args: { name },
      }),
      name,
    });
  },
};

export default function Page(
  { data: { messages, name: myName, playedToday } }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <ReidleTemplate
      playedToday={playedToday}
      route="/messages"
      title="Messages"
    >
      <div class="mb-6">
        <div class="flex items-center gap-2">
          <span class="text-2xl">💬</span>
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
            Community Chat
          </h1>
        </div>
        <p class="text-xs sm:text-sm text-gray-500 mt-1">
          Chat with other players. Tip: type <code class="bg-gray-100 px-1 py-0.5 rounded text-emerald-800 font-mono text-xs">/gif &lt;keyword&gt;</code> to post a GIF!
        </p>
      </div>

      {/* Message Composer */}
      <form
        method="POST"
        class="mb-6 bg-white border border-gray-200/80 rounded-2xl p-3 shadow-xs focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition-all"
      >
        <textarea
          required
          rows={2}
          class="w-full text-sm text-gray-900 placeholder-gray-400 bg-transparent resize-none border-none outline-none focus:outline-none"
          placeholder="Share your thoughts or type /gif victory..."
          autocomplete="off"
          autoFocus
          name="message"
        />
        <div class="flex items-center justify-between pt-2 border-t border-gray-100">
          <span class="text-[11px] text-gray-400">
            Posting as <strong class="text-gray-700">{myName}</strong>
          </span>
          <button
            type="submit"
            class="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            style={{ backgroundColor: "#059669", color: "#ffffff" }}
          >
            Post message
          </button>
        </div>
      </form>

      {/* Messages List */}
      <div class="space-y-3">
        {messages.length === 0 ? (
          <div class="bg-gray-50 border border-gray-200/80 rounded-2xl p-8 text-center text-gray-400 text-sm italic">
            No messages yet. Say hello to everyone!
          </div>
        ) : (
          messages.map(({ message, message_id, name, created_at, likes }) => {
            const isMe = myName === name;
            const hasLiked = (likes ?? []).includes(myName ?? "");

            return (
              <div
                key={message_id}
                class="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-2xs transition-all hover:border-gray-300"
              >
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black uppercase">
                      {name.slice(0, 2)}
                    </span>
                    <div>
                      <Name name={name} />
                      <span class="text-[10px] text-gray-400 block -mt-0.5">
                        {moment(created_at).fromNow()}
                      </span>
                    </div>
                  </div>

                  {isMe && (
                    <form
                      method="POST"
                      action={`/messages/${message_id}/delete`}
                    >
                      <button
                        type="submit"
                        class="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                        title="Delete message"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          class="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    </form>
                  )}
                </div>

                {/* Message Body */}
                <div class="text-sm text-gray-800 leading-relaxed break-words pl-9">
                  <MessageView message={message} />
                </div>

                {/* Footer / Likes */}
                <div class="mt-3 pt-2 pl-9 border-t border-gray-50 flex items-center gap-3">
                  <form
                    method="POST"
                    action={`/messages/${message_id}/like`}
                  >
                    <button
                      type="submit"
                      class={[
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 border",
                        hasLiked
                          ? "border-emerald-200"
                          : "border-gray-200 hover:bg-gray-200",
                      ].join(" ")}
                      style={{
                        backgroundColor: hasLiked ? "#ecfdf5" : "#f3f4f6",
                        color: hasLiked ? "#047857" : "#4b5563",
                      }}
                      title="Like this message"
                      aria-label={`Like this message (${(likes ?? []).length} likes)`}
                    >
                      <img
                        src={asset("/android-chrome-96x96.webp")}
                        alt=""
                        aria-hidden="true"
                        class="w-4 h-4 rounded-sm"
                      />
                      <span>{(likes ?? []).length}</span>
                    </button>
                  </form>

                  {(likes?.length ?? 0) > 0 && (
                    <span class="text-[11px] text-gray-400 truncate max-w-[240px]">
                      {likes?.slice(0, 3).join(", ")}
                      {(likes?.length ?? 0) > 3 ? ` +${likes!.length - 3}` : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </ReidleTemplate>
  );
}
