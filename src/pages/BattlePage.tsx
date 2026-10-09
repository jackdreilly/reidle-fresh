import type { PageProps } from "@/router";
import Battle from "@/components/Battle";
import { useSession } from "@/lib/session";
import type { BattleState } from "@/lib/types";

type Data = { battle_id: number; state: BattleState };

export default function BattlePage({ data: { battle_id, state } }: PageProps<Data>) {
  const { name } = useSession();
  return <Battle name={name ?? ""} initial_state={state} battle_id={battle_id} url={location.href} />;
}
