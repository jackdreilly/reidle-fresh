import type { PageProps } from "@/router";
import { DailyTable } from "@/components/DailyTable";
import { useSession } from "@/lib/session";
import type { DailySubmission } from "@/lib/types";

type Data = { challenge_id: number; played: boolean; submissions: DailySubmission[] };

export default function Challenge({ data: { challenge_id, played, submissions } }: PageProps<Data>) {
  const { name } = useSession();
  return (
    <>
      <h1>Challenge {challenge_id}</h1>
      {played ? null : (
        <a
          class="inline-block text-white bg-linear-to-br from-purple-600 to-blue-500 hover:bg-linear-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center m-2"
          href={`/challenges/challenge/${challenge_id}/play`}
        >
          Play
        </a>
      )}
      <DailyTable hide={!played} name={name ?? ""} submissions={submissions} />
    </>
  );
}
