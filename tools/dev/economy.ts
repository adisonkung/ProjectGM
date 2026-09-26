/**
 * Patch 1 progression-speed model: a core team of 5 heroes farming with the real reward code
 * (completeFarmRun / completeTowerRun / breakthrough / potions). No combat — every run is a win.
 * npm run economy [-- --minutes=30,60,120,240 --bonus-only]
 *
 * Player model per day: spend the daily bonus runs (Training 3, Ascension 2), then repeat runs until the day's time is
 * used. A run = measured active clear time (npm run balance -- 60 rec - --farm=all) + 30 s menus / placement.
 * Stones are farmed when a hero waits at a gate; otherwise the highest unlocked Training. Tower floors are cleared
 * (first clear EXP) once the team's lowest level reaches the floor band's minimum; Floor 10 is never assumed.
 * Potions go to the lowest hero with "Use Max".
 */
import { BREAKTHROUGHS, DAILY_BONUS, FARM_BY_ID, FARM_DUNGEONS } from '../../src/app/core/data/economy';
import { newGameState } from '../../src/app/core/data/starter';
import { GameState } from '../../src/app/core/models/game-state';
import { breakthrough, levelState, nextBreakthrough, useAllPotionsToCap } from '../../src/app/core/rules/leveling';
import { completeFarmRun, completeTowerRun, dailyBonusLeft, ensureDaily, isUnlocked } from '../../src/app/core/rules/rewards';

declare const process: { argv: string[] };
const args = process.argv.slice(2);
const minutesArg = args.find(a => a.startsWith('--minutes='))?.slice(10);

/** measured active clear seconds (level-only team at the dungeon's lower recommended level) + 30 s overhead */
const RUN_SECONDS: Record<string, number> = {
  training_1: 72, training_2: 73, training_3: 60, training_4: 63, training_5: 76,
  ascension_1: 41, ascension_2: 56, ascension_3: 71,
};
const OVERHEAD = 30;
const TOWER_RUN_SECONDS = 90;
const TOWER_CLEAR_LEVEL: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 3, 6: 5, 7: 5, 8: 8, 9: 9 };

interface Milestones {
  day: Record<string, number>;
  runs: Record<string, number>;
  hours: Record<string, number>;
}

