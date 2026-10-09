export function timerTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(Math.round(1000 * (totalSeconds - 60 * minutes)) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const utcToday = () => isoDay(new Date());

const STEPS = [["second", 60], ["minute", 60], ["hour", 24], ["day", 30], ["month", 12], ["year", Infinity]] as const;
export function fromNow(iso: string): string {
  let v = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  let i = 0;
  while (v >= STEPS[i][1]) v = Math.floor(v / STEPS[i++][1]);
  if (i === 0) return "a few seconds ago";
  const unit = STEPS[i][0];
  return `${v === 1 ? (unit === "hour" ? "an" : "a") : v} ${unit}${v === 1 ? "" : "s"} ago`;
}
