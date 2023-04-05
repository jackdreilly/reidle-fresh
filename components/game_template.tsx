import ReidleTemplate from "@/components/reidle_template.tsx";
import { ComponentChildren } from "preact";
export default function GameTemplate(
  { isPractice, children, title, playedToday }: {
    isPractice: boolean;
    children?: ComponentChildren;
    title: string;
    playedToday: boolean;
  },
) {
  title ??= isPractice ? "Practice" : "Play";
  return (
    <ReidleTemplate
      playedToday={playedToday}
      route={isPractice ? "/practice" : "/play"}
      fullPage
      title={title}
    >
      {children}
    </ReidleTemplate>
  );
}