function simulate(minutesPerDay: number | 'bonus'): Milestones {
  let s: GameState = newGameState();
  const core = s.team.map(t => t.uid);
  const ms: Milestones = { day: {}, runs: {}, hours: {} };
  let rng = 12345;
  const rand = () => ((rng = (rng * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let seconds = 0;
  const runs: Record<string, number> = { training: 0, ascension: 0, tower: 0 };
  const bandRuns: Record<string, number> = {};
  const hero = (uid: number) => s.heroes.find(h => h.uid === uid)!;
  const minLevel = () => Math.min(...core.map(u => hero(u).level));
  const band = () => {
    const l = minLevel();
    return l < 5 ? 'Lv1→5' : l < 6 ? 'Lv5→6' : l < 8 ? 'Lv6→8' : l < 9 ? 'Lv8→9' : l < 10 ? 'Lv9→10' : 'done';
  };
  const mark = (key: string, day: number) => {
    if (ms.day[key] != null) return;
    ms.day[key] = day;
    ms.runs[key] = runs['training'] + runs['ascension'];
    ms.hours[key] = +(seconds / 3600).toFixed(1);
  };
  const tidy = (day: number) => {
    // tower first clears the team is ready for (never Floor 10): level-only TACTICAL ≥ 50 % (npm run balance
    // -- 100 <lv> - --all-floors --profile=LVL); Floor 9 needs gear — assumed cleared at Lv9 once equipment exists
    for (let f = s.cleared + 1; f <= 9; f++) {
      if (minLevel() < TOWER_CLEAR_LEVEL[f]) break;
      s = completeTowerRun(s, f, { win: true, deaths: 0, time: 60, participants: core }).state;
      runs['tower']++;
      seconds += TOWER_RUN_SECONDS;
    }
    // potions → lowest heroes, then breakthroughs
    for (let pass = 0; pass < 3; pass++) {
      for (const uid of [...core].sort((a, b) => hero(a).level - hero(b).level || (hero(a).exp ?? 0) - (hero(b).exp ?? 0))) {
        const r = useAllPotionsToCap(hero(uid), s.inventory);
        s = { ...s, inventory: r.inventory, heroes: s.heroes.map(h => (h.uid === uid ? r.hero : h)) };
        const b = breakthrough(hero(uid), s.inventory);
        if (!('error' in b)) s = { ...s, inventory: b.inventory, heroes: s.heroes.map(h => (h.uid === uid ? b.hero : h)) };
      }
    }
    const lv = minLevel();
    for (const [k, v] of [['team Lv5', 5], ['team Lv6 (BT I)', 6], ['team Lv8', 8], ['team Lv9 (BT II)', 9], ['team Lv10 (BT III)', 10]] as const) {
      if (lv >= v) mark(k, day);
    }
  };
  /** what to run next: stones if a hero waits at a gate and the stones are short, else the best Training */
  const pick = (): string => {
    const waiting = core.map(hero).filter(h => levelState(h) === 'BREAKTHROUGH_READY');
    for (const h of waiting) {
      const bt = nextBreakthrough(h)!;
      const need = bt.requiredItems[0];
      const have = s.inventory[need.itemId] ?? 0;
      const asc = FARM_BY_ID[`ascension_${bt.tier}`];
      const needAll = waiting.filter(w => nextBreakthrough(w)?.tier === bt.tier).length * need.count;
      if (have < needAll && isUnlocked(asc, s.cleared)) return asc.id;
    }
    const tr = FARM_DUNGEONS.filter(d => d.type === 'TRAINING' && isUnlocked(d, s.cleared));
    return tr[tr.length - 1].id;
  };
  for (let day = 1; day <= 400 && minLevel() < 10; day++) {
    const now = new Date(2026, 9, day, 12);
    s = { ...s, daily: ensureDaily(s.daily, now) };
    let budget = minutesPerDay === 'bonus' ? Infinity : minutesPerDay * 60;
    let bonusRuns = 0;
    for (let guard = 0; guard < 500 && minLevel() < 10; guard++) {
      tidy(day);
      const id = pick();
      const def = FARM_BY_ID[id];
      const bonus = dailyBonusLeft(s.daily, def.dailyBonusPool) > 0;
      if (minutesPerDay === 'bonus') {
        // bonus-only player: just the daily bonus runs of both pools
        if (!bonus) {
          const other = def.type === 'TRAINING' ? 'ASCENSION' : 'TRAINING';
          if (bonusRuns >= DAILY_BONUS['TRAINING'] + DAILY_BONUS['ASCENSION'] || dailyBonusLeft(s.daily, other) <= 0) break;
          const alt = other === 'ASCENSION'
            ? FARM_DUNGEONS.filter(d => d.type === 'ASCENSION' && isUnlocked(d, s.cleared)).pop()
            : FARM_DUNGEONS.filter(d => d.type === 'TRAINING' && isUnlocked(d, s.cleared)).pop();
          if (!alt) break;
          const bb = band();
          s = completeFarmRun(s, alt, { win: true, deaths: 0, time: 60, participants: core }, rand, now).state;
          runs[alt.type === 'TRAINING' ? 'training' : 'ascension']++;
          const key = alt.type === 'TRAINING' ? `training ${bb}` : `ascension ${alt.id}`;
          bandRuns[key] = (bandRuns[key] ?? 0) + 1;
          seconds += RUN_SECONDS[alt.id] + OVERHEAD;
          bonusRuns++;
          continue;
        }
      }
      const cost = RUN_SECONDS[id] + OVERHEAD;
      if (budget < cost) break;
      budget -= cost;
      seconds += cost;
      const b0 = band();
      s = completeFarmRun(s, def, { win: true, deaths: 0, time: 60, participants: core }, rand, now).state;
      runs[def.type === 'TRAINING' ? 'training' : 'ascension']++;
      if (def.type === 'TRAINING') bandRuns[`training ${b0}`] = (bandRuns[`training ${b0}`] ?? 0) + 1;
      else bandRuns[`ascension ${id}`] = (bandRuns[`ascension ${id}`] ?? 0) + 1;
      bonusRuns++;
    }
    tidy(day);
  }
  Object.assign(ms.runs, Object.fromEntries(Object.entries(bandRuns).map(([k, v]) => [`#${k}`, v])));
  ms.runs['total training'] = runs['training'];
  ms.runs['total ascension'] = runs['ascension'];
  ms.hours['total'] = +(seconds / 3600).toFixed(1);
  return ms;
}

const plans: (number | 'bonus')[] = minutesArg ? minutesArg.split(',').map(Number) : ['bonus', 30, 60, 120, 240];
for (const p of plans) {
  const m = simulate(p);
  console.log(`\n=== ${p === 'bonus' ? 'daily bonus only (3 Training + 2 Ascension)' : `${p} min/day`} ===`);
  for (const k of Object.keys(m.day)) console.log(`  ${k.padEnd(20)} day ${String(m.day[k]).padStart(3)} · ${String(m.hours[k]).padStart(5)} h played · ${m.runs[k]} farm runs`);
  console.log('  runs by band:', Object.entries(m.runs).filter(([k]) => k.startsWith('#') || k.startsWith('total')).map(([k, v]) => `${k.replace('#', '')} ${v}`).join(' · '));
  console.log(`  total play ${m.hours['total']} h`);
}

// ------------------------------------------------------------------ per-hero reference numbers (one hero, one dungeon)
console.log('\n=== reference: runs for ONE hero in one dungeon (battle EXP + that run\'s potions on the same hero) ===');
for (const d of FARM_DUNGEONS.filter(x => x.type === 'TRAINING')) {
  const potion = (d.baseRewards.items ?? []).reduce((a, i) => a + i.count * (i.itemId === 'exp_potion_s' ? 50 : i.itemId === 'exp_potion_m' ? 150 : 500), 0);
  const base = (d.baseRewards.heroExp ?? 0);
  const perBonus = (base + potion / 5) * d.dailyBonusMultiplier;
  const perRepeat = (base + potion / 5) * d.repeatRewardMultiplier;
  console.log(`  ${d.id}: per hero (5-hero team, potions shared) bonus ${perBonus.toFixed(0)} EXP · repeat ${perRepeat.toFixed(0)} EXP`);
}
for (const b of BREAKTHROUGHS) {
  const need = b.requiredItems[0].count;
  console.log(`  ${b.id} (Lv${b.fromLevel}→${b.toLevel}): ${need} stones per hero, ${need * 5} for a 5-hero team · bonus clear 2 stones · repeat 7 fragments (0.7) · first clear +1`);
}
