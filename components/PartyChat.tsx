import { useEffect, useRef, useState } from "preact/hooks";

export type ChatMessage = {
  id: string;
  name: string;
  text: string;
  time: number;
};

const QUICK_REACTIONS = [
  "GG! 👏",
  "Nice! 🔥",
  "Close! 😅",
  "Hurry! ⏱️",
  "Oops 🙈",
  "Lucky! 🍀",
  "Rematch? ⚔️",
  "👀",
  "🤔",
  "❤️",
];

export function ChatToast(
  {
    toast,
    onOpenChat,
    onDismiss,
  }: {
    toast: ChatMessage | null;
    onOpenChat: () => void;
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
    <div
      class="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] sm:max-w-md cursor-pointer animate-fade-in"
      onClick={() => {
        onDismiss();
        onOpenChat();
      }}
    >
      <div class="px-3.5 py-1.5 bg-gray-900/90 text-white rounded-full shadow-lg backdrop-blur flex items-center gap-2 text-xs sm:text-sm border border-gray-700/50 hover:bg-gray-900 transition">
        <span class="text-base">💬</span>
        <span class="font-bold text-yellow-300 truncate max-w-[100px]">
          {toast.name}:
        </span>
        <span class="truncate max-w-[180px] sm:max-w-[240px] text-gray-100">
          {toast.text}
        </span>
        <span class="text-xs text-gray-400 pl-1">tap</span>
      </div>
    </div>
  );
}

export function ChatModal(
  {
    messages,
    onSendMessage,
    onClose,
    currentName,
  }: {
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    onClose: () => void;
  currentName?: string;
  },
) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e?: Event) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleQuickSend = (reaction: string) => {
    onSendMessage(reaction);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        class="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet */}
      <div class="relative bg-white w-full sm:max-w-md max-h-[85vh] sm:max-h-[75vh] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col z-10 border border-gray-200 overflow-hidden">
        {/* Header */}
        <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div class="flex items-center gap-2">
            <span class="text-lg">💬</span>
            <h3 class="font-bold text-gray-800 text-base">Party Chat</h3>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
              Live
            </span>
          </div>
          <button
            onClick={onClose}
            class="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 text-sm font-bold w-8 h-8 flex items-center justify-center transition"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>

        {/* Message Feed */}
        <div class="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[160px] max-h-[260px] sm:max-h-[300px] bg-gray-50/50">
          {messages.length === 0
            ? (
              <div class="h-full flex flex-col items-center justify-center text-center text-gray-400 py-8 px-4">
                <span class="text-2xl mb-1">👋</span>
                <p class="text-xs sm:text-sm font-medium">No messages yet</p>
                <p class="text-[11px] text-gray-400 mt-0.5">
                  Tap a reaction below or type a message!
                </p>
              </div>
            )
            : (
              messages.map((msg) => {
                const isMe = currentName && msg.name === currentName;
                const timeStr = new Date(msg.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={msg.id}
                    class={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div class="flex items-baseline gap-1.5 px-1 mb-0.5">
                      <span
                        class={`text-[11px] font-bold ${
                          isMe ? "text-blue-700" : "text-gray-700"
                        }`}
                      >
                        {msg.name}
                      </span>
                      <span class="text-[10px] text-gray-400">{timeStr}</span>
                    </div>
                    <div
                      class={`px-3 py-1.5 rounded-2xl max-w-[82%] text-xs sm:text-sm break-words shadow-sm ${
                        isMe
                          ? "bg-blue-600 text-white rounded-br-xs"
                          : "bg-white text-gray-900 border border-gray-200 rounded-bl-xs"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Reactions Bar */}
        <div class="px-3 py-2 border-t border-gray-100 bg-white">
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {QUICK_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                onClick={() => handleQuickSend(reaction)}
                class="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 active:scale-95 text-gray-700 rounded-full border border-gray-200 whitespace-nowrap font-medium text-xs transition select-none flex-shrink-0 cursor-pointer"
              >
                {reaction}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Message Input Form */}
        <form
          onSubmit={handleSend}
          class="p-2.5 border-t border-gray-200 bg-white flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onInput={(e) => setInputText((e.target as HTMLInputElement).value)}
            placeholder="Type a message..."
            maxLength={120}
            class="flex-1 px-3.5 py-2 border border-gray-300 rounded-full text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            class="px-3.5 py-2 bg-blue-600 disabled:bg-gray-300 text-white rounded-full font-bold text-xs sm:text-sm hover:bg-blue-700 active:scale-95 transition flex items-center justify-center cursor-pointer disabled:cursor-not-allowed shadow-sm"
            aria-label="Send message"
          >
            <svg
              class="w-4 h-4 transform rotate-90"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
