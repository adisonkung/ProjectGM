import { inject, Injectable } from '@angular/core';
import { pull, PullResult } from '../rules/stars';
import { SaveService } from './save.service';

/** summoning (base rarity 1★–3★): new heroes join the roster, duplicates become Hero Memory */
@Injectable({ providedIn: 'root' })
export class GachaService {
  private readonly save = inject(SaveService);

  /** null = not enough gems */
  summon(n: 1 | 10, rng: () => number = Math.random): PullResult[] | null {
    const r = pull(this.save.state(), n, rng);
    if (!r) return null;
    this.save.update(() => r.state);
    return r.results;
  }
}
