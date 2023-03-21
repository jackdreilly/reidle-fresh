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
  { columns, children }: {
    columns?: ComponentChildren[];
    children?: ComponentChildren;
  },
) {
  return (
    <thead class="text-xs text-gray-700 uppercase bg-gray-50">
      {columns?.map((c) => <HeadColumn>{c}</HeadColumn>)}
      {children}
    </thead>
  );
}
export function TableRow(
  { header, children, "class": myClass }: {
    header?: ComponentChildren;
    children?: ComponentChildren;
    "class"?: string;
  },
) {
  return (
    <tr class={`bg-white border-b ${myClass ?? ""}`}>
      {header && <TableRowHeader>{header}</TableRowHeader>}
      {children}
    </tr>
  );
}
export function TableRowHeader(
  { children, "class": myClass }: {
    children?: ComponentChildren;
    class?: string;
  },
) {
  return (
    <th
      scope="row"
      class={"px-4 py-2 font-medium text-gray-900 whitespace-nowrap " +
        (myClass ?? "")}
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
  { rows, children }: {
    rows?: ComponentChildren[][];
    children?: ComponentChildren;
  },
) {
  return (
    <tbody>
      {(rows ?? []).map((row) => (
        <TableRow header={row[0]}>
          {row.slice(1).map((cell, i) => (
            <TableCell>
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
  { columns, rows, children }: {
    columns?: ComponentChildren[];
    rows?: ComponentChildren[][];
    children?: ComponentChildren;
  },
) {
  return (
    <div class="relative overflow-x-auto">
      <table class="text-sm text-left text-gray-500">
        {columns ? <TableHead columns={columns} /> : null}
        {rows
          ? (
            <TableBody
              rows={rows}
            />
          )
          : null}
        {children}
      </table>
    </div>
  );
}
