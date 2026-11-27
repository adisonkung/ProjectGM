import { GEAR_SETS, SLOT_NAMES, SLOT_ICONS } from '../../core/data/equipment-patch-one';
import { equipmentAffixLabel } from '../../core/data/affix-art';
import { AffixIconComponent } from '../../shared/affix-icon.component';
import { MaterialInventoryComponent } from '../../shared/material-inventory.component';
import { StateEmblemComponent } from '../../shared/state-emblem.component';
import { CitadelFrameComponent } from '../../shared/citadel-frame.component';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { HeroStarsComponent } from '../../shared/hero-stars.component';
import { heroArt } from '../../core/data/hero-art';
import { CLASS_NAME } from '../../core/data/classes';
import { CollectionHeaderComponent } from '../heroes/collection-header.component';
import { ArmoryLayout } from './armory-layout';
import { EquipmentArtComponent, equipmentArtFamily } from '../../shared/equipment-art.component';
import { IconComponent } from '../../shared/icon.component';
import { AFFIXES, SELL_GOLD, FLAT_STATS, RARITIES, RARITY_NAME, SLOTS, STAT_LABEL } from '../../core/data/equipment';
import { EquipmentInstance, EquipmentSlot, EquipStat, Rarity, StatLine } from '../../core/models/equipment';
import { activeGearSets, nextSubstatMilestone, previewGearSwap, canEquip, heroGear, heroGearTotals, itemLines, itemName, mainValue, slotOf, upgradeCap, upgradeCost } from '../../core/rules/equipment';
import { combatModifiers } from '../../core/rules/progression';
import { EquipmentService } from '../../core/services/equipment.service';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';

type SealSlot = 'weapon' | 'helmet' | 'armor' | 'necklace' | 'ring' | 'artifact';
type OwnerFilter = 'all' | 'available' | 'others';

const SEAL_SLOTS: readonly { id: SealSlot; label: string; sketch: string; slot?: EquipmentSlot }[] = [
  { id: 'helmet', label: 'หมวก', sketch: '/ui/home-k7/nav_hero_helm.webp', slot: 'HELMET' },
  { id: 'weapon', label: 'อาวุธ', sketch: '/ui/generated/equipment/swords/foreground/common.webp', slot: 'WEAPON' },
  { id: 'armor', label: 'เกราะ', sketch: '/ui/equipment/tiered/armor/common.webp', slot: 'ARMOR' },
  { id: 'necklace', label: 'สร้อย', sketch: '/ui/equipment/tiered/necklace/common.webp', slot: 'NECKLACE' },
  { id: 'ring', label: 'แหวน', sketch: '/ui/equipment/tiered/ring/common.webp', slot: 'RING' },
  { id: 'artifact', label: 'อาร์ติแฟกต์', sketch: '/ui/home-k7/nav_summon_crystal.webp' },
];
const SEAL_FILTERS = ['weapon', 'helmet', 'armor', 'necklace', 'ring', 'artifact']
  .map(id => SEAL_SLOTS.find(slot => slot.id === id)!);
const RARITY_CODES: Record<Rarity, string> = { COMMON: 'C', UNCOMMON: 'UC', RARE: 'R', ELITE: 'EL', EPIC: 'EP', LEGENDARY: 'LG' };
const STAT_TABLE_LABEL: Partial<Record<EquipStat, string>> = {
  atkPct: 'ATK', atkFlat: 'ATK (ค่าคงที่)', hpPct: 'HP', defPct: 'DEF',
  critChance: 'Crit', critDamage: 'Crit DMG', skillDamage: 'Skill DMG',
  cooldownReduction: 'Cooldown', breakPower: 'Break', damageReduction: 'Damage Reduction',
  healingReceived: 'Healing Received',
};

const ERR: Record<string, string> = {
  STALE_UPGRADE: 'ระดับตีบวกเปลี่ยนแล้ว ลองเลือกใหม่',
  LOCKED: 'ล็อกอยู่', EQUIPPED: 'ถอดก่อน', WRONG_CLASS: 'สายนี้ใช้อาวุธนี้ไม่ได้', MAX_LEVEL: 'ตีบวกเต็มแล้ว', NEED_ORE: 'Ore ไม่พอ',
  NEED_GOLD: 'ทองไม่พอ', NEED_FRAGMENTS: 'เศษไม่พอ', NO_RECIPE: 'ไม่มีสูตร', BAD_MAIN: 'ค่าหลักไม่ตรงฐาน', NOT_FOUND: 'ไม่พบ',
};

