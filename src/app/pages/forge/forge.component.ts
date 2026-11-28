import { equipmentAffixLabel } from '../../core/data/affix-art';
import { AffixIconComponent } from '../../shared/affix-icon.component';
import { CitadelFrameComponent } from '../../shared/citadel-frame.component';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ITEMS } from '../../core/data/economy';
import { CRAFT_RECIPES, EQUIPMENT_DEFS, FLAT_STATS, RARITIES, RARITY_NAME, RARITY_RULES, SLOTS, STAT_LABEL } from '../../core/data/equipment';
import { EquipmentInstance, EquipmentSlot, EquipStat, Rarity, StatLine } from '../../core/models/equipment';
import { dismantleRewards, itemLines, itemName, mainBaseValue, slotOf, upgradeCap, upgradeCost } from '../../core/rules/equipment';
import { EquipmentService } from '../../core/services/equipment.service';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';
import { EquipmentArtComponent, equipmentArtFamily } from '../../shared/equipment-art.component';
import { SheetFxComponent } from '../../shared/sheet-fx.component';
import { CollectionHeaderComponent } from '../heroes/collection-header.component';
import { ForgeLayout } from './forge-layout';
import { IconComponent } from '../../shared/icon.component';

export type ForgeTab = 'craft' | 'enhance' | 'salvage';

const ERR: Record<string, string> = {
  LOCKED: 'ล็อกอยู่', EQUIPPED: 'ถอดก่อน', MAX_LEVEL: 'ตีบวกเต็มแล้ว', NEED_ORE: 'Enhancement Ore ไม่พอ', NEED_GOLD: 'ทองไม่พอ',
  NEED_FRAGMENTS: 'เศษอุปกรณ์ไม่พอ', NO_RECIPE: 'ไม่มีสูตร', BAD_MAIN: 'ค่าหลักไม่ตรงฐาน', NOT_FOUND: 'ไม่พบ', WRONG_CLASS: 'สายนี้ใช้ไม่ได้',
};
const SLOT_LABEL: Record<EquipmentSlot, string> = { WEAPON: 'อาวุธ', ARMOR: 'เกราะ', ACCESSORY: 'เครื่องประดับ' };
const SLOT_ICON: Record<EquipmentSlot, string> = { WEAPON: 'sword', ARMOR: 'shield', ACCESSORY: 'gem' };

/** Desktop Anvil: the six positions of the Celestial Seal armory. Helmet and artifact are illustrative (no real slot);
 *  necklace and ring are the two appearances of the shared ACCESSORY slot. */
export type ForgeKind = 'weapon' | 'helmet' | 'armor' | 'necklace' | 'ring' | 'artifact';
const FORGE_KINDS: readonly { id: ForgeKind; label: string; slot?: EquipmentSlot; look?: 'necklace' | 'ring' }[] = [
  { id: 'weapon', label: 'อาวุธ', slot: 'WEAPON' },
  { id: 'helmet', label: 'หมวก' },
  { id: 'armor', label: 'เกราะ', slot: 'ARMOR' },
  { id: 'necklace', label: 'สร้อย', slot: 'ACCESSORY', look: 'necklace' },
  { id: 'ring', label: 'แหวน', slot: 'ACCESSORY', look: 'ring' },
  { id: 'artifact', label: 'อาร์ติแฟกต์' },
];
const TIER_ID: Record<Rarity, string> = { COMMON: 'common', UNCOMMON: 'uncommon', RARE: 'rare', ELITE: 'elite', EPIC: 'epic' };
const TIER_NO: Record<Rarity, string> = { COMMON: 'T1', UNCOMMON: 'T2', RARE: 'T3', ELITE: 'T4', EPIC: 'T5' };
/** art for a kind at a tier (icons only — crafting rolls the real base) */
export function forgeKindArt(kind: ForgeKind, rarity: Rarity): string {
  const t = TIER_ID[rarity];
  if (kind === 'weapon') return `/ui/generated/equipment/swords/foreground/${t}.webp`;
  if (kind === 'helmet') return `/ui/equipment/tiered/helmet/${t}.webp`;
  if (kind === 'artifact') return '/ui/home-k7/nav_summon_crystal.webp';
  return `/ui/equipment/tiered/${kind}/${t}.webp`;
}
/** which of the six positions an owned item belongs to */
export function forgeKindOf(i: EquipmentInstance): ForgeKind {
  const family = equipmentArtFamily(i.definitionId, i.instanceId);
  return family === 'sword' ? 'weapon' : family;
}
export type ForgeFx = { kind: ForgeTab; tick: number; rarity: Rarity; level?: number; count?: number };
const SPARKS = Array.from({ length: 14 }, (_, i) => ({ angle: `${Math.round(i * 360 / 14 + (i % 3) * 7)}deg`, delay: `${(i % 5) * 45}ms`, reach: `${92 + (i % 4) * 18}px` }));

