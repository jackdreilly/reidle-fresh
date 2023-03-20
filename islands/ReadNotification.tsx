import { useEffect, useState } from "preact/hooks";

export default function ReadNotification() {
  const [unread, setUnread] = useState("");
  useEffect(() => {
    fetch("/api/unread_messages").then((x) => x.text()).then((x) =>
      setUnread(x)
    );
  }, []);
  return (
    <span class={"m-1 relative h-3 w-3 " + (unread ? "inline-flex" : "hidden")}>
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38bdf8] opacity-75">
      </span>
      <span class="relative inline-flex rounded-full h-3 w-3 bg-[#0ea5e9]">
      </span>
    </span>
  );
}
