import { ComponentChildren } from "preact";

export function TableHead({ columns }: { columns: any[] }) {
  return (
    <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
      {columns.map((c) => <th scope="col" class="px-6 py-3">{c}</th>)}
    </thead>
  );
}
export function TableRow(
  { header, children }: { header?: string; children?: ComponentChildren },
) {
  return (
    <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
      {header ? <TableRowHeader value={header} /> : null}
      {children}
    </tr>
  );
}
export function TableRowHeader({ value }: { value: string }) {
  return (
    <th
      scope="row"
      class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white"
    >
      {value}
    </th>
  );
}
export function TableCell(props: { value: any; "class"?: string }) {
  return <td class={"px-6 py-4 " + (props["class"] ?? "")}>{props.value}</td>;
}
export function TableBody(
  { rows, children, columnStyles }: {
    rows?: any[][];
    children?: ComponentChildren;
    columnStyles?: Record<number, string>;
  },
) {
  return (
    <tbody>
      {(rows ?? []).map((row) => (
        <TableRow header={row[0]}>
          {row.slice(1).map((cell, i) => (
            <TableCell class={(columnStyles ?? {})[i + 1] ?? ""} value={cell} />
          ))}
          {children}
        </TableRow>
      ))}
      {children}
    </tbody>
  );
}

export function Table(
  { columns, rows, children, columnStyles }: {
    columns?: any[];
    rows?: any[][];
    children?: ComponentChildren;
    columnStyles?: Record<string, string>;
  },
) {
  return (
    <div class="relative overflow-x-auto">
      <table class="text-sm text-left text-gray-500 dark:text-gray-400">
        {columns ? <TableHead columns={columns} /> : null}
        {rows
          ? (
            <TableBody
              columnStyles={Object.fromEntries(
                Object.entries(columnStyles ?? {}).map((
                  [key, value],
                ) => [(columns ?? []).indexOf(key), value]),
              )}
              rows={rows}
            />
          )
          : null}
        {children}
      </table>
    </div>
  );
}
