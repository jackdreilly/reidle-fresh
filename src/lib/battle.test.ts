import { describe, expect, it } from "vitest";
import { longer, mergeLeaderboards } from "./battle";

describe("mergeLeaderboards", () => {
  it("never lowers a win count when a stale or empty copy arrives", () => {
    expect(mergeLeaderboards({ cbo: 9, jack: 1 }, {})).toEqual({ cbo: 9, jack: 1 });
    expect(mergeLeaderboards({ cbo: 9, jack: 1 }, { cbo: 8, olga: 2 })).toEqual({ cbo: 9, jack: 1, olga: 2 });
    expect(mergeLeaderboards(undefined, { jack: 3 })).toEqual({ jack: 3 });
  });
});

describe("longer", () => {
  it("keeps the longer round history", () => {
    expect(longer([1, 2], [])).toEqual([1, 2]);
    expect(longer([1], [1, 2])).toEqual([1, 2]);
    expect(longer(undefined, undefined)).toEqual([]);
  });
});
