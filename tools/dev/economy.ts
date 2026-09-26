/**
 * Patch 1 progression-speed model (rebalance spec: claude/patch1-rebalance-spec.md) — a core team of 5 heroes playing
 * with the real reward code (completeFarmRun / completeTowerRun / breakthrough / potions). Every farm run is a win
 * (farm win rates are reported separately by `npm run balance -- 60 rec - --farm=all`).
 *
 *   npm run economy [-- --minutes=30,60,120,240]
 *
 * Two views per plan:
 *   TEAM  — potions go to the lowest hero; stones are needed for all 5 heroes (5 × cost per breakthrough).
 *   FOCUS — one priority hero gets every potion and is the only one who needs stones (the other 4 still fight).
 * Player model per day: spend the daily bonus runs (Ascension first when stones are still needed, then Training),
 * then repeat runs until the day's time is used (bonus-only = just the 5 bonus runs). Stones are farmed on repeat runs
 * only while a hero waits at a gate. A run = measured active clear time + 20 s menus / placement.
 * Tower first clears (EXP + first-clear stones) happen once the tracked level reaches TOWER_CLEAR_LEVEL — Floor 7+
 * ASSUME the future gear / skill layers (level-only teams cannot clear them); Floor 10 is never assumed.
 * Gear / skill farming time is NOT included (those systems don't exist yet).
 */
import { BREAKTHROUGHS, FARM_BY_ID, FARM_DUNGEONS } from '../../src/app/core/data/economy';
import { newGameState } from '../../src/app/core/data/starter';
import { GameState } from '../../src/app/core/models/game-state';
import { OwnedHero } from '../../src/app/core/models/hero';
import { breakthrough, levelState, nextBreakthrough, useAllPotionsToCap } from '../../src/app/core/rules/leveling';
import { completeFarmRun, completeTowerRun, dailyBonusLeft, ensureDaily, isUnlocked } from '../../src/app/core/rules/rewards';

declare const process: { argv: string[] };
const args = process.argv.slice(2);
const minutesArg = args.find(a => a.startsWith('--minutes='))?.slice(10);

/** measured active clear seconds (npm run balance -- 60 rec - --farm=all, TACTICAL) */
const RUN_SECONDS: Record<string, number> = {
  training_1: 63, training_2: 81, training_3: 95, training_4: 107, training_5: 123,
  ascension_1: 80, ascension_2: 96, ascension_3: 125,
};
const OVERHEAD = 20;
const TOWER_RUN_SECONDS = 110;
/** tracked level at which a floor's first clear happens (F7+ assumes gear / skills on top of the level) */
const TOWER_CLEAR_LEVEL: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 3, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 };

type Plan = number | 'bonus';
interface Result {
  levelAt: Record<number, { h: number; day: number; tr: number; asc: number }>;
  gate: Record<number, { expReady?: number; stonesReady?: number; ascBonus: number; ascRepeat: number; jump: number[] }>;
  bandRuns: Record<string, { tr: number; asc: number; h: number }>;
  totalH: number;
  runs: { tr: number; asc: number; tower: number };
}

