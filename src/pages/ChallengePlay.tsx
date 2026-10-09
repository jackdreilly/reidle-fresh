import type { PageProps } from "@/router";
import Game from "@/components/Game";

type Data = {
  challenge_id: number;
  starting_word: string;
  answer: string;
  leader?: { name: string; time: number } | null;
};

export default function ChallengePlay({ data: { challenge_id, starting_word, answer, leader } }: PageProps<Data>) {
  return (
    <Game
      challenge_id={challenge_id}
      isPractice={false}
      winnersTime={leader?.time}
      startingWord={starting_word}
      word={answer}
      winner={leader?.name}
    />
  );
}
