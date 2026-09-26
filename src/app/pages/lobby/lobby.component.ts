import { Component, computed, inject } from '@angular/core';
import { EXP_POTIONS, ITEMS, TRAINING_SLOTS } from '../../core/data/economy';
import { OwnedHero } from '../../core/models/hero';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';

/** Heroes: level, EXP, cap, breakthrough, EXP potions (Use 1 / 10 / Max), Training Slots */
@Component({
  selector: 'app-lobby',
  imports: [],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
})
export class LobbyComponent {
  private readonly save = inject(SaveService);
  readonly roster = inject(RosterService);
  readonly potions = EXP_POTIONS;
  readonly slotsMax = TRAINING_SLOTS.count;
  readonly slotShare = TRAINING_SLOTS.expShare;
  readonly inventory = computed(() => this.save.state().inventory);
  readonly slots = computed(() => this.save.state().trainingSlots);
  readonly inTeam = computed(() => new Set(this.save.state().team.map(t => t.uid)));
  readonly items = computed(() => Object.entries(this.inventory()).filter(([, n]) => n > 0).map(([id, n]) => ({ id, name: ITEMS[id]?.name ?? id, n })));
  readonly message: Record<number, string> = {};
  readonly itemName = (id: string) => ITEMS[id]?.name ?? id;
  readonly Math = Math;

  rows = computed(() => this.roster.heroes().map(h => ({ h, t: this.roster.template(h), s: this.roster.stats(h), p: this.roster.progress(h) })));

  use(h: OwnedHero, id: string, n: number | 'max'): void {
    this.roster.usePotion(h.uid, id, n);
  }

  useMax(h: OwnedHero): void {
    this.roster.usePotionsToCap(h.uid);
  }

  breakthrough(h: OwnedHero): void {
    const err = this.roster.breakthrough(h.uid);
    this.message[h.uid] = err === 'NEED_ITEMS' ? 'หินไม่พอ' : err === 'NEED_EXP' ? 'EXP ยังไม่ครบ' : err ? '' : 'Breakthrough สำเร็จ!';
  }

  toggleSlot(h: OwnedHero): void {
    this.roster.toggleTrainingSlot(h.uid);
  }
}