/** Desktop Celestial Seal and the existing compact armory share the same equipment actions. */
@Component({
  selector: 'app-armory',
  imports: [DecimalPipe, CollectionHeaderComponent, HeroStarsComponent, AffixIconComponent, MaterialInventoryComponent, StateEmblemComponent, CitadelFrameComponent, HeroPortraitComponent, IconComponent, EquipmentArtComponent, RouterLink],
  templateUrl: './armory.component.html',
  styleUrls: ['./armory.component.scss', './celestial-seal.scss'],
})
export class ArmoryComponent {
  private readonly save = inject(SaveService);
  readonly roster = inject(RosterService);
  readonly desktop = inject(ArmoryLayout).desktop;
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
  readonly selectedId = signal<number | null>(null);
  readonly sort = signal<'recent' | 'rarity' | 'upgrade'>('recent');
  readonly className = CLASS_NAME;
  readonly heroBanner = computed(() => heroArt(this.hero()?.templateId ?? '')?.banner);
  readonly heroPortrait = computed(() => heroArt(this.hero()?.templateId ?? '')?.portrait);
  readonly hero = computed(() => this.save.state().heroes.find(h => h.uid === this.heroUid()) ?? null);
  readonly cls = computed(() => { const h = this.hero(); return h ? this.roster.template(h).cls : null; });
  readonly stats = computed(() => { const h = this.hero(); return h ? this.roster.stats(h) : null; });
  readonly totals = computed(() => { const h = this.hero(); return h ? heroGearTotals(h) : null; });
  readonly bag = computed(() => {
    const ranks = { COMMON: 0, UNCOMMON: 1, RARE: 2, ELITE: 3, EPIC: 4, LEGENDARY: 5 };
    return this.eq.bag().filter(i => this.filter() === 'ALL' || slotOf(i) === this.filter() || (this.filter() === 'NECKLACE' && slotOf(i) === 'ACCESSORY')).slice().sort((a, b) =>
      (this.sort() === 'rarity' ? ranks[b.rarity] - ranks[a.rarity] : this.sort() === 'upgrade' ? b.upgradeLevel - a.upgradeLevel : 0) || b.instanceId - a.instanceId);
  });
  readonly selected = computed<EquipmentInstance | null>(() => {
    const id = this.selectedId();
    return id === null ? null : this.allItems().find(i => i.instanceId === id) ?? null;
  });
  readonly selectedWorn = computed(() => { const item = this.selected(); return !!item && this.slots.some(s => this.hero()?.gear?.[s]?.instanceId === item.instanceId); });
  readonly slotOf = slotOf;
  chooseSlot(slot: EquipmentSlot, item?: EquipmentInstance): void { this.filter.set(slot); this.selectedId.set(item?.instanceId ?? null); }
  chooseFilter(slot: EquipmentSlot | 'ALL'): void { this.filter.set(slot); this.selectedId.set(null); }

  readonly gold = computed(() => this.save.state().gold);

