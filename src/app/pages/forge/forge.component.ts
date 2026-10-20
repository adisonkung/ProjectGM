import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CLASS_NAME } from '../../core/data/classes';
import { ITEMS } from '../../core/data/economy';
import { AFFIXES, CRAFT_RECIPES, EQUIPMENT_DEFS, FLAT_STATS, RARITY_NAME, SLOTS, STAT_LABEL, WEAPON_GROUP_OF } from '../../core/data/equipment';
import { HeroClass } from '../../core/models/hero';
import { EquipmentInstance, EquipmentSlot, EquipStat, Rarity, StatLine } from '../../core/models/equipment';
import { dismantleRewards, mainBaseValue, itemLines, itemName, slotOf, upgradeCap, upgradeCost } from '../../core/rules/equipment';
import { EquipmentService } from '../../core/services/equipment.service';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';
import { EquipmentArtComponent } from '../../shared/equipment-art.component';
import { IconComponent } from '../../shared/icon.component';

export type ForgeTab = 'craft' | 'enhance' | 'salvage';

const ERR: Record<string, string> = {
  LOCKED: 'ล็อกอยู่', EQUIPPED: 'ถอดก่อน', MAX_LEVEL: 'ตีบวกเต็มแล้ว', NEED_ORE: 'Enhancement Ore ไม่พอ', NEED_GOLD: 'ทองไม่พอ',
  NEED_FRAGMENTS: 'เศษอุปกรณ์ไม่พอ', NO_RECIPE: 'ไม่มีสูตร', BAD_MAIN: 'ค่าหลักไม่ตรงฐาน', NOT_FOUND: 'ไม่พบ', WRONG_CLASS: 'สายนี้ใช้ไม่ได้',
};
const SLOT_LABEL: Record<EquipmentSlot, string> = { WEAPON: 'อาวุธ', ARMOR: 'เกราะ', ACCESSORY: 'เครื่องประดับ' };
const SLOT_ICON: Record<EquipmentSlot, string> = { WEAPON: 'sword', ARMOR: 'shield', ACCESSORY: 'gem' };

/** Blacksmith: targeted crafting, enhancement (+1, bag or equipped), salvage (dismantle bag items into materials) */
@Component({
  selector: 'app-forge',
  imports: [IconComponent, EquipmentArtComponent, RouterLink],
  templateUrl: './forge.component.html',
  styleUrl: './forge.component.scss',
})
export class ForgeComponent {
  private readonly save = inject(SaveService);
  private readonly roster = inject(RosterService);
  readonly eq = inject(EquipmentService);

  readonly tabs: { id: ForgeTab; label: string; icon: string }[] = [
    { id: 'craft', label: 'คราฟต์', icon: 'flame' },
    { id: 'enhance', label: 'ตีบวก', icon: 'bolt' },
    { id: 'salvage', label: 'ย่อย', icon: 'crystal' },
  ];
  readonly tab = signal<ForgeTab>(this.initialTab());
  private initialTab(): ForgeTab {
    const t = inject(ActivatedRoute).snapshot.queryParamMap.get('tab');
    return t === 'enhance' || t === 'salvage' ? t : 'craft';
  }
  readonly message = signal<{ text: string; ok: boolean } | null>(null);

  readonly gold = computed(() => this.save.state().gold);
  readonly ore = computed(() => this.save.state().inventory['enhancement_ore'] ?? 0);
  readonly mats = computed(() => ['equip_frag_basic', 'equip_frag_rare', 'equip_frag_elite', 'equip_frag_epic']
    .map(id => ({ id, name: ITEMS[id].name, n: this.save.state().inventory[id] ?? 0 })));

