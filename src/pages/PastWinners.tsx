import type { PageProps } from "@/router";
import StatsTabs from "@/components/StatsTabs";
import { Table, TableBody, TableCell, TableRow, TableRowHeader } from "@/components/Tables";
import { Name } from "@/components/DailyTable";
import { useSession } from "@/lib/session";

export default function PastWinners({ data }: PageProps<{ name: string; week: string }[]>) {
  const { name: me } = useSession();
  return (
    <StatsTabs route="past_winners">
      <Table columns={["Name", "Week"]}>
        <TableBody>
          {data.map(({ name, week }) => (
            <TableRow class={name === me ? "bg-yellow-100" : ""}>
              <TableRowHeader><Name name={name} /></TableRowHeader>
              <TableCell>
                <a class="font-medium text-blue-600 dark:text-blue-500 hover:underline" href={`/stats/weekly/${week}`}>{week}</a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </StatsTabs>
  );
}
