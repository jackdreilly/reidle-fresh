import { useEffect, useRef, useState } from "preact/hooks";
import type { PageProps } from "@/router";
import Button from "@/components/Button";
import { Name } from "@/components/DailyTable";
import MessageText from "@/components/MessageText";
import { rpc } from "@/lib/supabase";
import { patchSession, useSession } from "@/lib/session";
import { fromNow } from "@/lib/time";

type Msg = { message_id: number; name: string; message: string; created_at: string; likes: string[] };

export default function Messages({ data }: PageProps<Msg[]>) {
  const { name: myName } = useSession();
  const [messages, setMessages] = useState(data);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => patchSession({ unread: false }), []);
  const reload = async () => setMessages(await rpc<Msg[]>("messages_page"));
  async function act(fn: string, id: number) {
    await rpc(fn, { p_id: id });
    await reload();
  }
  async function post(e: Event) {
    e.preventDefault();
    const text = box.current!.value.trim();
    if (!text) return;
    box.current!.value = "";
    await rpc("post_message", { p_message: text });
    await reload();
  }
  return (
    <>
      <form class="flex" onSubmit={post}>
        <textarea
          required
          rows={2}
          class="flex-grow-1 break-word mr-2.5 p-2.5 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Your message..."
          autocomplete="off"
          autoFocus
          name="message"
          ref={box}
        />
        <Button>Send</Button>
      </form>
      <ul>
        {messages.map(({ message, message_id, name, created_at, likes }) => (
          <li class="border-b-1 p-2 whitespace-break-spaces">
            <span class="font-bold">
              <Name name={name} />
            </span>: <MessageText message={message} />
            <div class="text-xs italic flex p-2">
              {myName === name
                ? (
                  <form
                    style={{ display: "inline" }}
                    class="pr-1"
                    onSubmit={(e) => { e.preventDefault(); void act("delete_message", message_id); }}
                  >
                    <button
                      class="cursor-pointer"
                      type="submit"
                      style={{ fontSize: 8, marginLeft: 5 }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-6 h-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </form>
                )
                : null}
              {fromNow(created_at)}
              <form
                style={{ display: "inline" }}
                onSubmit={(e) => { e.preventDefault(); void act("like_message", message_id); }}
              >
                <button
                  class="cursor-pointer"
                  type="submit"
                  style={{ fontSize: 8, marginLeft: 5 }}
                >
                  <img
                    height="34px"
                    width="34px"
                    src="/android-chrome-96x96.webp"
                    class="pr-2"
                    alt="Reidle Logo"
                  />
                </button>
              </form>
              {(likes?.length ?? 0) > 0
                ? (
                  <span class="pr-2">
                    {likes.map((x) => x.substring(0, 9)).join(", ")}
                  </span>
                )
                : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
