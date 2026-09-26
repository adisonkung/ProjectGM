import { BREAKTHROUGHS, DAILY_BONUS, EXP_TO_NEXT, FARM_BY_ID, FARM_DUNGEONS, ITEMS, TOWER_REWARDS, TRAINING_SLOTS } from '../data/economy';
import { HERO_5STAR_LV1 } from '../data/classes';
import { HERO_BY_ID } from '../data/heroes';
import { newGameState } from '../data/starter';
import { GameState } from '../models/game-state';
import { OwnedHero } from '../models/hero';
import { migrate } from '../services/save.service';
import {
  addExp, breakthrough, currentLevelCap, expToNext, heroProgressView, levelState, totalExpTo, unlockFlags, useAllPotionsToCap, useExpPotion,
} from './leveling';
import {
  combineFragments, completeFarmRun, completeTowerRun, dailyBonusLeft, ensureDaily, farmRewardBreakdown, grantItems, isUnlocked,
} from './rewards';
import { heroStats } from './stats';

const hero = (o: Partial<OwnedHero> = {}): OwnedHero => ({ uid: 1, templateId: 'aurel', level: 1, potential: 'B', injury: 0, exp: 0, breakthroughTier: 0, ...o });
const DAY = new Date(2026, 8, 26, 12);
const NEXT_DAY = new Date(2026, 8, 27, 9);
const noLuck = () => 0.99;

