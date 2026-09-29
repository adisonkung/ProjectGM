import { SlashGrade, SlashTraceDefinition } from '../data/special-skills';

/** Blade Trace mini-game (pure): trail generation + grading of a drawn path. Coordinates: any space, same for both. */
export interface Pt { x: number; y: number }
export interface SlashStroke {
  /** the trail, start → end (sampled points; a light curve) */
  points: Pt[];
}
export interface StrokeScore {
  grade: SlashGrade;
  score: number;
  /** fraction of the trail touched */
  coverage: number;
  /** 0–1 from the drawn points' mean distance to the trail */
  accuracy: number;
  /** drawn start → end the same way as the trail */
  rightWay: boolean;
  /** finished inside the window */
  inTime: boolean;
}

const SAMPLES = 24;

/**
 * `n` crossing sword trails in the unit square (x, y ∈ [0, 1], y down), centred on the middle of the field, each a
 * different angle, with a random direction and a slight bend. Deterministic for a given rng.
 */
export function slashPattern(n: number, rng: () => number): SlashStroke[] {
  const out: SlashStroke[] = [];
  const base = rng() * Math.PI;
  for (let i = 0; i < n; i++) {
    // spread the angles so no two trails overlap: base + i·(π/n) ± a little jitter
    const ang = base + (i * Math.PI) / n + (rng() - 0.5) * (Math.PI / n) * 0.5;
    const len = 0.62 + rng() * 0.18;
    const cx = 0.5 + (rng() - 0.5) * 0.16;
    const cy = 0.5 + (rng() - 0.5) * 0.16;
    const dx = (Math.cos(ang) * len) / 2;
    const dy = (Math.sin(ang) * len) / 2;
    const flip = rng() < 0.5 ? -1 : 1;
    const a = { x: cx - dx * flip, y: cy - dy * flip };
    const b = { x: cx + dx * flip, y: cy + dy * flip };
    // quadratic bend: control point pushed sideways (≤ 12 % of the length)
    const bend = (rng() - 0.5) * 0.24 * len;
    const ctrl = { x: cx - Math.sin(ang) * bend, y: cy + Math.cos(ang) * bend };
    const points: Pt[] = [];
    for (let k = 0; k <= SAMPLES; k++) {
      const t = k / SAMPLES;
      const u = 1 - t;
      points.push({ x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x, y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y });
    }
    out.push({ points: points.map(p => ({ x: clamp(p.x, 0.04, 0.96), y: clamp(p.y, 0.06, 0.94) })) });
  }
  return out;
}

/** scale a unit-square trail to a w × h field */
export const toSpace = (s: SlashStroke, w: number, h: number): SlashStroke => ({ points: s.points.map(p => ({ x: p.x * w, y: p.y * h })) });

/**
 * Grade one drawn path against a trail (same coordinate space). `tol` = accuracy tolerance in those units.
 *   coverage  = trail samples within `tol` of the drawn path
 *   accuracy  = 1 − mean(distance of drawn points to the trail) / (2·tol)
 *   rightWay  = the drawn path starts nearer the trail's start than its end
 *   score     = coverage × (0.5 + 0.5·accuracy) × (rightWay ? 1 : 0.25) × (inTime ? 1 : 0)
 */
export function gradeStroke(trail: SlashStroke, drawn: Pt[], tol: number, inTime: boolean, def: SlashTraceDefinition): StrokeScore {
  if (drawn.length < 2 || !inTime) {
    return { grade: 'MISS', score: 0, coverage: 0, accuracy: 0, rightWay: false, inTime, };
  }
  const path = densify(drawn, tol / 3);
  const covered = trail.points.filter(p => minDist(p, path) <= tol).length;
  const coverage = covered / trail.points.length;
  const mean = drawn.reduce((a, p) => a + distToPolyline(p, trail.points), 0) / drawn.length;
  const accuracy = clamp(1 - mean / (2 * tol), 0, 1);
  const start = trail.points[0];
  const end = trail.points[trail.points.length - 1];
  const rightWay = dist(drawn[0], start) <= dist(drawn[0], end);
  const score = coverage * (0.5 + 0.5 * accuracy) * (rightWay ? 1 : 0.25);
  return { grade: gradeOf(score, def), score, coverage, accuracy, rightWay, inTime };
}

export function gradeOf(score: number, def: SlashTraceDefinition): SlashGrade {
  return score >= def.gradeAt.PERFECT ? 'PERFECT' : score >= def.gradeAt.GOOD ? 'GOOD' : score >= def.gradeAt.OK ? 'OK' : 'MISS';
}

/** damage multipliers of the trails (what the engine receives) */
export const strokeMultipliers = (grades: SlashGrade[], def: SlashTraceDefinition): number[] => grades.map(g => def.gradeMultiplier[g]);

// ---------------------------------------------------------------- geometry
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const minDist = (p: Pt, pts: Pt[]) => pts.reduce((m, q) => Math.min(m, dist(p, q)), Infinity);
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const l2 = vx * vx + vy * vy;
  const t = l2 ? clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / l2, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}
function distToPolyline(p: Pt, line: Pt[]): number {
  let m = Infinity;
  for (let i = 1; i < line.length; i++) m = Math.min(m, distToSegment(p, line[i - 1], line[i]));
  return m;
}
/** extra points along the drawn path so fast swipes (few pointer events) still cover the trail */
function densify(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

// ---------------------------------------------------------------- finisher (shadow figure cut to pieces)
export interface FinisherCut {
  grade: SlashGrade;
  /** degrees, 0 = horizontal */
  angle: number;
  /** sideways offset from the figure's centre (figure units: 100 × 200 box) */
  offset: number;
  /** seconds after the finisher starts */
  at: number;
}
export interface FinisherPlan {
  cuts: FinisherCut[];
  /** the last big cut (gold) — the figure splits along it right after */
  finalAt: number;
  finalAngle: number;
  /** total length; damage lands after this */
  duration: number;
}

/** rapid cuts per trail grade: a clean trail = a flurry, a missed one = a single weak (red) cut */
export const FINISHER_CUTS: Record<SlashGrade, number> = { PERFECT: 3, GOOD: 2, OK: 1, MISS: 1 };
export const FINISHER_START = 0.3;
export const FINISHER_GAP = 0.085;
export const FINISHER_SPLIT = 0.75;

/** the finisher's cut schedule from the trail grades (deterministic for a given rng) */
export function finisherPlan(grades: SlashGrade[], rng: () => number): FinisherPlan {
  const cuts: FinisherCut[] = [];
  let t = FINISHER_START;
  let side = 1;
  for (const g of grades) {
    for (let k = 0; k < FINISHER_CUTS[g]; k++) {
      side = -side;
      // alternate steep / shallow crossing cuts so the flurry reads as many directions
      const base = side > 0 ? -35 : 35;
      cuts.push({ grade: g, angle: base + (rng() - 0.5) * 40 + (k % 2 ? 90 : 0), offset: (rng() - 0.5) * 50, at: t });
      t += FINISHER_GAP;
    }
  }
  const finalAt = t + 0.12;
  return { cuts, finalAt, finalAngle: -18 + (rng() - 0.5) * 10, duration: finalAt + FINISHER_SPLIT };
}
