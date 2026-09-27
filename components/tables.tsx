import { JSX } from "preact";
import { ComponentChildren } from "preact";

export function HeadColumn(
  { "class": classValue, children }: {
    class?: string;
    children?: ComponentChildren;
  },
) {
  return (
    <th
      scope="col"
      class={`px-3 sm:px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider ${
        classValue ?? ""
      }`}
    >
      {children}
    </th>
  );
}

export function TableHead(
  { columns, columnClasses, children }: {
    columns?: ComponentChildren[];
    columnClasses?: string[];
    children?: ComponentChildren;
  },
) {
  return (
    <thead class="bg-gray-50/80 border-b border-gray-200/80">
      <tr>
        {columns?.map((c, index) => (
          <HeadColumn class={columnClasses?.[index]}>{c}</HeadColumn>
        ))}
        {children}
      </tr>
    </thead>
  );
}

export function TableRow(
  { header, children, "class": myClass, style }: {
    header?: ComponentChildren;
    children?: ComponentChildren;
    "class"?: string;
    style?: JSX.CSSProperties;
  },
) {
  return (
    <tr
      style={style}
      class={`border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60 transition-colors ${myClass ?? ""}`}
    >
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
      class={`px-3 sm:px-4 py-2.5 font-semibold text-gray-900 whitespace-nowrap text-left text-xs sm:text-sm ${
        myClass ?? ""
      }`}
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
    <td
      style={style}
      class={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-gray-600 align-middle ${
        myClass ?? ""
      }`}
    >
      {children}
    </td>
  );
}

export function TableBody(
  { rows, children }: {
    rows?: ComponentChildren[][];
    children?: ComponentChildren;
  },
) {
  return (
    <tbody class="divide-y divide-gray-100 bg-white">
      {(rows ?? []).map((row) => (
        <TableRow header={row[0]}>
          {row.slice(1).map((cell) => (
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
  { columns, columnClasses, tableClass, rows, children }: {
    columns?: ComponentChildren[];
    columnClasses?: string[];
    tableClass?: string;
    rows?: ComponentChildren[][];
    children?: ComponentChildren;
  },
) {
  return (
    <div class="w-full bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class={`w-full text-left border-collapse ${tableClass ?? ""}`}>
          {columns ? <TableHead columns={columns} columnClasses={columnClasses} /> : null}
          {rows ? <TableBody rows={rows} /> : null}
          {children}
        </table>
      </div>
    </div>
  );
}
