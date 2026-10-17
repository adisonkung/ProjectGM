import { FieldDefinition } from '../../core/models/combat';
import { Cell } from '../../core/models/unit';

export interface RuntimeField {
  readonly id: number;
  readonly sourceId: number;
  readonly center: Cell;
  readonly definition: FieldDefinition;
  remaining: number;
}

interface FieldState extends RuntimeField {
  elapsed: number;
  nextPulse: number;
  pulse: () => void;
  sourceAlive: () => boolean;
}

/** Fixed combat zones. No art, wall-clock timers, target tracking or hero-specific rules. */
export class FieldSystem {
  private seq = 0;
  private fields: FieldState[] = [];

  constructor(private readonly changed: (f: RuntimeField, state: 'start' | 'end') => void = () => undefined) {}

  get active(): readonly RuntimeField[] { return this.fields; }

  add(sourceId: number, center: Cell, definition: FieldDefinition, pulse: () => void, sourceAlive: () => boolean): void {
    if (!Number.isFinite(definition.duration) || !Number.isFinite(definition.interval) ||
      definition.duration <= 0 || definition.interval <= 0) throw new Error('Invalid field duration / interval');
    const f: FieldState = {
      id: ++this.seq, sourceId, center: { ...center }, definition, remaining: definition.duration,
      elapsed: 0, nextPulse: definition.interval, pulse, sourceAlive,
    };
    this.fields.push(f);
    this.changed(f, 'start');
  }

  /** Call only during COMBAT. First pulse is delayed; large steps and final boundary are deterministic. */
  tick(dt: number): void {
    for (const f of [...this.fields]) {
      if (!f.sourceAlive()) { this.remove(f); continue; }
      f.elapsed = Math.min(f.definition.duration, f.elapsed + dt);
      f.remaining = Math.max(0, f.definition.duration - f.elapsed);
      while (f.nextPulse <= f.elapsed + 1e-9 && f.nextPulse <= f.definition.duration + 1e-9) {
        if (!f.sourceAlive() || !this.fields.includes(f)) break;
        f.pulse();
        f.nextPulse += f.definition.interval;
      }
      if (f.remaining <= 1e-9 || !f.sourceAlive()) this.remove(f);
    }
  }

  clear(): void { for (const f of [...this.fields]) this.remove(f); }

  private remove(f: FieldState): void {
    if (!this.fields.includes(f)) return;
    this.fields = this.fields.filter(x => x !== f);
    this.changed(f, 'end');
  }
}
