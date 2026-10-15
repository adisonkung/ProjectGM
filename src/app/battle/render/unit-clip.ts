import { AnimDef, ANIM_FALLBACK, FRAME_MS, IDLE_FRAME_MS, SheetDef, SpriteAnim } from '../../core/data/sprites';

/**
 * The character animation of one unit as a pure function of ONE clock — the same rules the DOM `app-unit-sprite`
 * applies with a Web Animation per clip (idle loop, movement-driven walk loop, action clips with `seq`/`steps`,
 * monster cast stretch, die hold, root motion, runtime opacity, fall-back to walk / idle when a clip ends), but
 * nothing plays by itself: every display frame asks "which frame at game time t?". Pause, hit-stop and the battle
 * speed are therefore just how the clock advances (renderers: `render/pixi-units.ts`).
 *
 * Times: `now` = board game clock (s, advances × battle speed, frozen while paused / hit-stop) · `idleNow` = real
 * seconds (frozen likewise) — the idle breath never speeds up with x2 / x4 (IDLE_FRAME_MS rule).
 */

/** clips that never interrupt an action (walk / hurt do not cut an attack or a skill) */
const LOW: SpriteAnim[] = ['idle', 'walk', 'hurt'];

export interface ClipRequest {
  anim: SpriteAnim;
  castTime?: number;
  castClip?: string;
  force?: boolean;
}

export interface ClipPose {
  /** sheet cell */
  row: number;
  col: number;
  /** AnimDef.root (atlas px, dx forward along the facing, dy down) */
  dx: number;
  dy: number;
  /** AnimDef.opacity (1 = none) */
  opacity: number;
}

/** step position (fractions ok) → seconds from the clip start (AnimDef.root / opacity keys) */
function stepClock(steps: number[]): { at: (i: number) => number; total: number } {
  const starts = [0];
  for (const ms of steps) starts.push(starts[starts.length - 1] + ms / 1000);
  const total = starts[starts.length - 1];
  const at = (i: number) => {
    const k = Math.min(Math.max(Math.floor(i), 0), steps.length);
    return Math.min(total, starts[k] + (k < steps.length ? ((i - k) * steps[k]) / 1000 : 0));
  };
  return { at, total };
}

/** piecewise-linear keys [t, v...] sampled at t (held before the first / after the last key) */
function sample(keys: { t: number; v: number[] }[], t: number): number[] {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1];
      const b = keys[i];
      const k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return a.v.map((x, j) => x + (b.v[j] - x) * k);
    }
  }
  return keys[keys.length - 1].v;
}

/** an action clip's timeline: frame at t (s), its length, and the runtime root / opacity curves */
export interface ClipTimeline {
  def: AnimDef;
  duration: number;
  /** stays on its last frame (die) */
  hold: boolean;
  frameAt(t: number): number;
  rootAt(t: number): [number, number];
  opacityAt(t: number): number;
}

export function clipTimeline(a: AnimDef, name: SpriteAnim, req: ClipRequest): ClipTimeline {
  const hold = name === 'die';
  const ms = (a.ms ?? FRAME_MS) / 1000;
  let frameAt: (t: number) => number;
  let duration: number;
  let root: (t: number) => [number, number] = () => [0, 0];
  let opacity: (t: number) => number = () => 1;
  if (name === 'cast' && a.castStart != null && a.activate != null) {
    // monster cast: CAST_START shows at once, frames up to SKILL_ACTIVATE stretch over the cast time, then recover
    const span = a.activate - a.castStart;
    const cast = req.castTime ?? span * ms;
    const per = span > 0 ? cast / span : 0;
    const starts: { f: number; t: number }[] = [];
    let t = 0;
    for (let f = a.castStart; f < a.frames; f++) {
      starts.push({ f, t });
      t += f < a.activate ? per : ms;
    }
    duration = t;
    frameAt = s => {
      let f = starts[0].f;
      for (const k of starts) if (s >= k.t) f = k.f;
      return f;
    };
  } else if (a.seq && a.steps) {
    const seq = a.seq;
    const { at, total } = stepClock(a.steps);
    duration = total;
    frameAt = s => {
      for (let i = seq.length - 1; i >= 0; i--) if (s >= at(i)) return seq[i];
      return seq[0];
    };
    if (a.root?.length) {
      const keys = a.root.map(([i, dx, dy]) => ({ t: at(i), v: [dx, dy] })).sort((p, q) => p.t - q.t);
      root = s => sample(keys, s) as [number, number];
    }
    if (a.opacity?.length) {
      const keys = a.opacity.map(([i, o]) => ({ t: at(i), v: [o] })).sort((p, q) => p.t - q.t);
      opacity = s => sample(keys, s)[0];
    }
  } else {
    duration = a.frames * ms;
    frameAt = s => Math.min(a.frames - 1, Math.max(0, Math.floor(s / ms)));
  }
  return { def: a, duration, hold, frameAt, rootAt: root, opacityAt: opacity };
}

