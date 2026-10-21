import { FX, SHEETS, SkillKind } from '../../core/data/sprites';
import { SemanticEvent } from '../../core/models/monster';

interface Host {
  spawn(name: string, source: number, loop: boolean): number;
  remove(ids: number[]): void;
}

/** Semantic movement lifetime owns attached FX. One-shot frames finish early; every layer stops on arrival. */
export class MotionFxPlayback {
  private owned = new Map<number, number[]>();
  constructor(private readonly host: Host) {}

  handle(source: number, sprite: string | undefined, kind: SkillKind | undefined, event: SemanticEvent): void {
    if (event === 'DASH_END') { this.stop(source); return; }
    if (event !== 'DASH_START' || !kind || this.owned.has(source)) return;
    const definition = sprite ? SHEETS[sprite]?.motionFx?.[kind] : undefined;
    if (!definition) return;
    const ids: number[] = [];
    if (definition.start && FX[definition.start]) ids.push(this.host.spawn(definition.start, source, false));
    if (FX[definition.loop]) ids.push(this.host.spawn(definition.loop, source, true));
    this.owned.set(source, ids);
  }

  stop(source: number): void {
    const ids = this.owned.get(source);
    if (!ids) return;
    this.owned.delete(source);
    this.host.remove(ids);
  }

  clear(): void { for (const source of this.owned.keys()) this.stop(source); }
}
