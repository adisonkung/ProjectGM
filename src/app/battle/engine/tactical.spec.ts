import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { STAGES } from '../../core/data/stages';
import { newGameState } from '../../core/data/starter';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { ROLE_BEHAVIOR } from '../../core/data/classes';
import { FLOOR_BANDS } from '../../core/data/progression';
import { EnemyPlacement, StageDef, wavesOf } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { heroStats, LEVEL_GROWTH } from '../../core/rules/stats';
import { teamToUnits } from '../../core/rules/team';
import { BattleEngine, BattleEvent, BattleUnit, MONSTER_TUNING_LIMITS, monsterTuningReview } from './battle-engine';
import { applyBuff, hasStatus, modifier } from './buffs';
import { distance } from './grid';
import { TacticalBot } from './bots/tactical-bot';
import { SAFE_DANGER } from './positioning';

// ------------------------------------------------------------------ harness

const DT = 0.05;
type Ev = BattleEvent & { t: number };

const H = (id: string, depth: number, lane: number, o: Partial<UnitSpec['stats']> = {}): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + depth * 10 + lane, sprite: t.sprite,
    stats: { ...heroStats(t, { uid: 0, templateId: id, level: 1, potential: 'B', injury: 0 }), ...o },
    pos: { r: depth, c: lane },
  };
};
const mon = (enemy: string, depth: number, lane: number): EnemyPlacement => ({ enemy, r: depth, c: lane });
const TOUGH = { hp: 99999 };

function battle(allies: UnitSpec[], enemies: EnemyPlacement[], o: { tuning?: StageDef['monsterTuning'] } = {}) {
  const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies, monsterTuning: o.tuning };
  const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: 7 });
  const log: Ev[] = [];
  const flush = () => {
    for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
  };
  const step = () => {
    e.step(DT);
    flush();
  };
  const run = (sec: number) => {
    for (let i = 0; i < Math.round(sec / DT) && !e.result; i++) step();
  };
  const until = (cond: () => boolean, max = 30) => {
    for (let t = 0; t < max && !cond() && !e.result; t += DT) step();
    return cond();
  };
  const hero = (id: string) => e.units.find(u => u.heroId === id)!;
  const monsters = (id: string) => e.units.filter(u => u.monster?.definitionId === id);
  const of = <T extends BattleEvent['type']>(type: T) => {
    flush();
    return log.filter(x => x.type === type) as (Ev & Extract<BattleEvent, { type: T }>)[];
  };
  const x = e as any;
  const put = (u: BattleUnit, c: number, r: number) => x.relocate(u, { r, c }, 'blink');
  const cast = (u: BattleUnit, skill: string, target: BattleUnit | null = null) => {
    u.monster!.state = 'CASTING';
    u.monster!.currentSkillId = skill;
    x.beginCast(u, MONSTER_SKILLS[skill], target);
  };
  const statue = (u: BattleUnit) => applyBuff(u, STATUS_EFFECTS['root'], 0, { duration: 999 });
  step();
  return { e, log, step, run, until, hero, monsters, of, put, cast, statue };
}

// ------------------------------------------------------------------ stats

