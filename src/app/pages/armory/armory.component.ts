import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { IconComponent } from '../../shared/icon.component';
import { AFFIXES, FLAT_STATS, RARITY_NAME, SLOTS, STAT_LABEL } from '../../core/data/equipment';
import { EquipmentInstance, EquipmentSlot, StatLine } from '../../core/models/equipment';
import { canEquip, heroGearTotals, itemLines, itemName, slotOf, upgradeCap } from '../../core/rules/equipment';
import { EquipmentService } from '../../core/services/equipment.service';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';

const ERR: Record<string, string> = {
  LOCKED: 'ล็อกอยู่', EQUIPPED: 'ถอดก่อน', WRONG_CLASS: 'สายนี้ใช้อาวุธนี้ไม่ได้', MAX_LEVEL: 'ตีบวกเต็มแล้ว', NEED_ORE: 'Ore ไม่พอ',
  NEED_GOLD: 'ทองไม่พอ', NEED_FRAGMENTS: 'เศษไม่พอ', NO_RECIPE: 'ไม่มีสูตร', BAD_MAIN: 'ค่าหลักไม่ตรงฐาน', NOT_FOUND: 'ไม่พบ',
};

/** Equipment: hero gear (3 slots), bag with comparison, equip / unequip / lock / sell — crafting, enhancement and salvage live in the forge */
@Component({
  selector: 'app-armory',
  imports: [HeroPortraitComponent, IconComponent, RouterLink],
  templateUrl: './armory.component.html',
  styleUrl: './armory.component.scss',
})
export class ArmoryComponent {
  private readonly save = inject(SaveService);
  readonly roster = inject(RosterService);
  readonly eq = inject(EquipmentService);
  readonly slots = SLOTS;
  readonly rarityName = RARITY_NAME;
  /** ?hero=uid (from the hero page) or the first hero */
  readonly heroUid = signal<number>(this.initialHero());
  private initialHero(): number {
    const q = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('hero'));
    const heroes = this.save.state().heroes;
    return heroes.some(h => h.uid === q) ? q : heroes[0]?.uid ?? 0;
  }
  readonly filter = signal<EquipmentSlot | 'ALL'>('ALL');
  readonly message = signal('');
  readonly hero = computed(() => this.save.state().heroes.find(h => h.uid === this.heroUid()) ?? null);
  readonly cls = computed(() => { const h = this.hero(); return h ? this.roster.template(h).cls : null; });
  readonly stats = computed(() => { const h = this.hero(); return h ? this.roster.stats(h) : null; });
  readonly totals = computed(() => { const h = this.hero(); return h ? heroGearTotals(h) : null; });
  readonly bag = computed(() => this.eq.bag().filter(i => this.filter() === 'ALL' || slotOf(i) === this.filter()));
  readonly gold = computed(() => this.save.state().gold);

  readonly name = itemName;
  readonly cap = upgradeCap;
  readonly affixName = (id?: string) => (id ? AFFIXES[id].name + ' — ' + AFFIXES[id].description : '');
  readonly lines = (i: EquipmentInstance) => itemLines(i).slice(0, 1 + i.secondaries.length);
  readonly fmt = (l: StatLine) => `${STAT_LABEL[l.stat]} ${l.value >= 0 ? '+' : ''}${FLAT_STATS.includes(l.stat) ? l.value : (l.value * 100).toFixed(1) + ' %'}`;
  readonly usable = (i: EquipmentInstance) => { const c = this.cls(); return !!c && canEquip(c, i); };
  readonly slotLabel: Record<EquipmentSlot | 'ALL', string> = { ALL: 'ทั้งหมด', WEAPON: 'อาวุธ', ARMOR: 'เกราะ', ACCESSORY: 'เครื่องประดับ' };
  readonly slotIcon: Record<EquipmentSlot, string> = { WEAPON: 'sword', ARMOR: 'shield', ACCESSORY: 'gem' };
  readonly filters: (EquipmentSlot | 'ALL')[] = ['ALL', 'WEAPON', 'ARMOR', 'ACCESSORY'];

  compare(i: EquipmentInstance) {
    return this.eq.compare(this.heroUid(), i).map(d => this.fmt({ stat: d.stat, value: d.delta }));
  }

  private say(err: string | null, ok: string) { this.message.set(err ? ERR[err] ?? err : ok); }
  equip(i: EquipmentInstance) { this.say(this.eq.equip(this.heroUid(), i.instanceId), `สวม ${itemName(i)}`); }
  unequip(slot: EquipmentSlot) { this.eq.unequip(this.heroUid(), slot); }
  toggleLock(i: EquipmentInstance) { this.eq.lock(i.instanceId, !i.locked); }
  sell(i: EquipmentInstance) { this.say(this.eq.sell(i.instanceId), `ขาย ${itemName(i)}`); }
}
