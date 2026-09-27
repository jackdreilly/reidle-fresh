import { useEffect, useRef, useState } from "preact/hooks";

export type ChatMessage = {
  id: string;
  name: string;
  text: string;
  type?: "chat" | "event" | "win" | "penalty";
};

export function PartyChatToast(
  {
    toast,
    onDismiss,
  }: {
    toast: ChatMessage | null;
    onDismiss?: () => void;
  },
) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!toast) return;
    const duration = toast.type === "win" ? 4500 : 3000;
    const timer = setTimeout(() => {
      onDismissRef.current?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast?.id, toast?.type]);

  if (!toast) return null;

  const type = toast.type ?? "chat";
  const icon = type === "win" ? "🏆" : type === "penalty" ? "🛑" : type === "event" ? "🎯" : "💬";
  const borderColor = type === "win"
    ? "border-amber-400 bg-black/90 shadow-[0_10px_25px_-3px_rgba(245,158,11,0.4)]"
    : type === "penalty"
    ? "border-red-500 bg-black/90 shadow-[0_10px_25px_-3px_rgba(239,68,68,0.4)]"
    : type === "event"
    ? "border-cyan-400 bg-black/90 shadow-[0_10px_25px_-3px_rgba(6,182,212,0.3)]"
    : "border-[#3f3f46] bg-[#18181b] shadow-[0_10px_25px_-3px_rgba(0,0,0,0.6)]";

  const nameColor = type === "win"
    ? "text-amber-400"
    : type === "penalty"
    ? "text-red-400"
    : type === "event"
    ? "text-cyan-300"
    : "text-amber-300";

  return (
    <>
      <style>
        {`
          @keyframes chat-toast-in-out {
            0% {
              opacity: 0;
              transform: translate(-50%, -10px) scale(0.92);
            }
            12% {
              opacity: 1;
              transform: translate(-50%, 0) scale(1);
            }
            85% {
              opacity: 1;
              transform: translate(-50%, 0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(-50%, -8px) scale(0.96);
            }
          }
          .animate-chat-toast {
            animation: chat-toast-in-out 3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .animate-chat-toast-win {
            animation: chat-toast-in-out 4.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}
      </style>
      <div
        key={toast.id}
        class={`fixed top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[100] max-w-[94vw] sm:max-w-md pointer-events-none ${
          type === "win" ? "animate-chat-toast-win" : "animate-chat-toast"
        }`}
      >
        <div
          class={`px-3.5 py-1.5 text-white rounded-full flex items-center gap-2 text-xs sm:text-sm border ${borderColor}`}
        >
          <span class="text-sm select-none">{icon}</span>
          <span class={`font-bold ${nameColor} truncate max-w-[100px] sm:max-w-[130px] drop-shadow-sm`}>
            {toast.name}:
          </span>
          <span class="truncate max-w-[220px] sm:max-w-[320px] text-white font-medium drop-shadow-sm">
            {toast.text}
          </span>
        </div>
      </div>
    </>
  );
}

export function PartyChatInput(
  {
    onSendMessage,
  }: {
    onSendMessage?: (text: string) => void;
  },
) {
  const [text, setText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const lastSentRef = useRef<string>("");

  const submitText = (rawText: string): boolean => {
    const trimmed = rawText.trim();
    if (!trimmed || lastSentRef.current === trimmed) return false;
    lastSentRef.current = trimmed;
    setTimeout(() => {
      lastSentRef.current = "";
    }, 400);

    onSendMessage?.(trimmed);
    setText("");
    setIsOpen(false);
    return true;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.querySelector("input");
    submitText(input?.value ?? text);
    input?.blur();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.isComposing) {
      // iOS keyboards do not always dispatch an implicit form submission.
      // Handle Return directly as well as the form's submit event.
      e.preventDefault();
      const input = e.currentTarget as HTMLInputElement;
      submitText(input.value);
      input.blur();
    }
  };

  return (
    <div class="relative shrink-0">
      <button
        type="button"
        class="rounded-lg border border-gray-200 bg-gray-100 p-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label="Open battle chat"
      >
        <span aria-hidden="true">💬</span>
        <span class="hidden sm:inline ml-1">Chat</span>
      </button>
      {isOpen && (
        <form
          onSubmit={handleSubmit}
          class="fixed z-[90] flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
          style={{
            top: "calc(env(safe-area-inset-top) + 2.75rem)",
            left: "0.5rem",
            right: "0.5rem",
          }}
        >
          <input
            type="text"
            value={text}
            onInput={(e) => {
              lastSentRef.current = "";
              setText((e.target as HTMLInputElement).value);
            }}
            onKeyDown={handleKeyDown}
            enterkeyhint="send"
            placeholder="Write a message..."
            maxLength={80}
            autoFocus
            class="min-w-0 flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
          />
          <button
            type="submit"
            class="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 active:bg-emerald-900"
          >
            Send
          </button>
          <button
            type="button"
            class="shrink-0 p-2 text-gray-500 hover:text-gray-900"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat composer"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );
}
