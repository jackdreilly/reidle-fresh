import { useEffect, useState } from "preact/hooks";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

interface State {
}

export default function Page({ battle_id }: { battle_id: number }) {
  const [state, setState] = useState<State>();
  useEffect(() => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_HOST") ?? "",
      Deno.env.get("SUPABASE_KEY") ?? "",
    );
    supabase.channel("any").on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "battles",
        filter: `battle_id=eq.${battle_id}`,
      },
      ({ new: { state } }) => {
        setState(state);
      },
    )
      .subscribe();

    (async () => {
      const { data, error } = await supabase
        .from("battles")
        .update({ created_at: new Date().toISOString() })
        .eq("battle_id", battle_id);
      console.log({ data, error });
    })();
  }, []);
  return (
    <div>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
}