describe('Hero level — EXP curve and growth', () => {
  it('EXP table 100 … 2,800, total 9,360; configurable data', () => {
    expect(EXP_TO_NEXT).toEqual([100, 180, 300, 480, 750, 1100, 1550, 2100, 2800]);
    expect(totalExpTo(10)).toBe(9360);
    expect(expToNext(1)).toBe(100);
    expect(expToNext(10)).toBe(0);
  });

  it('stat growth is linear on the final 5★ Lv1 stats (no second star multiplier); no attack speed / range growth', () => {
    const at = (level: number) => heroStats(HERO_BY_ID['aurel'], hero({ level }));
    expect(at(1).hp).toBe(HERO_5STAR_LV1.tank.hp);
    expect(at(10).hp).toBe(Math.round(393 * 1.405));
    expect(at(10).atk).toBe(Math.round(27 * 1.36));
    expect(at(10).def).toBe(Math.round(49 * 1.315));
    expect(at(5).hp).toBe(Math.round(393 * (1 + 0.045 * 4)));
    expect(at(10).atkSpeed).toBe(at(1).atkSpeed);
    expect(at(10).range).toBe(at(1).range);
  });

  it('EXP accumulates; a single level up; several level ups from one reward', () => {
    let r = addExp(hero(), 60);
    expect([r.hero.level, r.hero.exp]).toEqual([1, 60]);
    r = addExp(r.hero, 40);
    expect([r.hero.level, r.hero.exp, r.levelsGained]).toEqual([2, 0, 1]);
    r = addExp(hero(), 100 + 180 + 300 + 50);
    expect([r.hero.level, r.hero.exp, r.levelsGained]).toEqual([4, 50, 3]);
  });

  it('breakthrough blocks Lv5 → 6: BREAKTHROUGH_READY, EXP kept', () => {
    const r = addExp(hero(), totalExpTo(5) + 750);
    expect(r.hero.level).toBe(5);
    expect(r.hero.exp).toBe(750);
    expect(levelState(r.hero)).toBe('BREAKTHROUGH_READY');
    expect(currentLevelCap(r.hero)).toBe(5);
  });

  it('CRITICAL: overflow while blocked is stored, then processed after the breakthrough (no EXP lost)', () => {
    let h = addExp(hero(), totalExpTo(5)).hero; // exactly Lv5, 0 EXP
    h = addExp(h, 2000).hero;
    expect([h.level, h.exp]).toEqual([5, 2000]);
    const inv = { bt_stone_1: 3 };
    const r = breakthrough(h, inv);
    if ('error' in r) throw new Error(r.error);
    // 2000 − 750 (Lv5→6) = 1250 → Lv6→7 needs 1100 → Lv7 with 150
    expect([r.hero.level, r.hero.exp, r.hero.breakthroughTier]).toEqual([7, 150, 1]);
    expect(r.inventory['bt_stone_1']).toBe(0);
  });

  it('breakthrough consumes the configured items; not enough materials / EXP is refused', () => {
    const ready = addExp(hero(), totalExpTo(5) + 750).hero;
    expect(breakthrough(ready, { bt_stone_1: 2 })).toEqual({ error: 'NEED_ITEMS' });
    const notReady = addExp(hero(), totalExpTo(5) + 100).hero;
    expect(breakthrough(notReady, { bt_stone_1: 3 })).toEqual({ error: 'NEED_EXP' });
    const r = breakthrough(ready, { bt_stone_1: 5 });
    expect('error' in r).toBeFalse();
    if (!('error' in r)) expect(r.inventory['bt_stone_1']).toBe(2);
    expect(BREAKTHROUGHS.map(b => [b.fromLevel, b.toLevel, b.requiredItems[0].itemId, b.requiredItems[0].count])).toEqual([
      [5, 6, 'bt_stone_1', 3], [8, 9, 'bt_stone_2', 4], [9, 10, 'bt_stone_3', 5],
    ]);
  });

  it('gates at 8 → 9 and 9 → 10; unlock flags stored per breakthrough', () => {
    let h = addExp(hero({ level: 6, breakthroughTier: 1 }), 99999).hero;
    expect([h.level, levelState(h)]).toEqual([8, 'BREAKTHROUGH_READY']);
    let r = breakthrough(h, { bt_stone_2: 4 });
    if ('error' in r) throw new Error(r.error);
    h = r.hero;
    expect([h.level, levelState(h)]).toEqual([9, 'BREAKTHROUGH_READY']);
    r = breakthrough(h, { bt_stone_3: 5 });
    if ('error' in r) throw new Error(r.error);
    expect(r.hero.level).toBe(10);
    expect(unlockFlags(r.hero)).toEqual(['SKILL_RANK_CAP_3', 'GEAR_TIER_UP', 'PATCH1_TALENT_SLOT']);
  });

  it('CRITICAL: Lv10 cap — level 10, EXP gain stops, nothing stored beyond it', () => {
    const h = hero({ level: 10, breakthroughTier: 3 });
    const r = addExp(h, 5000);
    expect([r.hero.level, r.hero.exp, r.taken]).toEqual([10, 0, 0]);
    expect(levelState(r.hero)).toBe('MAX');
  });

  it('hero screen view: Lv5, 750 / 750, BREAKTHROUGH REQUIRED, Stone I 2 / 3', () => {
    const h = addExp(hero(), totalExpTo(5) + 750).hero;
    const v = heroProgressView(h, { bt_stone_1: 2 });
    expect([v.level, v.exp, v.expToNext, v.state]).toEqual([5, 750, 750, 'BREAKTHROUGH_READY']);
    expect(v.breakthrough!.have).toEqual([{ itemId: 'bt_stone_1', count: 2 }]);
  });
});

describe('EXP potions', () => {
  it('Use 1 / Use N consume potions and add their EXP (50 / 150 / 500)', () => {
    expect([ITEMS['exp_potion_s'].exp, ITEMS['exp_potion_m'].exp, ITEMS['exp_potion_l'].exp]).toEqual([50, 150, 500]);
    const r = useExpPotion(hero(), { exp_potion_s: 20 }, 'exp_potion_s', 10);
    expect(r.used).toBe(10);
    expect(r.inventory['exp_potion_s']).toBe(10);
    expect(r.hero.level).toBe(3); // 500 EXP → Lv3 (280) + 220
    expect(r.hero.exp).toBe(220);
  });

  it('Use Max stops at the current cap (breakthrough-ready) without wasting potions', () => {
    const r = useExpPotion(hero({ level: 4 }), { exp_potion_m: 50 }, 'exp_potion_m', 'max');
    // Lv4 → ready at Lv5 needs 480 + 750 = 1230 → 9 medium potions (1350)
    expect(r.used).toBe(9);
    expect(r.hero.level).toBe(5);
    expect(levelState(r.hero)).toBe('BREAKTHROUGH_READY');
    const all = useAllPotionsToCap(hero({ level: 4 }), { exp_potion_l: 5, exp_potion_s: 10 });
    expect(levelState(all.hero)).toBe('BREAKTHROUGH_READY');
    expect(all.inventory['exp_potion_l']).toBe(3); // 1000 from larges, then 5 smalls
    expect(all.inventory['exp_potion_s']).toBe(5);
  });

  it('potions are never used at Lv10', () => {
    const r = useExpPotion(hero({ level: 10, breakthroughTier: 3 }), { exp_potion_l: 3 }, 'exp_potion_l', 1);
    expect(r.used).toBe(0);
  });
});