  // ---------------------------------------------------------------- craft
  readonly recipes = Object.values(CRAFT_RECIPES);
  readonly rarityName = RARITY_NAME;
  readonly craftRarity = signal<Rarity>('RARE');
  readonly craftBase = signal<string>('guard_armor');
  readonly craftMain = signal<EquipStat>('hpPct');
  readonly slotFilter = signal<EquipmentSlot>('ARMOR');
  readonly slots = SLOTS;
  readonly bases = computed(() => Object.values(EQUIPMENT_DEFS).filter(d => d.slot === this.slotFilter()));
  readonly mains = computed(() => EQUIPMENT_DEFS[this.craftBase()]?.mainStats ?? []);
  readonly recipe = computed(() => CRAFT_RECIPES[this.craftRarity()]!);
  readonly canCraft = computed(() => {
    const r = this.recipe();
    return (this.save.state().inventory[r.fragmentId] ?? 0) >= r.fragments && this.gold() >= r.gold;
  });
  readonly fragsHave = computed(() => this.save.state().inventory[this.recipe().fragmentId] ?? 0);
  readonly mainPreview = computed(() => this.fmt({ stat: this.craftMain(), value: mainBaseValue(EQUIPMENT_DEFS[this.craftBase()], this.craftMain(), this.craftRarity()) }));
  readonly baseName = computed(() => EQUIPMENT_DEFS[this.craftBase()]?.name ?? '');
  readonly crafted = signal<EquipmentInstance | null>(null);
  /** which classes wield a weapon base (armor / accessories: everyone) */
  wielders(defId: string): string {
    const g = EQUIPMENT_DEFS[defId].weaponGroup;
    if (!g) return 'ทุกสาย';
    return (Object.keys(WEAPON_GROUP_OF) as HeroClass[]).filter(c => WEAPON_GROUP_OF[c] === g).map(c => CLASS_NAME[c]).join(' · ');
  }
  pickSlot(s: EquipmentSlot) {
    this.slotFilter.set(s);
    this.pickBase(this.bases()[0].id);
  }
  pickBase(id: string) { this.craftBase.set(id); this.craftMain.set(EQUIPMENT_DEFS[id].mainStats[0]); }
  craft() {
    const before = new Set(this.eq.bag().map(i => i.instanceId));
    const err = this.eq.craft(this.craftRarity(), this.craftBase(), this.craftMain());
    this.crafted.set(err ? null : this.eq.bag().find(i => !before.has(i.instanceId)) ?? null);
    this.say(err, 'คราฟต์สำเร็จ!');
  }

  // ---------------------------------------------------------------- enhance
  /** every item: bag + equipped (with the wearer's name) */
  readonly allItems = computed(() => {
    const s = this.save.state();
    const worn = s.heroes.flatMap(h => SLOTS.map(sl => h.gear?.[sl]).filter((x): x is EquipmentInstance => !!x)
      .map(item => ({ item, wearer: this.roster.template(h).name })));
    return [...worn, ...(s.equipment ?? []).map(item => ({ item, wearer: null as string | null }))];
  });
  readonly enhanceFilters: { id: EquipmentSlot | 'ALL'; label: string }[] = [
    { id: 'ALL', label: 'ทั้งหมด' }, ...SLOTS.map(id => ({ id, label: SLOT_LABEL[id] })),
  ];
  readonly enhanceSlot = signal<EquipmentSlot | 'ALL'>('ALL');
  readonly enhanceList = computed(() => this.allItems().filter(x => this.enhanceSlot() === 'ALL' || slotOf(x.item) === this.enhanceSlot()));
  upgrade(i: EquipmentInstance) { this.say(this.eq.upgrade(i.instanceId), `ตีบวก ${itemName(i)} สำเร็จ`); }

  // ---------------------------------------------------------------- salvage
  readonly salvageList = computed(() => this.eq.bag());
  dismantle(i: EquipmentInstance) { this.say(this.eq.dismantle(i.instanceId), `ย่อย ${itemName(i)} → ${this.dismantleText(i)}`); }
  toggleLock(i: EquipmentInstance) { this.eq.lock(i.instanceId, !i.locked); }

  // ---------------------------------------------------------------- display
  readonly name = itemName;
  readonly cap = upgradeCap;
  readonly cost = upgradeCost;
  readonly slotLabel = SLOT_LABEL;
  readonly slotIcon = SLOT_ICON;
  readonly slotIconOf = (i: EquipmentInstance) => SLOT_ICON[slotOf(i)];
  readonly statLabel = (s: EquipStat) => STAT_LABEL[s];
  readonly itemName = (id: string) => ITEMS[id]?.name ?? id;
  readonly lines = (i: EquipmentInstance) => itemLines(i).slice(0, 1 + i.secondaries.length).map(l => this.fmt(l));
  readonly fmt = (l: StatLine) => `${STAT_LABEL[l.stat]} ${l.value >= 0 ? '+' : ''}${FLAT_STATS.includes(l.stat) ? l.value : (l.value * 100).toFixed(1) + ' %'}`;
  readonly affixName = (id?: string) => (id ? AFFIXES[id].name + ' — ' + AFFIXES[id].description : '');
  readonly dismantleText = (i: EquipmentInstance) => dismantleRewards(i).map(r => `${ITEMS[r.itemId].name} ×${r.count}`).join(', ');
  private say(err: string | null, ok: string) { this.message.set({ text: err ? ERR[err] ?? err : ok, ok: !err }); }
  onTabKey(event: KeyboardEvent): void {
    const index = this.tabs.findIndex(t => t.id === this.tab());
    const next = event.key === 'ArrowRight' ? (index + 1) % this.tabs.length : event.key === 'ArrowLeft' ? (index + this.tabs.length - 1) % this.tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    this.setTab(this.tabs[next].id);
    (event.currentTarget as HTMLElement).closest('nav')?.querySelector<HTMLButtonElement>('#forge-tab-' + this.tab())?.focus();
  }
  setTab(t: ForgeTab) { this.tab.set(t); this.message.set(null); }
}
