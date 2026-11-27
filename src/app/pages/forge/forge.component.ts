import { EQUIPMENT_TIERS, GEAR_SETS, ORDINARY_SLOTS, PATCH_BASE, PATCH_RARITIES, SET_IDS, SLOT_NAMES, SLOT_ICONS, TIER_CONFIG } from '../../core/data/equipment-patch-one';
import { equipmentAffixLabel } from '../../core/data/affix-art';
import { AffixIconComponent } from '../../shared/affix-icon.component';
import { CitadelFrameComponent } from '../../shared/citadel-frame.component';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ITEMS } from '../../core/data/economy';
import { FLAT_STATS, RARITY_NAME, SLOTS, STAT_LABEL } from '../../core/data/equipment';
import { EquipmentInstance, EquipmentSlot, EquipmentTier, EquipStat, GearSet, OrdinarySlot, StatLine } from '../../core/models/equipment';
import { dismantleRewards, isTierUnlocked, nextSubstatMilestone, itemLines, itemName, slotOf, upgradeCap, upgradeCost } from '../../core/rules/equipment';
import { EquipmentService } from '../../core/services/equipment.service';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';
import { EquipmentArtComponent } from '../../shared/equipment-art.component';
import { IconComponent } from '../../shared/icon.component';

export type ForgeTab = 'craft' | 'enhance' | 'salvage';

const ERR: Record<string, string> = {
  TIER_LOCKED: 'ต้องผ่าน Equipment Hunt ของ Tier นี้ก่อน', STALE_UPGRADE: 'ระดับตีบวกเปลี่ยนแล้ว ลองเลือกใหม่',
  LOCKED: 'ล็อกอยู่', EQUIPPED: 'ถอดก่อน', MAX_LEVEL: 'ตีบวกเต็มแล้ว', NEED_ORE: 'Enhancement Ore ไม่พอ', NEED_GOLD: 'ทองไม่พอ',
  NEED_FRAGMENTS: 'เศษอุปกรณ์ไม่พอ', NO_RECIPE: 'ไม่มีสูตร', BAD_MAIN: 'ค่าหลักไม่ตรงฐาน', NOT_FOUND: 'ไม่พบ', WRONG_CLASS: 'สายนี้ใช้ไม่ได้',
};
/** Blacksmith: targeted crafting, enhancement (+1, bag or equipped), salvage (dismantle bag items into materials) */
@Component({
  selector: 'app-forge',
  imports: [AffixIconComponent, CitadelFrameComponent, IconComponent, EquipmentArtComponent, RouterLink],
  templateUrl: './forge.component.html',
  styleUrl: './forge.component.scss',
})
export class ForgeComponent {
  private readonly save = inject(SaveService);
  private readonly roster = inject(RosterService);
  readonly eq = inject(EquipmentService);

  readonly tabs: { id: ForgeTab; label: string; icon: string }[] = [
    { id: 'craft', label: 'คราฟต์', icon: 'craft' },
    { id: 'enhance', label: 'ตีบวก', icon: 'enhance' },
    { id: 'salvage', label: 'ย่อย', icon: 'salvage' },
  ];
  readonly tab = signal<ForgeTab>(this.initialTab());
  private initialTab(): ForgeTab {
    const t = inject(ActivatedRoute).snapshot.queryParamMap.get('tab');
    return t === 'enhance' || t === 'salvage' ? t : 'craft';
  }
  readonly message = signal<{ text: string; ok: boolean } | null>(null);

  readonly gold = computed(() => this.save.state().gold);
  readonly ore = computed(() => this.save.state().inventory['enhancement_ore'] ?? 0);
  readonly mats = computed(() => EQUIPMENT_TIERS.map(tier => TIER_CONFIG[tier].material)
    .map(id => ({ id, name: ITEMS[id].name, n: this.save.state().inventory[id] ?? 0 })));

  // ---------------------------------------------------------------- craft
  readonly tiers = EQUIPMENT_TIERS;
  readonly sets = SET_IDS;
  readonly rolls = PATCH_RARITIES;
  readonly tierData = TIER_CONFIG;
  readonly setData = GEAR_SETS;
  readonly rarityName = RARITY_NAME;
  readonly craftTier = signal<EquipmentTier>(1);
  readonly craftSet = signal<GearSet>('assault');
  readonly slotFilter = signal<OrdinarySlot>('WEAPON');
  readonly slots = ORDINARY_SLOTS;
  readonly crafted = signal<EquipmentInstance | null>(null);
  readonly recipe = computed(() => TIER_CONFIG[this.craftTier()]);
  readonly tierUnlocked = (tier: EquipmentTier) => isTierUnlocked(this.save.state(), tier);
  readonly fragsHave = computed(() => this.save.state().inventory[this.recipe().material] ?? 0);
  readonly canCraft = computed(() => this.tierUnlocked(this.craftTier()) && this.fragsHave() >= this.recipe().fragments
    && this.gold() >= this.recipe().gold);
  readonly displayBase = computed(() => this.crafted()?.definitionId ?? PATCH_BASE[this.slotFilter()]);
  readonly displayRarity = computed(() => this.crafted()?.rarity ?? 'COMMON');
  pickTier(tier: EquipmentTier) { this.craftTier.set(tier); this.crafted.set(null); }
  pickSet(set: GearSet) { this.craftSet.set(set); this.crafted.set(null); }
  pickSlot(slot: OrdinarySlot) { this.slotFilter.set(slot); this.crafted.set(null); }
  craft() {
    const before = this.save.state().nextItemId;
    const error = this.eq.craftTier(this.craftTier(), this.slotFilter(), this.craftSet());
    this.crafted.set(error ? null : this.eq.bag().find(item => item.instanceId === before) ?? null);
    this.say(error, 'คราฟต์สำเร็จ!');
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
    { id: 'ALL', label: 'ทั้งหมด' }, ...SLOTS.map(id => ({ id, label: SLOT_NAMES[id] })),
  ];
  readonly enhanceSlot = signal<EquipmentSlot | 'ALL'>('ALL');
  readonly enhanceList = computed(() => this.allItems().filter(x => this.enhanceSlot() === 'ALL' || slotOf(x.item) === this.enhanceSlot()));
  readonly selectedEnhanceId = signal<number | null>(null);
  readonly selectedEnhance = computed(() => this.enhanceList().find(x => x.item.instanceId === this.selectedEnhanceId()) ?? this.enhanceList()[0] ?? null);

