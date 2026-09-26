import { Component, computed, inject, signal } from '@angular/core';
import { AFFIXES, CRAFT_RECIPES, EQUIPMENT_DEFS, FLAT_STATS, RARITY_NAME, SLOTS, STAT_LABEL, WEAPON_GROUP_OF } from '../../core/data/equipment';
import { ITEMS } from '../../core/data/economy';
import { EquipmentInstance, EquipmentSlot, EquipStat, HuntTarget, Rarity, StatLine } from '../../core/models/equipment';
import { canEquip, dismantleRewards, heroGearTotals, itemLines, itemName, slotOf, upgradeCap, upgradeCost } from '../../core/rules/equipment';
import { EquipmentService } from '../../core/services/equipment.service';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';

const ERR: Record<string, string> = {
  LOCKED: 'ล็อกอยู่', EQUIPPED: 'ถอดก่อน', WRONG_CLASS: 'สายนี้ใช้อาวุธนี้ไม่ได้', MAX_LEVEL: 'ตีบวกเต็มแล้ว', NEED_ORE: 'Ore ไม่พอ',
  NEED_GOLD: 'ทองไม่พอ', NEED_FRAGMENTS: 'เศษไม่พอ', NO_RECIPE: 'ไม่มีสูตร', BAD_MAIN: 'ค่าหลักไม่ตรงฐาน', NOT_FOUND: 'ไม่พบ',
};

/** Armory: hero gear (3 slots), bag with comparison, upgrade / lock / dismantle / sell, targeted crafting, Hunt target */
@Component({
  selector: 'app-armory',
  imports: [],
  templateUrl: './armory.component.html',
  styleUrl: './armory.component.scss',
})
export class ArmoryComponent {
  private readonly save = inject(SaveService);
  readonly roster = inject(RosterService);
  readonly eq = inject(EquipmentService);
  readonly slots = SLOTS;
  readonly rarityName = RARITY_NAME;
  readonly heroUid = signal<number>(this.save.state().heroes[0]?.uid ?? 0);
  readonly filter = signal<EquipmentSlot | 'ALL'>('ALL');
  readonly message = signal('');
  readonly hero = computed(() => this.save.state().heroes.find(h => h.uid === this.heroUid()) ?? null);
  readonly cls = computed(() => { const h = this.hero(); return h ? this.roster.template(h).cls : null; });
  readonly stats = computed(() => { const h = this.hero(); return h ? this.roster.stats(h) : null; });
  readonly totals = computed(() => { const h = this.hero(); return h ? heroGearTotals(h) : null; });
  readonly bag = computed(() => this.eq.bag().filter(i => this.filter() === 'ALL' || slotOf(i) === this.filter()));
  readonly mats = computed(() => ['enhancement_ore', 'equip_frag_basic', 'equip_frag_rare', 'equip_frag_elite', 'equip_frag_epic']
    .map(id => ({ id, name: ITEMS[id].name, n: this.save.state().inventory[id] ?? 0 })));
  readonly gold = computed(() => this.save.state().gold);
  readonly targets: HuntTarget[] = ['ANY', 'WEAPON', 'ARMOR', 'ACCESSORY'];

  // crafting
  readonly recipes = Object.values(CRAFT_RECIPES);
  readonly craftRarity = signal<Rarity>('RARE');
  readonly craftBase = signal<string>('guard_armor');
  readonly craftMain = signal<EquipStat>('hpPct');
  readonly bases = computed(() => {
    const c = this.cls();
    return Object.values(EQUIPMENT_DEFS).filter(d => d.slot !== 'WEAPON' || !c || d.weaponGroup === WEAPON_GROUP_OF[c]);
  });
  readonly mains = computed(() => EQUIPMENT_DEFS[this.craftBase()]?.mainStats ?? []);

  readonly name = itemName;
  readonly affixName = (id?: string) => (id ? AFFIXES[id].name + ' — ' + AFFIXES[id].description : '');
  readonly cap = upgradeCap;
  readonly cost = upgradeCost;
  readonly lines = (i: EquipmentInstance) => itemLines(i).slice(0, 1 + i.secondaries.length);
  readonly fmt = (l: StatLine) => `${STAT_LABEL[l.stat]} ${l.value >= 0 ? '+' : ''}${FLAT_STATS.includes(l.stat) ? l.value : (l.value * 100).toFixed(1) + ' %'}`;
  readonly dismantleText = (i: EquipmentInstance) => dismantleRewards(i).map(r => `${ITEMS[r.itemId].name} ×${r.count}`).join(', ');
  readonly usable = (i: EquipmentInstance) => { const c = this.cls(); return !!c && canEquip(c, i); };
  readonly statLabel = (s: EquipStat) => STAT_LABEL[s];

  compare(i: EquipmentInstance) {
    return this.eq.compare(this.heroUid(), i).map(d => this.fmt({ stat: d.stat, value: d.delta }));
  }

  private say(err: string | null, ok: string) { this.message.set(err ? ERR[err] ?? err : ok); }
  equip(i: EquipmentInstance) { this.say(this.eq.equip(this.heroUid(), i.instanceId), `สวม ${itemName(i)}`); }
  unequip(slot: EquipmentSlot) { this.eq.unequip(this.heroUid(), slot); }
  upgrade(i: EquipmentInstance) { this.say(this.eq.upgrade(i.instanceId), `ตีบวก ${itemName(i)} สำเร็จ`); }
  toggleLock(i: EquipmentInstance) { this.eq.lock(i.instanceId, !i.locked); }
  dismantle(i: EquipmentInstance) { this.say(this.eq.dismantle(i.instanceId), `ย่อย ${itemName(i)}`); }
  sell(i: EquipmentInstance) { this.say(this.eq.sell(i.instanceId), `ขาย ${itemName(i)}`); }
  pickBase(id: string) { this.craftBase.set(id); this.craftMain.set(EQUIPMENT_DEFS[id].mainStats[0]); }
  craft() { this.say(this.eq.craft(this.craftRarity(), this.craftBase(), this.craftMain()), 'คราฟต์สำเร็จ'); }
  target(t: HuntTarget) { this.eq.setHuntTarget(t); }
}
