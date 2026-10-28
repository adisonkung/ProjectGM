/** Interpolate within the latest fixed simulation snapshot, rather than integrating another capped wall clock. */
export function visualGameClock(snapshot: number, alpha: number, step: number): number {
  return Math.max(0, snapshot - Math.max(0, step) * (1 - Math.min(1, Math.max(0, alpha))));
}
