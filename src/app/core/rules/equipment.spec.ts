import { ENEMIES } from '../data/enemies';
import { FARM_BY_ID, FARM_DUNGEONS, DAILY_BONUS } from '../data/economy';
import {
  AFFIXES, CRAFT_RECIPES, EQUIPMENT_DEFS, GEAR_PROFILES, RARITIES, RARITY_RULES, STAT_CAPS, UPGRADE_COST_CURVE, UPGRADE_ORE_BASE,
} from '../data/equipment';
import { HERO_BY_ID } from '../data/heroes';
import { kitOf } from '../data/hero-skills';
import { newGameState } from '../data/starter';
import { EquipmentInstance, EquipStat, Rarity } from '../models/equipment';
import { GameState } from '../models/game-state';
import { OwnedHero } from '../models/hero';
import { StageDef } from '../models/stage';
import { UnitSpec } from '../models/unit';
import { migrate } from '../services/save.service';
import { BattleEngine } from '../../battle/engine/battle-engine';
import {
  canEquip, compareGear, craft, dismantle, effectivePower, equip, gearTotals, heroGearTotals, itemLines, mainValue, profileGear,
  releaseHeroGear, rollItem, sell, setLocked, totalUpgradeOre, unequipSlot, upgrade, upgradeCost,
} from './equipment';
import { combatModifiers } from './progression';
import { completeFarmRun } from './rewards';
import { heroStats } from './stats';

const DAY = new Date(2026, 8, 26, 12);
let seq = 1;
const item = (defId: string, rarity: Rarity, main: EquipStat, o: { sec?: EquipStat[]; affix?: string | null; level?: number } = {}): EquipmentInstance =>
  ({ ...rollItem(defId, rarity, () => 0, seq++, { main, secondaries: o.sec ?? [], affix: o.affix ?? null }), upgradeLevel: o.level ?? 0 });
const withBag = (items: EquipmentInstance[], o: Partial<GameState> = {}): GameState => ({ ...newGameState(), equipment: items, gold: 100000, ...o });
const uidOf = (s: GameState, templateId: string) => s.heroes.find(h => h.templateId === templateId)!.uid;
const heroOf = (s: GameState, uid: number) => s.heroes.find(h => h.uid === uid)!;
const ok = (r: { state: GameState } | { error: string }) => {
  if ('error' in r) throw new Error(r.error);
  return r.state;
};