describe('Rewards, daily bonus, fragments', () => {
  const state = (o: Partial<GameState> = {}): GameState => ({ ...newGameState(), ...o });

  it('Training: daily bonus ×2 for the first 3 clears, then 70 % of BASE (not of the bonus)', () => {
    const d = FARM_BY_ID['training_3'];
    const bonus = farmRewardBreakdown(d, { bonus: true, firstClear: false, rng: noLuck });
    const rep = farmRewardBreakdown(d, { bonus: false, firstClear: false, rng: noLuck });
    expect(bonus.final.heroExp).toBe(400);
    expect(rep.final.heroExp).toBe(140);
    expect(rep.final.items).toEqual([{ itemId: 'exp_potion_m', count: 0.7 }]);
    expect(DAILY_BONUS['TRAINING']).toBe(3);
    let s = state();
    const participants = s.team.map(t => t.uid);
    const exp: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = completeFarmRun(s, FARM_BY_ID['training_1'], { win: true, deaths: 0, time: 90, participants }, noLuck, DAY);
      exp.push(r.breakdown!.final.heroExp);
      s = r.state;
    }
    expect(exp).toEqual([140, 140, 140, 49, 49]);
    expect(dailyBonusLeft(s.daily, 'TRAINING')).toBe(0);
    // still playable, still rewarding; the next day resets only the counter
    expect(dailyBonusLeft(ensureDaily(s.daily, NEXT_DAY), 'TRAINING')).toBe(3);
    // 3 bonus smalls ×2 = 6, then 0.7 + 0.7 carried → 7 potions + 0.4 carry
    expect(s.inventory['exp_potion_s']).toBe(7);
    expect(s.rewardCarry['exp_potion_s']).toBeCloseTo(0.4, 5);
  });

  it('Ascension: guaranteed stone, daily bonus 2, repeat = 7 fragments, 10 fragments = 1 stone, first clear +1', () => {
    let s = state({ cleared: 5 });
    const participants = s.team.map(t => t.uid);
    const run = { win: true, deaths: 0, time: 80, participants };
    const r1 = completeFarmRun(s, FARM_BY_ID['ascension_1'], run, noLuck, DAY);
    expect(r1.state.inventory['bt_stone_1']).toBe(3); // 1 ×2 bonus + 1 first clear
    s = completeFarmRun(r1.state, FARM_BY_ID['ascension_1'], run, noLuck, DAY).state;
    expect(s.inventory['bt_stone_1']).toBe(5);
    s = completeFarmRun(s, FARM_BY_ID['ascension_1'], run, noLuck, DAY).state;
    expect([s.inventory['bt_stone_1'], s.inventory['bt_fragment_1']]).toEqual([5, 7]);
    s = completeFarmRun(s, FARM_BY_ID['ascension_1'], run, noLuck, DAY).state;
    expect([s.inventory['bt_stone_1'], s.inventory['bt_fragment_1']]).toEqual([6, 4]);
    expect(combineFragments({ bt_fragment_2: 23 })).toEqual({ bt_fragment_2: 3, bt_stone_2: 2 });
    expect(grantItems({}, {}, [{ itemId: 'bt_stone_3', count: 1.4 }]).inventory).toEqual({ bt_stone_3: 1, bt_fragment_3: 4 });
  });

  it('bonus drop is extra only (20 % +1 stone)', () => {
    const d = FARM_BY_ID['ascension_2'];
    const lucky = farmRewardBreakdown(d, { bonus: false, firstClear: false, rng: () => 0.1 });
    expect(lucky.final.items.reduce((a, i) => a + i.count, 0)).toBeCloseTo(1.4, 5);
  });

  it('unlocks follow tower progress (Training II F3 … V F9, Ascension I F5 / II F7 / III F9); locked runs give nothing', () => {
    expect(FARM_DUNGEONS.map(d => [d.id, d.unlockFloor])).toEqual([
      ['training_1', 0], ['training_2', 3], ['training_3', 5], ['training_4', 7], ['training_5', 9],
      ['ascension_1', 5], ['ascension_2', 7], ['ascension_3', 9],
    ]);
    expect(isUnlocked(FARM_BY_ID['training_2'], 2)).toBeFalse();
    expect(isUnlocked(FARM_BY_ID['training_2'], 3)).toBeTrue();
    const s = state({ cleared: 2 });
    expect(completeFarmRun(s, FARM_BY_ID['training_2'], { win: true, deaths: 0, time: 60, participants: [1] }, noLuck, DAY).breakdown).toBeNull();
  });

  it('EXP distribution: deployed 100 %, Training Slot 35 % of Training EXP (no potions), others 0; farm deaths = EVENT_KO', () => {
    const s0 = state();
    const bench = s0.heroes.filter(h => !s0.team.some(t => t.uid === h.uid));
    const s = { ...s0, trainingSlots: [bench[0].uid] };
    const participants = s.team.map(t => t.uid);
    const r = completeFarmRun(s, FARM_BY_ID['training_1'], { win: true, deaths: 2, time: 90, participants }, noLuck, DAY);
    const expOf = (uid: number) => r.state.heroes.find(h => h.uid === uid)!;
    expect(expOf(participants[0]).level).toBe(2); // 140 EXP
    expect(expOf(bench[0].uid).exp).toBe(Math.round(140 * TRAINING_SLOTS.expShare));
    expect(expOf(bench[1].uid).exp).toBe(0);
    expect(r.state.heroes.every(h => h.injury === 0)).toBeTrue();
    expect(TRAINING_SLOTS).toEqual({ count: 2, expShare: 0.35 });
  });

  it('tower: clear EXP + first clear bonus once; repeat is plain; tower EXP < Training of the same band', () => {
    let s = state();
    const participants = s.team.map(t => t.uid);
    const run = { win: true, deaths: 0, time: 40, participants };
    let r = completeTowerRun(s, 1, run);
    expect(r.breakdown!.final.heroExp).toBe(TOWER_REWARDS[1].clear.heroExp! + TOWER_REWARDS[1].firstClear.heroExp!);
    s = r.state;
    expect(s.cleared).toBe(1);
    r = completeTowerRun(s, 1, run);
    expect(r.breakdown!.final.heroExp).toBe(TOWER_REWARDS[1].clear.heroExp!);
    // clearing every floor once (with first-clear bonuses) doesn't even reach Lv9 — Lv10 needs farming
    const firstClears = Object.values(TOWER_REWARDS).reduce((a, t) => a + t.firstClear.heroExp! + t.clear.heroExp!, 0);
    expect(firstClears).toBeLessThan(totalExpTo(9));
  });

  it('save / load: v5 keeps level, EXP, tier, inventory, slots, daily usage; v4 saves migrate without losing heroes', () => {
    const s = { ...state(), inventory: { bt_stone_1: 2, exp_potion_s: 5, bt_fragment_1: 3 }, trainingSlots: [7], daily: { day: '2026-09-26', used: { TRAINING: 2, ASCENSION: 1 } } };
    s.heroes[0] = { ...s.heroes[0], level: 5, exp: 900, breakthroughTier: 0 };
    const back = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(back.heroes[0]).toEqual(jasmine.objectContaining({ level: 5, exp: 900, breakthroughTier: 0 }));
    expect(back.inventory).toEqual(s.inventory);
    expect(back.trainingSlots).toEqual([7]);
    expect(back.daily).toEqual(s.daily);
    const v4: any = { ...state(), version: 4 };
    delete v4.inventory;
    delete v4.daily;
    v4.heroes[0] = { uid: 1, templateId: 'aurel', level: 7, potential: 'B', injury: 0 };
    const m = migrate(v4)!;
    expect(m.version).toBe(5);
    expect(m.inventory).toEqual({});
    expect(m.heroes[0]).toEqual(jasmine.objectContaining({ level: 7, exp: 0, breakthroughTier: 1 }));
    expect(migrate({ version: 3 })).toBeNull();
  });
});
