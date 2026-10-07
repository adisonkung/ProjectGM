// balance reference = the pre-remodel roster (test fixture) until the remodelled heroes exist
import '../../src/testing/legacy-roster';
/**
 * FULL PATCH 1 ACCOUNT ECONOMY — one player journey with every progression system at once, using the real rules:
 * Hero Level (potions / Training) + Breakthrough (Ascension stones) + Equipment (Hunt drops, crafting, upgrades,
 * dismantle) + Skill ranks (Skill Trial tomes) + Gold competition (gear vs skills) + Universal Memory stars +
 * Tower attempts played by the real combat engine with the current account (TacticalBot or AUTO).
 *
 *   npm run account-economy [-- --minutes=30,60 --bot=auto --seeds=3 --verbose]
 *
 * Player model per day (plan = bonus-only / N minutes of play):
 *   1. Tower: attempt the next floor (TACTICAL / AUTO bot, real battle); a win continues to the next floor, a loss
 *      ends tower play for the day (≤ 1 failed attempt per day).
 *   2. Daily bonus runs of every unlocked pool (Training 3 · Ascension 2 · Hunt 3 · Skill 2), best unlocked tier.
 *   3. Repeat runs with the remaining time on whatever blocks progress now (stones → Ascension, gear goal → Hunt,
 *      tomes → Trial, gold → Hunt, EXP → Training), rotating between the needs.
 *   After every run: potions to cap, breakthroughs, stars (Universal Memory), then gold spent on skills or gear —
 *   whichever lags the pairing Basic/S1 · Mid/S2 · Good/S3 · Very Good/S4 · Near max/S5.
 * Farm runs are assumed won (farm win rates: npm run balance -- 40 rec - --farm=all). Gacha / gems are not simulated
 * (no gem income in Patch 1): star-ups come from Universal Memory only.
 */
import { BattleEngine } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { BREAKTHROUGHS, FARM_BY_ID, FARM_DUNGEONS } from '../../src/app/core/data/economy';
import { CLASS_BUILDS, CRAFT_RECIPES, GEAR_PROFILES, GearProfileId, RARITIES, SLOTS, WEAPON_DEF_OF, WEAPON_GROUP_OF } from '../../src/app/core/data/equipment';
import { HERO_BY_ID } from '../../src/app/core/data/heroes';
import { SKILL_PROFILES, SKILL_RANK_COSTS } from '../../src/app/core/data/skill-ranks';
const rankDefCost = (rank: number) => SKILL_RANK_COSTS[rank]?.items ?? [];
import { STAGES } from '../../src/app/core/data/stages';
import { newGameState } from '../../src/app/core/data/starter';
import { EquipmentInstance, EquipmentSlot, Rarity } from '../../src/app/core/models/equipment';
import { FarmDungeonDefinition } from '../../src/app/core/models/economy';
import { GameState } from '../../src/app/core/models/game-state';
import { HeroClass } from '../../src/app/core/models/hero';
import { SkillKind } from '../../src/app/core/models/progression';
import { craft, dismantle, equip, slotOf, upgrade } from '../../src/app/core/rules/equipment';
import { breakthrough, levelState, useAllPotionsToCap } from '../../src/app/core/rules/leveling';
import { completeFarmRun, completeTowerRun, ensureDaily, isUnlocked } from '../../src/app/core/rules/rewards';
import { heroRanks, skillPriorityOf, upgradeSkill } from '../../src/app/core/rules/skill-ranks';
import { heroStar, starUp } from '../../src/app/core/rules/stars';
import { teamToUnits } from '../../src/app/core/rules/team';
import { TacticalBot, tacticalFormation } from './policy';

declare const process: { argv: string[] };
const args = process.argv.slice(2);
const arg = (k: string) => args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const BOT = (arg('bot') ?? 'tactical').toUpperCase() as 'TACTICAL' | 'AUTO';
const SEEDS = Number(arg('seeds') ?? 3);
const VERBOSE = args.includes('--verbose');
const MAX_DAYS = Number(arg('days') ?? 365);