describe('Equipment — items, stats, caps', () => {
  it('rarity rules: secondaries 0 / 1 / 1 / 1–2 / 2, affix from Rare, upgrade cap 6 / 8 / 10 / 10 / 10', () => {
    expect(RARITIES.map(r => RARITY_RULES[r].secondaries)).toEqual([[0, 0], [1, 1], [1, 1], [1, 2], [2, 2]]);
    expect(RARITIES.map(r => RARITY_RULES[r].affixChance > 0)).toEqual([false, false, true, true, true]);
    expect(RARITIES.map(r => RARITY_RULES[r].upgradeCap)).toEqual([6, 8, 10, 10, 10]);
    for (let seed = 0; seed < 30; seed++) {
      let x = seed / 30;
      const rng = () => (x = (x * 9301 + 0.49297) % 1);
      for (const r of RARITIES) {
        const i = rollItem('guard_armor', r, rng, 1);
        const [lo, hi] = RARITY_RULES[r].secondaries;
        expect(i.secondaries.length).toBeGreaterThanOrEqual(lo);
        expect(i.secondaries.length).toBeLessThanOrEqual(hi);
        expect(new Set(i.secondaries.map(s => s.stat)).size).toBe(i.secondaries.length);
        if (r === 'ELITE' || r === 'EPIC') expect(i.affix).toBeDefined();
        if (r === 'COMMON' || r === 'UNCOMMON') expect(i.affix).toBeUndefined();
      }
    }
  });

  it('weapon ATK at +10 per rarity stays in the spec bands (4–6 / 6–8 / 8–11 / 11–14 / 14–17 %) — rarity is not ×3', () => {
    const at10 = RARITIES.map(r => mainValue(item('heavy_blade', r, 'atkPct', { level: 10 })));
    expect(at10.map(v => Math.round(v * 1000) / 10)).toEqual([4.9, 7, 9.1, 11.2, 14]);
    expect(at10[4] / at10[2]).toBeLessThan(1.6);
  });

  it('upgrades: +10 = main stat ×1.40, secondaries fixed; costs follow the curve; every upgrade succeeds; caps per rarity', () => {
    const it0 = item('guard_armor', 'EPIC', 'hpPct', { sec: ['defPct', 'healingReceived'] });
    let s = withBag([it0], { inventory: { enhancement_ore: 10000 } });
    for (let l = 0; l < 10; l++) {
      const cost = upgradeCost(s.equipment[0])!;
      expect(cost.ore).toBe(Math.round(UPGRADE_ORE_BASE.EPIC * UPGRADE_COST_CURVE[l]));
      s = ok(upgrade(s, it0.instanceId));
      expect(s.equipment[0].upgradeLevel).toBe(l + 1);
    }
    const up = s.equipment[0];
    expect(mainValue(up)).toBeCloseTo(0.105 * 1.4, 5);
    expect(up.secondaries).toEqual(it0.secondaries);
    expect(upgradeCost(up)).toBeNull();
    expect(upgrade(s, it0.instanceId)).toEqual({ error: 'MAX_LEVEL' });
    expect(up.oreInvested).toBe(totalUpgradeOre('EPIC', 10));
    expect(s.inventory['enhancement_ore']).toBe(10000 - totalUpgradeOre('EPIC', 10));
    // a Common tops out at +6 (upgrading Common to +10 is never available)
    const c = withBag([item('guard_armor', 'COMMON', 'hpPct', { level: 6 })], { inventory: { enhancement_ore: 999 } });
    expect(upgrade(c, c.equipment[0].instanceId)).toEqual({ error: 'MAX_LEVEL' });
    expect(upgrade(withBag([item('guard_armor', 'RARE', 'hpPct')]), seq - 1)).toEqual({ error: 'NEED_ORE' });
    expect(UPGRADE_COST_CURVE).toEqual([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6.5, 8]);
  });

  it('stat aggregation: % stats add across items, apply once after level growth; flat Break rounds', () => {
    const w = item('heavy_blade', 'RARE', 'atkPct', { sec: ['atkPct'] });
    const a = item('guard_armor', 'RARE', 'hpPct', { sec: ['atkPct'] });
    const t = gearTotals([w, a]);
    expect(t.atkPct).toBeCloseTo(0.065 + 0.02 + 0.02, 5);
    const h: OwnedHero = { uid: 1, templateId: 'jin', level: 10, potential: 'B', injury: 0, gear: { WEAPON: w, ARMOR: a } };
    const s = heroStats(HERO_BY_ID['jin'], h);
    expect(s.atk).toBe(Math.round(47 * 1.225 * (1 + t.atkPct)));
    expect(itemLines(item('trinket', 'EPIC', 'breakPower', { level: 10, affix: 'breaker' })).map(l => l.value)).toEqual([8, 13]);
  });

  it('caps: CDR 15 %, crit +20 %, attack speed +10 %, bleed / poison / root 40 %, healing received 25 %, Break +20', () => {
    expect(STAT_CAPS).toEqual(jasmine.objectContaining({
      cooldownReduction: 0.15, critChance: 0.2, attackSpeed: 0.1, bleedReduction: 0.4, poisonReduction: 0.4, rootReduction: 0.4,
      healingReceived: 0.25, breakPower: 20,
    }));
    const crit = [item('twin_daggers', 'EPIC', 'atkPct', { affix: 'keen_eye', sec: ['critChance'] }), item('trinket', 'EPIC', 'critChance', { level: 10, affix: 'keen_eye', sec: ['critChance'] })];
    expect(gearTotals(crit).critChance).toBe(0.2);
    const heal = [item('guard_armor', 'EPIC', 'hpPct', { affix: 'medic', sec: ['healingReceived'] }), item('trinket', 'EPIC', 'healingReceived', { level: 10, affix: 'medic' })];
    expect(gearTotals(heal).healingReceived).toBe(0.25);
  });

  it('tactical affixes help without disabling: max single affix ≤ 25 % (Epic ×1.25), every reduction capped below immunity', () => {
    for (const a of Object.values(AFFIXES)) {
      if (a.effect.stat === 'breakPower') continue;
      expect(a.effect.value * RARITY_RULES.EPIC.affixScale).withContext(a.id).toBeLessThanOrEqual(0.25);
    }
    for (const s of ['bleedReduction', 'poisonReduction', 'rootReduction', 'diveReduction', 'damageReduction'] as EquipStat[]) {
      expect(STAT_CAPS[s]!).withContext(s).toBeLessThan(0.5);
    }
  });
});

