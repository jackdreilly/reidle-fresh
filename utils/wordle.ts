import { readAsset } from "@/utils/utils.ts";

function todaysHash() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  return 321 * (year * 543 + month * 123) + day * 711;
}

export class Wordle {
  todaysAnswer(): string {
    return this.answers[todaysHash() % this.answers.length];
  }
  todaysWord(): string {
    return this.words[todaysHash() % this.answers.length];
  }
  randomAnswer(): string {
    return this.answers[Math.floor(Math.random() * this.answers.length)];
  }
  randomWord(): string {
    return this.words[Math.floor(Math.random() * this.words.length)];
  }
  words: string[];
  answers: string[];
  wordsSet: Set<string>;
  constructor(words: string[], answers: string[], wordsSet: Set<string>) {
    this.words = words;
    this.answers = answers;
    this.wordsSet = wordsSet;
  }
  static async make(server: boolean) {
    const [words, answers] = await Promise.all(
      ["words", "answers"].map(async (w) =>
        (await readAsset(w + ".csv", server)).toUpperCase().split("\n")
      ),
    );
    const wordsSet = new Set(words);
    return new Wordle(words, answers, wordsSet);
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
