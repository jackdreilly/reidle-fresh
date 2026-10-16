import { useEffect, useRef, useState } from "preact/hooks";
import type { WeekOutput } from "@/lib/types";

// The week as a race, under the Weekly table. Two views of the same running points:
//   Points   — the scoreboard climbing day by day (basketball);
//   Standing — the leaderboard as positions (election night), but continuous: on each day the leader sits at 1st,
//              the last player at the bottom, and everyone else in between in proportion to their points gap, so a
//              runaway leader opens a visible gap and a tight pack bunches together.
// Switching views morphs the lines; Replay re-runs the week from Monday. Inline styles only (CSS budget).

const PODIUM = ["#16a34a", "#ca8a04", "#ea580c"]; // 1st, 2nd, 3rd (the chip colours)
const ME = "#d97706";
const PACK = "#d1d5db";
const W = 320, H = 150, L = 22, R = 70, T = 10, B = 18;

type Line = { name: string; i: number; pts: number[]; ranks: number[]; pos: number[] };

function build(players: WeekOutput): { lines: Line[]; days: string[] } {
  const days = players[0].results.days.map((d) => d.day);
  const lines: Line[] = players.map(({ name, results }, i) => {
    let sum = 0;
    return { name, i, pts: results.days.map((d) => (sum += d.score)), ranks: [], pos: [] };
  });
  const n = lines.length;
  days.forEach((_, k) => {
    const col = lines.map((l) => l.pts[k]);
    const hi = Math.max(...col), lo = Math.min(...col);
    for (const l of lines) {
      l.ranks[k] = 1 + col.filter((v) => v > l.pts[k]).length;
      l.pos[k] = hi === lo ? (1 + n) / 2 : 1 + ((n - 1) * (hi - l.pts[k])) / (hi - lo);
    }
  });
  return { lines, days };
}

/** Smooth path through points (Catmull-Rom as cubic Béziers, control points kept between their two ends so a
 *  line never overshoots 1st place or the top score). */
function path(p: [number, number][]) {
  if (!p.length) return "";
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let k = 0; k < p.length - 1; k++) {
    const [x0, y0] = p[Math.max(0, k - 1)], [x1, y1] = p[k], [x2, y2] = p[k + 1], [x3, y3] = p[Math.min(p.length - 1, k + 2)];
    const clamp = (v: number) => Math.min(Math.max(v, Math.min(y1, y2)), Math.max(y1, y2));
    d += ` C${x1 + (x2 - x0) / 6},${clamp(y1 + (y2 - y0) / 6)} ${x2 - (x3 - x1) / 6},${clamp(y2 - (y3 - y1) / 6)} ${x2},${y2}`;
  }
  return d;
}

