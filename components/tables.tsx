import { JSX } from "preact";
import { ComponentChildren } from "preact";

export function HeadColumn(
  { "class": classValue, children }: {
    class?: string;
    children?: ComponentChildren;
  },
) {
  return <th scope="col" class={`px-4 py-2 ${classValue ?? ""}`}>{children}
  </th>;
}
export function TableHead(
  { columns, children }: { columns?: any[]; children?: ComponentChildren },
) {
  return (
    <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
      {columns?.map((c) => <HeadColumn>{c}</HeadColumn>)}
      {children}
    </thead>
  );
}
export function TableRow(
  { header, children }: { header?: string; children?: ComponentChildren },
) {
  return (
    <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
      {header && <TableRowHeader>{header}</TableRowHeader>}
      {children}
    </tr>
  );
}
export function TableRowHeader({ children }: { children?: ComponentChildren }) {
  return (
    <th
      scope="row"
      class="px-4 py-2 font-medium text-gray-900 whitespace-nowrap dark:text-white"
    >
      {children}
    </th>
  );
}
export function TableCell(
  { "class": myClass, children, style }: {
    children?: ComponentChildren;
    "class"?: string;
    style?: JSX.CSSProperties;
  },
) {
  return (
    <td style={style} class={"px-4 py-2 " + (myClass ?? "")}>{children}</td>
  );
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
            <TableCell class={(columnStyles ?? {})[i + 1] ?? ""}>
              {cell}
            </TableCell>
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
