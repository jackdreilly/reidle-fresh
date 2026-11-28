/** Wins only go up within a round, so a stale copy of the leaderboard must never lower anyone's count. */
export function mergeLeaderboards(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): Record<string, number> {
  const out: Record<string, number> = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

export function longer<T>(a: T[] | undefined, b: T[] | undefined): T[] {
  return (b?.length ?? 0) >= (a?.length ?? 0) ? (b ?? []) : (a ?? []);
}
