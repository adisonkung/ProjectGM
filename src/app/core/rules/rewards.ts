/**
 * Generic rewards, daily bonus and farm / tower run completion (pure). Every source uses RewardBundle:
 * tower clears, Training Ground, Ascension Trial — later equipment / skill dungeons.
 */
import { DAILY_BONUS, FARM_DUNGEONS, ITEMS, TOWER_REWARDS, TRAINING_SLOTS } from '../data/economy';
import { DailyState, FarmDungeonDefinition, ItemStack, RewardBreakdown, RewardBundle } from '../models/economy';
import { GameState } from '../models/game-state';
import { OwnedHero } from '../models/hero';
import { addExp, Inventory } from './leveling';
import { rollHuntItems } from './equipment';
import { WEAPON_GROUP_OF } from '../data/equipment';
import { HERO_BY_ID } from '../data/heroes';

/** local calendar day key (daily reset at local midnight) */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** a fresh daily state on a new day — only the counters reset, never heroes or inventory */
export const ensureDaily = (daily: DailyState | undefined, now: Date): DailyState =>
  daily && daily.day === dayKey(now) ? daily : { day: dayKey(now), used: {} };

export const dailyBonusLeft = (daily: DailyState, pool: string): number => Math.max(0, (DAILY_BONUS[pool] ?? 0) - (daily.used[pool] ?? 0));

export const isUnlocked = (def: FarmDungeonDefinition, clearedFloor: number) => clearedFloor >= def.unlockFloor;

export const unlockedDungeons = (clearedFloor: number) => FARM_DUNGEONS.filter(d => isUnlocked(d, clearedFloor));

/** roll the bonus drops (independent chances) into the item list */
function rollItems(b: RewardBundle, rng: () => number): ItemStack[] {
  const items = (b.items ?? []).map(i => ({ ...i }));
  for (const d of b.bonusDrops ?? []) if (rng() < d.chance) items.push(...d.items.map(i => ({ ...i })));
  return items;
}

const scale = (items: ItemStack[], k: number): ItemStack[] => items.map(i => ({ itemId: i.itemId, count: i.count * k }));

/**
 * Farm reward: daily bonus = base × dailyBonusMultiplier; after the bonus = base × repeatRewardMultiplier
 * (65 % Training / 60 % Ascension of BASE, not of the doubled reward). First clear adds its bonus once. Item counts may be fractional here —
 * `grantItems` turns them into stones + fragments or carries the rest.
 */
export function farmRewardBreakdown(def: FarmDungeonDefinition, o: { bonus: boolean; firstClear: boolean; rng: () => number }): RewardBreakdown {
  const k = o.bonus ? def.dailyBonusMultiplier : def.repeatRewardMultiplier;
  const rolled = rollItems(def.baseRewards, o.rng);
  const items = scale(rolled, k);
  if (o.firstClear && def.firstClearBonus?.items) items.push(...def.firstClearBonus.items.map(i => ({ ...i })));
  return {
    base: { ...def.baseRewards, items: rolled },
    kind: o.bonus ? 'DAILY_BONUS' : 'REPEAT',
    multiplier: k,
    ...(o.firstClear && def.firstClearBonus ? { firstClear: def.firstClearBonus } : {}),
    final: {
      heroExp: Math.round((def.baseRewards.heroExp ?? 0) * k) + (o.firstClear ? def.firstClearBonus?.heroExp ?? 0 : 0),
      gold: Math.round((def.baseRewards.gold ?? 0) * k),
      items,
    },
  };
}

/** tower battle-clear EXP (+ the floor's first-clear bonus) — no daily bonus, tower is not the farming place */
export function towerRewardBreakdown(floor: number, firstClear: boolean): RewardBreakdown {
  const t = TOWER_REWARDS[floor] ?? { clear: {}, firstClear: {} };
  return {
    base: t.clear,
    kind: firstClear ? 'TOWER_FIRST' : 'TOWER_REPEAT',
    multiplier: 1,
    ...(firstClear ? { firstClear: t.firstClear } : {}),
    final: {
      heroExp: (t.clear.heroExp ?? 0) + (firstClear ? t.firstClear.heroExp ?? 0 : 0),
      gold: t.clear.gold ?? 0,
      items: [...(t.clear.items ?? []), ...(firstClear ? t.firstClear.items ?? [] : [])].map(i => ({ ...i })),
    },
  };
}

/** fragments → whole stones (10 : 1) */
export function combineFragments(inv: Inventory): Inventory {
  const out = { ...inv };
  for (const def of Object.values(ITEMS)) {
    if (!def.combinesInto || !def.fragmentsPerItem) continue;
    const n = Math.floor((out[def.id] ?? 0) / def.fragmentsPerItem);
    if (n > 0) {
      out[def.id] -= n * def.fragmentsPerItem;
      out[def.combinesInto] = (out[def.combinesInto] ?? 0) + n;
    }
  }
  return out;
}

/**
 * Add (possibly fractional) item counts: stones split into whole stones + fragments (deterministic), other items keep
 * the fraction in `carry` until it adds up to a whole item.
 */
export function grantItems(inv: Inventory, carry: Record<string, number>, items: ItemStack[]): { inventory: Inventory; carry: Record<string, number> } {
  const inventory = { ...inv };
  const c = { ...carry };
  const add = (id: string, n: number) => (inventory[id] = (inventory[id] ?? 0) + n);
  for (const it of items) {
    const def = ITEMS[it.itemId];
    const whole = Math.floor(it.count + 1e-9);
    const frac = it.count - whole;
    if (whole > 0) add(it.itemId, whole);
    if (frac < 1e-9) continue;
    const frag = def?.fragmentId ? ITEMS[def.fragmentId] : undefined;
    if (frag?.fragmentsPerItem) add(frag.id, Math.round(frac * frag.fragmentsPerItem));
    else {
      c[it.itemId] = (c[it.itemId] ?? 0) + frac;
      const n = Math.floor(c[it.itemId] + 1e-9);
      if (n > 0) {
        add(it.itemId, n);
        c[it.itemId] -= n;
      }
    }
  }
  return { inventory: combineFragments(inventory), carry: c };
}

