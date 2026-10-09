import type { PageProps } from "@/router";
import Game from "@/components/Game";

export default function Practice({ data }: PageProps<{ word: string; startingWord: string }>) {
  return <Game isPractice={true} word={data.word} startingWord={data.startingWord} />;
}
