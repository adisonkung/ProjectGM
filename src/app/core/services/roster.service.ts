import { computed, inject, Injectable } from '@angular/core';
import { HERO_BY_ID } from '../data/heroes';
import { OwnedHero } from '../models/hero';
import { heroStats, levelUpCost, maxLevel, power } from '../rules/stats';
import { SaveService } from './save.service';

@Injectable({ providedIn: 'root' })
export class RosterService {
  private readonly save = inject(SaveService);

  readonly heroes = computed(() => this.save.state().heroes);

  template(h: OwnedHero) {
    return HERO_BY_ID[h.templateId];
  }

  stats(h: OwnedHero) {
    return heroStats(this.template(h), h);
  }

  power(h: OwnedHero) {
    return power(this.stats(h));
  }

  levelUp(uid: number): boolean {
    const s = this.save.state();
    const h = s.heroes.find(x => x.uid === uid);
    if (!h || h.level >= maxLevel(this.template(h))) return false;
    const cost = levelUpCost(h);
    if (s.gold < cost) return false;
    this.save.update(st => ({
      ...st,
      gold: st.gold - cost,
      heroes: st.heroes.map(x => (x.uid === uid ? { ...x, level: x.level + 1 } : x)),
    }));
    return true;
  }

  /** หลังจบการต่อสู้: ลดรอบพักของตัวที่บาดเจ็บ แล้วตั้งบาดเจ็บให้ตัวที่ล้ม */
  applyInjuries(fallen: number[], rest = 2): void {
    this.save.update(st => ({
      ...st,
      heroes: st.heroes.map(h => {
        const injury = Math.max(0, h.injury - 1);
        return { ...h, injury: fallen.includes(h.uid) ? rest : injury };
      }),
    }));
  }
}
