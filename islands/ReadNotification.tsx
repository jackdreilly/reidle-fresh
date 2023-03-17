import { useEffect, useState } from "preact/hooks";

export default function ReadNotification() {
  const [unread, setUnread] = useState("");
  useEffect(() => {
    fetch("/api/unread_messages").then((x) => x.text()).then((x) =>
      setUnread(x)
    );
  }, []);
  return <div class="contents">{unread ? "🟢" : ""}</div>;
}
