import type { PageProps } from "@/router";
import PlaybackView from "@/components/PlaybackView";
import type { PlaybackEvent } from "@/lib/playback";

export default function PlaybackPage({ data: { events } }: PageProps<{ events: PlaybackEvent[] }>) {
  return events.length ? <PlaybackView events={events} /> : <>You need to play today to see this</>;
}
