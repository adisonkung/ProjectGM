// balance reference = the pre-remodel roster (test fixture) until the remodelled heroes exist
import '../../src/testing/legacy-roster';
/**
 * Equipment farming model (Equipment spec §84–85): a 5-hero core team farms Equipment Hunt with the real reward code
 * (completeFarmRun → drops / fragments / ore / gold), crafts the missing pieces deterministically, dismantles what it
 * can't use and upgrades to the gear profile (core/data/equipment.ts GEAR_PROFILES). Every Hunt run is a win.
 *
 *   npm run gear-economy [-- --minutes=30,60]
 *
 * Goals in order: BASIC (Hunt II) → MID (Hunt III) → GOOD (Hunt IV) → VERY_GOOD (Hunt V). A piece counts when it has
 * the class build's main stat and at least the profile rarity (affix: any affix when the profile wants one).
 * Player per day: 3 Hunt bonus runs, then repeat runs until the day's time is used (bonus-only = 3 runs).
 * Gear farming overlaps with levelling (it is played on the same days) — times here are Hunt time only.
 */
import { FARM_BY_ID } from '../../src/app/core/data/economy';
import { CLASS_BUILDS, CRAFT_RECIPES, GEAR_PROFILES, GearProfileId, RARITIES, SLOTS, WEAPON_DEF_OF, WEAPON_GROUP_OF } from '../../src/app/core/data/equipment';
import { HERO_BY_ID } from '../../src/app/core/data/heroes';
import { newGameState } from '../../src/app/core/data/starter';
import { EquipmentInstance, EquipmentSlot, Rarity } from '../../src/app/core/models/equipment';
import { GameState } from '../../src/app/core/models/game-state';
import { HeroClass } from '../../src/app/core/models/hero';
import { craft, dismantle, equip, slotOf, upgrade } from '../../src/app/core/rules/equipment';
import { completeFarmRun, ensureDaily } from '../../src/app/core/rules/rewards';

declare const process: { argv: string[] };
const minutesArg = process.argv.slice(2).find(a => a.startsWith('--minutes='))?.slice(10);

/** measured TACTICAL clear seconds (npm run balance -- 60 rec - --farm=hunt_1,…) + 20 s menus */
const RUN_SECONDS: Record<string, number> = { hunt_1: 84, hunt_2: 103, hunt_3: 113, hunt_4: 133, hunt_5: 153 };
const OVERHEAD = 20;
const GOALS: { id: GearProfileId; hunt: string }[] = [
  { id: 'BASIC', hunt: 'hunt_2' }, { id: 'MID', hunt: 'hunt_3' }, { id: 'GOOD', hunt: 'hunt_4' }, { id: 'VERY_GOOD', hunt: 'hunt_5' },
];
const rank = (r: Rarity) => RARITIES.indexOf(r);
const defFor = (cls: HeroClass, slot: EquipmentSlot) => (slot === 'WEAPON' ? WEAPON_DEF_OF[WEAPON_GROUP_OF[cls]] : slot === 'ARMOR' ? 'guard_armor' : 'trinket');

interface Result { reached: Partial<Record<GearProfileId, { h: number; day: number; runs: number; crafted: number; dropped: number }>>; runs: number; hours: number; goldShort: number }