describe('Equipment — bag actions', () => {
  it('equip / unequip: slot follows the item, replaced item returns to the bag, weapon groups enforced', () => {
    const blade = item('heavy_blade', 'RARE', 'atkPct');
    const blade2 = item('heavy_blade', 'ELITE', 'atkPct');
    const bow = item('longbow', 'RARE', 'atkPct');
    let s = withBag([blade, blade2, bow]);
    const tank = uidOf(s, 'aurel');
    const archer = uidOf(s, 'sylvie');
    s = ok(equip(s, tank, blade.instanceId));
    expect(heroOf(s, tank).gear?.WEAPON?.instanceId).toBe(blade.instanceId);
    expect(heroOf(s, tank).gear?.WEAPON?.equippedHeroId).toBe(tank);
    expect(s.equipment.map(i => i.instanceId)).toEqual([blade2.instanceId, bow.instanceId]);
    s = ok(equip(s, tank, blade2.instanceId));
    expect(heroOf(s, tank).gear?.WEAPON?.instanceId).toBe(blade2.instanceId);
    expect(s.equipment.find(i => i.instanceId === blade.instanceId)?.equippedHeroId).toBeNull();
    expect(equip(s, archer, blade.instanceId)).toEqual({ error: 'WRONG_CLASS' });
    expect(canEquip('archer', bow)).toBeTrue();
    expect(canEquip('archer', item('guard_armor', 'RARE', 'hpPct'))).toBeTrue();
    // moving an equipped item to another hero takes it off the first one
    const armor = item('guard_armor', 'RARE', 'hpPct');
    s = ok(equip({ ...s, equipment: [...s.equipment, armor] }, tank, armor.instanceId));
    s = ok(equip(s, archer, armor.instanceId));
    expect(heroOf(s, tank).gear?.ARMOR).toBeUndefined();
    expect(heroOf(s, archer).gear?.ARMOR?.instanceId).toBe(armor.instanceId);
    s = unequipSlot(s, archer, 'ARMOR');
    expect(heroOf(s, archer).gear?.ARMOR).toBeUndefined();
    expect(s.equipment.some(i => i.instanceId === armor.instanceId)).toBeTrue();
  });

  it('runtime stats follow equipment changes at once (no cached stats)', () => {
    let s = withBag([item('guard_armor', 'EPIC', 'hpPct', { level: 10 })]);
    const tank = uidOf(s, 'aurel');
    const before = heroStats(HERO_BY_ID['aurel'], heroOf(s, tank)).hp;
    s = ok(equip(s, tank, s.equipment[0].instanceId));
    const after = heroStats(HERO_BY_ID['aurel'], heroOf(s, tank)).hp;
    expect(after).toBe(Math.round(before * (1 + 0.105 * 1.4)));
    expect(compareGear(heroOf(withBag([]), tank), heroOf(s, tank).gear!.ARMOR!).find(d => d.stat === 'hpPct')!.delta).toBeCloseTo(0.147, 5);
  });

  it('lock: locked items cannot be dismantled or sold; dismantle refunds 75 % of the invested ore + fragments', () => {
    const it = { ...item('guard_armor', 'ELITE', 'hpPct', { level: 4 }), oreInvested: totalUpgradeOre('ELITE', 4) };
    let s = withBag([it]);
    s = ok(setLocked(s, it.instanceId, true));
    expect(dismantle(s, it.instanceId)).toEqual({ error: 'LOCKED' });
    expect(sell(s, it.instanceId)).toEqual({ error: 'LOCKED' });
    s = ok(setLocked(s, it.instanceId, false));
    const d = ok(dismantle(s, it.instanceId));
    expect(d.equipment.length).toBe(0);
    expect(d.inventory['enhancement_ore']).toBe(12 + Math.floor(totalUpgradeOre('ELITE', 4) * 0.75));
    expect(d.inventory['equip_frag_elite']).toBe(3);
    const sold = ok(sell(s, it.instanceId));
    expect(sold.gold).toBe(s.gold + 150);
    // equipped items must come off first
    const tank = uidOf(s, 'aurel');
    const worn = ok(equip(s, tank, it.instanceId));
    expect(dismantle(worn, it.instanceId)).toEqual({ error: 'EQUIPPED' });
  });

  it('deterministic crafting: fragments + gold → chosen base + chosen main stat (secondaries / affix still roll)', () => {
    const r = CRAFT_RECIPES.RARE!;
    let s = withBag([], { inventory: { equip_frag_rare: r.fragments + 5 } });
    const out = craft(s, 'RARE', 'longbow', 'breakPower', () => 0.5);
    s = ok(out);
    expect(out.item?.definitionId).toBe('longbow');
    expect(out.item?.main.stat).toBe('breakPower');
    expect(out.item?.rarity).toBe('RARE');
    expect(s.inventory['equip_frag_rare']).toBe(5);
    expect(s.gold).toBe(100000 - r.gold);
    expect(s.equipment.length).toBe(1);
    expect(craft(s, 'RARE', 'longbow', 'atkPct', () => 0.5)).toEqual({ error: 'NEED_FRAGMENTS' });
    expect(craft(withBag([], { inventory: { equip_frag_rare: 99 } }), 'RARE', 'longbow', 'hpPct', () => 0.5)).toEqual({ error: 'BAD_MAIN' });
    expect(Object.keys(CRAFT_RECIPES)).toEqual(['UNCOMMON', 'RARE', 'ELITE', 'EPIC']);
  });

  it('a hero leaving the roster never destroys gear — it returns to the bag', () => {
    let s = withBag([item('guard_armor', 'EPIC', 'hpPct'), item('heavy_blade', 'EPIC', 'atkPct')]);
    const tank = uidOf(s, 'aurel');
    s = ok(equip(s, tank, s.equipment[0].instanceId));
    s = ok(equip(s, tank, s.equipment[0].instanceId));
    expect(s.equipment.length).toBe(0);
    const released = releaseHeroGear(s, tank);
    expect(released.equipment.length).toBe(2);
    expect(released.equipment.every(i => i.equippedHeroId === null)).toBeTrue();
  });

  it('save / load v6 keeps bag, equipped gear (upgrades, rolls, affix, lock), materials, Hunt target; v5 saves migrate', () => {
    let s = withBag([item('guard_armor', 'ELITE', 'hpPct', { level: 7, affix: 'bleed_guard', sec: ['defPct'] }), item('trinket', 'RARE', 'critChance')],
      { inventory: { enhancement_ore: 33, equip_frag_rare: 12 }, huntTarget: 'ARMOR', nextItemId: 77 });
    s = ok(setLocked(s, s.equipment[1].instanceId, true));
    s = ok(equip(s, uidOf(s, 'aurel'), s.equipment[0].instanceId));
    const back = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(back.equipment).toEqual(s.equipment);
    expect(heroOf(back, uidOf(s, 'aurel')).gear).toEqual(heroOf(s, uidOf(s, 'aurel')).gear);
    expect(back.inventory).toEqual(s.inventory);
    expect([back.huntTarget, back.nextItemId, back.version]).toEqual(['ARMOR', 77, 6]);
    const v5: any = JSON.parse(JSON.stringify({ ...newGameState(), version: 5 }));
    delete v5.equipment;
    delete v5.nextItemId;
    delete v5.huntTarget;
    v5.heroes[0].equipment = { WEAPON: 'weapon_good' };
    const m = migrate(v5)!;
    expect([m.version, m.equipment, m.nextItemId, m.huntTarget]).toEqual([6, [], 1, 'ANY']);
    expect(m.heroes[0]).not.toEqual(jasmine.objectContaining({ equipment: jasmine.anything() }));
  });
});

