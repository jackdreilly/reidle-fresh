import { timerTime } from "@/utils/utils.ts";

export default function TimerText(
  props: { seconds: number; "class"?: string },
) {
  return (
    <span
      class={[
        "inline-block min-w-[3.25rem] whitespace-nowrap text-right tabular-nums",
        props.class ?? "",
      ].join(" ")}
    >
      {timerTime(props.seconds)}
    </span>
  );
}
