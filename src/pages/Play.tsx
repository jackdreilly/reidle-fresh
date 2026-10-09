import type { PageProps } from "@/router";
import Game from "@/components/Game";
import type { Checkpoint } from "@/lib/types";

type Data = {
  word: string;
  startingWord: string;
  winner?: string | null;
  winnersTime?: number | null;
  checkpoint: Checkpoint;
};

export default function Play({ data }: PageProps<Data>) {
  return <Game isPractice={false} {...data} winner={data.winner ?? undefined} />;
}