describe('Equipment Hunt', () => {
  const hunts = FARM_DUNGEONS.filter(d => d.type === 'EQUIPMENT');
  const run = (s: GameState) => ({ win: true, deaths: 2, time: 100, participants: s.team.map(t => t.uid) });

  it('five tiers, unlock F3 / F4 / F5 / F7 / F8 (Hunt III before the F7 wall — no deadlock), safe farming deaths', () => {
    expect(hunts.map(h => [h.id, h.unlockFloor])).toEqual([['hunt_1', 3], ['hunt_2', 4], ['hunt_3', 5], ['hunt_4', 7], ['hunt_5', 8]]);
    expect(hunts.every(h => h.deathRule === 'EVENT_KO')).toBeTrue();
    // Hunt III (unlocks before F7) must drop / craft Mid (Rare) gear; Hunt IV (before F8) Elite; Hunt V (before F9) Epic
    expect(FARM_BY_ID['hunt_3'].equipmentDrops!.rarityWeights.RARE).toBeGreaterThan(50);
    expect(FARM_BY_ID['hunt_3'].baseRewards.items!.some(i => i.itemId === 'equip_frag_rare')).toBeTrue();
    expect(FARM_BY_ID['hunt_4'].baseRewards.items!.some(i => i.itemId === 'equip_frag_elite')).toBeTrue();
    expect(FARM_BY_ID['hunt_5'].baseRewards.items!.some(i => i.itemId === 'equip_frag_epic')).toBeTrue();
  });

  it('drop tables are valid (positive weights, known rarities, sensible chance) and climb with the tier', () => {
    const best: number[] = [];
    for (const h of hunts) {
      const t = h.equipmentDrops!;
      expect(t.itemChance).toBeGreaterThan(0);
      expect(t.itemChance).toBeLessThanOrEqual(1);
      const entries = Object.entries(t.rarityWeights);
      expect(entries.length).toBeGreaterThan(0);
      for (const [r, w] of entries) {
        expect(RARITIES).toContain(r as Rarity);
        expect(w).toBeGreaterThan(0);
      }
      best.push(Math.max(...entries.map(([r]) => RARITIES.indexOf(r as Rarity))));
    }
    expect([...best].sort()).toEqual(best);
  });

  it('daily Hunt bonus 3 runs ×1.5, repeat ×0.6 of BASE fragments / ore / gold, first clear gives a guaranteed item', () => {
    expect(DAILY_BONUS['HUNT']).toBe(3);
    const def = FARM_BY_ID['hunt_3'];
    let s: GameState = { ...newGameState(), cleared: 5 };
    const frags: number[] = [];
    const items: number[] = [];
    for (let i = 0; i < 5; i++) {
      const before = s.inventory['equip_frag_rare'] ?? 0;
      const r = completeFarmRun(s, def, run(s), () => 0.99, DAY);
      frags.push((r.state.inventory['equip_frag_rare'] ?? 0) + (r.state.rewardCarry['equip_frag_rare'] ?? 0) - before - (s.rewardCarry['equip_frag_rare'] ?? 0));
      items.push(r.breakdown!.equipment!.length);
      s = r.state;
    }
    expect(frags.map(f => Math.round(f * 10) / 10)).toEqual([7.5, 7.5, 7.5, 3, 3]);
    // rng 0.99 = never a random drop: only the first clear's guaranteed Rare
    expect(items).toEqual([1, 0, 0, 0, 0]);
    expect(s.equipment[0].rarity).toBe('RARE');
    // no injuries from farming (EVENT_KO)
    expect(s.heroes.every(h => h.injury === 0)).toBeTrue();
  });

  it('bad RNG still progresses: every clear gives ore + fragments; the Hunt target slot is favoured', () => {
    const def = FARM_BY_ID['hunt_4'];
    let s: GameState = { ...newGameState(), cleared: 8, huntTarget: 'ARMOR', farm: { hunt_4: { clears: 1, firstClearDone: true, bestRating: 3 } } };
    let x = 0.123;
    const rng = () => (x = (x * 9301 + 0.49297) % 1);
    for (let i = 0; i < 60; i++) s = completeFarmRun(s, def, run(s), rng, DAY).state;
    expect(s.inventory['enhancement_ore']).toBeGreaterThan(60 * 22 * 0.6 - 1);
    expect(s.inventory['equip_frag_elite']).toBeGreaterThan(60 * 5 * 0.6 - 1);
    const armor = s.equipment.filter(i => EQUIPMENT_DEFS[i.definitionId].slot === 'ARMOR').length;
    expect(armor / s.equipment.length).toBeGreaterThan(0.5);
    // weapons that drop fit the deployed team's weapon groups
    const groups = new Set(s.team.map(t => s.heroes.find(h => h.uid === t.uid)!.templateId).map(id => HERO_BY_ID[id].cls));
    for (const i of s.equipment.filter(e => EQUIPMENT_DEFS[e.definitionId].slot === 'WEAPON')) {
      expect([...groups].some(c => canEquip(c, i))).toBeTrue();
    }
  });
});

