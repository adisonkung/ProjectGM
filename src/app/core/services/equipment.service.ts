import { computed, inject, Injectable } from '@angular/core';
import { EquipmentInstance, EquipmentSlot, EquipStat, HuntTarget, Rarity } from '../models/equipment';
import {
  compareGear, craft, craftRandom, dismantle, dismantleMany, EquipError, equip, sell, setLocked, unequipSlot, upgrade,
} from '../rules/equipment';
import { SaveService } from './save.service';

/** Equipment actions on the saved game (every rule lives in core/rules/equipment.ts) */
@Injectable({ providedIn: 'root' })
export class EquipmentService {
  private readonly save = inject(SaveService);

  readonly bag = computed(() => this.save.state().equipment ?? []);
  readonly huntTarget = computed(() => this.save.state().huntTarget ?? 'ANY');

  private apply(r: { state: import('../models/game-state').GameState } | { error: EquipError }): EquipError | null {
    if ('error' in r) return r.error;
    this.save.update(() => r.state);
    return null;
  }

  equip(heroUid: number, id: number) { return this.apply(equip(this.save.state(), heroUid, id)); }
  unequip(heroUid: number, slot: EquipmentSlot) { this.save.update(s => unequipSlot(s, heroUid, slot)); }
  upgrade(id: number) { return this.apply(upgrade(this.save.state(), id)); }
  dismantle(id: number) { return this.apply(dismantle(this.save.state(), id)); }
  sell(id: number) { return this.apply(sell(this.save.state(), id)); }
  lock(id: number, locked: boolean) { return this.apply(setLocked(this.save.state(), id, locked)); }
  craft(rarity: Rarity, defId: string, main: EquipStat, rng = Math.random) {
    const r = craft(this.save.state(), rarity, defId, main, rng);
    return this.apply(r);
  }
  craftRandom(rarity: Rarity, slot: EquipmentSlot, rng = Math.random) { return this.apply(craftRandom(this.save.state(), rarity, slot, rng)); }
  dismantleMany(ids: readonly number[]) { return this.apply(dismantleMany(this.save.state(), ids)); }
  setHuntTarget(t: HuntTarget) { this.save.update(s => ({ ...s, huntTarget: t })); }

  compare(heroUid: number, item: EquipmentInstance) {
    const h = this.save.state().heroes.find(x => x.uid === heroUid);
    return h ? compareGear(h, item) : [];
  }
}
