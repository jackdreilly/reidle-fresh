import type { PageProps } from "@/router";
import { Name } from "@/components/DailyTable";
import { Table, TableCell, TableRow } from "@/components/Tables";
import TimerText from "@/components/TimerText";
import { useSession } from "@/lib/session";
import type { Leaderboard } from "@/lib/types";

type Data = {
  history: { challenge_id: number; time: number; answer: string; players: string[]; winner: { name: string; time: number } }[];
  today_leaderboard: Leaderboard;
  yesterday_leaderboard: Leaderboard;
  pending_challenges: number;
};

const IconEye = ({ class: c }: { class?: string }) => (
  <svg class={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="2" /><path d="M22 12c-2.667 4.667-6 7-10 7s-7.333-2.333-10-7c2.667-4.667 6-7 10-7s7.333 2.333 10 7" />
  </svg>
);
const IconPlayerPlay = ({ class: c }: { class?: string }) => (
  <svg class={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 4v16l13-8z" />
  </svg>
);

export default function Challenges(
  { data: { today_leaderboard, yesterday_leaderboard, history, pending_challenges } }: PageProps<Data>,
) {
  const { name: myName } = useSession();
  return (
    <>
      <div class="flex">
        <a
          href="/challenges/play"
          class="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-700 flex gap-2"
        >
          <IconPlayerPlay class="w-6 h-6" />
          {pending_challenges
            ? `${pending_challenges} Pending Challenge${
              pending_challenges > 1 ? "s" : ""
            }!`
            : "Start New Challenge!"}
        </a>
      </div>
      <h1 class="my-4">Today</h1>
      <Table
        columns={["Name", "Score", "W", "L"]}
      >
        {today_leaderboard.map((
          { name, total_points, num_losses, num_wins },
        ) => (
          <TableRow class={name === myName ? "bg-yellow-100" : ""}>
            {[<Name name={name} />, total_points, num_wins, num_losses].map((
              x,
            ) => <TableCell>{x}</TableCell>)}
          </TableRow>
        ))}
      </Table>
      <h1 class="my-4">Your Challenges</h1>
      <Table
        columns={["See", "Word", "Time", "Winner", "Others"]}
      >
        {history.map((
          {
            challenge_id,
            time,
            answer,
            winner: { name, time: winning_time },
            players,
          },
        ) => (
          <TableRow class={name === myName ? "bg-green-100" : ""}>
            {[
              <a
                href={`/challenges/challenge/${challenge_id}`}
                type="button"
                class="px-3 py-2 bg-white rounded border border-gray-400 hover:bg-gray-200 flex gap-2"
              >
                <IconEye class="w-6 h-6" />
              </a>,
              <div>{answer}</div>,
              <TimerText seconds={time} />,
              <div>
                <span>
                  <Name name={name} />
                </span>
                <span class="mx-2">
                  <TimerText seconds={winning_time} />
                </span>
              </div>,
              <div>{players.join(", ")}</div>,
            ].map((x) => <TableCell>{x}</TableCell>)}
          </TableRow>
        ))}
      </Table>
      <h1 class="my-4">Yesterday</h1>
      <Table
        columns={["Name", "Score", "W", "L"]}
      >
        {yesterday_leaderboard.map((
          { name, total_points, num_losses, num_wins },
        ) => (
          <TableRow class={name === myName ? "bg-yellow-100" : ""}>
            {[name, total_points, num_wins, num_losses].map((x) => (
              <TableCell>{x}</TableCell>
            ))}
          </TableRow>
        ))}
      </Table>
    </>
  );
}
