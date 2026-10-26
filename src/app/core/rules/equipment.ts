/**
 * Equipment rules (pure): item lines, gear totals with caps, rolling / crafting, upgrades, dismantle, sell, lock,
 * equip / unequip on the GameState, Hunt drops and the simulation gear profiles.
 * Equipped items live on the hero (`OwnedHero.gear`), unequipped ones in `GameState.equipment` — an item is always
 * in exactly one place and keeps `equippedHeroId` in sync.
 */
import {
  ACCESSORY_MAIN_VALUES, AFFIXES, CLASS_BUILDS, CRAFT_RECIPES, DISMANTLE_FRAGMENTS, DISMANTLE_ORE, DISMANTLE_REFUND, EQUIPMENT_DEFS,
  FLAT_STATS, GEAR_PROFILES, GearProfileId, GOLD_PER_ORE, HUNT_TARGET_SHARE, MAIN_STAT_VALUES, RARITIES, RARITY_NAME, RARITY_RULES,
  SECONDARY_VALUES, SELL_GOLD, SLOTS, STAT_CAPS, UPGRADE_COST_CURVE, UPGRADE_ORE_BASE, UPGRADE_STEP, WEAPON_DEF_OF, WEAPON_GROUP_OF,
} from '../data/equipment';
import { HERO_BY_ID } from '../data/heroes';
import {
  EquipmentDefinition, EquipmentDropTable, EquipmentInstance, EquipmentSlot, EquipStat, GearTotals, HuntTarget, Rarity, StatLine,
} from '../models/equipment';
import { GameState } from '../models/game-state';
import { HeroClass, OwnedHero } from '../models/hero';

const ALL_STATS: EquipStat[] = [
  'atkPct', 'atkFlat', 'hpPct', 'defPct', 'critChance', 'critDamage', 'skillDamage', 'healingPower', 'shieldPower', 'healingReceived',
  'cooldownReduction', 'attackSpeed', 'moveSpeed', 'breakPower', 'damageReduction', 'bleedReduction', 'poisonReduction', 'rootReduction',
  'diveReduction', 'execution', 'mistHunter',
];
export const emptyTotals = (): GearTotals => Object.fromEntries(ALL_STATS.map(s => [s, 0])) as GearTotals;

const round4 = (v: number) => Math.round(v * 10000) / 10000;
export const defOf = (i: EquipmentInstance): EquipmentDefinition => EQUIPMENT_DEFS[i.definitionId];
export const slotOf = (i: EquipmentInstance): EquipmentSlot => defOf(i).slot;
export const itemName = (i: EquipmentInstance) => `${RARITY_NAME[i.rarity]} ${defOf(i).name}${i.upgradeLevel ? ` +${i.upgradeLevel}` : ''}`;
export const upgradeCap = (i: EquipmentInstance) => RARITY_RULES[i.rarity].upgradeCap;

/** main stat value at +0 for a base / rarity (accessories use their smaller raw-stat table when there is one) */
export function mainBaseValue(def: EquipmentDefinition, stat: EquipStat, rarity: Rarity): number {
  const table = (def.slot === 'ACCESSORY' && ACCESSORY_MAIN_VALUES[stat]) || MAIN_STAT_VALUES[stat];
  if (!table) throw new Error(`no main stat table for ${stat}`);
  return table[rarity];
}

/** upgraded main stat: × (1 + 4 % per level) → +10 = ×1.40; flat stats round to whole numbers */
export function mainValue(i: EquipmentInstance, level = i.upgradeLevel): number {
  const v = i.main.value * (1 + UPGRADE_STEP * level);
  return FLAT_STATS.includes(i.main.stat) ? Math.round(v) : round4(v);
}

/** every stat line an item grants (main upgraded, secondaries fixed, affix scaled by rarity) */
export function itemLines(i: EquipmentInstance): StatLine[] {
  const out: StatLine[] = [{ stat: i.main.stat, value: mainValue(i) }, ...i.secondaries];
  if (i.affix) {
    const a = AFFIXES[i.affix];
    const v = a.effect.value * RARITY_RULES[i.rarity].affixScale;
    out.push({ stat: a.effect.stat, value: FLAT_STATS.includes(a.effect.stat) ? Math.round(v) : round4(v) });
  }
  return out;
}

