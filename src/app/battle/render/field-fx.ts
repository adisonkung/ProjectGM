import { FX, SHEETS } from '../../core/data/sprites';
import { Cell } from '../../core/models/unit';
import { FieldLifecycleEvent } from '../engine/fields';
import { fxLength } from './fx-clip';

interface Host {
  spawn(name: string, world: Cell, loop: boolean): number;
  remove(ids: number[]): void;
}
interface OwnedFx { world: Cell; expires: number }

/** Generic field presentation. All lifetimes use the combat clock and authoritative field events. */
export class FieldFxPlayback {
  private fields = new Map<number, { sprite: string; world: Cell; ids: number[] }>();
  private owned = new Map<number, OwnedFx>();

  constructor(private readonly host: Host) {}

  private spawn(name: string | undefined, world: Cell, loop: boolean, clock: number): number | undefined {
    if (!name || !FX[name]) return undefined;
    const id = this.host.spawn(name, world, loop);
    this.owned.set(id, { world: { ...world }, expires: loop ? Infinity : clock + fxLength(FX[name]) });
    return id;
  }

  handle(e: FieldLifecycleEvent, sprite: string | undefined, origin: number, clock: number): void {
    if (e.type === 'FIELD_STARTED') {
      if (this.fields.has(e.fieldId) || !sprite) return;
      const def = SHEETS[sprite]?.fieldFx;
      if (!def) return;
      const world = { r: e.at.r, c: origin + e.at.c };
      const ids = [this.spawn(def.start, world, false, clock), this.spawn(def.loop, world, true, clock)]
        .filter((id): id is number => id != null);
      this.fields.set(e.fieldId, { sprite, world, ids });
    } else {
      const field = this.fields.get(e.fieldId);
      if (!field) return;
      this.fields.delete(e.fieldId);
      this.remove(field.ids);
      if (e.reason === 'EXPIRED') {
        const def = SHEETS[field.sprite]?.fieldFx;
        this.spawn(def?.end, field.world, false, clock);
        this.spawn(def?.residual, field.world, false, clock);
      }
    }
  }

  advance(clock: number): void {
    this.remove([...this.owned].filter(([, f]) => f.expires <= clock + 1e-9).map(([id]) => id));
  }

  /** Reproject the fixed world cell as the camera moves, including post-field shatter/residual visuals. */
  positions(camera: number): Map<number, Cell> {
    return new Map([...this.owned].map(([id, f]) => [id, { r: f.world.r, c: f.world.c - camera }]));
  }

  clear(): void {
    this.fields.clear();
    this.remove([...this.owned.keys()]);
  }

  private remove(ids: number[]): void {
    const present = ids.filter(id => this.owned.has(id));
    for (const id of present) this.owned.delete(id);
    if (present.length) this.host.remove(present);
  }
}
