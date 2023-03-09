import { useEffect, useState } from "preact/hooks";
import TimerText from "../components/timer_text.tsx";

export default function Timer(
  props: { "class": string | undefined },
) {
  const [startingTime, _] = useState(new Date());
  const [__, setTicks] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTicks((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const totalSeconds = Math.round(
    (new Date().getTime() - startingTime.getTime()) / 1000,
  );
  return <TimerText seconds={totalSeconds} class={props.class} />;
}
