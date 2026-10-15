import { FX_SCALE, FxDef, PROJECTILE_SCALE, PX_TO_CELL } from '../../core/data/sprites';

/**
 * A skill FX as a pure function of ONE clock — the same rules `app-fx-sprite` applies with Web Animations
 * (delayMs hidden, the strip at frameMs per frame, `repeat` loops, `from` segment of a longer strip, the
 * fadeOutMs hold-and-fade on the last frame), but sampled: "which frame / alpha at t game seconds after spawn?".
 * Pause, hit-stop and x2 / x4 are only how the board clock advances (renderer: `render/pixi-units.ts`).
 */
export interface FxPose {
  /** frame index in the file (from + i) */
  frame: number;
  alpha: number;
  visible: boolean;
  /** past the delay + strip + fade: the renderer drops it */
  done: boolean;
}

/** CSS `ease-in` = cubic-bezier(0.42, 0, 1, 1) — the fade curve of the DOM FX */
export function easeIn(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const x1 = 0.42;
  const x2 = 1;
  const bx = (s: number) => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (bx(m) < x) lo = m;
    else hi = m;
  }
  const s = (lo + hi) / 2;
  return 3 * s * s * (1 - s) + s * s * s; // y control points 0, 1
}

/** total length in game seconds (delay + strip × repeat + fade) — `fxDuration()` / 1000 at speed 1 */
export function fxLength(d: FxDef): number {
  return ((d.delayMs ?? 0) + d.frames * d.frameMs * (d.repeat ?? 1) + (d.fadeOutMs ?? 0)) / 1000;
}

export function fxPoseAt(d: FxDef, t: number): FxPose {
  const from = d.from ?? 0;
  const delay = (d.delayMs ?? 0) / 1000;
  const per = d.frameMs / 1000;
  const play = d.frames * per * (d.repeat ?? 1);
  const fade = (d.fadeOutMs ?? 0) / 1000;
  if (t < delay) return { frame: from, alpha: 0, visible: false, done: false };
  const u = t - delay;
  if (u < play) {
    const i = Math.min(d.frames - 1, Math.floor(u / per) % d.frames);
    return { frame: from + i, alpha: 1, visible: true, done: false };
  }
  const last = from + d.frames - 1;
  if (fade > 0 && u < play + fade) {
    const a = 1 - easeIn((u - play) / fade);
    return { frame: last, alpha: a, visible: a > 0.001, done: false };
  }
  return { frame: last, alpha: 0, visible: false, done: true };
}

/** where the FX frame sits (board px): the DOM `.fx-wrap` is one cell at (x, y), the `.fx` box inside it */
export interface FxPlacement {
  /** the pivot point on the board */
  x: number;
  y: number;
  /** drawn size (px) */
  width: number;
  height: number;
  /** radians */
  rotation: number;
  flip: boolean;
}

/**
 * Same box as FxSpriteComponent: width = fitCells cells or w × PX_TO_CELL × scale × FX_SCALE % of a cell, the
 * frame's pivot on (50 % + dx · flip, 50 % + dy) of the cell, rotate(angle) then scaleX(−1) around the pivot.
 */
export function fxPlacement(
  d: FxDef,
  cell: number,
  x: number,
  y: number,
  flip: boolean,
  angle: number,
  offset?: [number, number],
): FxPlacement {
  const width = d.fitCells ? d.fitCells * cell : ((d.w * PX_TO_CELL * (d.scale ?? 1) * FX_SCALE) / 100) * cell;
  const height = (width * d.h) / d.w;
  const [dx, dy] = offset ?? [d.dx ?? 0, d.dy ?? 0];
  return {
    x: x + cell / 2 + ((dx * (flip ? -1 : 1)) / 100) * cell,
    y: y + cell / 2 + (dy / 100) * cell,
    width,
    height,
    rotation: (angle * Math.PI) / 180,
    flip,
  };
}

/** a projectile in flight at t game seconds after it was fired — the `app-projectile` rules sampled by time */
export interface ProjectilePose {
  /** 0 → 1 along from → to */
  k: number;
  frame: number;
  done: boolean;
}

/** the impact frame stays this long after arrival (`projectileLife`) */
export const PROJECTILE_HOLD = 0.14;

/** flight frames 0 … n−2 spread once over the flight, the last (impact) frame on arrival */
export function projectilePoseAt(d: FxDef, flightSec: number, t: number): ProjectilePose {
  const fly = Math.max(1, d.frames - 1);
  if (t >= flightSec) return { k: 1, frame: d.frames - 1, done: t >= flightSec + PROJECTILE_HOLD };
  const k = flightSec > 0 ? Math.max(0, t / flightSec) : 1;
  return { k, frame: Math.min(fly - 1, Math.floor(k * fly)), done: false };
}

/** the bolt's centre (board px) and size: the DOM `.p` box (left 50 %, top 42 % of the cell, centred) */
export function projectilePlacement(
  d: FxDef,
  cell: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  k: number,
): FxPlacement {
  const width = ((d.w * PX_TO_CELL * (d.scale ?? 1) * PROJECTILE_SCALE) / 100) * cell;
  const cx = from.x + (to.x - from.x) * k;
  const cy = from.y + (to.y - from.y) * k;
  const deg = d.noRotate ? 0 : (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI - (d.angle0 ?? 0);
  return { x: cx * cell + cell / 2, y: cy * cell + cell * 0.42, width, height: (width * d.h) / d.w, rotation: (deg * Math.PI) / 180, flip: false };
}
