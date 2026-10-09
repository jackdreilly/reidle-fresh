import type { PageProps } from "@/router";
import Chart from "@/components/Chart";
import { timerTime } from "@/lib/time";
import type { Buckets } from "@/lib/types";

type Data = {
  total: number;
  rank: Buckets;
  time: Buckets;
  penalty: Buckets;
  week: { week: string; time: number; penalty: number; rank: number }[];
};

export default function Player({ params, data: { total, rank, penalty, time, week } }: PageProps<Data>) {
  const sorted = (b: Buckets) => [...b].sort((a, c) => a.bucket - c.bucket);
  const scores = sorted(rank), times = sorted(time), penalties = sorted(penalty).filter((p) => p.bucket !== 0);
  const weeks = week.map((w) => w.week.slice(5, 10));
  const Box = ({ children }: { children: preact.ComponentChildren }) => <div class="p-4 mx-auto max-w-screen-md">{children}</div>;
  return (
    <>
      <h1 class="text-2xl">{params.name}</h1>
      <div class="m-2"><h2 class="text-xl">Total Games: {total}</h2></div>
      <Box><Chart type="bar" label="Scores" labels={scores.map((s) => `${s.bucket}`)} values={scores.map((s) => s.count)} /></Box>
      <Box><Chart type="bar" label="Times" labels={times.map((s) => timerTime(s.bucket))} values={times.map((s) => s.count)} /></Box>
      <Box><Chart type="bar" label="Penalties" labels={penalties.map((s) => timerTime(s.bucket))} values={penalties.map((s) => s.count)} /></Box>
      <Box><Chart type="line" label="Times" labels={weeks} values={week.map((w) => w.time)} /></Box>
      <Box><Chart type="line" label="Scores" labels={weeks} values={week.map((w) => w.rank)} /></Box>
      <Box><Chart type="line" label="Penalties" labels={weeks} values={week.map((w) => w.penalty)} /></Box>
    </>
  );
}