/** summed gear effect of a set of items, each stat capped (STAT_CAPS) — the only place caps are applied */
export function gearTotals(items: (EquipmentInstance | undefined)[]): GearTotals {
  const t = emptyTotals();
  for (const i of items) if (i) for (const l of itemLines(i)) t[l.stat] += l.value;
  for (const s of ALL_STATS) {
    const cap = STAT_CAPS[s];
    if (cap != null) t[s] = Math.min(cap, t[s]);
    t[s] = round4(t[s]);
  }
  return t;
}

export const heroGear = (h: OwnedHero): EquipmentInstance[] => SLOTS.map(s => h.gear?.[s]).filter((x): x is EquipmentInstance => !!x);
export const heroGearTotals = (h: OwnedHero) => gearTotals(heroGear(h));

/** can this class use the item? (weapons: weapon group; armor / accessory: everyone) */
export function canEquip(cls: HeroClass, i: EquipmentInstance): boolean {
  const d = defOf(i);
  return d.slot !== 'WEAPON' || d.weaponGroup === WEAPON_GROUP_OF[cls];
}

// ------------------------------------------------------------------ rolling / crafting

export interface RollOptions {
  /** force a main stat (crafting) — must be in the base's pool */
  main?: EquipStat;
  /** force the secondaries (profiles) / affix (profiles) */
  secondaries?: EquipStat[];
  affix?: string | null;
}

const pick = <T>(list: T[], rng: () => number): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** a new item of `rarity` from a base: main from the pool (or chosen), secondaries + affix by the rarity rules */
export function rollItem(defId: string, rarity: Rarity, rng: () => number, instanceId: number, o: RollOptions = {}): EquipmentInstance {
  const def = EQUIPMENT_DEFS[defId];
  if (!def) throw new Error(`unknown equipment ${defId}`);
  const mainStat = o.main ?? pick(def.mainStats, rng);
  if (!def.mainStats.includes(mainStat)) throw new Error(`${mainStat} is not a main stat of ${defId}`);
  const rules = RARITY_RULES[rarity];
  const [lo, hi] = rules.secondaries;
  const n = lo + (hi > lo ? Math.floor(rng() * (hi - lo + 1)) : 0);
  const pool = def.secondaryPool.filter(s => SECONDARY_VALUES[s]);
  // profiles pass their wanted secondaries (up to the rarity's maximum); drops / crafts roll distinct ones
  const secStats: EquipStat[] = o.secondaries ? o.secondaries.filter(s => SECONDARY_VALUES[s]).slice(0, hi) : [];
  while (!o.secondaries && secStats.length < n) {
    const left = pool.filter(x => !secStats.includes(x));
    if (!left.length) break;
    secStats.push(pick(left, rng));
  }
  const secondaries = secStats.slice(0, hi).map(s => ({ stat: s, value: SECONDARY_VALUES[s]![rarity] }));
  let affix: string | undefined;
  if (o.affix !== undefined) affix = o.affix && rules.affixChance > 0 ? o.affix : undefined;
  else if (rules.affixChance > 0 && rng() < rules.affixChance) affix = pick(def.affixPool, rng);
  if (affix && !def.affixPool.includes(affix)) throw new Error(`${affix} cannot roll on ${defId}`);
  return {
    instanceId, definitionId: defId, rarity, upgradeLevel: 0,
    main: { stat: mainStat, value: mainBaseValue(def, mainStat, rarity) },
    secondaries, ...(affix ? { affix } : {}), locked: false, equippedHeroId: null, oreInvested: 0,
  };
}

export type EquipError = 'NOT_FOUND' | 'LOCKED' | 'EQUIPPED' | 'WRONG_CLASS' | 'MAX_LEVEL' | 'NEED_ORE' | 'NEED_GOLD' | 'NEED_FRAGMENTS' | 'NO_RECIPE' | 'BAD_MAIN';
type Result = { state: GameState } | { error: EquipError };