const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Animates a number toward `target` over `ms`. */
function useTween(target: number, ms: number, from?: number) {
  const [v, setV] = useState(from ?? target);
  const cur = useRef(v);
  useEffect(() => {
    const start = cur.current, t0 = performance.now();
    if (start === target) return;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      cur.current = start + (target - start) * ease(t);
      setV(cur.current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

export default function Race({ players, me }: { players: WeekOutput; me: string | null }) {
  const [standing, setStanding] = useState(false);
  const [run, setRun] = useState(0); // bump to replay
  if (!players.length || players[0].results.days.length < 2) return null;
  return (
    <section class="mt-6 w-fit max-w-full rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div class="mb-1 flex items-center justify-between gap-3">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">The race</h2>
        <div class="flex items-center gap-1 text-xs">
          {([["Points", false], ["Standing", true]] as const).map(([label, v]) => (
            <button
              type="button"
              aria-pressed={standing === v}
              onClick={() => setStanding(v)}
              class={"rounded-full px-2 py-0.5 font-medium " + (standing === v ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100")}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={() => setRun((r) => r + 1)} class="rounded-full px-2 py-0.5 text-gray-500 hover:bg-gray-100" title="Replay the week">
            ▶ Replay
          </button>
        </div>
      </div>
      <Chart key={run} players={players} me={me} standing={standing} />
    </section>
  );
}

function Chart({ players, me, standing }: { players: WeekOutput; me: string | null; standing: boolean }) {
  const { lines, days } = build(players);
  const n = lines.length, D = days.length;
  const m = useTween(standing ? 1 : 0, 450); // 0 = points, 1 = standing
  const p = useTween(D - 1, 700 * (D - 1), 0); // how far through the week the race has run
  const max = Math.max(1, ...lines.map((l) => l.pts[D - 1]));
  const x = (k: number) => L + (k * (W - L - R)) / (D - 1);
  const yPts = (v: number) => T + (H - T - B) * (1 - v / max);
  const yPos = (pos: number) => T + ((H - T - B) * (pos - 1)) / Math.max(1, n - 1);
  const yAt = (l: Line, k: number) => yPts(l.pts[k]) * (1 - m) + yPos(l.pos[k]) * m;
  const lerp = (a: number[], k: number) => a[Math.floor(k)] + (a[Math.ceil(k)] - a[Math.floor(k)]) * (k - Math.floor(k));

  const color = (l: Line) => (l.i < 3 ? PODIUM[l.i] : l.name === me ? ME : PACK);
  const loud = (l: Line) => l.i < 3 || l.name === me;
  const order = [...lines].sort((a, b) => Number(loud(a)) - Number(loud(b)) || (a.name === me ? 1 : 0) - (b.name === me ? 1 : 0));

  // the run so far: whole days, then the in-between point where the head currently is
  const shown = (l: Line): [number, number][] => {
    const pts: [number, number][] = [];
    for (let k = 0; k <= Math.floor(p); k++) pts.push([x(k), yAt(l, k)]);
    if (p > Math.floor(p)) {
      const k = Math.floor(p), f = p - k;
      pts.push([x(k) + (x(k + 1) - x(k)) * f, yAt(l, k) + (yAt(l, k + 1) - yAt(l, k)) * f]);
    }
    return pts;
  };
  const day = Math.round(p);
  const labels = order.filter(loud).map((l) => {
    const pts = shown(l);
    const [hx, hy] = pts[pts.length - 1];
    return { l, hx, hy, ly: hy };
  }).sort((a, b) => a.ly - b.ly);
  for (let k = 1; k < labels.length; k++) labels[k].ly = Math.max(labels[k].ly, labels[k - 1].ly + 11);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} class="block h-auto max-w-full" role="img"
      aria-label={standing ? "Standings through the week" : "Running points through the week"}>
      {/* left axis: points scale or positions, crossfading */}
      <g opacity={1 - m}>
        {[0, Math.round(max / 2), max].map((v) => (
          <text x={L - 4} y={yPts(v) + 3} text-anchor="end" font-size="9" fill="#9ca3af">{v}</text>
        ))}
      </g>
      <g opacity={m}>
        {[1, n].filter((v, k, a) => a.indexOf(v) === k).map((v) => (
          <text x={L - 4} y={yPos(v) + 3} text-anchor="end" font-size="9" fill="#9ca3af">{ordinal(v)}</text>
        ))}
      </g>
      {days.map((d, k) => (
        <g>
          <line x1={x(k)} x2={x(k)} y1={T} y2={H - B} stroke="#f3f4f6" />
          <text x={x(k)} y={H - 4} text-anchor="middle" font-size="10" fill={k <= day ? "#6b7280" : "#d1d5db"}>
            {"MTWRFSU"[(new Date(d).getUTCDay() + 6) % 7]}
          </text>
        </g>
      ))}
      {order.map((l) => {
        const pts = shown(l);
        const [hx, hy] = pts[pts.length - 1];
        return (
          <g>
            <path d={path(pts)} fill="none" stroke={color(l)} stroke-width={l.name === me ? 2.5 : loud(l) ? 2 : 1.25}
              stroke-linejoin="round" stroke-linecap="round">
              <title>{l.name}: {l.pts[D - 1]} pts, {ordinal(l.ranks[D - 1])}</title>
            </path>
            {loud(l) && <circle cx={hx} cy={hy} r={l.name === me ? 3.5 : 3} fill={color(l)} stroke="#fff" stroke-width="1.5" />}
          </g>
        );
      })}
      {labels.map(({ l, hx, ly }) => (
        <text x={hx + 6} y={ly + 3} font-size="10" fill={color(l)} font-weight={l.name === me ? 700 : 500}>
          {l.name.length > 8 ? l.name.slice(0, 7) + "…" : l.name}{" "}
          {standing ? ordinal(l.ranks[Math.min(D - 1, day)]) : Math.round(lerp(l.pts, p))}
        </text>
      ))}
    </svg>
  );
}