describe('Tactical difficulty — stats', () => {
  it('no large stage multipliers: stage tuning is clamped (HP ≤ +40%, ATK ≤ +25%, DEF ≤ +30%)', () => {
    for (const st of STAGES) expect((st as any).monsterScale).toBeUndefined();
    const b = battle([H('aurel', 0, 1)], [mon('goblin_guard', 3, 1)], { tuning: { hp: 3, atk: 3, def: 3 } });
    const g = b.monsters('goblin_guard')[0];
    const st = MONSTERS['goblin_guard'].stats;
    expect(g.maxHp).toBe(Math.round(st.maxHp * MONSTER_TUNING_LIMITS.hp));
    expect(g.atk).toBe(Math.round(st.attack * MONSTER_TUNING_LIMITS.atk));
    expect(g.def).toBe(Math.round(st.defense * MONSTER_TUNING_LIMITS.def));
  });

  it('Patch 1 level growth: HP +3%, ATK +2.5%, DEF +2% per level (Lv10 ≈ ×1.27 / ×1.225 / ×1.18)', () => {
    const t = HERO_BY_ID['jin'];
    const at = (level: number) => heroStats(t, { uid: 0, templateId: 'jin', level, potential: 'B', injury: 0 });
    const l1 = at(1), l10 = at(10);
    expect(l10.atk / l1.atk).toBeCloseTo(1 + 9 * LEVEL_GROWTH.atk, 1);
    expect(l10.hp / l1.hp).toBeCloseTo(1.27, 1);
    expect(l10.def / l1.def).toBeCloseTo(1.18, 1);
    expect(LEVEL_GROWTH).toEqual({ hp: 0.03, atk: 0.025, def: 0.02 });
  });

  it('tuning above the ceilings is flagged for review (never silently applied); stages stay within the limits', () => {
    const st = STAGES[6];
    expect(monsterTuningReview({ ...st, monsterTuning: { hp: 2 } })).toEqual(['HP ×2 > ×1.4']);
    expect(monsterTuningReview({ ...st, monsterTuning: { hp: 1.4, atk: 1.25, def: 1.3 } })).toEqual([]);
    for (const s of STAGES) expect(monsterTuningReview(s)).toEqual([]);
  });

  it('mechanic exposure metrics: per-skill casts, boss lifetime, phases', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    const boss = b.monsters('elder_treant')[0];
    b.statue(boss);
    b.cast(boss, 'call_of_the_forest');
    b.run(3.5);
    const m = b.e.metrics;
    expect(m.bossSpawnedAt).not.toBeNull();
    expect(m.skillStats['call_of_the_forest'].started).toBe(1);
    expect(m.skillStats['call_of_the_forest'].completed).toBe(1);
    expect(m.statusApplied['ancient_protection']).toBe(1);
    boss.hp = 1;
    (b.e as any).applyDamage(boss, 99999, false);
    b.run(0.2);
    expect(m.bossDiedAt).not.toBeNull();
    expect(m.bossLifetime(b.e.time)).toBeGreaterThan(3);
    expect(m.phaseDurations(b.e.time).length).toBeGreaterThanOrEqual(1);
  });

  it('Patch 1 recommended levels = the top of each floor band (Floor 10 = Lv9–10 endgame)', () => {
    expect(STAGES.map(s => s.recommendedLevel)).toEqual([1, 1, 2, 3, 5, 6, 8, 8, 10, 10]);
    for (const st of STAGES) expect(st.recommendedLevel).toBe(FLOOR_BANDS[st.floor].levels[1]);
  });
});

// ------------------------------------------------------------------ positioning