function simulate(plan: number | 'bonus'): Result {
  let s: GameState = { ...newGameState(), cleared: 8, gold: 0 };
  const core = s.team.map(t => t.uid);
  const cls = (uid: number) => HERO_BY_ID[s.heroes.find(h => h.uid === uid)!.templateId].cls;
  let x = 0.4242;
  const rng = () => (x = (x * 16807 + 0.12345) % 1);
  const res: Result = { reached: {}, runs: 0, hours: 0, goldShort: 0 };
  let seconds = 0;
  let crafted = 0;
  let dropped = 0;
  const fits = (i: EquipmentInstance, c: HeroClass, slot: EquipmentSlot, g: GearProfileId) => {
    const want = GEAR_PROFILES[g].pieces[slot];
    // wanted affix: Elite / Epic always carry one; a Rare without the 35 % affix roll still counts (its affix is a bonus)
    return slotOf(i) === slot && i.definitionId === defFor(c, slot) && i.main.stat === CLASS_BUILDS[c][slot].main && rank(i.rarity) >= rank(want.rarity) && (!want.affix || !!i.affix || i.rarity === 'RARE');
  };
  const score = (i: EquipmentInstance) => rank(i.rarity) * 100 + i.upgradeLevel + (i.affix ? 1 : 0);
  /** equip the best fitting item per hero / slot from the bag, craft missing ones, upgrade, dismantle leftovers */
  const tidy = (g: GearProfileId) => {
    for (const uid of core) {
      const c = cls(uid);
      for (const slot of SLOTS) {
        const cur = s.heroes.find(h => h.uid === uid)!.gear?.[slot];
        const cand = s.equipment.filter(i => slotOf(i) === slot && i.definitionId === defFor(c, slot) && i.main.stat === CLASS_BUILDS[c][slot].main)
          .sort((a, b) => score(b) - score(a))[0];
        if (cand && (!cur || score(cand) > score(cur))) {
          const r = equip(s, uid, cand.instanceId);
          if (!('error' in r)) s = r.state;
        }
      }
    }
    // craft the missing pieces of the current goal (one recipe tier: the goal's rarity per slot)
    for (const uid of core) {
      const c = cls(uid);
      for (const slot of SLOTS) {
        const cur = s.heroes.find(h => h.uid === uid)!.gear?.[slot];
        if (cur && fits(cur, c, slot, g)) continue;
        // no Common recipe: the cheapest recipe at or above the wanted rarity
        const want = RARITIES.slice(rank(GEAR_PROFILES[g].pieces[slot].rarity)).find(r => CRAFT_RECIPES[r])!;
        const r = craft(s, want, defFor(c, slot), CLASS_BUILDS[c][slot].main, rng);
        if ('error' in r) {
          if (r.error === 'NEED_GOLD') res.goldShort++;
          continue;
        }
        s = r.state;
        crafted++;
        const e = equip(s, uid, r.item!.instanceId);
        if (!('error' in e)) s = e.state;
      }
    }
    // upgrade equipped pieces toward the profile level (cheapest first)
    for (let pass = 0; pass < 40; pass++) {
      let did = false;
      for (const uid of core) for (const slot of SLOTS) {
        const cur = s.heroes.find(h => h.uid === uid)!.gear?.[slot];
        if (!cur || cur.upgradeLevel >= GEAR_PROFILES[g].pieces[slot].level) continue;
        const r = upgrade(s, cur.instanceId);
        if (!('error' in r)) { s = r.state; did = true; }
      }
      if (!did) break;
    }
    // dismantle bag items nobody in the core team can use better (ore + fragments)
    for (const i of [...s.equipment]) {
      const useful = core.some(uid => {
        const c = cls(uid);
        const slot = slotOf(i);
        const cur = s.heroes.find(h => h.uid === uid)!.gear?.[slot];
        return i.definitionId === defFor(c, slot) && i.main.stat === CLASS_BUILDS[c][slot].main && (!cur || score(i) > score(cur));
      });
      if (!useful) {
        const r = dismantle(s, i.instanceId);
        if (!('error' in r)) s = r.state;
      }
    }
  };
  const done = (g: GearProfileId) => core.every(uid => SLOTS.every(slot => {
    const cur = s.heroes.find(h => h.uid === uid)!.gear?.[slot];
    return cur && fits(cur, cls(uid), slot, g) && cur.upgradeLevel >= Math.min(GEAR_PROFILES[g].pieces[slot].level, 10);
  }));
  /** the slot the team still misses most (Hunt target pool) */
  const target = (g: GearProfileId): EquipmentSlot => {
    const miss: Record<EquipmentSlot, number> = { WEAPON: 0, ARMOR: 0, ACCESSORY: 0 };
    for (const uid of core) for (const slot of SLOTS) {
      const cur = s.heroes.find(h => h.uid === uid)!.gear?.[slot];
      if (!cur || !fits(cur, cls(uid), slot, g)) miss[slot]++;
    }
    return (Object.entries(miss).sort((a, b) => b[1] - a[1])[0][0]) as EquipmentSlot;
  };
  let gi = 0;
  for (let day = 1; day <= 2000 && gi < GOALS.length; day++) {
    const now = new Date(2026, 9, day, 12);
    s = { ...s, daily: ensureDaily(s.daily, now) };
    let budget = plan === 'bonus' ? 0 : plan * 60;
    for (let n = 0; gi < GOALS.length; n++) {
      const goal = GOALS[gi];
      const def = FARM_BY_ID[goal.hunt];
      const cost = RUN_SECONDS[def.id] + OVERHEAD;
      if (n >= 3 && budget < cost) break;
      s = { ...s, huntTarget: target(goal.id) };
      const r = completeFarmRun(s, def, { win: true, deaths: 0, time: 60, participants: core }, rng, now);
      dropped += r.breakdown?.equipment?.length ?? 0;
      s = r.state;
      budget -= cost;
      seconds += cost;
      res.runs++;
      tidy(goal.id);
      if (process.argv.includes('--debug') && res.runs % 20 === 0) {
        const miss = core.flatMap(uid => SLOTS.filter(slot => { const cur = s.heroes.find(h => h.uid === uid)!.gear?.[slot]; return !(cur && fits(cur, cls(uid), slot, goal.id) && cur.upgradeLevel >= GEAR_PROFILES[goal.id].pieces[slot].level); }).map(slot => { const cur = s.heroes.find(h => h.uid === uid)!.gear?.[slot]; return `${cls(uid)}.${slot}=${cur ? cur.rarity + '+' + cur.upgradeLevel + ':' + cur.main.stat + (cur.affix ? '*' : '') : '-'}`; }));
        console.log(`run ${res.runs} ${goal.id} gold ${s.gold} ore ${s.inventory['enhancement_ore'] ?? 0} frags ${JSON.stringify(Object.fromEntries(Object.entries(s.inventory).filter(([k]) => k.startsWith('equip'))))} missing ${miss.join(' ')}`);
      }
      while (gi < GOALS.length && done(GOALS[gi].id)) {
        res.reached[GOALS[gi].id] = { h: seconds / 3600, day, runs: res.runs, crafted, dropped };
        gi++;
      }
    }
  }
  res.hours = seconds / 3600;
  return res;
}

const plans: (number | 'bonus')[] = minutesArg ? minutesArg.split(',').map(Number) : ['bonus', 30, 60, 120, 240];
for (const p of plans) {
  const r = simulate(p);
  console.log(`\n=== ${p === 'bonus' ? 'daily bonus only (3 Hunt runs / day)' : `${p} min/day of Hunt`} — ${r.runs} Hunt runs · ${r.hours.toFixed(1)} h · craft attempts blocked by gold ${r.goldShort} ===`);
  let prev = { h: 0, runs: 0 };
  for (const g of GOALS) {
    const x = r.reached[g.id];
    if (!x) { console.log(`  ${g.id.padEnd(9)} not reached`); continue; }
    console.log(`  ${g.id.padEnd(9)} day ${String(x.day).padStart(4)} · ${x.h.toFixed(1).padStart(5)} h total (+${(x.h - prev.h).toFixed(1)} h) · ${String(x.runs).padStart(4)} runs (+${x.runs - prev.runs} on ${g.hunt}) · crafted ${x.crafted} · drops so far ${x.dropped}`);
    prev = x;
  }
}