  upgradePreview(i: EquipmentInstance): string[] { return this.lines({ ...i, upgradeLevel: Math.min(i.upgradeLevel + 1, this.cap(i)) }); }
  upgrade(i: EquipmentInstance) { this.say(this.eq.upgrade(i.instanceId, i.upgradeLevel), `ตีบวก ${itemName(i)} สำเร็จ`); }

  // ---------------------------------------------------------------- salvage
  readonly salvageList = computed(() => this.eq.bag());
  readonly selectedSalvageIds = signal<Set<number>>(new Set());
  readonly salvageEligible = computed(() => this.salvageList().filter(i => !i.locked));
  readonly selectedSalvage = computed(() => this.salvageEligible().filter(i => this.selectedSalvageIds().has(i.instanceId)));
  readonly allSalvageSelected = computed(() => this.salvageEligible().length > 0 && this.selectedSalvage().length === this.salvageEligible().length);
  readonly salvageRewards = computed(() => this.rewardSummary(this.selectedSalvage()));
  readonly pendingDismantleIds = signal<number[]>([]);
  readonly pendingItems = computed(() => this.allItems().filter(x => this.pendingDismantleIds().includes(x.item.instanceId)).map(x => x.item));
  readonly pendingRewards = computed(() => this.rewardSummary(this.pendingItems()));
  toggleSalvage(i: EquipmentInstance, checked: boolean) {
    if (i.locked) return;
    this.selectedSalvageIds.update(ids => { const next = new Set(ids); checked ? next.add(i.instanceId) : next.delete(i.instanceId); return next; });
  }
  selectAllSalvage(checked: boolean) { this.selectedSalvageIds.set(new Set(checked ? this.salvageEligible().map(i => i.instanceId) : [])); }
  toggleLock(i: EquipmentInstance) {
    this.eq.lock(i.instanceId, !i.locked);
    this.selectedSalvageIds.update(ids => { const next = new Set(ids); next.delete(i.instanceId); return next; });
  }
  prepareDismantle() { this.pendingDismantleIds.set(this.selectedSalvage().map(i => i.instanceId)); }
  confirmDismantle() {
    const count = this.pendingDismantleIds().length;
    const error = this.eq.dismantleMany(this.pendingDismantleIds());
    this.say(error, `ย่อยอุปกรณ์ ${count} ชิ้นสำเร็จ`);
    if (!error) this.selectedSalvageIds.set(new Set());
    this.pendingDismantleIds.set([]);
  }
  private rewardSummary(items: EquipmentInstance[]) {
    const sums = new Map<string, number>();
    for (const item of items) for (const r of dismantleRewards(item)) sums.set(r.itemId, (sums.get(r.itemId) ?? 0) + r.count);
    return [...sums].map(([itemId, count]) => ({ itemId, count }));
  }

  // ---------------------------------------------------------------- display
  readonly name = itemName;
  readonly cap = upgradeCap;
  readonly cost = upgradeCost;
  readonly nextRoll = nextSubstatMilestone;
  readonly slotLabel = SLOT_NAMES;
  readonly slotIcon = SLOT_ICONS;
  readonly slotIconOf = (i: EquipmentInstance) => SLOT_ICONS[slotOf(i)];
  readonly statLabel = (s: EquipStat) => STAT_LABEL[s];
  readonly itemName = (id: string) => ITEMS[id]?.name ?? id;
  readonly lines = (i: EquipmentInstance) => itemLines(i).slice(0, 1 + i.secondaries.length).map(l => this.fmt(l));
  readonly fmt = (l: StatLine) => `${STAT_LABEL[l.stat]} ${l.value >= 0 ? '+' : ''}${FLAT_STATS.includes(l.stat) ? l.value : (l.value * 100).toFixed(1) + ' %'}`;
  readonly affixName = (item: EquipmentInstance) => equipmentAffixLabel(item.affix, item.rarity);
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
