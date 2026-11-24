import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DEV_FLAGS } from '../../core/data/dev-flags';
import { BAG_TABS, BagCategory, BagSlot, bagSlots, seedBag } from '../../core/rules/bag';
import { EquipmentService } from '../../core/services/equipment.service';
import { SaveService } from '../../core/services/save.service';
import { EquipmentArtComponent } from '../../shared/equipment-art.component';
import { DungeonRewardIconComponent } from '../dungeons/dungeon-reward-icon.component';
import { LineIconComponent } from './line-icon.component';

/** Home bag (user 2026-11-24): tabs อุปกรณ์ / วัตถุดิบ / อัญเชิญ, 999 per slot, tap → detail with Use / Sell. */
@Component({
  selector: 'app-home-bag',
  imports: [A11yModule, LineIconComponent, EquipmentArtComponent, DungeonRewardIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-bag.component.html',
  styleUrl: './home-bag.component.scss',
})
export class HomeBagComponent {
  private readonly save = inject(SaveService);
  private readonly gear = inject(EquipmentService);
  private readonly router = inject(Router);
  readonly closed = output<void>();

  readonly tabs = BAG_TABS;
  readonly devSeed = DEV_FLAGS.bagTestSeed;
  readonly tab = signal<BagCategory>('equipment');
  readonly slots = computed(() => bagSlots(this.save.state()));
  readonly counts = computed(() => {
    const c: Record<BagCategory, number> = { equipment: 0, materials: 0, summon: 0 };
    for (const s of this.slots()) c[s.category]++;
    return c;
  });
  readonly shown = computed(() => this.slots().filter(s => s.category === this.tab()));
  private readonly selectedKey = signal<string | null>(null);
  /** selection follows the same key; falls back to the first slot of the tab (e.g. after a sale) */
  readonly selected = computed(() => {
    const list = this.shown();
    return list.find(s => s.key === this.selectedKey()) ?? list[0] ?? null;
  });
  readonly message = signal<string | null>(null);

  pickTab(t: BagCategory): void { this.tab.set(t); this.selectedKey.set(null); this.message.set(null); }
  pick(s: BagSlot): void { this.selectedKey.set(s.key); this.message.set(null); }

  tabKey(event: KeyboardEvent): void {
    const i = this.tabs.findIndex(t => t.id === this.tab());
    const d = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    event.preventDefault();
    const n = (i + d + this.tabs.length) % this.tabs.length;
    this.pickTab(this.tabs[n].id);
    (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')[n]?.focus();
  }

  /** ใช้: open the page where the item is spent */
  use(s: BagSlot): void {
    let url: string;
    if ('route' in s.use) url = s.use.route;
    else {
      const st = this.save.state();
      const memoryHero = s.type === 'memory' ? st.heroes.find(h => h.templateId === s.id)?.uid : undefined;
      const uid = memoryHero ?? st.team[0]?.uid ?? st.heroes[0]?.uid;
      url = uid === undefined ? '/heroes' : `/heroes/${uid}?tab=${s.use.heroTab}`;
    }
    this.closed.emit();
    void this.router.navigateByUrl(url);
  }

  /** ขาย: equipment only (existing EquipmentService rule); other items have no sell price yet */
  sell(s: BagSlot): void {
    if (s.sellGold === null || !s.instance) return;
    const err = this.gear.sell(s.instance.instanceId);
    this.message.set(err ? `ขายไม่ได้ (${err})` : `ขาย ${s.name} ได้ ${s.sellGold} ทอง`);
  }

  seed(): void {
    this.save.update(seedBag);
    this.message.set('เติมของทดสอบแล้ว: ไอเท็มทุกชนิด +1 · อุปกรณ์ 1 ชิ้นต่อแบบ');
  }
}
