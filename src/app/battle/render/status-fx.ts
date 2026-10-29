import { FX, SHEETS } from '../../core/data/sprites';
import { Cell } from '../../core/models/unit';
import { fxLength } from './fx-clip';

export interface StatusFxInstance {
  target: number;
  source: number;
  status: string;
  sprite?: string;
  at: Cell;
}
interface Host {
  spawn(name: string, target: number, at: Cell, loop: boolean, sprite?: string): number;
  remove(ids: number[]): void;
}

/** Visual ownership follows actual statuses. Refresh extends the loop; expiry/cleanse/death removes it. */
export class StatusFxPlayback {
  private active = new Map<string, { ids: number[]; start?: number; startEnd: number }>();
  constructor(private readonly host: Host) {}

  sync(instances: StatusFxInstance[], clock: number): void {
    const live = new Set<string>();
    for (const instance of instances) {
      const def = SHEETS[instance.sprite ?? '']?.statusFx?.[instance.status];
      if (!def || !FX[def.loop]) continue;
      const key = `${instance.target}:${instance.source}:${instance.status}`;
      live.add(key);
      let state = this.active.get(key);
      if (!state) {
        const start = def.start && FX[def.start] ? this.host.spawn(def.start, instance.target, instance.at, false, instance.sprite) : undefined;
        const loop = this.host.spawn(def.loop, instance.target, instance.at, true, instance.sprite);
        state = { ids: start == null ? [loop] : [start, loop], start,
          startEnd: clock + (def.start && FX[def.start] ? fxLength(FX[def.start]) : 0) };
        this.active.set(key, state);
      }
      if (state.start != null && clock >= state.startEnd - 1e-9) {
        this.host.remove([state.start]);
        state.ids = state.ids.filter(id => id !== state!.start);
        state.start = undefined;
      }
    }
    for (const [key, state] of this.active) if (!live.has(key)) {
      this.host.remove(state.ids);
      this.active.delete(key);
    }
  }

  clear(): void {
    for (const state of this.active.values()) this.host.remove(state.ids);
    this.active.clear();
  }
}
