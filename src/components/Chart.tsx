// Tiny dependency-free SVG charts (replaces chart.js).
type Props = { type: "bar" | "line"; label: string; labels: string[]; values: number[]; width?: number; height?: number };

const niceMax = (m: number) => {
  if (m <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(m));
  return Math.ceil(m / p) * p;
};

/** Axis for whole-number data (game counts): integer steps only, never 22.5 games. */
function integerAxis(max: number): { top: number; ticks: number[] } {
  if (max <= 4) return { top: Math.max(1, max), ticks: Array.from({ length: Math.max(1, max) + 1 }, (_, i) => i) };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((st) => st >= raw)!;
  return { top: step * Math.ceil(max / step), ticks: Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step) };
}

export default function Chart({ type, label, labels, values, width = 400, height = 200 }: Props) {
  const L = 36, R = 8, T = 26, B = 22;
  const w = width - L - R, h = height - T - B;
  const peak = Math.max(0, ...values);
  const whole = type === "bar"; // bar charts here are always counts
  const axis = whole ? integerAxis(peak) : { top: niceMax(peak), ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => f * niceMax(peak)) };
  const max = axis.top;
  const n = values.length;
  const x = (i: number) => L + (type === "bar" ? (i + 0.5) * (w / n) : n === 1 ? w / 2 : (i * w) / (n - 1));
  const y = (v: number) => T + h - (v / max) * h;
  const ticks = axis.ticks;
  const step = Math.ceil(n / 8);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} class="w-full" role="img" aria-label={label}>
      <text x={width / 2} y={14} text-anchor="middle" font-size="12" fill="#666">{label}</text>
      {ticks.map((t) => (
        <g>
          <line x1={L} x2={width - R} y1={y(t)} y2={y(t)} stroke="#e5e7eb" />
          <text x={L - 4} y={y(t) + 3} text-anchor="end" font-size="10" fill="#666">{+t.toFixed(1)}</text>
        </g>
      ))}
      {type === "bar"
        ? values.map((v, i) => (
          <rect x={x(i) - (w / n) * 0.4} y={y(v)} width={(w / n) * 0.8} height={h - (y(v) - T)} fill="rgba(54,162,235,.5)" stroke="rgb(54,162,235)" />
        ))
        : (
          <>
            <polyline fill="none" stroke="rgb(54,162,235)" stroke-width="2" points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
            {values.map((v, i) => <circle cx={x(i)} cy={y(v)} r="3" fill="rgb(54,162,235)" />)}
          </>
        )}
      {labels.map((l, i) => i % step === 0 && (
        <text x={x(i)} y={height - 6} text-anchor="middle" font-size="10" fill="#666">{l}</text>
      ))}
    </svg>
  );
}