function simulate(plan: Plan, mode: 'TEAM' | 'FOCUS'): Result {
  let s: GameState = newGameState();
  const team = s.team.map(t => t.uid);
  const tracked = mode === 'TEAM' ? team : [team[0]];
  const res: Result = { levelAt: {}, gate: {}, bandRuns: {}, totalH: 0, runs: { tr: 0, asc: 0, tower: 0 } };
  for (const b of BREAKTHROUGHS) res.gate[b.tier] = { ascBonus: 0, ascRepeat: 0, jump: [] };
  let rng = 12345;
  const rand = () => ((rng = (rng * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let seconds = 0;
  const hero = (uid: number) => s.heroes.find(h => h.uid === uid)!;
  const setHero = (h: OwnedHero) => (s = { ...s, heroes: s.heroes.map(x => (x.uid === h.uid ? h : x)) });
  const level = () => Math.min(...tracked.map(u => hero(u).level));
  const stonesGot: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const stoneNeed = (tier: number) => BREAKTHROUGHS[tier - 1].requiredItems[0].count * tracked.length;
  const band = (l: number) => (l < 5 ? 'Lv1→5' : l < 7 ? 'Lv5→7' : l < 8 ? 'Lv7→8' : l < 9 ? 'Lv8→9' : 'Lv9→10');
  const countStones = (before: GameState) => {
    for (const t of [1, 2, 3]) {
      const id = `bt_stone_${t}`;
      const frag = `bt_fragment_${t}`;
      const d = (s.inventory[id] ?? 0) - (before.inventory[id] ?? 0) + ((s.inventory[frag] ?? 0) - (before.inventory[frag] ?? 0)) / 10;
      stonesGot[t] += d;
    }
  };
  const mark = (day: number) => {
    const l = level();
    for (let v = 2; v <= l; v++) res.levelAt[v] ??= { h: seconds / 3600, day, tr: res.runs.tr, asc: res.runs.asc };
    for (const b of BREAKTHROUGHS) {
      const g = res.gate[b.tier];
      if (g.expReady == null && tracked.every(u => hero(u).level > b.fromLevel || (levelState(hero(u)) === 'BREAKTHROUGH_READY' && hero(u).level === b.fromLevel))) g.expReady = seconds / 3600;
      if (g.stonesReady == null && stonesGot[b.tier] >= stoneNeed(b.tier)) g.stonesReady = seconds / 3600;
    }
  };
  const tidy = (day: number) => {
    for (let f = s.cleared + 1; f <= 9; f++) {
      if (level() < TOWER_CLEAR_LEVEL[f]) break;
      const before = s;
      s = completeTowerRun(s, f, { win: true, deaths: 0, time: 60, participants: team }).state;
      countStones(before);
      res.runs.tower++;
      seconds += TOWER_RUN_SECONDS;
    }
    for (let pass = 0; pass < 3; pass++) {
      const order = mode === 'FOCUS' ? [team[0]] : [...team].sort((a, b) => hero(a).level - hero(b).level || (hero(a).exp ?? 0) - (hero(b).exp ?? 0));
      for (const uid of order) {
        const r = useAllPotionsToCap(hero(uid), s.inventory);
        s = { ...s, inventory: r.inventory };
        setHero(r.hero);
        if (!tracked.includes(uid)) continue;
        const before = hero(uid).level;
        const b = breakthrough(hero(uid), s.inventory);
        if (!('error' in b)) {
          s = { ...s, inventory: b.inventory };
          setHero(b.hero);
          res.gate[b.hero.breakthroughTier ?? 0]?.jump.push(b.hero.level - before);
        }
      }
    }
    mark(day);
  };
  /** the breakthrough tier the tracked heroes still need stones for (unlocked dungeon only) */
  const stoneTierNeeded = (onlyWaiting: boolean): number | null => {
    for (const b of BREAKTHROUGHS) {
      const asc = FARM_BY_ID[`ascension_${b.tier}`];
      if (!isUnlocked(asc, s.cleared)) continue;
      const pending = tracked.filter(u => (hero(u).breakthroughTier ?? 0) < b.tier);
      if (!pending.length) continue;
      const waiting = pending.filter(u => levelState(hero(u)) === 'BREAKTHROUGH_READY' && nextBreakthrough(hero(u))?.tier === b.tier);
      if (onlyWaiting && !waiting.length) continue;
      const have = (s.inventory[`bt_stone_${b.tier}`] ?? 0) + (s.inventory[`bt_fragment_${b.tier}`] ?? 0) / 10;
      if (have < pending.length * b.requiredItems[0].count) return b.tier;
    }
    return null;
  };
  const bestTraining = () => FARM_DUNGEONS.filter(d => d.type === 'TRAINING' && isUnlocked(d, s.cleared)).pop()!;
  const run = (id: string, day: number) => {
    const def = FARM_BY_ID[id];
    const bonus = dailyBonusLeft(s.daily, def.dailyBonusPool) > 0;
    const b = band(level());
    const before = s;
    s = completeFarmRun(s, def, { win: true, deaths: 0, time: 60, participants: team }, rand, new Date(2026, 9, day, 12)).state;
    countStones(before);
    const cost = RUN_SECONDS[id] + OVERHEAD;
    seconds += cost;
    res.bandRuns[b] ??= { tr: 0, asc: 0, h: 0 };
    res.bandRuns[b].h += cost / 3600;
    if (def.type === 'TRAINING') {
      res.runs.tr++;
      res.bandRuns[b].tr++;
    } else {
      res.runs.asc++;
      res.bandRuns[b].asc++;
      const tier = +id.slice(-1);
      if (bonus) res.gate[tier].ascBonus++;
      else res.gate[tier].ascRepeat++;
    }
    return cost;
  };
  for (let day = 1; day <= 1000 && level() < 10; day++) {
    s = { ...s, daily: ensureDaily(s.daily, new Date(2026, 9, day, 12)) };
    let budget = plan === 'bonus' ? 0 : plan * 60;
    tidy(day);
    // daily bonus runs: Ascension (while stones are still needed) then Training
    while (dailyBonusLeft(s.daily, 'ASCENSION') > 0 && level() < 10) {
      const t = stoneTierNeeded(false);
      if (t == null) break;
      budget -= run(`ascension_${t}`, day);
      tidy(day);
    }
    while (dailyBonusLeft(s.daily, 'TRAINING') > 0 && level() < 10) {
      budget -= run(bestTraining().id, day);
      tidy(day);
    }
    // repeat runs with the rest of the day's time
    for (let guard = 0; guard < 400 && level() < 10; guard++) {
      const t = stoneTierNeeded(true);
      const id = t != null ? `ascension_${t}` : bestTraining().id;
      if (budget < RUN_SECONDS[id] + OVERHEAD) break;
      budget -= run(id, day);
      tidy(day);
    }
  }
  res.totalH = seconds / 3600;
  return res;
}

const f1 = (v: number | undefined) => (v == null ? '  –  ' : v.toFixed(1).padStart(5));
const plans: Plan[] = minutesArg ? minutesArg.split(',').map(Number) : ['bonus', 30, 60, 120, 240];
const planName = (p: Plan) => (p === 'bonus' ? 'daily bonus only (3 Training + 2 Ascension / day)' : `${p} min/day`);

for (const mode of ['FOCUS', 'TEAM'] as const) {
  console.log(`\n################ ${mode === 'FOCUS' ? 'ONE priority hero (all potions, own stones only)' : 'CORE TEAM of 5 (potions to the lowest, 5 × stones)'} ################`);
  for (const p of plans) {
    const r = simulate(p, mode);
    console.log(`\n=== ${planName(p)} — total ${r.totalH.toFixed(1)} h played · ${r.runs.tr} Training + ${r.runs.asc} Ascension + ${r.runs.tower} tower first clears ===`);
    const lv = (n: number) => r.levelAt[n];
    const seg = (a: number, b: number) => {
      const x = a === 1 ? { h: 0, day: 1, tr: 0, asc: 0 } : lv(a);
      const y = lv(b);
      if (!x || !y) return `Lv${a}→${b}: not reached`;
      return `Lv${a}→${b}: ${f1(y.h - x.h)} h · ${String(y.tr - x.tr).padStart(3)} Training + ${String(y.asc - x.asc).padStart(3)} Ascension runs · reached day ${y.day} (${y.h.toFixed(1)} h total)`;
    };
    for (const [a, b] of [[1, 3], [3, 5], [1, 5], [5, 7], [7, 8], [8, 9], [7, 9], [9, 10]]) console.log('  ' + seg(a, b));
    for (const b of BREAKTHROUGHS) {
      const g = r.gate[b.tier];
      const bottleneck = g.expReady == null || g.stonesReady == null ? '?' : g.stonesReady > g.expReady + 0.05 ? 'STONES' : g.expReady > g.stonesReady + 0.05 ? 'EXP' : 'even';
      const jumps = g.jump.length ? `levels gained on breakthrough ${g.jump.join(',')}` : '';
      console.log(`  BT ${['I', 'II', 'III'][b.tier - 1]} (Lv${b.fromLevel}→${b.toLevel}, ${b.requiredItems[0].count}/hero): Ascension runs ${g.ascBonus} bonus + ${g.ascRepeat} repeat · EXP ready ${f1(g.expReady)} h · stones ready ${f1(g.stonesReady)} h → bottleneck ${bottleneck} · ${jumps}`);
    }
  }
}

console.log('\n=== reference: per-run EXP per hero (battle EXP; potions ÷ 5 when shared) ===');
for (const d of FARM_DUNGEONS.filter(x => x.type === 'TRAINING')) {
  const potion = (d.baseRewards.items ?? []).reduce((a, i) => a + i.count * (i.itemId === 'exp_potion_s' ? 50 : i.itemId === 'exp_potion_m' ? 150 : 500), 0);
  const base = d.baseRewards.heroExp ?? 0;
  const t = RUN_SECONDS[d.id] + OVERHEAD;
  const rep = (base + potion / 5) * d.repeatRewardMultiplier;
  console.log(`  ${d.id}: bonus ${((base + potion / 5) * d.dailyBonusMultiplier).toFixed(0)} · repeat ${rep.toFixed(0)} EXP/hero · repeat ${(rep / t * 60).toFixed(0)} EXP/hero/min (${t} s/run)`);
}
