import { inject, Injectable } from '@angular/core';
import { pull, PullResult } from '../rules/stars';
import { DEV_FLAGS } from '../data/dev-flags';
import { SaveService } from './save.service';
import { SUMMON_SEALS, SUMMON_SEAL_COST } from '../data/summon-seals';

/** summoning (base rarity 1★–3★): new heroes join the roster, duplicates become Hero Memory */
@Injectable({ providedIn: 'root' })
export class GachaService {
  private readonly save = inject(SaveService);

  get freeSummons(): boolean { return DEV_FLAGS.freeSummons; }

  /** null = not enough standard summon seals when the temporary free-summon switch is disabled */
  summon(n: 1 | 10, rng: () => number = Math.random): PullResult[] | null {
    const r = pull(this.save.state(), n, rng, { free: this.freeSummons,
      itemCost: { itemId: SUMMON_SEALS.standard.id, count: n === 10 ? SUMMON_SEAL_COST.multi : SUMMON_SEAL_COST.single } });
    if (!r) return null;
    this.save.update(() => r.state);
    return r.results;
  }
}
