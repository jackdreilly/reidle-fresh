import { afterEach, describe, expect, it, vi } from "vitest";
import { fromNow, timerTime } from "./time";

describe("timerTime", () => {
  it("formats m:ss", () => {
    expect(timerTime(0)).toBe("0:00");
    expect(timerTime(65.4)).toBe("1:05");
    expect(timerTime(600)).toBe("10:00");
  });
});

describe("fromNow", () => {
  afterEach(() => vi.useRealTimers());
  it("humanises offsets", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-01-10T12:00:00Z"));
    expect(fromNow("2026-01-10T11:59:50Z")).toBe("a few seconds ago");
    expect(fromNow("2026-01-10T11:59:00Z")).toBe("a minute ago");
    expect(fromNow("2026-01-10T10:00:00Z")).toBe("2 hours ago");
    expect(fromNow("2026-01-10T11:00:00Z")).toBe("an hour ago");
    expect(fromNow("2026-01-08T12:00:00Z")).toBe("2 days ago");
  });
});
