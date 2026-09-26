import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { kitOf } from '../../core/data/hero-skills';
import { HERO_5STAR_LV1 } from '../../core/data/classes';
import { MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import {
  BREAKTHROUGH_GATES, EQUIPMENT, FLOOR_BANDS, PATCH_1, POWER_PROFILES, SKILL_RANK_EFFECTS,
} from '../../core/data/progression';
import { STAGES } from '../../core/data/stages';
import { newGameState } from '../../core/data/starter';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { OwnedHero } from '../../core/models/hero';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import {
  applyProfile, canLevelUp, combatModifiers, gearStatBonus, levelCap, needsBreakthrough,
} from '../../core/rules/progression';
import { heroStats, maxLevel } from '../../core/rules/stats';
import { teamToUnits } from '../../core/rules/team';
import { BattleEngine, BattleEvent, BattleUnit, monsterTuningReview } from './battle-engine';
import { applyBuff } from './buffs';

const hero = (templateId: string, o: Partial<OwnedHero> = {}): OwnedHero => ({ uid: 1, templateId, level: 1, potential: 'B', injury: 0, ...o });

const spec = (id: string, h: OwnedHero, depth: number, lane: number): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + depth * 10 + lane, sprite: t.sprite,
    stats: { ...heroStats(t, h), hp: 99999 }, mods: combatModifiers(h), pos: { r: depth, c: lane },
  };
};

function battle(allies: UnitSpec[], enemies: EnemyPlacement[]) {
  const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies };
  const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: 7 });
  const log: BattleEvent[] = [];
  const run = (sec: number) => {
    for (let i = 0; i < Math.round(sec / 0.05) && !e.result; i++) {
      e.step(0.05);
      log.push(...e.drainEvents());
    }
  };
  run(0.05);
  const heroU = (id: string) => e.units.find(u => u.heroId === id)!;
  const monsters = (id: string) => e.units.filter(u => u.monster?.definitionId === id);
  const statue = (u: BattleUnit) => applyBuff(u, STATUS_EFFECTS['root'], 0, { duration: 999 });
  return { e, log, run, heroU, monsters, statue };
}

describe('Patch 1 progression — structure', () => {
  it('level cap 10; breakthrough gates at 5 → 6, 8 → 9 and the major 9 → 10', () => {
    expect(PATCH_1.levelCap).toBe(10);
    expect(levelCap()).toBe(10);
    expect(maxLevel()).toBe(10);
    expect(BREAKTHROUGH_GATES.map(g => [g.from, g.kind])).toEqual([[5, 'MILESTONE'], [8, 'MILESTONE'], [9, 'MAJOR']]);
    expect(canLevelUp(hero('jin', { level: 4 }))).toBeTrue();
    expect(needsBreakthrough(hero('jin', { level: 5 }))).toBeTrue();
    expect(canLevelUp(hero('jin', { level: 5 }))).toBeFalse();
    expect(canLevelUp(hero('jin', { level: 5, breakthroughTier: 1 }))).toBeTrue();
    expect(canLevelUp(hero('jin', { level: 8, breakthroughTier: 1 }))).toBeFalse();
    expect(canLevelUp(hero('jin', { level: 9, breakthroughTier: 3 }))).toBeTrue();
    expect(canLevelUp(hero('jin', { level: 10, breakthroughTier: 3 }))).toBeFalse();
  });

  it('floor bands follow the Patch 1 journey (onboarding → wall → endgame)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(f => FLOOR_BANDS[f].levels)).toEqual([
      [1, 1], [1, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 8], [7, 8], [8, 10], [9, 10],
    ]);
    expect([1, 2, 3].every(f => FLOOR_BANDS[f].role === 'ONBOARDING')).toBeTrue();
    expect(FLOOR_BANDS[6].role).toBe('TRANSITION');
    expect([7, 8, 9].every(f => FLOOR_BANDS[f].role === 'WALL')).toBeTrue();
    expect(FLOOR_BANDS[10].role).toBe('ENDGAME');
    for (const f of [7, 8, 9, 10]) expect(FLOOR_BANDS[f].failureHints?.length).withContext(`F${f}`).toBeGreaterThan(0);
  });

  it('no stage asks for tuning beyond the ceilings; no global floor multiplier', () => {
    for (const st of STAGES) {
      expect(monsterTuningReview(st)).withContext(`F${st.floor}`).toEqual([]);
      expect((st as any).monsterScale).toBeUndefined();
    }
  });

  it('equipment catalog: 4 tiers × weapon / armor / 5 accessory families, stats grow with the tier, accessories carry utility', () => {
    const tiers = ['EARLY', 'MID', 'GOOD', 'VERY_GOOD'];
    expect(Object.keys(EQUIPMENT).length).toBe(4 * 7);
    const atk = tiers.map(t => EQUIPMENT[`weapon_${t.toLowerCase()}`].stats.atk!);
    expect([...atk].sort((a, b) => a - b)).toEqual(atk);
    for (const e of Object.values(EQUIPMENT).filter(x => x.slot === 'ACCESSORY')) expect(e.utility).withContext(e.id).toBeDefined();
  });

  it('skill ranks 1–5 raise power, lower cooldowns and add Break power', () => {
    const r = [1, 2, 3, 4, 5].map(n => SKILL_RANK_EFFECTS[n]);
    for (let i = 1; i < 5; i++) {
      expect(r[i].power).toBeGreaterThan(r[i - 1].power);
      expect(r[i].cooldown).toBeLessThanOrEqual(r[i - 1].cooldown);
      expect(r[i].breakBonus).toBeGreaterThanOrEqual(r[i - 1].breakBonus);
    }
  });
});