/** measured TACTICAL active seconds per farm run (npm run balance -- 40 rec - --farm=all, special modes) + menus */
const RUN_SECONDS: Record<string, number> = {
  training_1: 75, training_2: 85, training_3: 95, training_4: 110, training_5: 120,
  ascension_1: 64, ascension_2: 80, ascension_3: 99,
  hunt_1: 84, hunt_2: 97, hunt_3: 127, hunt_4: 129, hunt_5: 186,
  trial_1: 74, trial_2: 86, trial_3: 114, trial_4: 115,
};
/** carriers caught per Hunt run (TACTICAL, same measurement) */
const HUNT_CARRIERS: Record<string, number> = { hunt_1: 3, hunt_2: 2, hunt_3: 2, hunt_4: 3, hunt_5: 2 };
const OVERHEAD = 20;
const GEAR_LADDER: GearProfileId[] = ['BASIC', 'MID', 'GOOD', 'VERY_GOOD', 'NEAR_MAX'];
const SKILL_LADDER = ['S1', 'S2', 'S3', 'S4', 'S5'];

type Plan = number | 'bonus';
type Need = 'STONES' | 'GEAR' | 'TOMES' | 'GOLD' | 'EXP';
interface Journey {
  floorAt: Record<number, { day: number; h: number; attempts: number }>;
  levelAt: Record<number, { day: number; h: number }>;
  gearAt: Record<string, { day: number; h: number }>;
  skillAt: Record<string, { day: number; h: number }>;
  starsAt: { day: number; stars: number[] }[];
  hours: number; days: number;
  time: Record<string, number>;
  gold: { earned: number; gear: number; skills: number; craftBlocked: number; skillBlocked: number };
  towerFails: Record<number, number>;
  endState: string;
  /** ore held when each gear goal was reached (surplus check) */
  oreAt: Record<string, number>;
}

const rank = (r: Rarity) => RARITIES.indexOf(r);
const defFor = (cls: HeroClass, slot: EquipmentSlot) => (slot === 'WEAPON' ? WEAPON_DEF_OF[WEAPON_GROUP_OF[cls]] : slot === 'ARMOR' ? 'guard_armor' : 'trinket');