/**
 * One unit's clip state machine (mirrors UnitSpriteComponent.play / rest / the moving effect).
 * `moving` undefined = no movement driver (sprite lab): the walk clip plays once like any other clip.
 */
export class UnitClip {
  name: SpriteAnim = 'idle';
  private start = 0;
  private timeline?: ClipTimeline;
  /** walk loop phase (cycles) — integrated with the ground speed, so a pace change never jumps the legs */
  private walkPhase = 0;
  private lastNow = 0;
  private lastKey = -1;
  /** idle breath offset (each unit out of step with the others) */
  private readonly idlePhase: number;

  constructor(readonly def: SheetDef, idlePhase = Math.random()) {
    this.idlePhase = idlePhase;
  }

  private resolve(want: SpriteAnim): SpriteAnim | null {
    let name: SpriteAnim | null = want;
    while (name && !this.def.anims[name]) name = ANIM_FALLBACK[name];
    return name;
  }

  /** an action clip is still running (idle / walk loops count as running, like an infinite Web Animation) */
  private busy(now: number): boolean {
    if (this.name === 'idle' || (this.name === 'walk' && !this.timeline)) return true;
    return !!this.timeline && (this.timeline.hold || now - this.start < this.timeline.duration);
  }

  /** a new clip request from the battle (AnimState key changed) */
  request(req: ClipRequest, key: number, now: number, moving: boolean | undefined): void {
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.play(req.anim, now, moving, req);
  }

  play(want: SpriteAnim, now: number, moving: boolean | undefined, req: ClipRequest = { anim: want }): void {
    const name = this.resolve(want);
    if (!name) return;
    const busy = this.busy(now);
    if (name === 'walk' && moving !== undefined) {
      if (!moving || (this.name === 'walk' && busy)) return;
    }
    if (!req.force && LOW.includes(name) && name !== 'idle' && busy && !LOW.includes(this.name)) return;
    if (this.name === 'die' && name !== 'die' && name !== 'idle') return;
    const a = (name === 'cast' && this.def.casts?.[req.castClip ?? '']) || this.def.anims[name]!;
    this.name = name;
    this.start = now;
    const walkLoop = name === 'walk' && moving !== undefined;
    this.timeline = name === 'idle' || walkLoop ? undefined : clipTimeline(a, name, req);
    if (walkLoop) this.walkPhase = 0;
  }

  /**
   * The pose at this display frame. `pace` = measured ground speed (cells / game s) — the walk loop runs at
   * pace / AnimDef.pace (0.55–1.7). Ends a finished action clip → walk / idle.
   */
  pose(now: number, idleNow: number, moving: boolean | undefined, pace?: number): ClipPose {
    // the moving driver starts / stops the walk loop (UnitSpriteComponent's `moving` effect)
    if (moving !== undefined) {
      if (moving && this.name === 'idle') this.play('walk', now, moving);
      else if (!moving && this.name === 'walk' && !this.timeline) this.play('idle', now, moving);
    }
    // a finished action clip falls back to what the unit is doing now
    if (this.timeline && !this.timeline.hold && now - this.start >= this.timeline.duration) {
      this.timeline = undefined;
      this.name = 'idle';
      this.play(moving ? 'walk' : 'idle', now, moving);
    }
    const dt = Math.max(0, now - this.lastNow);
    this.lastNow = now;
    const name = this.name;
    const a = this.def.anims[name]!;
    if (name === 'idle') {
      const order = a.seq ?? Array.from({ length: a.frames }, (_, i) => i);
      const cycle = (order.length * (a.ms ?? IDLE_FRAME_MS)) / 1000;
      const i = Math.floor((((idleNow / cycle + this.idlePhase) % 1) + 1) % 1 * order.length);
      return { row: a.row, col: order[Math.min(i, order.length - 1)], dx: 0, dy: 0, opacity: 1 };
    }
    if (name === 'walk' && !this.timeline) {
      const cycle = (a.frames * (a.ms ?? FRAME_MS)) / 1000;
      const rate = a.pace != null && pace != null && pace > 0 ? Math.min(1.7, Math.max(0.55, pace / a.pace)) : 1;
      this.walkPhase = (this.walkPhase + (dt * rate) / cycle) % 1;
      return { row: a.row, col: Math.min(a.frames - 1, Math.floor(this.walkPhase * a.frames)), dx: 0, dy: 0, opacity: 1 };
    }
    const tl = this.timeline!;
    const t = Math.max(0, now - this.start);
    const [dx, dy] = tl.rootAt(t);
    return { row: tl.def.row, col: tl.frameAt(t), dx, dy, opacity: tl.opacityAt(t) };
  }
}
