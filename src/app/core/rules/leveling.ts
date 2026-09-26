/**
 * Hero EXP / level / breakthrough rules (pure). Data: core/data/economy.ts.
 * - EXP comes from battle clears and potions; levels go up while EXP ≥ the next requirement
 * - a breakthrough gate stops the level (state BREAKTHROUGH_READY); EXP keeps accumulating, never discarded
 * - the breakthrough consumes its items, raises the level and processes the stored EXP
 * - Lv10 (Patch 1 cap): no more EXP (no invisible Lv11 progress)
 */
import { BREAKTHROUGHS, EXP_POTIONS, EXP_TO_NEXT, ITEMS } from '../data/economy';
import { PATCH_1 } from '../data/progression';
import { BreakthroughDefinition, HeroLevelState, HeroProgressView, ItemStack, UnlockFlag } from '../models/economy';
import { OwnedHero } from '../models/hero';

export type Inventory = Record<string, number>;

export const expToNext = (level: number): number => (level >= PATCH_1.levelCap ? 0 : EXP_TO_NEXT[level - 1] ?? 0);

/** total EXP from Lv1 to `level` */
export const totalExpTo = (level: number): number => EXP_TO_NEXT.slice(0, Math.max(0, level - 1)).reduce((a, b) => a + b, 0);

export const breakthroughTier = (h: OwnedHero) => h.breakthroughTier ?? 0;

/** the next breakthrough this hero still needs (undefined = none left) */
export const nextBreakthrough = (h: OwnedHero): BreakthroughDefinition | undefined =>
  BREAKTHROUGHS.find(b => b.tier === breakthroughTier(h) + 1);

/** current level cap: the next breakthrough gate, else the Patch 1 cap */
export const currentLevelCap = (h: OwnedHero): number => nextBreakthrough(h)?.fromLevel ?? PATCH_1.levelCap;

export function levelState(h: OwnedHero): HeroLevelState {
  if (h.level >= PATCH_1.levelCap) return 'MAX';
  if (h.level >= currentLevelCap(h) && (h.exp ?? 0) >= expToNext(h.level)) return 'BREAKTHROUGH_READY';
  return 'NORMAL';
}

/** most EXP a hero can hold: everything still needed to reach Lv10 (nothing beyond the Patch 1 cap) */
export const maxStorableExp = (h: OwnedHero): number => totalExpTo(PATCH_1.levelCap) - totalExpTo(h.level);

/** level up as far as EXP and the current cap allow */
function settle(h: OwnedHero): { hero: OwnedHero; levelsGained: number } {
  let { level } = h;
  let exp = Math.min(h.exp ?? 0, maxStorableExp(h));
  const cap = currentLevelCap(h);
  let gained = 0;
  while (level < cap && exp >= expToNext(level) && expToNext(level) > 0) {
    exp -= expToNext(level);
    level++;
    gained++;
  }
  if (level >= PATCH_1.levelCap) exp = 0;
  return { hero: { ...h, level, exp }, levelsGained: gained };
}

/** add EXP (battle reward / potion); returns the EXP actually taken (0 at Lv10) */
export function addExp(h: OwnedHero, amount: number): { hero: OwnedHero; levelsGained: number; taken: number } {
  if (h.level >= PATCH_1.levelCap || amount <= 0) return { hero: h, levelsGained: 0, taken: 0 };
  const room = maxStorableExp(h) - (h.exp ?? 0);
  const taken = Math.max(0, Math.min(Math.round(amount), room));
  const r = settle({ ...h, exp: (h.exp ?? 0) + taken });
  return { ...r, taken };
}

export const hasItems = (inv: Inventory, need: ItemStack[]) => need.every(n => (inv[n.itemId] ?? 0) >= n.count);

export type BreakthroughFail = 'NOT_AT_GATE' | 'NEED_EXP' | 'NEED_ITEMS' | 'MAX';

/** perform the pending breakthrough: consume items, level up, process the stored EXP */
export function breakthrough(h: OwnedHero, inv: Inventory): { hero: OwnedHero; inventory: Inventory } | { error: BreakthroughFail } {
  const bt = nextBreakthrough(h);
  if (h.level >= PATCH_1.levelCap || !bt) return { error: 'MAX' };
  if (h.level !== bt.fromLevel) return { error: 'NOT_AT_GATE' };
  if ((h.exp ?? 0) < expToNext(h.level)) return { error: 'NEED_EXP' };
  if (!hasItems(inv, bt.requiredItems)) return { error: 'NEED_ITEMS' };
  const inventory = { ...inv };
  for (const n of bt.requiredItems) inventory[n.itemId] -= n.count;
  const up: OwnedHero = { ...h, breakthroughTier: bt.tier, level: bt.toLevel, exp: (h.exp ?? 0) - expToNext(h.level) };
  return { hero: settle(up).hero, inventory };
}

