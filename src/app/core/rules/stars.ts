import { HERO_BY_ID, HEROES } from '../data/heroes';
import { DUPLICATE_MEMORY, GACHA, MAX_STAR, MAXED_DUPLICATE_TO_UNIVERSAL, NO_PERK, STAR_PERKS, STAR_UP_COST, StarPerk, UNIVERSAL_MEMORY } from '../data/stars';
import { GameState } from '../models/game-state';
import { OwnedHero, Potential } from '../models/hero';

/** Star development + gacha rules (pure). Spec: gacha 1★–3★, develop to 6★ with Hero / Universal Memory. */

/** the hero's current star: developed star, else the template's base (gacha) rarity */
export function heroStar(h: Pick<OwnedHero, 'templateId' | 'star'>): number {
  const base = HERO_BY_ID[h.templateId]?.star ?? 1;
  return Math.max(base, Math.min(MAX_STAR, h.star ?? base));
}

export const starPerk = (star: number): StarPerk => STAR_PERKS[Math.min(MAX_STAR, star)] ?? NO_PERK;

export const heroMemoryOf = (s: GameState, templateId: string) => s.heroMemory?.[templateId] ?? 0;
export const universalMemoryOf = (s: GameState) => s.inventory[UNIVERSAL_MEMORY] ?? 0;

export interface StarUpView {
  star: number;
  maxed: boolean;
  /** Memory needed for the next star */
  cost: number;
  heroMemory: number;
  universal: number;
  /** what a star-up would spend */
  spendHero: number;
  spendUniversal: number;
  canUp: boolean;
  /** Memory still missing */
  missing: number;
}

export function starUpView(s: GameState, h: OwnedHero): StarUpView {
  const star = heroStar(h);
  const heroMem = heroMemoryOf(s, h.templateId), uni = universalMemoryOf(s);
  if (star >= MAX_STAR) return { star, maxed: true, cost: 0, heroMemory: heroMem, universal: uni, spendHero: 0, spendUniversal: 0, canUp: false, missing: 0 };
  const cost = STAR_UP_COST[star];
  const spendHero = Math.min(heroMem, cost);
  const spendUniversal = Math.min(uni, cost - spendHero);
  const missing = cost - spendHero - spendUniversal;
  return { star, maxed: false, cost, heroMemory: heroMem, universal: uni, spendHero, spendUniversal, canUp: missing === 0, missing };
}

/** +1 star: the hero's own Memory first, Universal Memory for the rest. null when not possible. */
export function starUp(s: GameState, uid: number): GameState | null {
  const h = s.heroes.find(x => x.uid === uid);
  if (!h) return null;
  const v = starUpView(s, h);
  if (!v.canUp) return null;
  return {
    ...s,
    heroes: s.heroes.map(x => (x.uid === uid ? { ...x, star: v.star + 1 } : x)),
    heroMemory: { ...(s.heroMemory ?? {}), [h.templateId]: v.heroMemory - v.spendHero },
    inventory: { ...s.inventory, [UNIVERSAL_MEMORY]: v.universal - v.spendUniversal },
  };
}

/** total Memory from a star to 6★ */
export const memoryToMax = (fromStar: number) => Object.entries(STAR_UP_COST).filter(([k]) => +k >= fromStar).reduce((a, [, v]) => a + v, 0);

// ------------------------------------------------------------------ gacha

export interface PullResult {
  templateId: string;
  /** base rarity */
  star: number;
  isNew: boolean;
  /** duplicate → Hero Memory (or Universal Memory when the hero is already 6★) */
  memory: number;
  universal: number;
  uid?: number;
}

function pickWeighted<T>(rng: () => number, items: [T, number][]): T {
  let r = rng() * items.reduce((a, [, w]) => a + w, 0);
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
}

/** rarity of one pull (pity: the GACHA.pity-th pull without a 3★ is a 3★) */
export function rollRarity(rng: () => number, pity: number, floor = 1): number {
  if (pity + 1 >= GACHA.pity) return 3;
  const r = pickWeighted(rng, Object.entries(GACHA.rates).map(([k, v]) => [+k, v] as [number, number]));
  return Math.max(floor, r);
}

/**
 * n pulls (1 or 10). Spends gems, adds new heroes (Lv1, base star) or Memory for duplicates, updates pity.
 * null when the player can't afford it.
 */
export function pull(s: GameState, n: 1 | 10, rng: () => number = Math.random): { state: GameState; results: PullResult[] } | null {
  const cost = n === 10 ? GACHA.multi : GACHA.single * n;
  if (s.gems < cost) return null;
  let state: GameState = { ...s, gems: s.gems - cost, heroes: [...s.heroes], heroMemory: { ...(s.heroMemory ?? {}) }, inventory: { ...s.inventory } };
  const results: PullResult[] = [];
  let pity = s.pity ?? 0;
  for (let i = 0; i < n; i++) {
    // a 10-pull guarantees one 2★+ (the last pull if none came before)
    const needFloor = n === 10 && i === n - 1 && !results.some(r => r.star >= GACHA.multiFloor);
    const star = rollRarity(rng, pity, needFloor ? GACHA.multiFloor : 1);
    pity = star >= 3 ? 0 : pity + 1;
    // a rarity with no hero (e.g. during the roster remodel) falls back to the whole roster
    const byStar = HEROES.filter(t => t.star === star);
    const pool = byStar.length ? byStar : HEROES;
    const t = pool[Math.floor(rng() * pool.length)];
    const owned = state.heroes.find(h => h.templateId === t.id);
    if (!owned) {
      const potential = pickWeighted(rng, GACHA.potential) as Potential;
      const hero: OwnedHero = { uid: state.nextUid, templateId: t.id, level: 1, potential, exp: 0, breakthroughTier: 0 };
      state = { ...state, nextUid: state.nextUid + 1, heroes: [...state.heroes, hero] };
      results.push({ templateId: t.id, star: t.star, isNew: true, memory: 0, universal: 0, uid: hero.uid });
      continue;
    }
    const mem = DUPLICATE_MEMORY[t.star] ?? 0;
    if (heroStar(owned) >= MAX_STAR) {
      const u = Math.floor(mem * MAXED_DUPLICATE_TO_UNIVERSAL);
      state.inventory[UNIVERSAL_MEMORY] = (state.inventory[UNIVERSAL_MEMORY] ?? 0) + u;
      results.push({ templateId: t.id, star: t.star, isNew: false, memory: 0, universal: u, uid: owned.uid });
    } else {
      state.heroMemory![t.id] = (state.heroMemory![t.id] ?? 0) + mem;
      results.push({ templateId: t.id, star: t.star, isNew: false, memory: mem, universal: 0, uid: owned.uid });
    }
  }
  return { state: { ...state, pity }, results };
}
