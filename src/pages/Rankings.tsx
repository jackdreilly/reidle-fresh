import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { PageProps } from "@/router";

type Series = { name: string; day: string[]; rank: number[] };

const COLORS = [
  "#2E91E5", "#E15F99", "#1CA71C", "#FB0D0D", "#DA16FF", "#222A2A", "#B68100", "#750D86",
  "#EB663B", "#511CFB", "#00A08B", "#FB00D1", "#FC0080", "#B2828D", "#6C7C32", "#778AAE",
  "#862A16", "#A777F1", "#620042", "#1616A7", "#DA60CA", "#6C4516", "#0D2A63", "#AF0038",
];
const DAY = 86_400_000;

// Catmull-Rom -> cubic bezier, matching plotly's "spline" feel.
function spline(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += `C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export default function Rankings({ data }: PageProps<Series[]>) {
  const [solo, setSolo] = useState<string | null>(null);
  const end = Date.now();
  const [from, setFrom] = useState(end - 30 * DAY);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 520 });
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const { w: W, h: H } = size;
  const T = 48, B = 28, PAD = 16, SPAN = 30 * DAY;
  const L = 0; // the legend is laid out beside/above the plot, never over it
  const maxRank = useMemo(() => Math.max(1, ...data.flatMap((s) => s.rank)), [data]);
  const X = (t: number) => L + PAD + ((t - from) / SPAN) * (W - L - 2 * PAD);
  const Y = (r: number) => T + ((r - 1) / Math.max(1, maxRank - 1)) * (H - T - B - 2 * PAD) + PAD;
  const ticks = Array.from({ length: 6 }, (_, i) => from + (i * SPAN) / 5);
  return (
    <div class="flex flex-col sm:flex-row sm:items-start gap-2">
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-lg sm:flex-col sm:flex-nowrap sm:gap-y-0 sm:text-xl sm:w-40 sm:shrink-0">
        {data.map((s, i) => (
          <div
            class="cursor-pointer whitespace-nowrap"
            style={{ color: COLORS[i % COLORS.length], opacity: solo && solo !== s.name ? 0.3 : 1 }}
            onClick={() => setSolo(solo === s.name ? null : s.name)}
          >
            ● {s.name}
          </div>
        ))}
      </div>
      <div ref={box} class="relative min-w-0 flex-1 select-none overflow-hidden h-[55vh] sm:h-[75vh]">
      <svg
        width={W}
        height={H}
        class="touch-pan-y"
        onPointerDown={(e) => { drag.current = { x: e.clientX, from }; (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setFrom(Math.min(end - SPAN, drag.current.from - ((e.clientX - drag.current.x) / (W - L - 2 * PAD)) * SPAN));
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <text x={W / 2} y={28} text-anchor="middle" font-size="22">Reidle Power Rankings</text>
        {ticks.map((t) => (
          <text x={X(t)} y={H - 6} text-anchor="middle" font-size="14" fill="#666">{new Date(t).toISOString().slice(5, 10)}</text>
        ))}
        {data.map((s, i) => {
          const pts = s.day.map((d, k) => [X(new Date(d).getTime()), Y(s.rank[k])] as [number, number]);
          return (
            <path
              d={spline(pts)} fill="none" stroke={COLORS[i % COLORS.length]} stroke-width="12"
              stroke-linecap="round" opacity={solo && solo !== s.name ? 0.12 : 0.9}
            />
          );
        })}
      </svg>
      </div>
    </div>
  );
}
