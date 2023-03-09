import { timerTime } from "@/utils/utils.ts";

export default function TimerText(
  props: { seconds: number; "class"?: string },
) {
  return <span class={props.class}>{timerTime(props.seconds)}</span>;
}
