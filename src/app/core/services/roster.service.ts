import { computed, inject, Injectable } from '@angular/core';
import { HERO_BY_ID } from '../data/heroes';
import { OwnedHero } from '../models/hero';
import { heroStats, power } from '../rules/stats';
import { breakthrough, BreakthroughFail, heroProgressView, useAllPotionsToCap, useExpPotion } from '../rules/leveling';
import { TRAINING_SLOTS } from '../data/economy';
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

  /** EXP potion use (never automatic): Use 1 / Use 10 / 'max' = just enough to reach the current cap */
  usePotion(uid: number, itemId: string, count: number | 'max'): number {
    const s = this.save.state();
    const h = s.heroes.find(x => x.uid === uid);
    if (!h) return 0;
    const r = useExpPotion(h, s.inventory, itemId, count);
    if (r.used) this.save.update(st => ({ ...st, inventory: r.inventory, heroes: st.heroes.map(x => (x.uid === uid ? r.hero : x)) }));
    return r.used;
  }

  /** Use Max with every potion size (largest first), stopping at the current cap */
  usePotionsToCap(uid: number): void {
    const s = this.save.state();
    const h = s.heroes.find(x => x.uid === uid);
    if (!h) return;
    const r = useAllPotionsToCap(h, s.inventory);
    this.save.update(st => ({ ...st, inventory: r.inventory, heroes: st.heroes.map(x => (x.uid === uid ? r.hero : x)) }));
  }

  /** consume the breakthrough stones, raise the level and process the stored EXP */
  breakthrough(uid: number): BreakthroughFail | null {
    const s = this.save.state();
    const h = s.heroes.find(x => x.uid === uid);
    if (!h) return 'MAX';
    const r = breakthrough(h, s.inventory);
    if ('error' in r) return r.error;
    this.save.update(st => ({ ...st, inventory: r.inventory, heroes: st.heroes.map(x => (x.uid === uid ? r.hero : x)) }));
    return null;
  }

  progress(h: OwnedHero) {
    return heroProgressView(h, this.save.state().inventory);
  }

  /** reserve heroes in Training Slots get 35 % of Training battle EXP */
  toggleTrainingSlot(uid: number): boolean {
    const s = this.save.state();
    const on = s.trainingSlots.includes(uid);
    if (!on && s.trainingSlots.length >= TRAINING_SLOTS.count) return false;
    this.save.update(st => ({ ...st, trainingSlots: on ? st.trainingSlots.filter(x => x !== uid) : [...st.trainingSlots, uid] }));
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