describe('Patch 1 progression — stats and combat modifiers', () => {
  it('base 5★ Lv1 table unchanged; gear adds its stat fractions on top of level growth', () => {
    const fresh = heroStats(HERO_BY_ID['aurel'], hero('aurel'));
    expect([fresh.hp, fresh.atk, fresh.def]).toEqual([HERO_5STAR_LV1.tank.hp, HERO_5STAR_LV1.tank.atk, HERO_5STAR_LV1.tank.def]);
    const geared = hero('aurel', { equipment: { WEAPON: 'weapon_good', ARMOR: 'armor_good' } });
    const b = gearStatBonus(geared);
    const s = heroStats(HERO_BY_ID['aurel'], geared);
    expect(s.hp).toBe(Math.round(393 * (1 + b.hp)));
    expect(s.atk).toBe(Math.round(27 * (1 + b.atk)));
    expect(s.def).toBe(Math.round(49 * (1 + b.def)));
  });

  it('combatModifiers: ranks → skill power / cooldown / Break, gear → Break, cooldown, healing, resistances', () => {
    const h = hero('sylvie', {
      skillRanks: { skill: 1, skill2: 4, ult: 5 },
      equipment: { ACCESSORY: 'breaker_good' },
    });
    const m = combatModifiers(h);
    expect(m.skillPower.skill).toBe(1);
    expect(m.skillPower.skill2).toBe(SKILL_RANK_EFFECTS[4].power);
    expect(m.breakBonus.skill2).toBe(SKILL_RANK_EFFECTS[4].breakBonus + EQUIPMENT['breaker_good'].utility!.breakBonus!);
    expect(combatModifiers(hero('jin', { equipment: { ACCESSORY: 'ward_very_good' } })).statusResist.bleed).toBe(0.45);
    expect(combatModifiers(hero('jin', { equipment: { ACCESSORY: 'focus_mid' } })).cooldown.skill).toBeCloseTo(0.95, 5);
  });

  it('the team builder hands progression to the engine (UnitSpec.mods)', () => {
    const st = newGameState();
    const heroes = st.heroes.map(h => applyProfile(h, POWER_PROFILES['E']));
    for (const u of teamToUnits(st.team, heroes)) {
      expect(u.mods).withContext(u.name).toBeDefined();
      expect(u.mods!.skillPower.skill2).toBe(SKILL_RANK_EFFECTS[4].power);
      expect(u.level).toBe(9);
    }
  });

  it('skill rank power multiplies skill damage (not basic attacks)', () => {
    const slime = (rank: number) => {
      const h = hero('jin', { skillRanks: { skill: 1, skill2: rank, ult: 1 } });
      const b = battle([spec('jin', h, 0, 1)], [{ enemy: 'forest_slime', r: 0, c: 1 }]);
      const m = b.monsters('forest_slime')[0];
      m.hp = m.maxHp = 99999;
      b.statue(m);
      const jin = b.heroU('jin');
      (b.e as any).relocate(jin, { r: m.pos.r, c: m.pos.c - 1 }, 'blink');
      b.e.skills.use(jin, 'skill2', kitOf('jin', 'fighter').skill2, m);
      b.run(1.5);
      return b.log.filter(ev => ev.type === 'damage' && ev.dst === m.id).map(ev => (ev as any).amount / ((ev as any).crit ? 1.5 : 1))[0];
    };
    const r1 = slime(1), r5 = slime(5);
    expect(r5 / r1).toBeGreaterThan(1.35 * 0.8);
    expect(r5 / r1).toBeLessThan(1.35 * 1.25);
  });

  it('skill cooldowns shrink with rank / gear', () => {
    const h = hero('jin', { skillRanks: { skill: 5, skill2: 1, ult: 1 }, equipment: { ACCESSORY: 'focus_very_good' } });
    const b = battle([spec('jin', h, 0, 1)], [{ enemy: 'forest_slime', r: 0, c: 1 }]);
    const jin = b.heroU('jin');
    const m = b.monsters('forest_slime')[0];
    b.e.skills.use(jin, 'skill', kitOf('jin', 'fighter').skill, m);
    expect(jin.cd1).toBeCloseTo(kitOf('jin', 'fighter').skill.cooldown! * 0.9 * 0.9, 5);
  });

  it('Break bonus from rank + gear reaches the Break Gauge', () => {
    const h = hero('aurel', { skillRanks: { skill: 1, skill2: 5, ult: 1 }, equipment: { ACCESSORY: 'breaker_very_good' } });
    const b = battle([spec('aurel', h, 0, 1)], [{ enemy: 'fallen_forest_guardian', r: 1, c: 1 }]);
    const g = b.monsters('fallen_forest_guardian')[0];
    b.statue(g);
    const tank = b.heroU('aurel');
    (b.e as any).relocate(tank, { r: g.pos.r, c: g.pos.c - 1 }, 'blink');
    g.monster!.state = 'CASTING';
    g.monster!.currentSkillId = 'forest_oblivion';
    (b.e as any).beginCast(g, MONSTER_SKILLS['forest_oblivion'], null);
    b.e.skills.use(tank, 'skill2', kitOf('aurel', 'tank').skill2, g);
    b.run(1);
    // 60 (Shield Charge) + 15 (rank 5) + 20 (Very Good Breaker Sigil) = 95
    expect(g.casting?.breakDamage).toBe(95);
  });

  it('equipment resistance shortens bleed on the hero', () => {
    const plain = battle([spec('jin', hero('jin'), 0, 1)], [{ enemy: 'forest_slime', r: 5, c: 1 }]);
    const warded = battle([spec('jin', hero('jin', { equipment: { ACCESSORY: 'ward_very_good' } }), 0, 1)], [{ enemy: 'forest_slime', r: 5, c: 1 }]);
    for (const b of [plain, warded]) (b.e as any).applyStatus(b.heroU('jin'), 'bleed', b.monsters('forest_slime')[0]);
    const left = (b: ReturnType<typeof battle>) => b.heroU('jin').buffs.find(x => x.def.id === 'bleed')!.remaining;
    expect(left(warded)).toBeCloseTo(left(plain) * 0.55, 5);
  });
});

describe('Patch 1 progression — boss phase protection', () => {
  it('Guardian phases start with a ~1 s phase-setup window (70 / 40 / 15 %)', () => {
    const phases = MONSTERS['fallen_forest_guardian'].phases!;
    expect(phases.map(p => p.hpBelow)).toEqual([0.7, 0.4, 0.15]);
    for (const p of phases) {
      expect(p.transition).withContext(p.id).toBeGreaterThanOrEqual(0.75);
      expect(p.transition).withContext(p.id).toBeLessThanOrEqual(1.25);
    }
    expect(STATUS_EFFECTS['phase_shift'].modifiers.damageTakenMultiplier).toBe(0);
  });
});
