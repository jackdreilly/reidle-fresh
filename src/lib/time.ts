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

/**
 * A league's game day (same rule as league_day() in SQL): the date in its timezone, counted from its reset
 * hour. Resets from noon on play the next date's word, so "resets at 9pm" plays tomorrow's word tonight.
 */
export function dayIn(tz: string, resetHour: number, at = new Date()): string {
  const shifted = new Date(at.getTime() + (resetHour >= 12 ? 24 - resetHour : -resetHour) * 3600_000);
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(shifted);
  } catch {
    return isoDay(shifted);
  }
}

/** The next daily reset (`resetAt`, default UTC midnight), optionally `hoursBefore` it, as a local clock time like "5:00 PM". */
export function resetClock(hoursBefore = 0, resetAt?: string): string {
  const d = resetAt ? new Date(resetAt) : new Date();
  if (resetAt) d.setTime(d.getTime() - hoursBefore * 3600_000);
  else d.setUTCHours(24 - hoursBefore, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "midnight", "6 AM", "9 PM" for a reset hour. */
export const hourLabel = (h: number) =>
  h === 0 ? "midnight" : h === 12 ? "noon" : `${h % 12} ${h < 12 ? "AM" : "PM"}`;
