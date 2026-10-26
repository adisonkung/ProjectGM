import { FieldDefinition, StatusModifiers } from '../../core/models/combat';
import { Cell, Side } from '../../core/models/unit';
import { resolveArea } from './area';
import { ENEMY_ZONE_START, LANES, SIDE_DEPTH } from './grid';

/** Shared by activation and AI; the even-width area uses the left-middle column as its anchor. */
export function fieldAnchor(side: Side, field: FieldDefinition, target: Cell): Cell {
  return field.anchor === 'HOME_ZONE'
    ? { r: Math.floor(LANES / 2), c: Math.floor((SIDE_DEPTH - 1) / 2) + (side === 'ally' ? 0 : ENEMY_ZONE_START) }
    : { ...target };
}

export type FieldEndReason = 'EXPIRED' | 'SOURCE_DIED' | 'CLEARED';
interface FieldEventBase { fieldId: number; src: number; at: Cell; area: FieldDefinition['area']; duration: number; interval?: number }
export type FieldLifecycleEvent = FieldEventBase &
  ({ type: 'FIELD_STARTED' } | { type: 'FIELD_PULSED'; index: number } | { type: 'FIELD_ENDED'; reason: FieldEndReason });

export interface RuntimeField {
  readonly id: number;
  readonly sourceId: number;
  readonly center: Cell;
  readonly definition: FieldDefinition;
  remaining: number;
}

interface FieldState extends RuntimeField {
  sourceSide: Side;
  elapsed: number;
  nextPulse: number;
  pulse: () => void;
  sourceAlive: () => boolean;
}

/** Fixed combat zones. No art, wall-clock timers, target tracking or hero-specific rules. */
export class FieldSystem {
  private seq = 0;
  private fields: FieldState[] = [];

  constructor(
    private readonly changed: (f: RuntimeField, state: 'start' | 'end', reason?: FieldEndReason) => void = () => undefined,
    private readonly pulsed: (f: RuntimeField, index: number) => void = () => undefined,
  ) {}

  get active(): readonly RuntimeField[] { return this.fields; }

  add(sourceId: number, center: Cell, definition: FieldDefinition, pulse: () => void, sourceAlive: () => boolean, sourceSide: Side = 'ally'): void {
    if (!Number.isFinite(definition.duration) || !Number.isFinite(definition.interval) ||
      definition.duration <= 0 || definition.interval <= 0) throw new Error('Invalid field duration / interval');
    const f: FieldState = {
      id: ++this.seq, sourceId, center: { ...center }, definition, remaining: definition.duration,
      sourceSide, elapsed: 0, nextPulse: definition.interval, pulse, sourceAlive,
    };
    this.fields.push(f);
    this.changed(f, 'start');
    // opening pulse: the field hits as it opens (pulse 0 now, then every interval) — same pulse count over its life
    if (definition.pulseOnStart && sourceAlive()) {
      f.pulse();
      this.pulsed(f, 0);
    }
  }

  /** Call only during COMBAT. First pulse is delayed; large steps and final boundary are deterministic. */
  tick(dt: number): void {
    for (const f of [...this.fields]) {
      if (!f.sourceAlive()) { this.remove(f, 'SOURCE_DIED'); continue; }
      f.elapsed = Math.min(f.definition.duration, f.elapsed + dt);
      f.remaining = Math.max(0, f.definition.duration - f.elapsed);
      const opening = !!f.definition.pulseOnStart;
      while (f.nextPulse <= f.elapsed + 1e-9 &&
        (opening ? f.nextPulse < f.definition.duration - 1e-9 : f.nextPulse <= f.definition.duration + 1e-9)) {
        if (!f.sourceAlive() || !this.fields.includes(f)) break;
        f.pulse();
        this.pulsed(f, Math.round(f.nextPulse / f.definition.interval) - (opening ? 0 : 1));
        f.nextPulse += f.definition.interval;
      }
      if (!f.sourceAlive()) this.remove(f, 'SOURCE_DIED');
      else if (f.remaining <= 1e-9) this.remove(f, 'EXPIRED');
    }
  }

  /** Resolve on every modifier query so movement/death immediately changes protection, even within a tick. */
  modifiersAt(unit: { id: number; pos: Cell; side: Side; alive: boolean }): StatusModifiers[] {
    if (!unit.alive) return [];
    return this.fields.flatMap(f => {
      const aura = f.definition.aura;
      if (!aura || f.remaining <= 1e-9 || !f.sourceAlive() ||
        ((unit.side === f.sourceSide) !== (aura.team === 'ALLY'))) return [];
      const anchor = { id: f.sourceId, pos: f.center };
      return resolveArea({ pattern: f.definition.area, caster: anchor, primary: anchor, candidates: [unit] }).length
        ? [aura.modifiers] : [];
    });
  }

  clear(): void { for (const f of [...this.fields]) this.remove(f, 'CLEARED'); }

  private remove(f: FieldState, reason: FieldEndReason): void {
    if (!this.fields.includes(f)) return;
    this.fields = this.fields.filter(x => x !== f);
    this.changed(f, 'end', reason);
  }
}