/** craft an item of `rarity` for the chosen base + main stat (deterministic target, random secondaries / affix) */
export function craft(state: GameState, rarity: Rarity, defId: string, main: EquipStat, rng: () => number): Result & { item?: EquipmentInstance } {
  const r = CRAFT_RECIPES[rarity];
  if (!r) return { error: 'NO_RECIPE' };
  if (!EQUIPMENT_DEFS[defId]?.mainStats.includes(main)) return { error: 'BAD_MAIN' };
  if ((state.inventory[r.fragmentId] ?? 0) < r.fragments) return { error: 'NEED_FRAGMENTS' };
  if (state.gold < r.gold) return { error: 'NEED_GOLD' };
  const item = rollItem(defId, rarity, rng, state.nextItemId ?? 1, { main });
  return {
    item,
    state: {
      ...state, gold: state.gold - r.gold, nextItemId: (state.nextItemId ?? 1) + 1,
      inventory: { ...state.inventory, [r.fragmentId]: (state.inventory[r.fragmentId] ?? 0) - r.fragments },
      equipment: [...(state.equipment ?? []), item],
    },
  };
}

/** Player craft: choose rarity/slot; base and legal main stat are uniformly rolled. */
export function craftRandom(state: GameState, rarity: Rarity, slot: EquipmentSlot, rng: () => number): Result & { item?: EquipmentInstance } {
  const recipe = CRAFT_RECIPES[rarity];
  if (!recipe) return { error: 'NO_RECIPE' };
  const bases = Object.values(EQUIPMENT_DEFS).filter(d => d.slot === slot);
  if (!bases.length) return { error: 'NO_RECIPE' };
  if ((state.inventory[recipe.fragmentId] ?? 0) < recipe.fragments) return { error: 'NEED_FRAGMENTS' };
  if (state.gold < recipe.gold) return { error: 'NEED_GOLD' };
  const base = pick(bases, rng);
  return craft(state, rarity, base.id, pick(base.mainStats, rng), rng);
}

// ------------------------------------------------------------------ upgrades / dismantle / sell / lock

/** cost of the next upgrade step (+n → +n+1) */
export function upgradeCost(i: EquipmentInstance): { ore: number; gold: number } | null {
  if (i.upgradeLevel >= upgradeCap(i)) return null;
  const ore = Math.round(UPGRADE_ORE_BASE[i.rarity] * UPGRADE_COST_CURVE[i.upgradeLevel]);
  return { ore, gold: ore * GOLD_PER_ORE };
}

/** total ore to take an item from +0 to +level */
export function totalUpgradeOre(rarity: Rarity, level: number): number {
  let ore = 0;
  for (let l = 0; l < level; l++) ore += Math.round(UPGRADE_ORE_BASE[rarity] * UPGRADE_COST_CURVE[l]);
  return ore;
}

/** find an item wherever it is (bag or a hero's slot) */
export function findItem(state: GameState, id: number): { item: EquipmentInstance; heroUid: number | null } | null {
  const bag = (state.equipment ?? []).find(i => i.instanceId === id);
  if (bag) return { item: bag, heroUid: null };
  for (const h of state.heroes) for (const s of SLOTS) if (h.gear?.[s]?.instanceId === id) return { item: h.gear[s]!, heroUid: h.uid };
  return null;
}

/** replace an item in place (bag or hero slot) */
function putItem(state: GameState, item: EquipmentInstance): GameState {
  const f = findItem(state, item.instanceId);
  if (!f) return state;
  if (f.heroUid == null) return { ...state, equipment: state.equipment.map(i => (i.instanceId === item.instanceId ? item : i)) };
  return { ...state, heroes: state.heroes.map(h => (h.uid === f.heroUid ? { ...h, gear: { ...h.gear, [slotOf(item)]: item } } : h)) };
}

/** every upgrade succeeds (no failure / destruction / downgrade) */
export function upgrade(state: GameState, id: number): Result {
  const f = findItem(state, id);
  if (!f) return { error: 'NOT_FOUND' };
  const cost = upgradeCost(f.item);
  if (!cost) return { error: 'MAX_LEVEL' };
  if ((state.inventory['enhancement_ore'] ?? 0) < cost.ore) return { error: 'NEED_ORE' };
  if (state.gold < cost.gold) return { error: 'NEED_GOLD' };
  const item = { ...f.item, upgradeLevel: f.item.upgradeLevel + 1, oreInvested: f.item.oreInvested + cost.ore };
  const s = putItem(state, item);
  return { state: { ...s, gold: s.gold - cost.gold, inventory: { ...s.inventory, enhancement_ore: (s.inventory['enhancement_ore'] ?? 0) - cost.ore } } };
}

