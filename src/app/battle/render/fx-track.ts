import { FxTrack } from '../../core/models/fx';

export function curveAt(keys: [number, number][] | undefined, ms: number, fallback: number): number {
  if (!keys?.length) return fallback;
  if (ms <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (ms <= keys[i][0]) {
    const [t, v] = keys[i - 1], [end, next] = keys[i];
    return v + (next - v) * (end > t ? (ms - t) / (end - t) : 1);
  }
  return keys[keys.length - 1][1];
}

export function trackPoseAt(track: FxTrack, ms: number) {
  let dx = 0, dy = 0;
  const keys = track.motion;
  if (keys?.length) {
    let a = keys[0], b = a;
    for (let i = 1; i < keys.length; i++) {
      b = keys[i];
      if (ms <= b[0]) break;
      a = b;
    }
    const k = b[0] > a[0] ? Math.min(1, Math.max(0, (ms - a[0]) / (b[0] - a[0]))) : 0;
    dx = a[1] + (b[1] - a[1]) * k; dy = a[2] + (b[2] - a[2]) * k;
  }
  const done = ms >= track.durationMs;
  const cycle=track.cycle, cycling=cycle && ms>=cycle.fromMs && ms<cycle.untilMs;
  const wave=cycling ? (1-Math.cos(2*Math.PI*(ms-cycle.fromMs)/Math.max(1,cycle.periodMs)))/2 : 0;
  const multiplier=(range: [number,number] | undefined) => cycling && range ? range[0]+(range[1]-range[0])*wave : 1;
  return { alpha: ms < 0 || done ? 0 : curveAt(track.alpha, ms, 1)*multiplier(cycle?.alpha), dx, dy,
    scale: curveAt(track.scale, ms, 1), reveal: curveAt(track.reveal, ms, 1)*multiplier(cycle?.reveal), done };
}
