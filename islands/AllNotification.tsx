import { useEffect, useState } from "preact/hooks";

export default function AllNotification() {
  return (
    <Notifier
      isTrue={async () =>
        (await Promise.all(
          ["/api/unread_messages", "/api/challenges_remaining"].map(
            (x) => fetch(x).then((x) => x.text()).then((x) => x.length > 0),
          ),
        )).filter((x) => x).length > 0}
    />
  );
}
export function MessagesNotification() {
  return (
    <Notifier
      isTrue={() =>
        fetch("/api/unread_messages").then((x) => x.text()).then((x) =>
          x.length > 0
        )}
    />
  );
}
export function ChallengesNotification() {
  return (
    <Notifier
      isTrue={() =>
        fetch("/api/challenges_remaining").then((x) => x.text()).then((x) =>
          x.length > 0
        )}
    />
  );
}
function Notifier({ isTrue }: { isTrue(): Promise<boolean> }) {
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    isTrue().then(x => setUnread(!!x));
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
