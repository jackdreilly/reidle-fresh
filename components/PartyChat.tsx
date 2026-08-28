import { useEffect, useState } from "preact/hooks";

export type ChatMessage = {
  id: string;
  name: string;
  text: string;
};

export function PartyChatToast(
  {
    toast,
    onDismiss,
  }: {
    toast: ChatMessage | null;
    onDismiss: () => void;
  },
) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

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
            animation: chat-toast-in-out 3.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}
      </style>
      <div
        key={toast.id}
        class="fixed top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[100] max-w-[94vw] sm:max-w-md pointer-events-none animate-chat-toast"
      >
        <div class="px-3.5 py-1.5 bg-[#18181b] text-white rounded-full flex items-center gap-2 text-xs sm:text-sm border border-[#3f3f46] shadow-[0_10px_25px_-3px_rgba(0,0,0,0.6),0_4px_6px_-4px_rgba(0,0,0,0.4)]">
          <span class="text-sm select-none">💬</span>
          <span class="font-bold text-amber-300 truncate max-w-[100px] sm:max-w-[130px] drop-shadow-sm">
            {toast.name}:
          </span>
          <span class="truncate max-w-[200px] sm:max-w-[300px] text-white font-medium drop-shadow-sm">
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
    onSendMessage: (text: string) => void;
  },
) {
  const [text, setText] = useState("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText("");
    // Blur to restore focus immediately to game board
    if (e.target instanceof HTMLFormElement) {
      const input = e.target.querySelector("input");
      input?.blur();
    }
  };

  return (
    <form onSubmit={handleSubmit} class="flex items-center">
      <input
        type="text"
        value={text}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
        placeholder="💬 Chat..."
        maxLength={80}
        class="w-20 sm:w-28 focus:w-36 sm:focus:w-44 px-2 py-1 text-xs border-2 border-black rounded bg-white hover:bg-gray-50 focus:bg-white focus:outline-none transition-all shadow-sm"
      />
    </form>
  );
}