/** EXP still needed until the hero is capped (breakthrough-ready at a gate, or Lv10) */
export function expUntilCapped(h: OwnedHero): number {
  const cap = currentLevelCap(h);
  const needTo = cap >= PATCH_1.levelCap ? totalExpTo(PATCH_1.levelCap) : totalExpTo(cap) + expToNext(cap);
  return Math.max(0, needTo - totalExpTo(h.level) - (h.exp ?? 0));
}

/**
 * Use EXP potions on a hero (never automatic). `count` = a number (Use 1 / Use 10) or 'max' (just enough to reach
 * the current cap — breakthrough-ready or Lv10 — so nothing is wasted). Explicit counts may push EXP into the
 * breakthrough overflow; EXP beyond Lv10 is never accepted (those potions are not consumed).
 */
export function useExpPotion(h: OwnedHero, inv: Inventory, itemId: string, count: number | 'max'): { hero: OwnedHero; inventory: Inventory; used: number } {
  const def = ITEMS[itemId];
  const have = inv[itemId] ?? 0;
  if (!def?.exp || have <= 0 || h.level >= PATCH_1.levelCap) return { hero: h, inventory: inv, used: 0 };
  const want = count === 'max' ? Math.ceil(expUntilCapped(h) / def.exp) : count;
  const room = Math.ceil((maxStorableExp(h) - (h.exp ?? 0)) / def.exp);
  const used = Math.max(0, Math.min(want, have, room));
  if (!used) return { hero: h, inventory: inv, used: 0 };
  const hero = addExp(h, used * def.exp).hero;
  return { hero, inventory: { ...inv, [itemId]: have - used }, used };
}

/** "Use Max" across every potion size, largest first */
export function useAllPotionsToCap(h: OwnedHero, inv: Inventory): { hero: OwnedHero; inventory: Inventory } {
  let hero = h;
  let inventory = inv;
  for (const id of EXP_POTIONS) {
    const need = expUntilCapped(hero);
    if (need <= 0) break;
    const exp = ITEMS[id].exp!;
    // big potions only while they don't overshoot a lot; the small ones finish the job
    const n = id === EXP_POTIONS[EXP_POTIONS.length - 1] ? Math.ceil(need / exp) : Math.floor(need / exp);
    if (n > 0) ({ hero, inventory } = useExpPotion(hero, inventory, id, n));
  }
  return { hero, inventory };
}

/** unlock flags earned by completed breakthroughs (skill rank cap 3, gear tier, talent slot — systems come later) */
export const unlockFlags = (h: OwnedHero): UnlockFlag[] =>
  BREAKTHROUGHS.filter(b => b.tier <= breakthroughTier(h)).flatMap(b => b.unlockFlags);

/** hero screen: Lv, EXP / required, cap, breakthrough requirement vs stones owned */
export function heroProgressView(h: OwnedHero, inv: Inventory): HeroProgressView {
  const bt = nextBreakthrough(h);
  const atGate = !!bt && h.level === bt.fromLevel;
  return {
    level: h.level,
    exp: h.exp ?? 0,
    expToNext: expToNext(h.level),
    levelCap: currentLevelCap(h),
    state: levelState(h),
    ...(atGate ? { breakthrough: { def: bt!, have: bt!.requiredItems.map(n => ({ itemId: n.itemId, count: inv[n.itemId] ?? 0 })) } } : {}),
  };
}

/** older saves: infer completed breakthroughs from the level (a Lv7 hero already passed Lv5 → 6) */
export function migrateHeroProgress(h: OwnedHero): OwnedHero {
  if (h.breakthroughTier != null && h.exp != null) return h;
  const tier = h.breakthroughTier ?? BREAKTHROUGHS.filter(b => h.level >= b.toLevel).length;
  return { ...h, breakthroughTier: tier, exp: h.exp ?? 0, level: Math.min(h.level, PATCH_1.levelCap) };
}
