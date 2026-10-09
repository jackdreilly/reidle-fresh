import { describe, expect, it } from "vitest";
import { Scoring, Wordle, wordScorer, type ScoredWord } from "./wordle";

const wordle = new Wordle(["CRANE", "SLATE", "CRATE", "TRACE", "NOTES", "ABBEY", "BOBBY"], ["CRATE"], new Set(["CRANE", "SLATE", "CRATE", "TRACE", "NOTES", "ABBEY", "BOBBY"]));
const S = (w: string, ...scores: Scoring[]): ScoredWord => [...w].map((letter, i) => ({ letter, score: scores[i] }));
const { green: G, orange: O, gray: X } = Scoring;
const score = (currentWord: string, word: string, previousWords: ScoredWord[] = []) =>
  wordScorer({ wordle, word, currentWord, previousWords });

describe("wordScorer", () => {
  it("scores greens, oranges and grays", () => {
    expect(score("CRANE", "CRATE")).toEqual(S("CRANE", G, G, G, X, G));
    expect(score("TRACE", "CRATE")).toEqual(S("TRACE", O, G, G, O, G));
  });
  it("handles duplicate letters like wordle", () => {
    expect(score("BOBBY", "ABBEY")).toEqual(S("BOBBY", O, X, G, X, G));
  });
  it("a correct guess always wins, even before other rules", () => {
    expect(score("CRATE", "CRATE")).toEqual(S("CRATE", G, G, G, G, G));
  });
  it("rejects short, spaced and unknown words with the right penalties", () => {
    expect(score("CRA", "CRATE")).toEqual({ error: "Need 5 letters" });
    expect(score("CR TE", "CRATE")).toEqual({ error: "Includes space or -" });
    expect(score("ZZZZZ", "CRATE")).toEqual({ error: "Not a word", penalty: 5 });
  });
  it("hard mode: must keep greens and not reuse known-wrong positions", () => {
    const first = S("CRANE", G, G, G, X, G);
    expect(score("SLATE", "CRATE", [first])).toEqual({ error: "Removed green @ 1", penalty: 10 });
    const second = S("TRACE", O, G, G, O, G);
    expect(score("NOTES", "CRATE", [second])).toMatchObject({ penalty: 10 });
  });
});
