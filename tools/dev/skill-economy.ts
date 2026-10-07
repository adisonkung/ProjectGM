// balance reference = the pre-remodel roster (test fixture) until the remodelled heroes exist
import '../../src/testing/legacy-roster';
/**
 * Skill Upgrade farming model (Skill Upgrade spec): the 5-hero core team farms Skill Trials with the real reward code
 * (completeFarmRun → tomes / fragments / gold) and upgrades with the real rule (upgradeSkill) in priority order:
 * S1 (critical R2) → S2 → S3 → S4 → S5. Heroes are Lv10 / BT III (skill time only — level gates are the Level
 * system's job). Every Trial run is a win.
 *
 *   npm run skill-economy [-- --minutes=30,60] [--gold=N]   (--gold = extra gold per hour from other content, default 0)
 *
 * Player per day: 2 Skill Trial bonus runs, then repeat runs until the day's time is used (bonus-only = 2 runs).
 * Trial choice: the unlocked Trial that yields most of the next upgrade's missing tome per second.
 */
import { FARM_BY_ID, TRIAL_BONUS_CHANCE, TRIAL_TIERS } from '../../src/app/core/data/economy';
import { HERO_BY_ID } from '../../src/app/core/data/heroes';
import { SKILL_PROFILES, SKILL_RANK_COSTS } from '../../src/app/core/data/skill-ranks';
import { newGameState } from '../../src/app/core/data/starter';
import { GameState } from '../../src/app/core/models/game-state';
import { SkillKind } from '../../src/app/core/models/progression';
import { completeFarmRun, ensureDaily } from '../../src/app/core/rules/rewards';
import { heroRanks, skillPriorityOf, upgradeBlocker, upgradeSkill } from '../../src/app/core/rules/skill-ranks';

declare const process: { argv: string[] };
const arg = (k: string) => process.argv.slice(2).find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const minutesArg = arg('minutes');
const extraGoldPerHour = Number(arg('gold') ?? 0);

/** measured TACTICAL clear seconds at the unlock profile (npm run balance -- 100 rec - --farm=trial_1,…) + 20 s menus */
const RUN_SECONDS: Record<string, number> = { trial_1: 79, trial_2: 88, trial_3: 135, trial_4: 125 };
const OVERHEAD = 20;

interface Step { uid: number; slot: SkillKind; rank: number; label: string }
interface Result {
  milestones: Record<string, { h: number; day: number; runs: number }>;
  runs: number; hours: number; goldWaitH: number; tomeWaitH: number; goldEarned: number; goldSpent: number;
}