describe('Equipment in combat', () => {
  const spec = (id: string, h: OwnedHero, depth: number, lane: number): UnitSpec => {
    const t = HERO_BY_ID[id];
    return { name: t.name, cls: t.cls, heroId: id, heroUid: 100 + depth * 10 + lane, stats: heroStats(t, h), mods: combatModifiers(h), pos: { r: depth, c: lane } };
  };
  const engine = (allies: UnitSpec[]) => {
    const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'forest_slime', r: 5, c: 1 }] };
    const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: 3 });
    e.step(0.05);
    return e;
  };
  const hero = (templateId: string, gear: OwnedHero['gear'] = {}): OwnedHero => ({ uid: 1, templateId, level: 10, potential: 'B', injury: 0, gear });

  it('Healing Power raises heals, Healing Received raises heals taken, Shield Power raises shields', () => {
    const healAmount = (healer: OwnedHero, target: OwnedHero) => {
      const e = engine([spec('lumina', healer, 4, 1), spec('aurel', target, 0, 1)]);
      const [l, a] = [e.units.find(u => u.heroId === 'lumina')!, e.units.find(u => u.heroId === 'aurel')!];
      a.hp = 1;
      e.skills.use(l, 'skill2', kitOf('lumina', 'healer').skill2, a);
      for (let i = 0; i < 40; i++) e.step(0.05);
      return a.hp - 1;
    };
    const base = healAmount(hero('lumina'), hero('aurel'));
    const power = healAmount(hero('lumina', { WEAPON: item('focus_staff', 'EPIC', 'healingPower', { level: 10 }) }), hero('aurel'));
    const received = healAmount(hero('lumina'), hero('aurel', { ARMOR: item('guard_armor', 'EPIC', 'hpPct', { affix: 'medic' }) }));
    expect(power / base).toBeCloseTo(1 + 0.13 * 1.4, 1);
    expect(received / base).toBeGreaterThan(1.1);
    const shield = (tank: OwnedHero) => {
      const e = engine([spec('aurel', tank, 0, 1)]);
      const a = e.units.find(u => u.heroId === 'aurel')!;
      e.skills.use(a, 'ult', kitOf('aurel', 'tank').ult, a);
      for (let i = 0; i < 30; i++) e.step(0.05);
      return a.shield / a.maxHp;
    };
    expect(shield(hero('aurel', { ACCESSORY: item('trinket', 'EPIC', 'hpPct', { affix: 'guardian' }) })) / shield(hero('aurel'))).toBeCloseTo(1.125, 2);
  });

  it('crit chance from gear shows in the damage stream; Damage Reduction lowers every hit taken', () => {
    const m = combatModifiers(hero('nox', { WEAPON: item('twin_daggers', 'EPIC', 'atkPct', { affix: 'keen_eye', sec: ['critChance', 'critDamage'] }) }));
    expect(m.critChance).toBeCloseTo(0.1 + 0.05 + 0.03, 5);
    expect(m.critMultiplier).toBeCloseTo(1.6, 5);
    const dr = combatModifiers(hero('aurel', { ARMOR: item('guard_armor', 'EPIC', 'damageReduction', { level: 10, affix: 'bulwark' }) })).damageReduction;
    expect(dr).toBeCloseTo(Math.min(0.12, 0.035 * 1.4 + 0.05), 5);
  });
});