export function dismantleRewards(i: EquipmentInstance): { itemId: string; count: number }[] {
  const frag = DISMANTLE_FRAGMENTS[i.rarity];
  return [{ itemId: 'enhancement_ore', count: DISMANTLE_ORE[i.rarity] + Math.floor(i.oreInvested * DISMANTLE_REFUND) }, { ...frag }];
}

const addItems = (inv: Record<string, number>, items: { itemId: string; count: number }[]) => {
  const out = { ...inv };
  for (const it of items) out[it.itemId] = (out[it.itemId] ?? 0) + it.count;
  return out;
};

/** dismantle a bag item (locked / equipped items are refused): ore + fragments + 75 % of upgrade ore */
export function dismantle(state: GameState, id: number): Result {
  const f = findItem(state, id);
  if (!f) return { error: 'NOT_FOUND' };
  if (f.item.locked) return { error: 'LOCKED' };
  if (f.heroUid != null) return { error: 'EQUIPPED' };
  return { state: { ...state, equipment: state.equipment.filter(i => i.instanceId !== id), inventory: addItems(state.inventory, dismantleRewards(f.item)) } };
}

/** Validate the whole selection before returning one new state; no partial salvage. */
export function dismantleMany(state: GameState, ids: readonly number[]): Result {
  const unique = [...new Set(ids)];
  if (!unique.length) return { error: 'NOT_FOUND' };
  let next = state;
  for (const id of unique) {
    const result = dismantle(next, id);
    if ('error' in result) return result;
    next = result.state;
  }
  return { state: next };
}

export function sell(state: GameState, id: number): Result {
  const f = findItem(state, id);
  if (!f) return { error: 'NOT_FOUND' };
  if (f.item.locked) return { error: 'LOCKED' };
  if (f.heroUid != null) return { error: 'EQUIPPED' };
  return { state: { ...state, equipment: state.equipment.filter(i => i.instanceId !== id), gold: state.gold + SELL_GOLD[f.item.rarity] } };
}

export function setLocked(state: GameState, id: number, locked: boolean): Result {
  const f = findItem(state, id);
  if (!f) return { error: 'NOT_FOUND' };
  return { state: putItem(state, { ...f.item, locked }) };
}

// ------------------------------------------------------------------ equip / unequip

/** equip a bag item on a hero; the replaced item goes back to the bag. Runtime stats are derived per battle. */
export function equip(state: GameState, heroUid: number, id: number): Result {
  const f = findItem(state, id);
  const hero = state.heroes.find(h => h.uid === heroUid);
  if (!f || !hero) return { error: 'NOT_FOUND' };
  if (!canEquip(HERO_BY_ID[hero.templateId].cls, f.item)) return { error: 'WRONG_CLASS' };
  let s = f.heroUid != null ? unequipSlot(state, f.heroUid, slotOf(f.item)) : state;
  const slot = slotOf(f.item);
  const current = s.heroes.find(h => h.uid === heroUid)!.gear?.[slot];
  if (current) s = unequipSlot(s, heroUid, slot);
  const item = { ...f.item, equippedHeroId: heroUid };
  return {
    state: {
      ...s,
      equipment: s.equipment.filter(i => i.instanceId !== id),
      heroes: s.heroes.map(h => (h.uid === heroUid ? { ...h, gear: { ...h.gear, [slot]: item } } : h)),
    },
  };
}

export function unequipSlot(state: GameState, heroUid: number, slot: EquipmentSlot): GameState {
  const hero = state.heroes.find(h => h.uid === heroUid);
  const item = hero?.gear?.[slot];
  if (!hero || !item) return state;
  const gear = { ...hero.gear };
  delete gear[slot];
  return {
    ...state,
    equipment: [...(state.equipment ?? []), { ...item, equippedHeroId: null }],
    heroes: state.heroes.map(h => (h.uid === heroUid ? { ...h, gear } : h)),
  };
}

/** a hero leaving the roster (permadeath / release): its gear returns to the bag, never destroyed */
export function releaseHeroGear(state: GameState, heroUid: number): GameState {
  let s = state;
  for (const slot of SLOTS) s = unequipSlot(s, heroUid, slot);
  return s;
}

// ------------------------------------------------------------------ comparison