describe('Tactical difficulty — positioning', () => {
  it('role leash / focus-chase / safe-range values', () => {
    expect([ROLE_BEHAVIOR.tank.leash, ROLE_BEHAVIOR.archer.leash, ROLE_BEHAVIOR.healer.leash, ROLE_BEHAVIOR.assassin.leash]).toEqual([5, 2.5, 1.5, 8]);
    expect([ROLE_BEHAVIOR.archer.minSafeRange, ROLE_BEHAVIOR.mage.minSafeRange, ROLE_BEHAVIOR.healer.minSafeRange]).toEqual([3, 2.5, 2.5]);
    expect(ROLE_BEHAVIOR.healer.maxFocusChase).toBe(0.5);
  });

  it('hostile melee threat zones raise the DangerScore; ranged heroes avoid them', () => {
    const b = battle([H('sylvie', 3, 1, TOUGH)], [mon('corrupted_wolf', 0, 1)]);
    const sy = b.hero('sylvie');
    const wolf = b.monsters('corrupted_wolf')[0];
    b.statue(wolf);
    const P = b.e.positioning;
    expect(P.danger(sy, wolf.pos)).toBeGreaterThanOrEqual(SAFE_DANGER);
    expect(P.danger(sy, sy.pos)).toBeLessThan(SAFE_DANGER);
    b.run(4);
    expect(P.threatCount(sy.pos, P.threats(sy))).toBe(0);
  });

  it('49. SAFE FOCUS: Sylvie never runs into the Treant for a Dark Shaman 8 cells away; Focus stays; she switches once it is safe', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('sylvie', 4, 1, TOUGH)],
      [mon('corrupted_treant', 0, 1), mon('dark_shaman', 4, 1), mon('corrupted_wolf', 0, 0)]);
    const sy = b.hero('sylvie');
    const [treant] = b.monsters('corrupted_treant');
    const shaman = b.monsters('dark_shaman')[0];
    b.statue(treant);
    b.statue(shaman);
    b.e.setFocus(shaman.id);
    let enteredThreat = false;
    for (let i = 0; i < 80; i++) {
      b.step();
      if (distance(sy.pos, treant.pos) <= 1.5 + 0.5) enteredThreat = true;
    }
    expect(enteredThreat).toBeFalse();
    expect(sy.targetId).not.toBe(shaman.id);
    expect(b.e.focusTargetId).toBe(shaman.id);
    expect(b.e.metrics.unsafeFocusChaseCount).toBe(0);
    // the shaman steps into safe range → Sylvie takes the Focus by herself
    b.put(shaman, sy.pos.c + 5, sy.pos.r);
    sy.lockUntil = 0;
    sy.cd1 = sy.cd2 = 99; // no new skill cast lock in the way of the re-think
    b.run(1.2); // a skill's cast lock (≤ 0.7 s) may still be running
    expect(sy.targetId).toBe(shaman.id);
    expect(sy.intent).toBe('focus');
  });

  it('Focus is not cleared while the target is temporarily untargetable / out of range', () => {
    const b = battle([H('sylvie', 4, 1, TOUGH)], [mon('mist_wraith', 5, 1), mon('goblin_guard', 0, 1)]);
    const w = b.monsters('mist_wraith')[0];
    b.e.setFocus(w.id);
    applyBuff(w, STATUS_EFFECTS['untargetable'], w.id, { duration: 1 });
    b.run(1.5);
    expect(b.e.focusTargetId).toBe(w.id);
  });

  it('ranged heroes drift back toward their anchor when nothing is safely shootable', () => {
    const b = battle([H('lumina', 3, 1, TOUGH), H('aurel', 0, 1, TOUGH)], [mon('goblin_guard', 5, 1)]);
    const lum = b.hero('lumina');
    const anchor = b.e.flow.formation.localAnchorOf(lum.id)!;
    b.put(lum, anchor.c + 3, anchor.r);
    b.statue(b.monsters('goblin_guard')[0]);
    b.run(4);
    // the anchor follows the frontline (Aurel walked up to the guard): the healer returns behind it, never ahead
    const moving = b.e.positioning.anchorOf(lum)!;
    expect(distance(lum.pos, moving)).toBeLessThanOrEqual(ROLE_BEHAVIOR.healer.leash);
    expect(lum.pos.c).toBeLessThan(b.hero('aurel').pos.c);
  });

  it('the backline anchor follows an advancing frontline (never past it)', () => {
    const b = battle([H('sylvie', 3, 1, TOUGH), H('aurel', 0, 1, TOUGH)], [mon('goblin_guard', 5, 1)]);
    const sy = b.hero('sylvie'), a = b.hero('aurel');
    const home = b.e.flow.formation.localAnchorOf(sy.id)!;
    const aHome = b.e.flow.formation.localAnchorOf(a.id)!;
    expect(b.e.positioning.anchorOf(sy)!.r).toBe(home.r);
    const before = b.e.positioning.anchorOf(sy)!;
    b.put(a, a.pos.c + 4, aHome.r);
    const after = b.e.positioning.anchorOf(sy)!;
    expect(after.c).toBeGreaterThan(before.c);
    expect(after.c).toBeLessThan(a.pos.c);
  });
});

// ------------------------------------------------------------------ skill modes & interrupts