  readonly sealSlots = SEAL_SLOTS;
  readonly sealFilters = SEAL_FILTERS;
  readonly rarities = [...RARITIES].reverse();
  readonly rarityCode = RARITY_CODES;
  readonly rarityFilter = signal<Rarity | 'all'>('all');
  readonly sealFilter = signal<SealSlot | 'all'>('weapon');
  readonly ownerFilter = signal<OwnerFilter>('all');
  readonly ownerFilters: readonly { id: OwnerFilter; label: string }[] = [
    { id: 'all', label: 'ทั้งหมด' }, { id: 'available', label: 'ว่าง / ของฉัน' }, { id: 'others', label: 'ฮีโร่อื่นสวมอยู่' },
  ];
  readonly allItems = computed(() => [...this.eq.bag(), ...this.roster.heroes().flatMap(heroGear)]);
  readonly wornCount = computed(() => this.hero() ? heroGear(this.hero()!).length : 0);
  readonly equippedAffixes = computed(() => {
    const hero = this.hero();
    return hero ? [...new Set(heroGear(hero).flatMap(item => item.affix ? [item.affix] : []))] : [];
  });
  readonly sealBag = computed(() => this.allItems().filter(item => {
    const category = this.sealFilter();
    const rarity = this.rarityFilter();
    const owner = this.ownerFilter();
    const own = item.equippedHeroId === null || item.equippedHeroId === this.heroUid();
    return (category === 'all' || this.sealSlot(item) === category)
      && (rarity === 'all' || rarity === item.rarity)
      && (owner === 'all' || (owner === 'available' ? own : !own));
  }).sort((a, b) =>
    (this.sort() === 'rarity' ? RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity)
      : this.sort() === 'upgrade' ? b.upgradeLevel - a.upgradeLevel : 0) || b.instanceId - a.instanceId,
  ));
  readonly setData = GEAR_SETS;
  readonly nextRoll = nextSubstatMilestone;
  readonly activeSets = computed(() => activeGearSets(this.hero() ? heroGear(this.hero()!) : []));
  readonly itemOwner = (item: EquipmentInstance) =>
    this.roster.heroes().find(hero => hero.uid === item.equippedHeroId);
  readonly affixDefinition = (id: string) => AFFIXES[id];
  readonly artMask = (path: string) => 'url("' + path + '")';
  readonly itemMain = (item: EquipmentInstance) => this.formatStat(item.main.stat, mainValue(item));
  readonly advanceCost = computed(() => {
    const item = this.selected();
    return item ? upgradeCost(item) : null;
  });
  readonly canAdvance = computed(() => {
    const cost = this.advanceCost();
    const state = this.save.state();
    return !!cost && state.gold >= cost.gold && (state.inventory['enhancement_ore'] ?? 0) >= cost.ore;
  });
  readonly removedSealSketch = signal<Partial<Record<SealSlot, string>>>({});
  readonly sealPulse = signal<{ slot: SealSlot; tick: number } | null>(null);
  readonly selectionPulse = signal(0);
  readonly pendingTransfer = signal<EquipmentInstance | null>(null);
  readonly currentSealItem = computed(() => {
    const item = this.selected();
    const gear = this.hero()?.gear;
    if (!item || !gear) return undefined;
    const slot = slotOf(item);
    return slot === 'NECKLACE' || slot === 'ACCESSORY' ? gear.NECKLACE ?? gear.ACCESSORY : gear[slot];
  });
  readonly sealStats = computed(() => {
    const hero = this.hero();
    const totals = this.totals();
    if (!hero || !totals) return [];
    const item = this.selected();
    const projected = item && this.usable(item) ? previewGearSwap(hero, item) : hero;
    const afterTotals = projected === hero ? totals : heroGearTotals(projected);
    const stats = this.roster.stats(hero);
    const afterStats = projected === hero ? stats : this.roster.stats(projected);
    const mod = combatModifiers(hero);
    const afterMod = projected === hero ? mod : combatModifiers(projected);
    const coreStats: Partial<Record<EquipStat, [number, number]>> = {
      atkPct: [stats.atk, afterStats.atk], hpPct: [stats.hp, afterStats.hp], defPct: [stats.def, afterStats.def],
      attackSpeed: [stats.atkSpeed, afterStats.atkSpeed], moveSpeed: [stats.moveSpeed, afterStats.moveSpeed],
    };
    const battleStats: Partial<Record<EquipStat, [number, number]>> = {
      critChance: [mod.critChance, afterMod.critChance],
      critDamage: [mod.critMultiplier, afterMod.critMultiplier],
      cooldownReduction: [1 - mod.cooldown.skill, 1 - afterMod.cooldown.skill],
    };
    return (Object.keys(totals) as EquipStat[]).map(stat => {
      const pair = coreStats[stat] ?? battleStats[stat];
      const value = pair ? pair[0] : totals[stat];
      const next = pair ? pair[1] : afterTotals[stat];
      const diff = Math.round((next - value) * 10000) / 10000;
      const display = (n: number) => coreStats[stat] ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : this.formatStat(stat, n);
      return {
        stat, label: STAT_TABLE_LABEL[stat] ?? STAT_LABEL[stat],
        gear: this.formatStat(stat, totals[stat], true),
        total: stat === 'atkFlat' ? '—' : display(value),
        current: display(value), after: display(next), direction: Math.sign(diff),
        delta: diff ? (diff > 0 ? '+' : '−') + display(Math.abs(diff)) : '—',
      };
    });
  });
  readonly hasWeaponMismatch = computed(() => this.selected() !== null && !this.usable(this.selected()!));

  sealSlot(item: EquipmentInstance): SealSlot {
    const slot = slotOf(item);
    if (slot === 'WEAPON') return 'weapon';
    if (slot === 'ARMOR') return 'armor';
    if (slot === 'HELMET') return 'helmet';
    if (slot === 'RING') return 'ring';
    return 'necklace';
  }

  sealItem(slot: SealSlot): EquipmentInstance | undefined {
    const hero = this.hero();
    return hero ? heroGear(hero).find(item => this.sealSlot(item) === slot) : undefined;
  }

  changeHero(step: number): void {
    const heroes = this.roster.heroes();
    if (heroes.length < 2) return;
    const index = heroes.findIndex(h => h.uid === this.heroUid());
    this.heroUid.set(heroes[(index + step + heroes.length) % heroes.length].uid);
    this.removedSealSketch.set({});
    this.clearComparison();
  }

  chooseSeal(slot: SealSlot | 'all'): void {
    this.sealFilter.set(slot);
    this.rarityFilter.set('all');
    this.clearComparison();
  }

  chooseOwner(owner: OwnerFilter): void {
    this.ownerFilter.set(owner);
    this.keepVisibleComparison();
  }

  chooseRarity(rarity: Rarity | 'all'): void {
    this.rarityFilter.set(rarity);
    this.keepVisibleComparison();
  }

  selectSealItem(item: EquipmentInstance): void {
    this.selectedId.set(item.instanceId);
    this.selectionPulse.update(tick => tick + 1);
    this.message.set('');
  }

  clearComparison(): void {
    this.selectedId.set(null);
    this.message.set('');
  }

  finishTransfer(item: EquipmentInstance): void {
    const current = this.allItems().find(entry => entry.instanceId === item.instanceId);
    if (!current || current.equippedHeroId !== item.equippedHeroId) {
      this.say('NOT_FOUND', '');
      return;
    }
    this.equipFromSeal(current);
  }

  equipFromSeal(item: EquipmentInstance): void {
    const error = this.eq.equip(this.heroUid(), item.instanceId);
    if (!error) {
      this.selectedId.set(null);
      this.sealPulse.update(previous => ({ slot: this.sealSlot(item), tick: (previous?.tick ?? 0) + 1 }));
    }
    this.say(error, 'สวม ' + this.name(item));
  }

  removeFromSeal(item: EquipmentInstance): void {
    if (item.equippedHeroId !== this.heroUid()) return;
    this.eq.unequip(this.heroUid(), slotOf(item));
    const family = equipmentArtFamily(item.definitionId, item.instanceId);
    const tier = item.rarity.toLowerCase();
    const sketch = item.tier && family === 'sword' ? `/ui/equipment/patch-one/weapon-t${item.tier}.webp`
      : slotOf(item) === 'HELMET' ? '/ui/home-k7/nav_hero_helm.webp'
      : family === 'sword' ? `/ui/generated/equipment/swords/foreground/${tier}.webp`
      : `/ui/equipment/tiered/${family}/${item.rarity === 'LEGENDARY' ? 'epic' : tier}.webp`;
    this.removedSealSketch.update(previous => ({ ...previous, [this.sealSlot(item)]: sketch }));
    this.selectedId.set(null);
    this.say(null, 'ถอด ' + this.name(item));
  }

  upgradeFromSeal(item: EquipmentInstance): void {
    const error = this.eq.upgrade(item.instanceId, item.upgradeLevel);
    if (!error) this.selectionPulse.update(tick => tick + 1);
    this.say(error, 'ตีบวก ' + this.name(this.selected() ?? item));
  }

  private keepVisibleComparison(): void {
    if (!this.sealBag().some(item => item.instanceId === this.selectedId())) this.clearComparison();
  }

  private formatStat(stat: EquipStat, value: number, signed = false): string {
    const magnitude = FLAT_STATS.includes(stat) ? value.toLocaleString('en-US') : +(value * 100).toFixed(2) + '%';
    return (signed && value > 0 ? '+' : '') + magnitude;
  }

  readonly name = itemName;
  readonly price = (i: EquipmentInstance) => SELL_GOLD[i.rarity];
  readonly cap = upgradeCap;
  readonly affixName = (item: EquipmentInstance) => equipmentAffixLabel(item.affix, item.rarity);
  readonly lines = (i: EquipmentInstance) => itemLines(i).slice(0, 1 + i.secondaries.length);
  readonly fmt = (line: StatLine) => STAT_LABEL[line.stat] + ' ' + this.formatStat(line.stat, line.value, true);
  readonly usable = (i: EquipmentInstance) => { const c = this.cls(); return !!c && canEquip(c, i); };
  readonly slotLabel: Record<EquipmentSlot | 'ALL', string> = { ALL: 'ทั้งหมด', ...SLOT_NAMES };
  readonly slotIcon: Record<EquipmentSlot | 'ALL', string> = { ALL: 'heroes', ...SLOT_ICONS };
  readonly filters: (EquipmentSlot | 'ALL')[] = ['ALL', ...SLOTS];

  compare(i: EquipmentInstance) {
    return this.eq.compare(this.heroUid(), i).map(d => this.fmt({ stat: d.stat, value: d.delta }));
  }

  private say(err: string | null, ok: string) { this.message.set(err ? ERR[err] ?? err : ok); }
  equip(i: EquipmentInstance) { this.say(this.eq.equip(this.heroUid(), i.instanceId), `สวม ${itemName(i)}`); }
  unequip(slot: EquipmentSlot) { this.eq.unequip(this.heroUid(), slot); }
  toggleLock(i: EquipmentInstance) { this.eq.lock(i.instanceId, !i.locked); }
  readonly pendingSale = signal<EquipmentInstance | null>(null);
  sell(i: EquipmentInstance) {
    const error = this.eq.sell(i.instanceId);
    if (!error && this.selectedId() === i.instanceId) this.selectedId.set(null);
    this.say(error, `ขาย ${itemName(i)}`);
  }
}
