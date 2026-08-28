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
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div class="fixed top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[100] max-w-[94vw] sm:max-w-md pointer-events-none transition-all duration-300">
      <div class="px-4 py-1.5 bg-gray-900/95 text-white rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs sm:text-sm border border-gray-700/80 animate-fade-in">
        <span class="text-sm">💬</span>
        <span class="font-bold text-yellow-300 truncate max-w-[110px]">
          {toast.name}:
        </span>
        <span class="truncate max-w-[200px] sm:max-w-[280px] text-gray-100 font-medium">
          {toast.text}
        </span>
      </div>
    </div>
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
        class="w-20 sm:w-28 focus:w-36 sm:focus:w-44 px-2 py-1 text-xs border-2 border-black rounded bg-white hover:bg-gray-50 focus:bg-white focus:outline-none transition-all"
      />
    </form>
  );
}
