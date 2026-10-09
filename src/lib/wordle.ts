import wordsUrl from "@/data/words.csv?url";
import answersUrl from "@/data/answers.csv?url";

export class Wordle {
  words: string[];
  answers: string[];
  wordsSet: Set<string>;
  constructor(words: string[], answers: string[], wordsSet: Set<string>) {
    this.words = words;
    this.answers = answers;
    this.wordsSet = wordsSet;
  }
  static async make() {
    const [words, answers] = await Promise.all(
      [wordsUrl, answersUrl].map(async (u) =>
        (await (await fetch(u)).text()).toUpperCase().split(/\s+/).filter(Boolean)
      ),
    );
    return new Wordle(words, answers, new Set(words));
  }
  isWord(word: string): boolean {
    return this.wordsSet.has(word);
  }
  error(guesses: ScoringHistory): string | null {
    if (!guesses) {
      return null;
    }
    const active = guesses[guesses.length - 1];
    const activeCounts: Record<string, number> = {};
    for (const { letter: l } of active) {
      activeCounts[l] = (activeCounts[l] ?? 0) + 1;
    }
    for (let i = 0; i < guesses.length - 1; i++) {
      const previousGuess = guesses[i];
      const presentCounts: Record<string, number> = {};
      const grays: Record<string, number> = {};
      for (const position of [0, 1, 2, 3, 4]) {
        const current = active[position];
        const prior = previousGuess[position];
        if (prior.score === Scoring.green && current.score !== Scoring.green) {
          return `Removed green @ ${position + 1}`;
        }
        if (prior.letter === current.letter && prior.score !== Scoring.green) {
          return `Wrong ${current.letter} @ ${position + 1}`;
        }
        if (prior.score === Scoring.gray) {
          grays[prior.letter] = 1;
        } else {
          presentCounts[prior.letter] = (presentCounts[prior.letter] ?? 0) + 1;
        }
      }
      for (
        const letter of new Set(
          [
            ...Object.keys(activeCounts),
            ...Object.keys(presentCounts),
            ...Object.keys(grays),
          ],
        )
      ) {
        const active = activeCounts[letter] ?? 0;
        const present = presentCounts[letter] ?? 0;
        const gray = grays[letter] ?? 0;
        if (gray && active !== present) {
          return `exactly ${present} ${letter}'s`;
        }
        if (active < present) {
          return `At least ${present} ${letter}'s`;
        }
      }
    }
    return null;
  }
}

export interface ScoredLetter {
  letter: string;
  score: Scoring;
}
export enum Scoring {
  green,
  orange,
  gray,
}
export type ScoredWord = ScoredLetter[];
export type ScoringHistory = ScoredWord[];

let cached: Promise<Wordle> | undefined;
/** Word lists are static, hashed assets: fetched once, cached forever by the SW/CDN. */
export const loadWordle = () => (cached ??= Wordle.make());

/** Scores a guess against the answer, or returns the rule violation (with its time penalty). */
export function wordScorer(
  { wordle, word, currentWord, previousWords }: {
    wordle: Wordle;
    word: string;
    currentWord: string;
    previousWords: ScoringHistory;
  },
): { error: string; penalty?: number } | ScoredWord {
  if (currentWord === word) {
    return word.split("").map((letter) => ({ letter, score: Scoring.green }));
  }
  if (currentWord.length < 5) {
    return { error: "Need 5 letters" };
  }
  if (currentWord.includes(" ") || currentWord.includes("-")) {
    return { error: "Includes space or -" };
  }
  if (!wordle?.isWord(currentWord)) {
    return { error: "Not a word", penalty: 5 };
  }
  const scoring = [
    Scoring.gray,
    Scoring.gray,
    Scoring.gray,
    Scoring.gray,
    Scoring.gray,
  ];
  word?.split("").forEach((letter, position) => {
    if (currentWord[position] === letter) {
      scoring[position] = Scoring.green;
      return;
    }
  });
  currentWord.split("").forEach((letter, position) => {
    if (scoring[position] === Scoring.green) {
      return;
    }
    const offPositions = word?.split("").filter((_, pos) =>
      scoring[pos] !== Scoring.green
    ).filter((l) => l === letter).length ?? 0;
    const usedPositions = currentWord.split("").filter((l, pos) =>
      l === letter && scoring[pos] === Scoring.orange
    ).length;
    if (usedPositions < offPositions) {
      scoring[position] = Scoring.orange;
    }
  });
  const guesses = [
    ...previousWords,
    currentWord.split("").map((l, p) => ({
      letter: l,
      score: scoring[p],
    })),
  ];
  const error = wordle?.error(guesses);
  if (error) {
    return { error, penalty: 10 };
  }
  return guesses[guesses.length - 1];
}