describe('Tactical difficulty — skill use modes & interrupt reservation', () => {
  it('RESERVE interrupt skills are never spent on normal damage; MANUAL never by the AI; requestSkill still works', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('sylvie', 4, 1, TOUGH)], [mon('goblin_guard', 0, 1), mon('goblin_guard', 0, 0)]);
    const a = b.hero('aurel'), sy = b.hero('sylvie');
    for (const g of b.monsters('goblin_guard')) g.hp = g.maxHp = 99999;
    b.e.setSkillMode(a.id, 'skill2', 'MANUAL');
    b.e.setSkillMode(sy.id, 'skill2', 'RESERVE');
    a.cd2 = 0;
    sy.cd2 = 0;
    b.run(6);
    expect(a.cd2).toBeLessThanOrEqual(0);
    expect(sy.cd2).toBeLessThanOrEqual(0);
    expect(b.e.requestSkill(sy.id, 'skill2')).toBeTrue();
    b.run(0.5);
    expect(sy.cd2).toBeGreaterThan(5);
  });

  it('AUTO interrupt skills fall back to damage (the old behaviour); CONDITIONAL does not', () => {
    const b = battle([H('sylvie', 4, 1, TOUGH), H('aurel', 0, 1, TOUGH)], [mon('goblin_guard', 0, 1)]);
    const sy = b.hero('sylvie'), a = b.hero('aurel');
    b.e.setSkillMode(a.id, 'skill2', 'CONDITIONAL');
    sy.cd2 = 0;
    a.cd2 = 0;
    b.run(5);
    expect(sy.cd2).toBeGreaterThan(0);
    expect(a.cd2).toBeLessThanOrEqual(0);
  });

  it('50. INTERRUPT RESERVATION: Arrow Rain waits (no damage use) and goes on Call of the Forest', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('sylvie', 4, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    const sy = b.hero('sylvie'), a = b.hero('aurel');
    const t = b.monsters('elder_treant')[0];
    b.statue(t);
    b.e.setSkillMode(sy.id, 'skill2', 'RESERVE');
    b.e.setSkillMode(a.id, 'skill2', 'MANUAL');
    t.castSkills.forEach(c => (c.cd = 99));
    sy.cd2 = 0;
    b.run(3);
    expect(sy.cd2).toBeLessThanOrEqual(0); // no dangerous cast → kept
    b.put(t, sy.pos.c + 5, sy.pos.r);
    b.cast(t, 'call_of_the_forest');
    b.until(() => b.of('CAST_INTERRUPTED').length > 0, 3);
    const ci = b.of('CAST_INTERRUPTED')[0];
    expect(ci.src).toBe(sy.id);
    expect(ci.skill).toBe('call_of_the_forest');
    expect(b.e.metrics.reservedSkillHits).toBe(1);
  });

  it('51. MULTIPLE INTERRUPTERS: the tank commits on Alpha Howl, Sylvie keeps Arrow Rain ready', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('sylvie', 4, 1, TOUGH)], [mon('alpha_wolf', 0, 1), mon('forest_wolf', 5, 0)]);
    const a = b.hero('aurel'), sy = b.hero('sylvie');
    const alpha = b.monsters('alpha_wolf')[0];
    b.statue(alpha);
    b.put(alpha, a.pos.c + 2, a.pos.r);
    for (const h of [a, sy]) b.e.setSkillMode(h.id, 'skill2', 'RESERVE');
    a.cd2 = 0;
    sy.cd2 = 0;
    b.cast(alpha, 'alpha_howl');
    b.until(() => b.of('CAST_INTERRUPTED').length > 0, 3);
    expect(b.of('CAST_INTERRUPTED')[0].src).toBe(a.id);
    expect(sy.cd2).toBeLessThanOrEqual(0);
    expect(b.of('cast').filter(c => c.kind === 'skill2').length).toBe(1);
  });

  it('52. FOREST OBLIVION: tank 60 + Sylvie 40 are both committed (60 alone is not "done") → Break', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('sylvie', 4, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    const a = b.hero('aurel'), sy = b.hero('sylvie');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.statue(g);
    b.put(g, a.pos.c + 2, a.pos.r);
    for (const h of [a, sy]) {
      b.e.setSkillMode(h.id, 'skill2', 'RESERVE');
      b.e.setSkillMode(h.id, 'ult', 'MANUAL');
    }
    a.cd2 = 0;
    sy.cd2 = 0;
    g.castSkills.push({ def: MONSTER_SKILLS['forest_oblivion'], cd: 0 });
    b.cast(g, 'forest_oblivion');
    b.until(() => b.of('broken').length > 0, 6);
    const gauge = b.of('breakGauge').map(x => [x.src, x.value]);
    expect(gauge).toContain([a.id, 60]);
    expect(b.of('broken').length).toBe(1);
    expect(a.cd2).toBeGreaterThan(0);
    expect(sy.cd2).toBeGreaterThan(0);
    expect(b.e.metrics.breakSuccess).toBe(1);
  });

  it('interrupt priority: a reserved interrupt ignores casts below the hero minimum', () => {
    const b = battle([H('sylvie', 4, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    const sy = b.hero('sylvie');
    const t = b.monsters('elder_treant')[0];
    b.statue(t);
    b.put(t, sy.pos.c + 5, sy.pos.r);
    b.e.setSkillMode(sy.id, 'skill2', 'RESERVE');
    b.e.setInterruptMinPriority(sy.id, 'CRITICAL');
    sy.cd2 = 0;
    b.cast(t, 'entangling_roots', sy); // MEDIUM
    b.run(2.2);
    expect(b.of('CAST_INTERRUPTED').length).toBe(0);
    expect(sy.cd2).toBeLessThanOrEqual(0);
  });

  it('RESERVE ultimates wait: healer for a death / crisis, interrupter for an important cast', () => {
    const b = battle([H('lumina', 4, 1, TOUGH), H('aurel', 0, 1, TOUGH)], [mon('goblin_guard', 0, 1)]);
    const lum = b.hero('lumina');
    b.e.setSkillMode(lum.id, 'ult', 'RESERVE');
    b.e.autoUlt = true;
    lum.mana = lum.maxMana;
    b.run(3);
    expect(lum.mana).toBe(lum.maxMana);
    b.hero('aurel').hp = Math.round(b.hero('aurel').maxHp * 0.2);
    lum.hp = Math.round(lum.maxHp * 0.2);
    b.run(2);
    expect(lum.mana).toBeLessThan(lum.maxMana);
  });
});

// ------------------------------------------------------------------ Stage 7 wall

describe('Tactical difficulty — Stage 7', () => {
  it('Call of the Forest: cast 3 s, cooldown 12 s, first cast 5 s into the boss wave, CRITICAL', () => {
    const c = MONSTER_SKILLS['call_of_the_forest'];
    expect([c.castTime, c.cooldown, c.firstCastDelay, c.interruptPriority, c.interruptible]).toEqual([3, 12, 5, 'CRITICAL', true]);
    expect(MONSTER_SKILLS['root_slam'].interruptible).toBeFalse();
    expect(MONSTER_SKILLS['entangling_roots'].interruptPriority).toBe('MEDIUM');
  });

  it('Ancient Protection: ×0.80 damage taken while any Call add lives, never stacks, ends with the last add', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    const t = b.monsters('elder_treant')[0];
    b.statue(t);
    b.cast(t, 'call_of_the_forest');
    b.until(() => !t.casting, 4);
    expect(hasStatus(t, 'ancient_protection')).toBeTrue();
    expect(modifier(t, 'damageTakenMultiplier')).toBeCloseTo(0.8, 5);
    applyBuff(t, STATUS_EFFECTS['ancient_protection'], t.id);
    expect(modifier(t, 'damageTakenMultiplier')).toBeCloseTo(0.8, 5);
    const adds = [...b.monsters('forest_spirit'), ...b.monsters('magic_mushroom')];
    expect(adds.length).toBe(3);
    const x = b.e as any;
    x.applyDamage(adds[0], adds[0].hp, false);
    x.applyDamage(adds[1], adds[1].hp, false);
    expect(hasStatus(t, 'ancient_protection')).toBeTrue();
    x.applyDamage(adds[2], adds[2].hp, false);
    expect(hasStatus(t, 'ancient_protection')).toBeFalse();
  });

  it('53. STAGE 7 WALL: AUTO lets Calls of the Forest through (interrupts spent on damage), TACTICAL stops them', () => {
    // the boss wave with an unkillable Treant and unkillable heroes: 60 s of pure decision-making
    const state = newGameState();
    const allies = teamToUnits(state.team, state.heroes.map(h => ({ ...h, level: 4 })));
    const w = wavesOf(STAGES[6])[2];
    const stage: StageDef = {
      floor: 7, mode: 'eliminate', timeLimit: 150,
      enemies: w.spawns.map(s => mon(s.monsterId, s.formationSlot.depth, s.formationSlot.lane)),
    };
    const run = (tactical: boolean) => {
      const out = { started: 0, completed: 0 };
      for (let seed = 1; seed <= 3; seed++) {
        const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed, autoUlt: true });
        const bot = tactical ? new TacticalBot() : null;
        e.units.forEach(u => {
          if (u.boss) u.hp = u.maxHp = 1e6;
          if (u.side === 'ally') u.hp = u.maxHp = 1e5;
        });
        e.subscribe(ev => {
          if (ev.type === 'castStart' && ev.label === 'CALL OF THE FOREST') out.started++;
          if (ev.type === 'skillActivated' && ev.skill === 'call_of_the_forest') out.completed++;
        });
        while (!e.result && e.time < 60) {
          bot?.tick(e);
          e.step(DT);
        }
      }
      return out;
    };
    const auto = run(false);
    const tactical = run(true);
    expect(auto.completed).toBeGreaterThan(0);
    expect(tactical.completed).toBeLessThan(auto.completed);
    expect(tactical.completed / tactical.started).toBeLessThan(0.2);
  });

});
