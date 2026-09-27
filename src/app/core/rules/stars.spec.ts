import { starMultiplier } from '../data/classes';
import { TOWER_REWARDS, FARM_BY_ID } from '../data/economy';
import { HEROES, HERO_BY_ID } from '../data/heroes';
import { DUPLICATE_MEMORY, GACHA, MAX_STAR, STAR_UP_COST, UNIVERSAL_MEMORY } from '../data/stars';
import { newGameState } from '../data/starter';
import { GameState } from '../models/game-state';
import { combatModifiers } from './progression';
import { heroStats } from './stats';
import { heroStar, memoryToMax, pull, rollRarity, starUp, starUpView } from './stars';
import { teamToUnits } from './team';
import { createBattle } from '../../battle/battle-session';
import { STAGES } from '../data/stages';
import { mulberry32 } from './island';

/** Star development + gacha (spec: gacha 1★–3★, develop to 6★, duplicates → Hero Memory, Universal Memory from play) */
describe('Stars — rarity, development, Memory, gacha', () => {
  const fresh = (): GameState => newGameState();

  it('gacha rarity is 1★–3★; the starting roster is 3★ (re-rated from 5★) at unchanged power', () => {
    expect(Math.max(...HEROES.map(h => h.star))).toBe(3);
    const s = fresh();
    for (const h of s.heroes) expect(heroStar(h)).toBe(3);
    expect(heroStats(HERO_BY_ID['aurel'], s.heroes.find(h => h.templateId === 'aurel')!).hp).toBe(393);
  });

  it('3★ → 6★ = +18 % raw stats; 6★ is the cap; Memory 100 / 150 / 250 = 500 ≈ 4–5 duplicates of a 3★', () => {
    expect(starMultiplier(6) / starMultiplier(3)).toBeCloseTo(1.18, 5);
    expect(starMultiplier(6) / starMultiplier(3) - 1).toBeGreaterThanOrEqual(0.15);
    expect(starMultiplier(6) / starMultiplier(3) - 1).toBeLessThanOrEqual(0.2);
    expect([STAR_UP_COST[3], STAR_UP_COST[4], STAR_UP_COST[5]]).toEqual([100, 150, 250]);
    expect(memoryToMax(3)).toBe(500);
    const dups = memoryToMax(3) / DUPLICATE_MEMORY[3];
    expect(dups).toBeGreaterThanOrEqual(4); expect(dups).toBeLessThanOrEqual(5);
    // lower rarities also reach 6★, with cheaper first steps
    expect(STAR_UP_COST[1]).toBeLessThan(STAR_UP_COST[2]);
    expect(STAR_UP_COST[2]).toBeLessThan(STAR_UP_COST[3]);
    expect(MAX_STAR).toBe(6);
  });

  it('star-up spends the hero\'s own Memory first, then Universal Memory; blocked when short or at 6★', () => {
    let s = fresh();
    const aurel = s.heroes.find(h => h.templateId === 'aurel')!;
    expect(starUp(s, aurel.uid)).toBeNull(); // no Memory
    s = { ...s, heroMemory: { aurel: 70 }, inventory: { ...s.inventory, [UNIVERSAL_MEMORY]: 40 } };
    const v = starUpView(s, aurel);
    expect([v.cost, v.spendHero, v.spendUniversal, v.canUp]).toEqual([100, 70, 30, true]);
    s = starUp(s, aurel.uid)!;
    expect(heroStar(s.heroes.find(h => h.uid === aurel.uid)!)).toBe(4);
    expect(s.heroMemory!['aurel']).toBe(0);
    expect(s.inventory[UNIVERSAL_MEMORY]).toBe(10);
    s = { ...s, heroMemory: { aurel: 1000 } };
    s = starUp(starUp(s, aurel.uid)!, aurel.uid)!;
    const h6 = s.heroes.find(h => h.uid === aurel.uid)!;
    expect(heroStar(h6)).toBe(6);
    expect(s.heroMemory!['aurel']).toBe(1000 - 150 - 250);
    expect(starUp(s, aurel.uid)).toBeNull();
    // only the star changed on the hero (level / gear / skills untouched)
    expect({ ...h6, star: undefined }).toEqual({ ...aurel, star: undefined });
  });

  it('utility perks: 4★ starts with 10 ult gauge, 5★ −5 % cooldowns, 6★ gauge 20 + crit +3 % — in battle too', () => {
    const s = fresh();
    const h = s.heroes.find(x => x.templateId === 'jin')!;
    const m3 = combatModifiers(h), m4 = combatModifiers({ ...h, star: 4 }), m5 = combatModifiers({ ...h, star: 5 }), m6 = combatModifiers({ ...h, star: 6 });
    expect(m3.startGauge ?? 0).toBe(0);
    expect(m4.startGauge).toBe(10);
    expect(m5.cooldown.skill).toBeCloseTo(m3.cooldown.skill * 0.95, 5);
    expect(m6.startGauge).toBe(20);
    expect(m6.critChance).toBeCloseTo(m3.critChance + 0.03, 5);
    const heroes = s.heroes.map(x => (x.templateId === 'jin' ? { ...x, star: 6 } : x));
    const units = teamToUnits(s.team, heroes);
    expect(units.find(u => u.heroId === 'jin')!.star).toBe(6);
    const e = createBattle({ allies: units, stage: STAGES[0], seed: 1 });
    expect(e.units.find(u => u.heroId === 'jin')!.mana).toBe(20);
    expect(e.units.find(u => u.heroId === 'aurel')!.mana).toBe(0);
    // sprite (and therefore sprite size) never changes with stars
    expect(units.find(u => u.heroId === 'jin')!.sprite).toBe(HERO_BY_ID['jin'].sprite);
  });

  it('gacha: 1★–3★ only, pity at 50 guarantees a 3★, every 10-pull has a 2★+, costs 100 / 900 gems', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) expect([1, 2, 3]).toContain(rollRarity(rng, 0));
    expect(rollRarity(() => 0.0, GACHA.pity - 1)).toBe(3);
    let s = fresh();
    for (let k = 0; k < 20; k++) {
      const r = pull({ ...s, gems: 900 }, 10, mulberry32(100 + k))!;
      expect(r.results.length).toBe(10);
      expect(r.results.some(x => x.star >= 2)).toBeTrue();
      expect(r.state.gems).toBe(0);
    }
    expect(pull({ ...s, gems: 99 }, 1)).toBeNull();
    // pity: 49 pulls without a 3★ → the next one is a 3★ (rng that never rolls a 3★)
    s = { ...fresh(), gems: 100, pity: GACHA.pity - 1 };
    expect(pull(s, 1, () => 0)!.results[0].star).toBe(3);
    // rates observed over many rolls ≈ the table
    const rr = mulberry32(3); const n = 20000; let three = 0;
    for (let i = 0; i < n; i++) if (rollRarity(rr, 0) === 3) three++;
    expect(three / n).toBeCloseTo(GACHA.rates[3], 1);
  });

  it('new hero joins the roster at its base star; a duplicate gives Hero Memory; a duplicate of a 6★ gives Universal Memory', () => {
    let s = fresh();
    const count = s.heroes.length;
    // force a 1★ that isn't owned (bron)
    const seq = [0.1, 0.0, 0.5]; let i = 0; const rng = () => seq[i++ % seq.length];
    const r1 = pull({ ...s, gems: 100 }, 1, rng)!;
    expect(r1.results[0]).toEqual(jasmine.objectContaining({ templateId: HEROES.filter(h => h.star === 1)[0].id, isNew: true }));
    expect(r1.state.heroes.length).toBe(count + 1);
    s = r1.state;
    i = 0;
    const r2 = pull({ ...s, gems: 100 }, 1, rng)!;
    expect(r2.results[0].isNew).toBeFalse();
    expect(r2.state.heroMemory![r2.results[0].templateId]).toBe(DUPLICATE_MEMORY[1]);
    // maxed duplicate
    s = { ...r2.state, heroes: r2.state.heroes.map(h => (h.templateId === r2.results[0].templateId ? { ...h, star: 6 } : h)) };
    i = 0;
    const r3 = pull({ ...s, gems: 100 }, 1, rng)!;
    expect(r3.results[0].universal).toBe(Math.floor(DUPLICATE_MEMORY[1] * 0.5));
    expect(r3.state.inventory[UNIVERSAL_MEMORY]).toBe(Math.floor(DUPLICATE_MEMORY[1] * 0.5));
  });

  it('Universal Memory comes from gameplay: tower first clears (230) + Ascension first clears and repeat runs', () => {
    const tower = Object.values(TOWER_REWARDS).reduce((a, t) => a + (t.firstClear.items?.find(i => i.itemId === UNIVERSAL_MEMORY)?.count ?? 0), 0);
    expect(tower).toBe(230);
    for (const id of ['ascension_1', 'ascension_2', 'ascension_3']) {
      expect(FARM_BY_ID[id].baseRewards.items!.some(i => i.itemId === UNIVERSAL_MEMORY)).withContext(id).toBeTrue();
      expect(FARM_BY_ID[id].firstClearBonus!.items!.some(i => i.itemId === UNIVERSAL_MEMORY)).withContext(id).toBeTrue();
    }
  });
});
