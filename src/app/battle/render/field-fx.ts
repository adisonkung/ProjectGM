import { FX, SHEETS } from '../../core/data/sprites';
import { Cell } from '../../core/models/unit';
import { rect3x2Center, rect6x3Center } from '../engine/area';
import { FieldLifecycleEvent } from '../engine/fields';
import { fxLength } from './fx-clip';

interface Host {
  spawn(name: string, world: Cell, loop: boolean): number;
  remove(ids: number[]): void;
}
interface OwnedFx { world: Cell; expires: number; fieldId?: number }
interface FieldView {
  sprite: string; world: Cell; ids: number[]; started: number; interval: number; duration: number;
  loopAt?: number;
  nextRain: number; pulses: Set<number>; area: FieldLifecycleEvent['area'];
}

/** Generic field presentation. Combat events own impacts/lifetimes; the same clock leads each rain visual. */
export class FieldFxPlayback {
  private fields = new Map<number, FieldView>();
  private owned = new Map<number, OwnedFx>();

  constructor(private readonly host: Host) {}

  private spawn(name: string | undefined, world: Cell, loop: boolean, clock: number, fieldId?: number): number | undefined {
    if (!name || !FX[name]) return undefined;
    const id = this.host.spawn(name, world, loop);
    this.owned.set(id, { world: { ...world }, expires: loop ? Infinity : clock + fxLength(FX[name]), fieldId });
    return id;
  }

  handle(e: FieldLifecycleEvent, sprite: string | undefined, origin: number, clock: number): void {
    if (e.type === 'FIELD_STARTED') {
      if (this.fields.has(e.fieldId) || !sprite) return;
      const def = SHEETS[sprite]?.fieldFx;
      if (!def) return;
      const center = e.area === 'RECT_3X2' ? rect3x2Center(e.at) : e.area === 'RECT_6X3' ? rect6x3Center(e.at) : e.at;
      const world = { r: center.r, c: origin + center.c };
      const loopAt = def.loopAfterStart && def.start && FX[def.start] ? clock + fxLength(FX[def.start]) : undefined;
      const ids = [this.spawn(def.start, world, false, clock, e.fieldId),
        loopAt == null ? this.spawn(def.loop, world, true, clock, e.fieldId) : undefined]
        .filter((id): id is number => id != null);
      this.fields.set(e.fieldId, { sprite, world, ids, started: clock, interval: e.interval ?? 0,
        duration: e.duration, loopAt, nextRain: 1, pulses: new Set(), area: e.area });
    } else {
      const field = this.fields.get(e.fieldId);
      if (!field) return;
      const def = SHEETS[field.sprite]?.fieldFx;
      if (e.type === 'FIELD_PULSED') {
        if (field.pulses.has(e.index)) return;
        field.pulses.add(e.index);
        const cells = def?.wave?.impactCells && field.area === 'RECT_3X2'
          ? [-0.5, 0.5].flatMap(dr => [-1, 0, 1].map(dc => ({ r: field.world.r + dr, c: field.world.c + dc })))
          : [field.world];
        for (const cell of cells) this.spawn(def?.wave?.impact, cell, false, clock, e.fieldId);
        return;
      }
      this.fields.delete(e.fieldId);
      this.remove(e.reason === 'EXPIRED' ? field.ids
        : [...this.owned].filter(([, f]) => f.fieldId === e.fieldId).map(([id]) => id));
      if (e.reason === 'EXPIRED') {
        this.spawn(def?.end, field.world, false, clock);
        this.spawn(def?.residual, field.world, false, clock);
      }
    }
  }

  advance(clock: number): void {
    this.remove([...this.owned].filter(([, f]) => f.expires <= clock + 1e-9).map(([id]) => id));
    for (const [fieldId, f] of this.fields) {
      if (f.loopAt != null && clock >= f.loopAt - 1e-9) {
        const id = this.spawn(SHEETS[f.sprite]?.fieldFx?.loop, f.world, true, clock, fieldId);
        if (id != null) f.ids.push(id);
        f.loopAt = undefined;
      }
      const wave = SHEETS[f.sprite]?.fieldFx?.wave;
      if (!wave || f.interval <= 0) continue;
      while (f.nextRain * f.interval <= f.duration + 1e-9 &&
        f.started + f.nextRain * f.interval - wave.leadMs / 1000 <= clock + 1e-9) {
        this.spawn(wave.rain, f.world, false, clock, fieldId);
        f.nextRain++;
      }
    }
  }

  /** Reproject fixed world cells as the camera moves, including the last wave/residual after expiry. */
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