describe('Equipment profiles (simulation)', () => {
  it('effective power climbs Basic < Mid < Good < Very Good < Near max and lands in the spec bands', () => {
    const classes = ['tank', 'fighter', 'assassin', 'archer', 'mage', 'healer'] as const;
    const avg = (p: keyof typeof GEAR_PROFILES) => classes.reduce((a, c) => a + effectivePower(gearTotals(Object.values(profileGear(c, p)))), 0) / classes.length;
    const v = (['BASIC', 'MID', 'GOOD', 'VERY_GOOD', 'NEAR_MAX'] as const).map(avg);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
    expect(v[0]).toBeGreaterThan(0.07);
    expect(v[0]).toBeLessThan(0.13);
    expect(v[1]).toBeGreaterThan(0.17);
    expect(v[1]).toBeLessThan(0.26);
    expect(v[2]).toBeGreaterThan(0.27);
    expect(v[2]).toBeLessThan(0.37);
    expect(v[3]).toBeGreaterThan(0.34);
    expect(v[3]).toBeLessThan(0.46);
  });

  it('profiles only use valid combinations (weapon group, pools, affix slots)', () => {
    for (const c of ['tank', 'fighter', 'assassin', 'archer', 'mage', 'healer'] as const) {
      for (const p of Object.keys(GEAR_PROFILES) as (keyof typeof GEAR_PROFILES)[]) {
        const g = profileGear(c, p);
        for (const i of Object.values(g)) {
          expect(canEquip(c, i!)).toBeTrue();
          const d = EQUIPMENT_DEFS[i!.definitionId];
          expect(d.mainStats).toContain(i!.main.stat);
          if (i!.affix) expect(AFFIXES[i!.affix].validSlots).toContain(d.slot);
        }
        expect(heroGearTotals({ uid: 1, templateId: 'aurel', level: 1, potential: 'B', injury: 0, gear: g }).cooldownReduction).toBeLessThanOrEqual(0.15);
      }
    }
  });
});
