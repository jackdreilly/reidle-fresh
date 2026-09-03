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
  const lastSentRef = useRef<string>("");

  const submitText = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;
    if (lastSentRef.current === trimmed) return;
    lastSentRef.current = trimmed;
    setTimeout(() => {
      lastSentRef.current = "";
    }, 400);

    onSendMessage?.(trimmed);
    setText("");
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    submitText(text);
    // Blur to restore focus immediately to game board
    if (e.target instanceof HTMLFormElement) {
      const input = e.target.querySelector("input");
      input?.blur();
    }
  };

  const handleBlur = (e: FocusEvent) => {
    const currentVal = (e.target as HTMLInputElement)?.value || text;
    submitText(currentVal);
  };

  return (
    <form onSubmit={handleSubmit} action="javascript:void(0);" class="flex items-center">
      <input
        type="text"
        value={text}
        onInput={(e) => {
          lastSentRef.current = "";
          setText((e.target as HTMLInputElement).value);
        }}
        onBlur={handleBlur}
        enterkeyhint="send"
        placeholder="💬 Chat..."
        maxLength={80}
        class="w-20 sm:w-28 focus:w-36 sm:focus:w-44 px-2 py-1 text-xs border-2 border-black rounded bg-white hover:bg-gray-50 focus:bg-white focus:outline-none transition-all shadow-sm"
      />
    </form>
  );
}