function simulate(plan: number | 'bonus'): Result {
  let s: GameState = { ...newGameState(), cleared: 8, gold: 0 };
  const core = s.team.map(t => t.uid);
  s = { ...s, heroes: s.heroes.map(h => (core.includes(h.uid) ? { ...h, level: 10, breakthroughTier: 3 } : h)) };
  // upgrade queue: profile by profile, critical first, one rank at a time
  const queue: Step[] = [];
  for (const pid of ['S1', 'S2', 'S3', 'S4', 'S5']) {
    const p = SKILL_PROFILES[pid];
    for (const pr of ['critical', 'important', 'secondary'] as const) {
      for (const uid of core) {
        const t = HERO_BY_ID[s.heroes.find(h => h.uid === uid)!.templateId];
        const slot = skillPriorityOf(t.id, t.cls)[pr];
        const have = queue.filter(q => q.uid === uid && q.slot === slot).length + 1;
        for (let r = have + 1; r <= p[pr]; r++) queue.push({ uid, slot, rank: r, label: pid });
      }
    }
  }
  let x = 0.4242;
  const rng = () => (x = (x * 16807 + 0.12345) % 1);
  const res: Result = { milestones: {}, runs: 0, hours: 0, goldWaitH: 0, tomeWaitH: 0, goldEarned: 0, goldSpent: 0 };
  let seconds = 0;
  let qi = 0;
  let upgrades = 0;
  const reach = (k: string, day: number) => { if (!res.milestones[k]) res.milestones[k] = { h: seconds / 3600, day, runs: res.runs }; };
  const tryUpgrades = (day: number) => {
    while (qi < queue.length) {
      const q = queue[qi];
      const r = upgradeSkill(s, q.uid, q.slot);
      if ('error' in r) return r.error;
      res.goldSpent += s.gold - r.state.gold;
      s = r.state;
      qi++;
      upgrades++;
      const ranks = core.flatMap(uid => Object.values(heroRanks(s.heroes.find(h => h.uid === uid)!)));
      const crit = core.map(uid => {
        const h = s.heroes.find(x => x.uid === uid)!;
        const t = HERO_BY_ID[h.templateId];
        return heroRanks(h)[skillPriorityOf(t.id, t.cls).critical];
      });
      for (const n of [2, 3, 4, 5]) {
        if (ranks.some(v => v >= n)) reach(`first R${n}`, day);
        if (crit.every(v => v >= n)) reach(`5 critical R${n}`, day);
      }
      if (ranks.filter(v => v >= 5).length >= 3) reach('3 skills R5', day);
      if (qi === queue.length || queue[qi].label !== q.label) reach(`profile ${q.label}`, day);
    }
    return null;
  };
  const nextNeed = (): string | null => {
    const q = queue[qi];
    if (!q) return null;
    const cost = SKILL_RANK_COSTS[q.rank];
    const miss = cost.items.find(i => (s.inventory[i.itemId] ?? 0) < i.count);
    return miss?.itemId ?? null;
  };
  const pick = () => {
    const need = nextNeed() ?? 'skill_tome_1';
    let best = FARM_BY_ID['trial_1'];
    let bestV = -1;
    for (const t of TRIAL_TIERS) {
      const d = FARM_BY_ID[`trial_${t.n}`];
      if (s.cleared < d.unlockFloor) continue;
      const base = t.tomes.find(([id]) => id === need)?.[1] ?? 0;
      const v = (base + (t.bonus === need ? TRIAL_BONUS_CHANCE : 0)) / (RUN_SECONDS[d.id] + OVERHEAD);
      if (v > bestV) { bestV = v; best = d; }
    }
    return best;
  };
  for (let day = 1; day <= 3000 && qi < queue.length; day++) {
    const now = new Date(2026, 9, day, 12);
    s = { ...s, daily: ensureDaily(s.daily, now) };
    let budget = plan === 'bonus' ? 0 : plan * 60;
    for (let n = 0; qi < queue.length; n++) {
      const def = pick();
      const cost = RUN_SECONDS[def.id] + OVERHEAD;
      if (n >= 2 && budget < cost) break;
      const before = s.gold;
      s = completeFarmRun(s, def, { win: true, deaths: 0, time: 60, participants: core }, rng, now).state;
      const extra = Math.round(extraGoldPerHour * cost / 3600);
      s = { ...s, gold: s.gold + extra };
      res.goldEarned += s.gold - before;
      budget -= cost;
      seconds += cost;
      res.runs++;
      const blocked = tryUpgrades(day);
      if (blocked === 'NEED_GOLD') res.goldWaitH += cost / 3600;
      if (blocked === 'NEED_MATERIALS') res.tomeWaitH += cost / 3600;
    }
  }
  res.hours = seconds / 3600;
  void upgrades;
  return res;
}

const plans: (number | 'bonus')[] = minutesArg ? minutesArg.split(',').map(Number) : ['bonus', 30, 60, 120, 240];
const ORDER = ['first R2', '5 critical R2', 'profile S1', 'first R3', '5 critical R3', 'profile S2', 'first R4', '5 critical R4', 'profile S3', 'first R5', '3 skills R5', '5 critical R5', 'profile S4', 'profile S5'];
console.log(`Skill Trial farming · core team Lv10 BT III · extra gold ${extraGoldPerHour}/h`);
for (const p of plans) {
  const r = simulate(p);
  console.log(`\n=== ${p === 'bonus' ? 'daily bonus only (2 Trial runs / day)' : `${p} min/day of Skill Trial`} — ${r.runs} runs · ${r.hours.toFixed(1)} h · gold earned ${r.goldEarned} spent ${r.goldSpent} · waiting on gold ${r.goldWaitH.toFixed(1)} h · on tomes ${r.tomeWaitH.toFixed(1)} h ===`);
  for (const k of ORDER) {
    const m = r.milestones[k];
    console.log(`  ${k.padEnd(15)} ${m ? `day ${String(m.day).padStart(4)} · ${m.h.toFixed(1).padStart(5)} h · ${String(m.runs).padStart(4)} runs` : 'not reached'}`);
  }
}