export interface HeroExpResult {
  uid: number;
  before: { level: number; exp: number };
  after: { level: number; exp: number };
  gained: number;
  share: number;
}

/**
 * Battle-clear EXP: deployed heroes 100 %, Training-Slot heroes `TRAINING_SLOTS.expShare` of Training battle EXP
 * (no potions for them), everybody else 0.
 */
export function distributeExp(heroes: OwnedHero[], amount: number, participants: number[], slotUids: number[], source: FarmDungeonDefinition['type'] | 'TOWER'): { heroes: OwnedHero[]; results: HeroExpResult[] } {
  const results: HeroExpResult[] = [];
  const out = heroes.map(h => {
    const share = participants.includes(h.uid) ? 1 : source === 'TRAINING' && slotUids.includes(h.uid) ? TRAINING_SLOTS.expShare : 0;
    if (!share || amount <= 0) return h;
    const r = addExp(h, amount * share);
    results.push({ uid: h.uid, before: { level: h.level, exp: h.exp ?? 0 }, after: { level: r.hero.level, exp: r.hero.exp ?? 0 }, gained: r.taken, share });
    return r.hero;
  });
  return { heroes: out, results };
}

/** clear rating: 3★ = no death and under the target time, 2★ = one of them, 1★ = cleared */
export const clearRating = (def: FarmDungeonDefinition, r: { deaths: number; time: number }) =>
  1 + (r.deaths === 0 ? 1 : 0) + (r.time <= def.targetTime ? 1 : 0);

/** future QoL: auto repeat / sweep need a 3★ clear (not implemented yet) */
export const canAutoRepeat = (s: GameState, id: string) => (s.farm[id]?.bestRating ?? 0) >= 3;

export interface RunOutcome {
  win: boolean;
  deaths: number;
  time: number;
  /** deployed hero uids */
  participants: number[];
}

/** finish a farm run: daily bonus / repeat reward, first clear, EXP (+ Training Slots), items, rating. Deaths = EVENT_KO. */
export function completeFarmRun(state: GameState, def: FarmDungeonDefinition, run: RunOutcome, rng: () => number, now: Date):
  { state: GameState; breakdown: RewardBreakdown | null; exp: HeroExpResult[]; rating: number } {
  let daily = ensureDaily(state.daily, now);
  if (!run.win || !isUnlocked(def, state.cleared)) return { state: { ...state, daily }, breakdown: null, exp: [], rating: 0 };
  const bonus = dailyBonusLeft(daily, def.dailyBonusPool) > 0;
  if (bonus) daily = { ...daily, used: { ...daily.used, [def.dailyBonusPool]: (daily.used[def.dailyBonusPool] ?? 0) + 1 } };
  const rec = state.farm[def.id] ?? { clears: 0, firstClearDone: false, bestRating: 0 };
  const breakdown = farmRewardBreakdown(def, { bonus, firstClear: !rec.firstClearDone, rng });
  const { heroes, results } = distributeExp(state.heroes, breakdown.final.heroExp, run.participants, state.trainingSlots, def.type);
  const { inventory, carry } = grantItems(state.inventory, state.rewardCarry, breakdown.final.items);
  const rating = clearRating(def, run);
  // Equipment Hunt: item drops (same chance on bonus and repeat runs) + the guaranteed first-clear item
  let equipment = state.equipment ?? [];
  let nextItemId = state.nextItemId ?? 1;
  if (def.equipmentDrops) {
    const groups = [...new Set(run.participants.map(uid => state.heroes.find(h => h.uid === uid)).filter(h => !!h)
      .map(h => WEAPON_GROUP_OF[HERO_BY_ID[h!.templateId].cls]))];
    const dropped = rollHuntItems(def.equipmentDrops, state.huntTarget ?? 'ANY', groups, rng, nextItemId, !rec.firstClearDone ? def.firstClearItem : undefined);
    nextItemId += dropped.length;
    equipment = [...equipment, ...dropped];
    breakdown.equipment = dropped;
  }
  return {
    state: {
      ...state, heroes, inventory, rewardCarry: carry, daily, gold: state.gold + breakdown.final.gold, equipment, nextItemId,
      farm: { ...state.farm, [def.id]: { clears: rec.clears + 1, firstClearDone: true, bestRating: Math.max(rec.bestRating, rating) } },
    },
    breakdown, exp: results, rating,
  };
}

/** finish a tower run: clear EXP (+ first clear bonus) for the deployed heroes; unlocks follow `cleared` */
export function completeTowerRun(state: GameState, floor: number, run: RunOutcome):
  { state: GameState; breakdown: RewardBreakdown | null; exp: HeroExpResult[] } {
  if (!run.win) return { state, breakdown: null, exp: [] };
  const first = floor > state.cleared;
  const breakdown = towerRewardBreakdown(floor, first);
  const { heroes, results } = distributeExp(state.heroes, breakdown.final.heroExp, run.participants, state.trainingSlots, 'TOWER');
  const { inventory, carry } = grantItems(state.inventory, state.rewardCarry, breakdown.final.items);
  return {
    state: { ...state, heroes, inventory, rewardCarry: carry, gold: state.gold + breakdown.final.gold, cleared: Math.max(state.cleared, floor) },
    breakdown, exp: results,
  };
}