/** stat deltas of swapping `candidate` into its slot on `h` (after caps) — for the item comparison UI */
export function compareGear(h: OwnedHero, candidate: EquipmentInstance): { stat: EquipStat; delta: number }[] {
  const slot = slotOf(candidate);
  const now = heroGearTotals(h);
  const next = gearTotals(SLOTS.map(s => (s === slot ? candidate : h.gear?.[s])));
  return (Object.keys(now) as EquipStat[]).map(stat => ({ stat, delta: round4(next[stat] - now[stat]) })).filter(d => Math.abs(d.delta) > 1e-6);
}

/**
 * Approximate effective combat improvement of a gear set (report / UI only, never used by combat):
 * offense = ATK × expected crit × skill share × attack speed × CDR · defense = HP × DEF share / (1 − DR) × healing received
 * → off × def − 1 (a fight is won by damage dealt × time survived). Utility affixes are not counted.
 */
export function effectivePower(t: GearTotals): number {
  const crit = (1 + (0.1 + t.critChance) * (0.5 + t.critDamage)) / 1.05;
  const off = (1 + t.atkPct) * crit * (1 + t.skillDamage * 0.4) * (1 + t.attackSpeed * 0.6) * (1 + t.cooldownReduction * 0.5) * (1 + t.healingPower * 0.5);
  const def = (1 + t.hpPct) * (1 + t.defPct * 0.3) / (1 - t.damageReduction) * (1 + t.healingReceived * 0.3);
  return off * def - 1;
}

// ------------------------------------------------------------------ Hunt drops

/** pick a rarity from weights */
export function rollRarity(weights: Partial<Record<Rarity, number>>, rng: () => number): Rarity {
  const entries = RARITIES.filter(r => (weights[r] ?? 0) > 0).map(r => [r, weights[r]!] as const);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let x = rng() * total;
  for (const [r, w] of entries) if ((x -= w) < 0) return r;
  return entries[entries.length - 1][0];
}

/** which base drops: the target slot gets HUNT_TARGET_SHARE, weapons follow the deployed team's weapon groups */
export function rollDropBase(target: HuntTarget, groups: string[], rng: () => number): string {
  const slot: EquipmentSlot = target !== 'ANY' && rng() < HUNT_TARGET_SHARE ? target : pick(SLOTS, rng);
  if (slot === 'WEAPON') return WEAPON_DEF_OF[pick(groups.length ? groups : Object.keys(WEAPON_DEF_OF), rng) as keyof typeof WEAPON_DEF_OF];
  return slot === 'ARMOR' ? 'guard_armor' : 'trinket';
}

/** one Hunt clear's item drops (drop chance unchanged by bonus / repeat — fragments carry the determinism) */
export function rollHuntItems(table: EquipmentDropTable, target: HuntTarget, groups: string[], rng: () => number, nextId: number, guaranteed?: Rarity): EquipmentInstance[] {
  const out: EquipmentInstance[] = [];
  if (guaranteed) out.push(rollItem(rollDropBase(target, groups, rng), guaranteed, rng, nextId + out.length));
  if (rng() < table.itemChance) out.push(rollItem(rollDropBase(target, groups, rng), rollRarity(table.rarityWeights, rng), rng, nextId + out.length));
  return out;
}

// ------------------------------------------------------------------ simulation gear profiles

/** the gear a sensible player of this class has at a profile (fixed, no RNG) */
export function profileGear(cls: HeroClass, profile: GearProfileId): Partial<Record<EquipmentSlot, EquipmentInstance>> {
  const p = GEAR_PROFILES[profile];
  const out: Partial<Record<EquipmentSlot, EquipmentInstance>> = {};
  let id = 90000;
  for (const slot of SLOTS) {
    const piece = p.pieces[slot];
    const build = CLASS_BUILDS[cls][slot];
    const defId = slot === 'WEAPON' ? WEAPON_DEF_OF[WEAPON_GROUP_OF[cls]] : slot === 'ARMOR' ? 'guard_armor' : 'trinket';
    const item = rollItem(defId, piece.rarity, () => 0, id++, { main: build.main, secondaries: build.secondaries, affix: piece.affix ? build.affix : null });
    out[slot] = { ...item, upgradeLevel: Math.min(piece.level, RARITY_RULES[piece.rarity].upgradeCap) };
  }
  return out;
}