function journey(plan: Plan, seed: number): Journey {
  let s: GameState = newGameState();
  const core = s.team.map(t => t.uid);
  const reserves = s.heroes.filter(h => !core.includes(h.uid)).slice(0, 2).map(h => h.uid);
  s = { ...s, trainingSlots: reserves };
  let x = (seed * 0.137) % 1 || 0.4242;
  const rng = () => (x = (x * 16807 + 0.12345) % 1);
  const J: Journey = {
    floorAt: {}, levelAt: {}, gearAt: {}, skillAt: {}, starsAt: [], hours: 0, days: 0, time: {},
    gold: { earned: 0, gear: 0, skills: 0, craftBlocked: 0, skillBlocked: 0 }, towerFails: {}, endState: '', oreAt: {},
  };
  let seconds = 0;
  let day = 1;
  const hero = (uid: number) => s.heroes.find(h => h.uid === uid)!;
  const cls = (uid: number) => HERO_BY_ID[hero(uid).templateId].cls;
  const mark = <T extends { day: number; h: number }>(rec: Record<string | number, T>, k: string | number, extra: Omit<T, 'day' | 'h'>) => {
    if (!rec[k]) rec[k] = { day, h: seconds / 3600, ...extra } as T;
  };
  const spend = (what: string, sec: number) => {
    seconds += sec;
    J.time[what] = (J.time[what] ?? 0) + sec;
  };

  // ------------------------------------------------------------ goals
  let gi = 0; // gear goal index
  let si = 0; // skill profile index
  const gearGoal = () => GEAR_LADDER[Math.min(gi, GEAR_LADDER.length - 1)];
  const fits = (i: EquipmentInstance, c: HeroClass, slot: EquipmentSlot, g: GearProfileId) => {
    const want = GEAR_PROFILES[g].pieces[slot];
    return slotOf(i) === slot && i.definitionId === defFor(c, slot) && i.main.stat === CLASS_BUILDS[c][slot].main &&
      rank(i.rarity) >= rank(want.rarity) && (!want.affix || !!i.affix || i.rarity === 'RARE');
  };
  const gearDone = (g: GearProfileId) => core.every(uid => SLOTS.every(slot => {
    const cur = hero(uid).gear?.[slot];
    return cur && fits(cur, cls(uid), slot, g) && cur.upgradeLevel >= GEAR_PROFILES[g].pieces[slot].level;
  }));
  // skill queue: profile by profile, critical → important → secondary, one rank at a time
  const skillQueue: { uid: number; slot: SkillKind; rank: number; profile: string }[] = [];
  for (const pid of SKILL_LADDER) {
    const p = SKILL_PROFILES[pid];
    for (const pr of ['critical', 'important', 'secondary'] as const) {
      for (const uid of core) {
        const t = HERO_BY_ID[hero(uid).templateId];
        const slot = skillPriorityOf(t.id, t.cls)[pr];
        const have = skillQueue.filter(q => q.uid === uid && q.slot === slot).length + 1;
        for (let r = have + 1; r <= p[pr]; r++) skillQueue.push({ uid, slot, rank: r, profile: pid });
      }
    }
  }
  let qi = 0;
  const nextSkill = () => skillQueue[qi];

  // ------------------------------------------------------------ spending
  let lastSkillError: string | null = null;
  let lastGearBlock: 'FRAGS' | 'GOLD' | null = null;
  const trySkills = (): boolean => {
    let did = false;
    while (qi < skillQueue.length) {
      const q = skillQueue[qi];
      if (heroRanks(hero(q.uid))[q.slot] >= q.rank) { qi++; continue; }
      const r = upgradeSkill(s, q.uid, q.slot);
      if ('error' in r) { lastSkillError = r.error; if (r.error === 'NEED_GOLD') J.gold.skillBlocked++; break; }
      J.gold.skills += s.gold - r.state.gold;
      s = r.state;
      qi++;
      did = true;
      lastSkillError = null;
      if (qi === skillQueue.length || skillQueue[qi].profile !== q.profile) mark(J.skillAt, q.profile, {});
    }
    si = SKILL_LADDER.findIndex(p => !J.skillAt[p]);
    if (si < 0) si = SKILL_LADDER.length;
    return did;
  };
  const score = (i: EquipmentInstance) => rank(i.rarity) * 100 + i.upgradeLevel + (i.affix ? 1 : 0);
  const tryGear = (): boolean => {
    if (gi >= GEAR_LADDER.length) return false;
    const g = gearGoal();
    let did = false;
    lastGearBlock = null;
    // equip the best fitting bag items
    for (const uid of core) for (const slot of SLOTS) {
      const c = cls(uid);
      const cur = hero(uid).gear?.[slot];
      const cand = s.equipment.filter(i => slotOf(i) === slot && i.definitionId === defFor(c, slot) && i.main.stat === CLASS_BUILDS[c][slot].main)
        .sort((a, b) => score(b) - score(a))[0];
      if (cand && (!cur || score(cand) > score(cur))) {
        const r = equip(s, uid, cand.instanceId);
        if (!('error' in r)) { s = r.state; did = true; }
      }
    }
    // craft missing pieces of the goal
    for (const uid of core) for (const slot of SLOTS) {
      const c = cls(uid);
      const cur = hero(uid).gear?.[slot];
      if (cur && fits(cur, c, slot, g)) continue;
      // the best recipe (≥ the wanted rarity) the fragments + gold allow now — Hunt V gives no Basic fragments
      const options = RARITIES.slice(rank(GEAR_PROFILES[g].pieces[slot].rarity)).filter(r => CRAFT_RECIPES[r]).reverse();
      const want = options.find(r => (s.inventory[CRAFT_RECIPES[r]!.fragmentId] ?? 0) >= CRAFT_RECIPES[r]!.fragments && s.gold >= CRAFT_RECIPES[r]!.gold) ?? options.at(-1)!;
      const before = s.gold;
      const r = craft(s, want, defFor(c, slot), CLASS_BUILDS[c][slot].main, rng);
      if ('error' in r) {
        if (r.error === 'NEED_GOLD') { J.gold.craftBlocked++; lastGearBlock = 'GOLD'; } else lastGearBlock ??= 'FRAGS';
        continue;
      }
      s = r.state;
      J.gold.gear += before - s.gold;
      did = true;
      const e = equip(s, uid, r.item!.instanceId);
      if (!('error' in e)) s = e.state;
    }
    // upgrade toward the goal level
    for (let pass = 0; pass < 40; pass++) {
      let any = false;
      for (const uid of core) for (const slot of SLOTS) {
        const cur = hero(uid).gear?.[slot];
        if (!cur || cur.upgradeLevel >= GEAR_PROFILES[g].pieces[slot].level) continue;
        const before = s.gold;
        const r = upgrade(s, cur.instanceId);
        if ('error' in r) { if (r.error === 'NEED_GOLD') lastGearBlock = 'GOLD'; continue; }
        s = r.state;
        J.gold.gear += before - s.gold;
        any = did = true;
      }
      if (!any) break;
    }
    // dismantle what nobody can use better
    for (const i of [...s.equipment]) {
      const useful = core.some(uid => {
        const c = cls(uid);
        const slot = slotOf(i);
        const cur = hero(uid).gear?.[slot];
        return i.definitionId === defFor(c, slot) && i.main.stat === CLASS_BUILDS[c][slot].main && (!cur || score(i) > score(cur));
      });
      if (!useful) {
        const r = dismantle(s, i.instanceId);
        if (!('error' in r)) s = r.state;
      }
    }
    while (gi < GEAR_LADDER.length && gearDone(gearGoal())) { mark(J.gearAt, gearGoal(), {}); J.oreAt[gearGoal()] = s.inventory['enhancement_ore'] ?? 0; gi++; }
    return did;
  };
  const tidy = () => {
    // levels: potions to cap (lowest hero first), breakthroughs
    for (const uid of [...core].sort((a, b) => hero(a).level - hero(b).level)) {
      const r = useAllPotionsToCap(hero(uid), s.inventory);
      s = { ...s, inventory: r.inventory, heroes: s.heroes.map(h => (h.uid === uid ? r.hero : h)) };
      if (levelState(hero(uid)) === 'BREAKTHROUGH_READY') {
        const b = breakthrough(hero(uid), s.inventory);
        if (!('error' in b)) s = { ...s, inventory: b.inventory, heroes: s.heroes.map(h => (h.uid === uid ? b.hero : h)) };
      }
    }
    const lv = Math.min(...core.map(u => hero(u).level));
    for (let l = 2; l <= lv; l++) mark(J.levelAt, l, {});
    // stars from Universal Memory (team order)
    for (const uid of core) {
      const r = starUp(s, uid);
      if (r) { s = r; J.starsAt.push({ day, stars: core.map(u => heroStar(hero(u))) }); }
    }
    // gold: skills or gear first — whichever lags the pairing
    for (let k = 0; k < 3; k++) {
      const skillFirst = si <= gi;
      const a = skillFirst ? trySkills() : tryGear();
      const b = skillFirst ? tryGear() : trySkills();
      if (!a && !b) break;
    }
  };

  // ------------------------------------------------------------ runs
  const unlocked = (type: string) => FARM_DUNGEONS.filter(d => d.type === type && isUnlocked(d, s.cleared));
  const best = (type: string) => unlocked(type).at(-1);
  const farm = (def: FarmDungeonDefinition, now: Date) => {
    const before = s.gold;
    const carriers = HUNT_CARRIERS[def.id] ?? 0;
    const mode = def.type === 'EQUIPMENT'
      ? { kind: 'TREASURE' as const, kills: 60, carriersKilled: carriers, carriersTotal: 3, escaped: 3 - carriers, strikes: 0, maxStrikes: 0, enraged: false }
      : undefined;
    s = completeFarmRun(s, def, { win: true, deaths: 0, time: 60, participants: core, mode: mode as never }, rng, now).state;
    J.gold.earned += s.gold - before;
    spend(def.type, RUN_SECONDS[def.id] + OVERHEAD);
    tidy();
  };
  const stoneNeed = (): number => {
    for (const uid of core) {
      const h = hero(uid);
      if (levelState(h) !== 'BREAKTHROUGH_READY') continue;
      const bt = BREAKTHROUGHS[h.breakthroughTier ?? 0];
      if (bt && !bt.requiredItems.every(i => (s.inventory[i.itemId] ?? 0) >= i.count)) return bt.tier;
    }
    return 0;
  };
  const needs = (): Need[] => {
    const out: Need[] = [];
    if (stoneNeed()) out.push('STONES');
    if (gi < GEAR_LADDER.length && lastGearBlock !== 'GOLD') out.push('GEAR');
    if (qi < skillQueue.length && lastSkillError === 'NEED_MATERIALS') out.push('TOMES');
    if ((qi < skillQueue.length && lastSkillError === 'NEED_GOLD') || lastGearBlock === 'GOLD') out.push('GOLD');
    if (core.some(u => levelState(hero(u)) === 'NORMAL')) out.push('EXP');
    return out;
  };
  const farmFor = (n: Need): FarmDungeonDefinition | undefined => {
    if (n === 'STONES') return unlocked('ASCENSION').find(d => d.id === `ascension_${stoneNeed()}`) ?? best('ASCENSION');
    if (n === 'TOMES') {
      // the tome the next upgrade is missing, from the Trial with the best yield per second
      const q = nextSkill();
      const cost = q ? rankDefCost(q.rank) : [];
      const miss = cost.find(i => (s.inventory[i.itemId] ?? 0) < i.count)?.itemId ?? 'skill_tome_1';
      const rate = (d: FarmDungeonDefinition) => ((d.baseRewards.items ?? []).find(i => i.itemId === miss)?.count ?? 0) / (RUN_SECONDS[d.id] + OVERHEAD);
      return [...unlocked('SKILL')].sort((a, b) => rate(b) - rate(a))[0] ?? best('SKILL');
    }
    if (n === 'GEAR' || n === 'GOLD') return best('EQUIPMENT');
    return best('TRAINING');
  };

  // ------------------------------------------------------------ tower
  const attempt = (floor: number): boolean => {
    const stage = STAGES.find(st => st.floor === floor)!;
    const team = BOT === 'TACTICAL' ? tacticalFormation(s.heroes, s.team, stage) : s.team;
    const e = new BattleEngine({ allies: teamToUnits(team, s.heroes), stage, enemyTemplates: ENEMIES, seed: Math.floor(rng() * 1e9), autoUlt: true });
    const bot = BOT === 'TACTICAL' ? new TacticalBot() : null;
    while (!e.result && e.time < 400) { bot?.tick(e); e.step(0.05); e.drainEvents(); }
    spend('TOWER', e.time + OVERHEAD);
    const win = e.result === 'win';
    if (VERBOSE && floor >= 7) {
      const hs = s.team.map(t => hero(t.uid));
      console.log(`    attempt F${floor} day ${day}: ${e.result} t=${e.time.toFixed(0)} wave ${e.waveIndex + 1} deaths ${e.metrics.deaths} · Lv ${hs.map(h => h.level).join('/')} · stars ${hs.map(h => heroStar(h)).join('/')} · gear ${hs.map(h => Object.values(h.gear ?? {}).filter(Boolean).map(i => i!.rarity[0] + i!.upgradeLevel).join(',')).join(' | ')} · ranks ${hs.map(h => Object.values(heroRanks(h)).join('')).join(' ')}`);
    }
    if (win) {
      const before = s.gold;
      s = completeTowerRun(s, floor, { win: true, deaths: e.metrics.deaths, time: e.time, participants: core }).state;
      J.gold.earned += s.gold - before;
      mark(J.floorAt, floor, { attempts: (J.towerFails[floor] ?? 0) + 1 });
      tidy();
    } else J.towerFails[floor] = (J.towerFails[floor] ?? 0) + 1;
    return win;
  };

  // ------------------------------------------------------------ days
  const allDone = () => s.cleared >= 10 && gi >= GEAR_LADDER.length && qi >= skillQueue.length && core.every(u => hero(u).level >= 10);
  for (; day <= MAX_DAYS && !allDone(); day++) {
    const now = new Date(2026, 9, day, 12);
    s = { ...s, daily: ensureDaily(s.daily, now) };
    const dayStart = seconds;
    const budget = plan === 'bonus' ? 0 : plan * 60;
    const left = () => budget - (seconds - dayStart);
    // 1. tower
    while (s.cleared < 10) {
      if (!attempt(s.cleared + 1)) break;
    }
    // 2. daily bonus runs (every pool, best tier; Ascension only while stones are useful)
    for (const [type, n] of [['TRAINING', 3], ['ASCENSION', 2], ['EQUIPMENT', 3], ['SKILL', 2]] as const) {
      for (let i = 0; i < n; i++) {
        // Ascension only while a core hero still has breakthroughs ahead (stones are useless afterwards)
        const btTier = Math.min(...core.map(u => hero(u).breakthroughTier ?? 0)) + 1;
        let def = type === 'ASCENSION' ? (btTier <= 3 ? unlocked('ASCENSION').find(d => d.id === `ascension_${stoneNeed() || btTier}`) : undefined)
          : type === 'SKILL' ? (qi < skillQueue.length ? farmFor('TOMES') : undefined) : best(type);
        if (type === 'TRAINING' && !core.some(u => levelState(hero(u)) === 'NORMAL')) def = undefined;
        if (!def) break;
        farm(def, now);
      }
    }
    // 3. repeat runs on what blocks progress now (rotating)
    let rot = 0;
    for (let guard = 0; guard < 200 && left() > 0; guard++) {
      const ns = needs();
      if (!ns.length) break;
      const def = farmFor(ns[rot++ % ns.length]);
      if (!def || left() < (RUN_SECONDS[def.id] + OVERHEAD) * 0.5) break;
      farm(def, now);
    }
    // a win today may unlock the next attempt tomorrow; a second attempt after farming if time is left
    if (s.cleared < 10 && plan !== 'bonus' && left() > 150) attempt(s.cleared + 1);
    if (VERBOSE && day % 5 === 0) {
      console.log(`  day ${day} · ${(seconds / 3600).toFixed(1)} h · F${s.cleared} · Lv ${core.map(u => hero(u).level).join('/')} · gear goal ${gearGoal()} · skills ${SKILL_LADDER[si] ?? 'done'} (${lastSkillError ?? '-'}) · gold ${s.gold} · ${JSON.stringify(Object.fromEntries(Object.entries(s.inventory).filter(([k, v]) => v && /tome_\d|stone|ore|universal/.test(k))))}`);
    }
  }
  J.days = day - 1;
  J.hours = seconds / 3600;
  J.endState = `F${s.cleared} · Lv ${core.map(u => hero(u).level).join('/')} · gear ${J.gearAt['NEAR_MAX'] ? 'NEAR_MAX' : gi ? GEAR_LADDER[gi - 1] : '-'} · skills ${qi}/${skillQueue.length} · stars ${core.map(u => heroStar(hero(u))).join('/')} · gold ${s.gold} · ore ${s.inventory['enhancement_ore'] ?? 0} · frags ${['basic', 'rare', 'elite', 'epic'].map(f => s.inventory[`equip_frag_${f}`] ?? 0).join('/')}`;
  return J;
}