/** Blacksmith: targeted crafting, enhancement (+1, bag or equipped), salvage (dismantle bag items into materials) */
@Component({
  selector: 'app-forge',
  imports: [AffixIconComponent, CitadelFrameComponent, CollectionHeaderComponent, IconComponent, EquipmentArtComponent, RouterLink, SheetFxComponent],
  templateUrl: './forge.component.html',
  styleUrls: ['./forge.component.scss', './forge-anvil.scss'],
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
  readonly mats = computed(() => ['equip_frag_basic', 'equip_frag_rare', 'equip_frag_elite', 'equip_frag_epic']
    .map(id => ({ id, name: ITEMS[id].name, n: this.save.state().inventory[id] ?? 0 })));

  // ---------------------------------------------------------------- craft
  readonly recipes = Object.values(CRAFT_RECIPES);
  readonly rarityName = RARITY_NAME;
  readonly craftRarity = signal<Rarity>('RARE');
  readonly slotFilter = signal<EquipmentSlot>('ARMOR');
  readonly slots = SLOTS;
  readonly bases = computed(() => Object.values(EQUIPMENT_DEFS).filter(d => d.slot === this.slotFilter()));
  readonly previewBase = computed(() => this.bases()[0].id);
  readonly recipe = computed(() => CRAFT_RECIPES[this.craftRarity()]!);
  /** how many crafts the current fragments and gold pay for */
  readonly maxCraft = computed(() => {
    const r = CRAFT_RECIPES[this.craftRarity()];
    return r ? Math.min(Math.floor((this.save.state().inventory[r.fragmentId] ?? 0) / r.fragments), Math.floor(this.gold() / r.gold)) : 0;
  });
  readonly craftQty = signal<1 | 10>(1);
  readonly canCraft = computed(() => this.maxCraft() >= this.craftQty());
  readonly fragmentTier = computed(() => this.recipe().fragmentId === 'equip_frag_basic' ? 'Basic' : RARITY_NAME[this.craftRarity()]);
  readonly fragsHave = computed(() => this.save.state().inventory[this.recipe().fragmentId] ?? 0);
  readonly crafted = signal<EquipmentInstance | null>(null);
  readonly accessoryPreview = signal<'necklace' | 'ring'>('necklace');
  readonly displayBase = computed(() => this.crafted()?.definitionId ?? this.previewBase());
  readonly displayRarity = computed(() => this.crafted()?.rarity ?? this.craftRarity());
  pickRarity(r: Rarity) { this.craftRarity.set(r); this.crafted.set(null); }
  pickAdornment(v: 'necklace' | 'ring') { this.accessoryPreview.set(v); this.crafted.set(null); }
  pickSlot(s: EquipmentSlot) { this.slotFilter.set(s); this.crafted.set(null); }
  /** crafts ×1 or ×10 (the batch is only started when every craft is paid for) */
  craft() {
    const qty = this.craftQty();
    if (this.maxCraft() < qty) { this.say(this.fragsHave() < this.recipe().fragments * qty ? 'NEED_FRAGMENTS' : 'NEED_GOLD', ''); return; }
    const made: EquipmentInstance[] = [];
    let err: string | null = null;
    for (let n = 0; n < qty && !err; n++) {
      const before = new Set(this.eq.bag().map(i => i.instanceId));
      err = this.eq.craftRandom(this.craftRarity(), this.slotFilter());
      const item = err ? null : this.eq.bag().find(i => !before.has(i.instanceId));
      if (item) made.push(item);
    }
    this.crafted.set(made[0] ?? null);
    this.craftBatch.set(made);
    this.say(made.length ? null : err, made.length > 1 ? `หลอมสร้างสำเร็จ ×${made.length}` : 'คราฟต์สำเร็จ!');
    if (made.length) this.playFx('craft', made[0].rarity, { count: made.length });
  }

  // ---------------------------------------------------------------- desktop Anvil
  private readonly layout = inject(ForgeLayout);
  readonly desktop = this.layout.desktop;
  readonly kinds = FORGE_KINDS;
  readonly sparks = SPARKS;
  readonly tierNo = TIER_NO;
  readonly kindArt = forgeKindArt;
  /** follows slotFilter's initial ARMOR so the preview, the highlighted type and the crafted slot always agree */
  readonly craftKind = signal<ForgeKind>('armor');
  readonly craftBatch = signal<EquipmentInstance[]>([]);
  /** T1–T5; a tier without a recipe (T1 Common today) is shown but cannot be chosen */
  readonly tiers = RARITIES.map(r => ({ rarity: r, no: TIER_NO[r], name: RARITY_NAME[r], open: !!CRAFT_RECIPES[r] }));
  pickKind(k: ForgeKind) {
    const kind = FORGE_KINDS.find(x => x.id === k);
    if (!kind?.slot) return;
    this.craftKind.set(k);
    this.slotFilter.set(kind.slot);
    if (kind.look) this.accessoryPreview.set(kind.look);
    this.crafted.set(null);
  }
  pickTier(r: Rarity) { if (CRAFT_RECIPES[r]) this.pickRarity(r); }
  readonly kindLabel = computed(() => FORGE_KINDS.find(k => k.id === this.craftKind())!.label);
  /** main stat range a craft can start with (the base rolls one of its main stats) */
  readonly craftMain = computed(() => {
    const r = this.craftRarity();
    const values = this.bases().flatMap(d => d.mainStats.map(stat => ({ stat, v: mainBaseValue(d, stat, r) })));
    const pct = values.filter(x => !FLAT_STATS.includes(x.stat)).map(x => x.v * 100);
    return pct.length ? `${Math.min(...pct).toFixed(1)}–${Math.max(...pct).toFixed(1)} %` : '—';
  });
  readonly craftSecondaries = computed(() => { const [a, b] = RARITY_RULES[this.craftRarity()].secondaries; return a === b ? `${a}` : `${a}–${b}`; });
  readonly craftAffix = computed(() => { const c = RARITY_RULES[this.craftRarity()].affixChance; return c >= 1 ? 'มีแน่นอน' : c > 0 ? `โอกาส ${Math.round(c * 100)}%` : 'ไม่มี'; });
  readonly craftCap = computed(() => RARITY_RULES[this.craftRarity()].upgradeCap);

  /** bag / enhancement filters shared with the armory: six positions + rarity */
  readonly bagKind = signal<ForgeKind | 'all'>('all');
  readonly bagRarity = signal<Rarity | 'all'>('all');
  readonly rarityChips: { id: Rarity | 'all'; label: string }[] = [
    { id: 'all', label: 'ทั้งหมด' }, { id: 'EPIC', label: 'EP' }, { id: 'ELITE', label: 'EL' }, { id: 'RARE', label: 'R' }, { id: 'UNCOMMON', label: 'UC' }, { id: 'COMMON', label: 'C' },
  ];
  pickBagKind(k: ForgeKind) { if (FORGE_KINDS.find(x => x.id === k)?.slot) this.bagKind.set(this.bagKind() === k ? 'all' : k); }
  private matchesBag(i: EquipmentInstance) { return (this.bagKind() === 'all' || forgeKindOf(i) === this.bagKind()) && (this.bagRarity() === 'all' || i.rarity === this.bagRarity()); }
  readonly anvilEnhanceList = computed(() => this.allItems().filter(x => this.matchesBag(x.item)));
  readonly anvilEnhance = computed(() => this.anvilEnhanceList().find(x => x.item.instanceId === this.selectedEnhanceId()) ?? this.anvilEnhanceList()[0] ?? null);
  readonly anvilEnhanceId = computed(() => this.anvilEnhance()?.item.instanceId ?? null);
  readonly anvilSalvageList = computed(() => this.salvageList().filter(i => this.matchesBag(i)));
  /** stat rows for the enhancement table: current value → value after +1 */
  enhanceRows(i: EquipmentInstance) {
    const now = itemLines(i).slice(0, 1 + i.secondaries.length);
    const next = itemLines({ ...i, upgradeLevel: Math.min(i.upgradeLevel + 1, this.cap(i)) }).slice(0, now.length);
    const val = (l: StatLine) => `${l.value >= 0 ? '+' : ''}${FLAT_STATS.includes(l.stat) ? l.value : (l.value * 100).toFixed(1) + '%'}`;
    return now.map((l, k) => ({ stat: l.stat, label: STAT_LABEL[l.stat], main: k === 0, now: val(l), next: val(next[k]), up: next[k].value !== l.value }));
  }
  readonly pips = (i: EquipmentInstance) => Array.from({ length: this.cap(i) }, (_, k) => k < i.upgradeLevel ? 'on' : k === i.upgradeLevel ? 'next' : 'off');
  pickSalvage(i: EquipmentInstance) { this.toggleSalvage(i, !this.selectedSalvageIds().has(i.instanceId)); }
  selectSalvageRarity(r: Rarity | 'all') {
    this.selectedSalvageIds.set(new Set(this.salvageEligible().filter(i => r === 'all' || i.rarity === r).map(i => i.instanceId)));
  }
  goEnhance(i: EquipmentInstance) { this.bagKind.set('all'); this.bagRarity.set('all'); this.selectedEnhanceId.set(i.instanceId); this.setTab('enhance'); }
  anvilUpgrade(i: EquipmentInstance) {
    const err = this.eq.upgrade(i.instanceId);
    this.say(err, `ตีบวก ${itemName(i)} +${i.upgradeLevel + 1} สำเร็จ`);
    if (!err) this.playFx('enhance', i.rarity, { level: i.upgradeLevel + 1 });
  }

  /** one-shot altar effect; a new tick re-creates the layer so the animation restarts */
  readonly fx = signal<ForgeFx | null>(null);
  private fxTick = 0;
  private playFx(kind: ForgeTab, rarity: Rarity, extra: Partial<ForgeFx> = {}) { this.fx.set({ kind, rarity, tick: ++this.fxTick, ...extra }); }

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
  readonly selectedEnhanceId = signal<number | null>(null);
  readonly selectedEnhance = computed(() => this.enhanceList().find(x => x.item.instanceId === this.selectedEnhanceId()) ?? this.enhanceList()[0] ?? null);

  upgradePreview(i: EquipmentInstance): string[] { return this.lines({ ...i, upgradeLevel: Math.min(i.upgradeLevel + 1, this.cap(i)) }); }
  upgrade(i: EquipmentInstance) { this.say(this.eq.upgrade(i.instanceId), `ตีบวก ${itemName(i)} สำเร็จ`); }

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
    const best = this.pendingItems().reduce<Rarity>((r, i) => RARITIES.indexOf(i.rarity) > RARITIES.indexOf(r) ? i.rarity : r, 'COMMON');
    this.say(error, `ย่อยอุปกรณ์ ${count} ชิ้นสำเร็จ`);
    if (!error) { this.selectedSalvageIds.set(new Set()); this.playFx('salvage', best, { count }); }
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
  readonly slotLabel = SLOT_LABEL;
  readonly slotIcon = SLOT_ICON;
  readonly slotIconOf = (i: EquipmentInstance) => SLOT_ICON[slotOf(i)];
  readonly slotLabelOf = (i: EquipmentInstance) => SLOT_LABEL[slotOf(i)];
  readonly statLabel = (s: EquipStat) => STAT_LABEL[s];
  readonly itemName = (id: string) => ITEMS[id]?.name ?? id;
  readonly lines = (i: EquipmentInstance) => itemLines(i).slice(0, 1 + i.secondaries.length).map(l => this.fmt(l));
  readonly fmt = (l: StatLine) => `${STAT_LABEL[l.stat]} ${l.value >= 0 ? '+' : ''}${FLAT_STATS.includes(l.stat) ? l.value : (l.value * 100).toFixed(1) + ' %'}`;
  readonly affixName = (item: EquipmentInstance) => equipmentAffixLabel(item.affix, item.rarity);
  readonly dismantleText = (i: EquipmentInstance) => dismantleRewards(i).map(r => `${ITEMS[r.itemId].name} ×${r.count}`).join(', ');
  readonly rarityTier = (r: Rarity) => TIER_ID[r];
  private say(err: string | null, ok: string) { this.message.set({ text: err ? ERR[err] ?? err : ok, ok: !err }); }
  onTabKey(event: KeyboardEvent): void {
    const index = this.tabs.findIndex(t => t.id === this.tab());
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown', back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const next = forward ? (index + 1) % this.tabs.length : back ? (index + this.tabs.length - 1) % this.tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    this.setTab(this.tabs[next].id);
    (event.currentTarget as HTMLElement).closest('nav')?.querySelector<HTMLButtonElement>('#forge-tab-' + this.tab())?.focus();
  }
  setTab(t: ForgeTab) { this.tab.set(t); this.message.set(null); this.fx.set(null); }
}