// ------------------------------------------------------------------ report

const plans: Plan[] = arg('minutes') ? arg('minutes')!.split(',').map(m => (m === 'bonus' || m === '0' ? 'bonus' : Number(m))) : ['bonus', 30, 60, 120, 240];
const median = (v: number[]) => { const a = [...v].sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
const fmt = (xs: ({ day: number; h: number } | undefined)[]) => {
  const got = xs.filter((v): v is { day: number; h: number } => !!v);
  if (got.length < xs.length / 2) return 'not reached'.padStart(18);
  return `d${String(median(got.map(v => v.day))).padStart(3)} · ${median(got.map(v => v.h)).toFixed(1).padStart(5)} h`;
};
console.log(`FULL ACCOUNT ECONOMY · bot ${BOT} · ${SEEDS} journeys per plan (medians) · max ${MAX_DAYS} days`);
for (const p of plans) {
  const js = Array.from({ length: SEEDS }, (_, i) => journey(p, i + 1));
  console.log(`\n=== ${p === 'bonus' ? 'daily bonus only (+ 1 tower attempt / day)' : `${p} min/day`} ===`);
  console.log('  floors:  ' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(f => `F${f} ${fmt(js.map(j => j.floorAt[f]))}`).filter((_, i) => i >= 4).join(' | '));
  console.log('           attempts to clear F7–F10: ' + [7, 8, 9, 10].map(f => `F${f} ${median(js.map(j => j.floorAt[f]?.attempts ?? NaN))}`).join(' · '));
  console.log('  levels:  ' + [5, 6, 8, 9, 10].map(l => `Lv${l} ${fmt(js.map(j => j.levelAt[l]))}`).join(' | '));
  console.log('  gear:    ' + GEAR_LADDER.map(g => `${g} ${fmt(js.map(j => j.gearAt[g]))}`).join(' | '));
  console.log('  skills:  ' + SKILL_LADDER.map(k => `${k} ${fmt(js.map(j => j.skillAt[k]))}`).join(' | '));
  const tt = (k: string) => median(js.map(j => (j.time[k] ?? 0) / 3600)).toFixed(1);
  console.log(`  total:   ${median(js.map(j => j.days))} days · ${median(js.map(j => j.hours)).toFixed(1)} h — time: tower ${tt('TOWER')} h · training ${tt('TRAINING')} · ascension ${tt('ASCENSION')} · hunt ${tt('EQUIPMENT')} · trial ${tt('SKILL')}`);
  const g = js[0].gold;
  console.log(`  gold (journey 1): earned ${g.earned} · spent gear ${g.gear} · skills ${g.skills} · craft blocked by gold ${g.craftBlocked}× · skill blocked by gold ${g.skillBlocked}×`);
  console.log(`  ore held at gear goal (journey 1): ${GEAR_LADDER.map(g => `${g} ${js[0].oreAt[g] ?? '-'}`).join(' · ')}`);
  console.log(`  end (journey 1): ${js[0].endState} · tower fails ${JSON.stringify(js[0].towerFails)}`);
}
