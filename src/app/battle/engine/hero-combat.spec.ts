import { CLASS_BASE, HERO_5STAR_LV1, HERO_CLASS_BASE, starMultiplier } from '../../core/data/classes';
import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { HERO_DEFINITIONS, kitOf } from '../../core/data/hero-skills';
import { MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { STAGES } from '../../core/data/stages';
import { newGameState } from '../../core/data/starter';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { SkillSlot } from '../../core/models/combat';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { teamToUnits } from '../../core/rules/team';
import { resolveArea } from './area';
import { BattleEngine, BattleEvent, BattleUnit } from './battle-engine';
import { applyBuff, attackModifier, buffRemaining, hasFlag, hasStatus, modifier } from './buffs';
import { distance } from './grid';
import { DamageResolver } from './damage-resolver';

// ------------------------------------------------------------------ harness

const DT = 0.05;
type Ev = BattleEvent & { t: number };

/** a 5★ Lv1 hero (prototype balance stats) — hp can be raised so nobody dies by accident */
const H = (id: string, depth: number, lane: number, o: Partial<UnitSpec['stats']> = {}): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + depth * 10 + lane, sprite: t.sprite,
    stats: { ...heroStats(t, { uid: 0, templateId: id, level: 1, potential: 'B' }), ...o },
    pos: { r: depth, c: lane },
  };
};
const mon = (enemy: string, depth: number, lane: number): EnemyPlacement => ({ enemy, r: depth, c: lane });

function battle(allies: UnitSpec[], enemies: EnemyPlacement[], opts: { rounds?: EnemyPlacement[][]; seed?: number } = {}) {
  const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies, rounds: opts.rounds };
  const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: opts.seed ?? 7 });
  const log: Ev[] = [];
  let frozen: 'none' | 'heroes' | 'all' = 'none';
  const step = () => {
    for (const u of e.units) {
      if (!u.alive) continue;
      if (u.side === 'ally' && frozen !== 'none') u.castLock = 1e9;
      if (u.side === 'enemy' && frozen === 'all') applyBuff(u, STATUS_EFFECTS['stun'], 0, { duration: 1 });
    }
    e.step(DT);
    for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
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
  const of = <T extends BattleEvent['type']>(type: T) => log.filter(x => x.type === type) as (Ev & Extract<BattleEvent, { type: T }>)[];
  const kill = (u: BattleUnit) => (e as any).applyDamage(u, u.hp + u.shield + 1, false);
  /** teleport a unit to a board cell (test setup) */
  const put = (u: BattleUnit, c: number, r: number) => (e as any).relocate(u, { r, c }, 'blink');
  /** use a skill slot of a hero right now on `target` (bypasses AI choice; the effect still runs through the systems) */
  const use = (u: BattleUnit, slot: SkillSlot, target: BattleUnit) => e.skills.use(u, slot, kitOf(u.heroId, u.cls)[slot], target);
  const root = (u: BattleUnit) => applyBuff(u, STATUS_EFFECTS['root'], 0, { duration: 999 });
  step(); // PREPARATION → COMBAT
  return {
    e, log, step, run, until, hero, monsters, of, kill, put, use, root,
    freeze: (m: 'heroes' | 'all' = 'heroes') => (frozen = m), unfreeze: () => (frozen = 'none'),
  };
}

const damageTo = (b: ReturnType<typeof battle>, u: BattleUnit, since = 0) =>
  b.of('damage').filter(d => d.dst === u.id && d.t > since);

// ------------------------------------------------------------------ data

describe('Hero kits (data)', () => {
  it('5★ Lv1 stats match the balance table', () => {
    const row = (id: string) => {
      const s = heroStats(HERO_BY_ID[id], { uid: 0, templateId: id, level: 1, potential: 'B' });
      return [s.hp, s.atk, s.def, +s.atkSpeed.toFixed(2), s.range];
    };
    expect(row('aurel')).toEqual([393, 27, 49, 0.99, 1]);
    expect(row('jin')).toEqual([270, 47, 27, 1.28, 1]);
    expect(row('shade')).toEqual([234, 49, 19, 1.51, 1]);
    expect(row('sylvie')).toEqual([197, 42, 15, 1.33, 6]);
    expect(row('velma')).toEqual([184, 57, 12, 1.04, 5]);
    expect(row('lumina')).toEqual([209, 30, 17, 1.1, 4]);
  });

  it('(30) star multiplier applied once on the 3★ reference: 1★ 0.91 · 2★ 0.955 · 3★ 1.00 · 4★ 1.05 · 5★ 1.10 · 6★ 1.18', () => {
    expect([1, 2, 3, 4, 5, 6].map(starMultiplier)).toEqual([0.91, 0.955, 1, 1.05, 1.1, 1.18]);
    expect(HERO_CLASS_BASE.tank.hp).toBe(393);
    const at = (id: string, star: number, level = 1) => heroStats(HERO_BY_ID[id], { uid: 0, templateId: id, level, potential: 'B', star });
    const t3 = at('aurel', 3);
    expect([t3.hp, t3.atk, t3.def]).toEqual([393, 27, 49]);
    expect([at('aurel', 6).hp, at('aurel', 6).atk, at('aurel', 6).def]).toEqual([Math.round(393 * 1.18), Math.round(27 * 1.18), Math.round(49 * 1.18)]);
    expect(at('aurel', 1).hp).toBe(Math.round(393 * 0.91));
    expect(at('aurel', 6).atkSpeed).toBe(t3.atkSpeed);
    // the starting roster was re-rated 5★ → 3★ at the same power: every class's 3★ Lv1 = the table
    for (const cls of Object.keys(HERO_5STAR_LV1) as (keyof typeof HERO_5STAR_LV1)[]) {
      const id = Object.values(HERO_BY_ID).find(h => h.cls === cls && h.star === 3 && h.sprite)!.id;
      const s3 = heroStats(HERO_BY_ID[id], { uid: 0, templateId: id, level: 1, potential: 'B' });
      expect([s3.hp, s3.atk, s3.def]).toEqual([HERO_5STAR_LV1[cls].hp, HERO_5STAR_LV1[cls].atk, HERO_5STAR_LV1[cls].def]);
    }
    expect(Object.values(HERO_5STAR_LV1).map(x => x.hp)).not.toContain(678);
    // linear level growth on the final Lv1 stats: Lv10 = ×1.27 HP, ×1.225 ATK, ×1.18 DEF
    const l10 = at('jin', 3, 10);
    expect([l10.hp, l10.atk, l10.def]).toEqual([Math.round(270 * 1.27), Math.round(47 * 1.225), Math.round(27 * 1.18)]);
  });

  it('(32) displayed stats (roster / heroStats) = runtime unit stats used in combat, every class', () => {
    const ids = ['aurel', 'jin', 'shade', 'sylvie', 'velma', 'lumina'];
    const b = battle(ids.map((id, i) => H(id, i < 3 ? 0 : 3, i % 3)), [mon('forest_slime', 5, 1)]);
    for (const id of ids) {
      const shown = heroStats(HERO_BY_ID[id], { uid: 0, templateId: id, level: 1, potential: 'B' });
      const u = b.hero(id);
      expect([u.maxHp, u.atk, u.def]).toEqual([shown.hp, shown.atk, shown.def]);
      expect([u.maxHp, u.atk, u.def]).toEqual([HERO_5STAR_LV1[u.cls].hp, HERO_5STAR_LV1[u.cls].atk, HERO_5STAR_LV1[u.cls].def]);
    }
    // the team builder (lab / tower battles) produces the same runtime stats
    const st = newGameState();
    for (const u of teamToUnits(st.team, st.heroes)) expect(u.stats.hp).toBe(HERO_5STAR_LV1[u.cls].hp);
  });

  it('cooldowns per class and no two same-class heroes are mechanical copies (except Aurel/Morgan by design)', () => {
    const cd = (id: string) => [HERO_DEFINITIONS[id].kit.skill.cooldown, HERO_DEFINITIONS[id].kit.skill2.cooldown];
    expect(cd('aurel')).toEqual([6, 12]);
    expect(cd('jin')).toEqual([5, 10]);
    expect(cd('shade')).toEqual([6, 12]);
    expect(cd('sylvie')).toEqual([6, 11]);
    expect(cd('velma')).toEqual([7, 14]);
    expect(cd('lumina')).toEqual([8, 15]);
    const ids = (id: string) => ['skill', 'skill2', 'ult'].map(s => (HERO_DEFINITIONS[id].kit as any)[s].id).join();
    expect(ids('ragnar')).not.toBe(ids('jin'));
    expect(ids('nox')).not.toBe(ids('shade'));
    expect(ids('corvin')).not.toBe(ids('lumina'));
    expect(ids('morgan')).toBe(ids('aurel'));
    expect(HERO_DEFINITIONS['morgan'].kit.ult.name).not.toBe(HERO_DEFINITIONS['aurel'].kit.ult.name);
  });

  it('only Tank S2 / Tank ult / Sylvie S2 / Sylvie ult carry interrupt', () => {
    const carriers: string[] = [];
    for (const [id, d] of Object.entries(HERO_DEFINITIONS)) {
      for (const slot of ['attack', 'skill', 'skill2', 'ult'] as const) {
        if (d.kit[slot].effects.some(x => x.type === 'INTERRUPT' || (x.type === 'DAMAGE' && x.interrupt))) carriers.push(`${id}.${slot}`);
      }
    }
    expect(carriers.sort()).toEqual(['aurel.skill2', 'aurel.ult', 'morgan.skill2', 'morgan.ult', 'sylvie.skill2', 'sylvie.ult']);
  });
});

describe('AreaResolver patterns', () => {
  const u = (id: number, c: number, r: number) => ({ id, pos: { r, c } });
  const caster = u(0, 5, 1);
  const grid = [u(1, 7, 1), u(2, 8, 1), u(3, 9, 1), u(4, 7, 0), u(5, 7, 2), u(6, 6, 1), u(7, 8, 0)];
  const ids = (pattern: any, primary: any, center?: any) => resolveArea({ pattern, caster, primary, center, candidates: grid }).map(x => x.id);
  it('SINGLE / LINE_2 / LINE_3 / ADJACENT_8 / CROSS_1 / FRONT_ARC / RADIUS_2', () => {
    expect(ids('SINGLE', grid[0])).toEqual([1]);
    expect(ids('LINE_2', grid[0])).toEqual([1, 2]);
    expect(ids('LINE_3', grid[0])).toEqual([1, 2, 3]);
    expect(ids('ADJACENT_8', grid[0]).sort()).toEqual([1, 2, 4, 5, 6, 7]);
    expect(ids('CROSS_1', grid[0]).sort()).toEqual([1, 2, 4, 5, 6]);
    expect(ids('FRONT_ARC', grid[5], 'SELF').sort()).toEqual([1, 4, 5, 6]);
    expect(ids('RADIUS_2', grid[0], 'SELF').sort()).toEqual([1, 4, 5, 6]);
    // the primary target is first and never listed twice
    expect(ids('ADJACENT_8', grid[0])[0]).toBe(1);
  });
});

// ------------------------------------------------------------------ gauge

describe('Ultimate gauge', () => {
  it('+3 per landed basic attack, never from skills; persists into the next wave', () => {
    const b = battle([H('jin', 0, 1, { hp: 99999 })], [mon('forest_slime', 0, 1)], { rounds: [[mon('forest_slime', 0, 1)]] });
    const jin = b.hero('jin');
    jin.cd1 = jin.cd2 = 999;
    b.until(() => b.of('WAVE_CLEARED').length > 0, 40);
    const hits = b.of('attack').filter(a => a.src === jin.id).length;
    const received = b.of('damage').filter(d => d.dst === jin.id && !d.poison).length;
    expect(jin.mana).toBeLessThanOrEqual(3 * hits + 2 * received);
    expect(jin.mana).toBeGreaterThanOrEqual(3 * (hits - 1));
    const at = jin.mana;
    b.until(() => b.e.waveIndex === 1);
    expect(jin.mana).toBe(at); // (22) persists, no passive gain during the transition
  });

  it('(23) no longer fills every ~8 s from normal attacks', () => {
    const b = battle([H('shade', 0, 1, { hp: 99999 })], [mon('forest_slime', 0, 1), mon('forest_slime', 0, 0), mon('forest_slime', 0, 2)]);
    const shade = b.hero('shade');
    shade.cd1 = shade.cd2 = 999;
    b.monsters('forest_slime').forEach(x => (x.hp = x.maxHp = 99999));
    b.until(() => b.of('attack').some(a => a.src === shade.id));
    const start = b.e.time;
    b.run(8);
    expect(b.e.time - start).toBeGreaterThan(7.9);
    expect(shade.mana).toBeLessThan(70); // fastest attacker (1.51/s): ≈ 36 + receive-hit gauge
  });

  it('(24) multi-hit damage cannot farm receive-hit gauge (0.5 s internal cooldown)', () => {
    const b = battle([H('aurel', 0, 1)], [mon('forest_slime', 5, 1)]);
    const t = b.hero('aurel');
    t.mana = 0;
    for (let i = 0; i < 5; i++) (b.e as any).applyDamage(t, 5, false);
    expect(t.mana).toBe(2);
    b.run(0.3);
    (b.e as any).applyDamage(t, 5, false);
    expect(t.mana).toBe(2);
    b.run(0.25);
    (b.e as any).applyDamage(t, 5, false);
    expect(t.mana).toBe(4);
  });

  it('using an ultimate empties the gauge and the ultimate itself generates none', () => {
    const b = battle([H('sylvie', 3, 1, { hp: 99999 })], [mon('forest_slime', 0, 1), mon('forest_slime', 0, 0)]);
    const s = b.hero('sylvie');
    s.mana = 100;
    b.e.requestUlt(s.id);
    b.until(() => b.of('cast').some(c => c.src === s.id && c.kind === 'ult'));
    expect(s.mana).toBe(0);
    s.castLock = 1e9;
    b.run(1.2);
    expect(s.mana).toBe(0);
  });
});

// ------------------------------------------------------------------ tank

describe('Tank (Aurel / Morgan)', () => {
  it('(1) Taunt: RADIUS_2 enemies must hit the tank for 3 s, tank takes ×0.60 — then it wears off', () => {
    const b = battle([H('aurel', 0, 1, { hp: 99999 }), H('lumina', 4, 1, { hp: 99999 })], [mon('forest_wolf', 0, 1), mon('forest_wolf', 0, 0), mon('forest_wolf', 5, 2)]);
    const tank = b.hero('aurel');
    b.freeze();
    b.until(() => b.monsters('forest_wolf').filter(w => distance(w.pos, tank.pos) <= 2).length >= 2);
    b.use(tank, 'skill', b.monsters('forest_wolf')[0]);
    b.run(0.6);
    const near = b.monsters('forest_wolf').filter(w => hasFlag(w, 'taunted'));
    expect(near.length).toBeGreaterThanOrEqual(2);
    for (const w of near) expect(w.monster!.currentTargetId).toBe(tank.id);
    expect(modifier(tank, 'damageTakenMultiplier')).toBeCloseTo(0.6, 6);
    b.run(3);
    expect(b.monsters('forest_wolf').some(w => hasFlag(w, 'taunted'))).toBeFalse();
    expect(modifier(tank, 'damageTakenMultiplier')).toBe(1);
  });

  it('(2) Shield Charge interrupts Alpha Howl: interrupt → 150% → knockback → 0.8 s stun; full 12 s cooldown', () => {
    const b = battle([H('aurel', 0, 1, { hp: 99999 })], [mon('alpha_wolf', 1, 1), mon('forest_wolf', 5, 0)]);
    const tank = b.hero('aurel');
    const alpha = b.monsters('alpha_wolf')[0];
    b.root(alpha);
    b.put(tank, alpha.pos.c - 2, alpha.pos.r);
    b.e.setSkillMode(tank.id, 'skill2', 'RESERVE'); // kept for casts (AUTO would spend it on damage)
    tank.cd2 = 0; // AI: the interrupt opportunity is taken as soon as the cast starts
    b.until(() => b.of('CAST_INTERRUPTED').length > 0, 8);
    const ci = b.of('CAST_INTERRUPTED')[0];
    expect(ci.src).toBe(tank.id);
    expect(ci.skill).toBe('alpha_howl');
    expect(alpha.casting).toBeNull();
    expect(alpha.castSkills[0].cd).toBeGreaterThan(11.5);
    expect(b.of('buff').some(x => x.buff === 'stun' && x.dst === alpha.id)).toBeTrue();
    expect(b.of('cast').find(c => c.src === tank.id && c.kind === 'skill2')!.skill).toBe('พุ่งชนโล่');
    b.run(3);
    expect(b.of('skillActivated').length).toBe(0);
    expect(alpha.buffs.some(x => x.def.id === 'alpha_howl_buff')).toBeFalse();
  });

  it('(3) Tank ultimate interrupts only casters inside RADIUS_2', () => {
    const b = battle([H('aurel', 0, 1, { hp: 99999 })], [mon('alpha_wolf', 0, 1), mon('alpha_wolf', 5, 1), mon('forest_wolf', 5, 0)]);
    const tank = b.hero('aurel');
    const [near, far] = b.monsters('alpha_wolf');
    b.monsters('alpha_wolf').concat(b.monsters('forest_wolf')).forEach(b.root);
    b.put(tank, near.pos.c - 1, near.pos.r);
    b.freeze();
    b.until(() => !!near.casting && !!far.casting, 8);
    b.use(tank, 'ult', tank);
    b.run(1);
    expect(b.of('CAST_INTERRUPTED').map(x => x.dst)).toEqual([near.id]);
    expect(far.casting).not.toBeNull();
    expect(distance(far.pos, tank.pos)).toBeGreaterThan(2);
    expect(tank.shield).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ fighters

describe('Fighters (Jin / Ragnar)', () => {
  it('(4) Jin Spinning Sword waits for at least two enemies around him', () => {
    const b = battle([H('jin', 0, 1, { hp: 99999 })], [mon('forest_slime', 0, 1), mon('forest_slime', 5, 0)]);
    const jin = b.hero('jin');
    const [s1, s2] = b.monsters('forest_slime');
    b.root(s2);
    b.put(jin, s1.pos.c - 1, 1);
    jin.cd1 = 0;
    jin.cd2 = 99;
    expect(b.e.skills.chooseSkill(jin, s1)).toBeNull();
    b.put(s2, s1.pos.c, 0);
    expect(b.e.skills.chooseSkill(jin, s1)?.skill.id).toBe('spinning_sword');
  });

  it('(5) Jin Piercing Thrust hits the primary (180%) + exactly one behind (120%), not a third', () => {
    const b = battle([H('jin', 0, 1, { hp: 99999 })], [mon('forest_slime', 0, 1), mon('forest_slime', 1, 1), mon('forest_slime', 2, 1)]);
    const jin = b.hero('jin');
    const [a, bb, c] = b.monsters('forest_slime');
    b.monsters('forest_slime').forEach(b.root);
    b.freeze('all');
    b.put(jin, a.pos.c - 1, 1);
    b.use(jin, 'skill2', a);
    b.run(1.2);
    expect(damageTo(b, a).length).toBe(1);
    expect(damageTo(b, bb).length).toBe(1);
    expect(damageTo(b, c).length).toBe(0);
    expect(damageTo(b, a)[0].amount).toBeGreaterThan(damageTo(b, bb)[0].amount);
  });

  it('(6) Ragnar is not a Jin copy: Axe Storm frenzy on ≥2 hits, Blood Rage ×1.25 dmg & speed, Lava Axe LINE_3', () => {
    const b = battle([H('ragnar', 0, 1, { hp: 99999 })], [mon('forest_slime', 0, 1), mon('forest_slime', 0, 0), mon('forest_slime', 1, 1), mon('forest_slime', 2, 1)]);
    const r = b.hero('ragnar');
    const [a, side, behind, third] = b.monsters('forest_slime');
    b.monsters('forest_slime').forEach(x => (x.hp = x.maxHp = 99999));
    b.monsters('forest_slime').forEach(b.root);
    b.freeze('all');
    b.put(r, a.pos.c - 1, 1);
    b.use(r, 'skill', a);
    b.run(1.2);
    expect(hasStatus(r, 'axe_frenzy')).toBeTrue();
    expect(modifier(r, 'attackSpeedMultiplier')).toBeCloseTo(1.15, 6);
    b.use(r, 'skill2', a);
    b.run(1.2);
    expect(modifier(r, 'damageMultiplier')).toBeCloseTo(1.25, 6);
    expect(modifier(r, 'attackSpeedMultiplier')).toBeCloseTo(1.15 * 1.25, 6);
    expect(buffRemaining(r, 'blood_rage')).toBeGreaterThan(4);
    const since = b.e.time;
    b.use(r, 'ult', a);
    b.run(1.5);
    expect([a, behind, third].every(x => damageTo(b, x, since).length === 1)).toBeTrue();
    expect(damageTo(b, side, since).length).toBe(0);
  });
});

// ------------------------------------------------------------------ assassins

describe('Assassins (Shade / Nox)', () => {
  it('(7) Shade Shadow Assault goes for the player Focus; otherwise the lowest HP% enemy', () => {
    const b = battle([H('shade', 0, 1, { hp: 99999 })], [mon('forest_slime', 0, 1), mon('goblin_archer', 4, 2)]);
    const shade = b.hero('shade');
    const [slime] = b.monsters('forest_slime');
    const archer = b.monsters('goblin_archer')[0];
    const s1 = kitOf('shade', 'assassin').skill;
    slime.hp = slime.maxHp * 0.2;
    expect(b.e.skills.pickTarget(shade, s1, slime)).toBe(slime);
    b.e.setFocus(archer.id);
    expect(b.e.skills.pickTarget(shade, s1, slime)).toBe(archer);
    b.freeze();
    b.use(shade, 'skill', archer);
    b.run(1);
    expect(distance(shade.pos, archer.pos)).toBe(1);
    expect(damageTo(b, archer).length).toBe(1);
  });

  it('(8) Shade ultimate ignores Focus: guaranteed crit on the lowest HP% enemy within 4', () => {
    const b = battle([H('shade', 0, 1, { hp: 99999 })], [mon('forest_slime', 0, 1), mon('forest_slime', 0, 0)]);
    const shade = b.hero('shade');
    const [a, low] = b.monsters('forest_slime');
    b.monsters('forest_slime').forEach(b.root);
    b.put(shade, a.pos.c - 1, 1);
    low.hp = Math.round(low.maxHp * 0.3);
    b.e.setFocus(a.id);
    expect(b.e.skills.chooseUltimate(shade, a, true)).toBe(low);
    b.freeze();
    b.use(shade, 'ult', low);
    b.run(1.5);
    const hit = damageTo(b, low)[0];
    expect(hit.crit).toBeTrue();
  });

  it('(9) Poison: same source refreshes (never stacks), another source coexists', () => {
    const b = battle([H('shade', 0, 1, { hp: 99999 }), H('corvin', 3, 1, { hp: 99999 })], [mon('forest_slime', 0, 1)]);
    const [shade, corvin] = [b.hero('shade'), b.hero('corvin')];
    const slime = b.monsters('forest_slime')[0];
    slime.hp = slime.maxHp = 99999;
    b.root(slime);
    b.freeze();
    b.put(shade, slime.pos.c - 1, 1);
    b.put(corvin, slime.pos.c - 3, 1);
    b.use(shade, 'skill2', slime);
    b.run(1.5);
    b.use(shade, 'skill2', slime);
    b.run(1.2);
    const mine = slime.buffs.filter(x => x.def.id === 'poison');
    expect(mine.length).toBe(1);
    expect(mine[0].remaining).toBeGreaterThan(3);
    b.use(corvin, 'skill2', slime);
    b.run(1.2);
    const all = slime.buffs.filter(x => x.def.id === 'poison');
    expect(all.length).toBe(2);
    expect(new Set(all.map(x => x.sourceId))).toEqual(new Set([shade.id, corvin.id]));
    // 25% ATK per second, 4 s (total 100% ATK)
    expect(STATUS_EFFECTS['poison'].tick!.perSecond * STATUS_EFFECTS['poison'].duration).toBe(1);
  });

  it('(10) Nox dives the back row; Shade takes the lowest HP% (front-liner here); Nox gains 30% dodge', () => {
    const b = battle([H('shade', 0, 1, { hp: 99999 }), H('nox', 0, 0, { hp: 99999 })], [mon('forest_slime', 0, 1), mon('goblin_archer', 5, 1)]);
    const [shade, nox] = [b.hero('shade'), b.hero('nox')];
    const slime = b.monsters('forest_slime')[0];
    const archer = b.monsters('goblin_archer')[0];
    slime.hp = Math.round(slime.maxHp * 0.5);
    expect(b.e.skills.pickTarget(shade, kitOf('shade', 'assassin').skill, slime)).toBe(slime);
    expect(b.e.skills.pickTarget(nox, kitOf('nox', 'assassin').skill, slime)).toBe(archer);
    b.freeze();
    b.use(nox, 'skill', archer);
    b.run(1);
    // landed behind the archer (it may have stepped back one cell since)
    expect(distance(nox.pos, archer.pos)).toBeLessThanOrEqual(2);
    if (archer.alive) expect(nox.targetId).toBe(archer.id);
    expect(hasStatus(nox, 'shadow_evasion')).toBeTrue();
  });

  it('(10b) Nox Soul Reap: ×1.35 on a target at ≤ 35% HP; Ghost Dash lands behind the primary', () => {
    const b = battle([H('nox', 0, 1, { hp: 99999, atk: 100 })], [mon('forest_slime', 0, 1), mon('forest_slime', 0, 0)]);
    const nox = b.hero('nox');
    const [a, low] = b.monsters('forest_slime');
    a.maxHp = a.hp = low.maxHp = 99999;
    low.hp = Math.round(low.maxHp * 0.3);
    b.monsters('forest_slime').forEach(b.root);
    b.freeze('all');
    b.put(nox, a.pos.c - 1, 1);
    // compare to a full-HP target: executes hit harder (variance ±10% and crit accounted for by the ratio range)
    b.use(nox, 'ult', a);
    b.run(1.5);
    b.use(nox, 'ult', low);
    b.run(1.5);
    const [hA] = damageTo(b, a).map(d => d.amount / (d.crit ? 1.5 : 1));
    const [hL] = damageTo(b, low).map(d => d.amount / (d.crit ? 1.5 : 1));
    expect(hL / hA).toBeGreaterThan(1.35 * 0.9 / 1.1 - 0.01);
    b.put(nox, a.pos.c - 1, a.pos.r);
    b.use(nox, 'skill2', a);
    b.run(1.5);
    expect(nox.pos.c).toBeGreaterThan(a.pos.c);
  });
});

// ------------------------------------------------------------------ archer

describe('Archer (Sylvie)', () => {
  it('(11) basic arrows damage on arrival, not on release', () => {
    const b = battle([H('sylvie', 3, 1, { hp: 99999 })], [mon('forest_slime', 0, 1)]);
    const s = b.hero('sylvie');
    const slime = b.monsters('forest_slime')[0];
    b.root(slime);
    b.until(() => b.of('projectile').some(p => p.src === s.id && p.kind === 'attack'), 10);
    const shot = b.of('projectile').find(p => p.src === s.id)!;
    b.run(1);
    const dmg = damageTo(b, slime)[0];
    expect(dmg.t - shot.t).toBeGreaterThanOrEqual(shot.flight - 1e-6);
  });

  it('(12) Rapid Shot: 4 independent arrows × 70% = 280%', () => {
    const rs = kitOf('sylvie', 'archer').skill;
    expect(rs.repeat!.count * (rs.effects[0] as any).primary).toBeCloseTo(2.8, 6);
    const b = battle([H('sylvie', 3, 1, { hp: 99999 })], [mon('forest_slime', 0, 1)]);
    const s = b.hero('sylvie');
    const slime = b.monsters('forest_slime')[0];
    slime.hp = slime.maxHp = 99999;
    b.root(slime);
    b.freeze();
    b.put(s, slime.pos.c - 5, 1);
    b.use(s, 'skill', slime);
    b.run(2);
    expect(b.of('projectile').filter(p => p.src === s.id && p.kind === 'skill').length).toBe(4);
    expect(damageTo(b, slime).length).toBe(4);
  });

  const casters = () => {
    const b = battle([H('sylvie', 3, 1, { hp: 99999 })], [mon('alpha_wolf', 0, 1), mon('alpha_wolf', 5, 0), mon('forest_wolf', 5, 2)]);
    const s = b.hero('sylvie');
    const [near, far] = b.monsters('alpha_wolf');
    [near, far, ...b.monsters('forest_wolf')].forEach(b.root);
    b.put(s, near.pos.c - 5, 1);
    b.freeze();
    b.until(() => !!near.casting && !!far.casting, 8);
    return { b, s, near, far };
  };

  it('(13) Arrow Rain automatically prioritizes a valid caster', () => {
    const { b, s, near } = casters();
    s.cd2 = 0;
    const pick = b.e.skills.chooseInterrupt(s, b.monsters('forest_wolf')[0]);
    expect(pick?.skill.id).toBe('arrow_rain');
    expect(pick?.target).toBe(near);
  });

  it('(14) Arrow Rain interrupts only casters inside its 3×3 area', () => {
    const { b, s, near, far } = casters();
    b.use(s, 'skill2', near);
    b.run(1.2);
    expect(b.of('CAST_INTERRUPTED').map(x => x.dst)).toEqual([near.id]);
    expect(far.casting ?? b.of('castDone').some(x => x.src === far.id)).toBeTruthy();
  });

  it('(15) Heavenly Arrow Rain interrupts every valid caster on the field', () => {
    const { b, s, near, far } = casters();
    b.use(s, 'ult', near);
    b.run(1.5);
    expect(b.of('CAST_INTERRUPTED').map(x => x.dst).sort()).toEqual([near.id, far.id].sort());
  });
});

// ------------------------------------------------------------------ mage

describe('Mage (Velma)', () => {
  it('(16) Bone Hand roots but does NOT interrupt Alpha Howl', () => {
    const b = battle([H('velma', 3, 1, { hp: 99999 })], [mon('alpha_wolf', 1, 1), mon('forest_wolf', 5, 0)]);
    const v = b.hero('velma');
    const alpha = b.monsters('alpha_wolf')[0];
    b.monsters('forest_wolf').forEach(b.root);
    b.freeze();
    b.until(() => !!alpha.casting, 8);
    b.put(v, alpha.pos.c - 4, alpha.pos.r);
    b.use(v, 'skill2', alpha);
    b.run(0.9);
    expect(hasFlag(alpha, 'root')).toBeTrue();
    expect(b.of('CAST_INTERRUPTED').length).toBe(0);
    b.until(() => b.of('skillActivated').length > 0, 3);
    expect(b.of('skillActivated').length).toBe(1);
  });

  it('Soul Curse only with ≥ 2 enemies in its 3×3', () => {
    const b = battle([H('velma', 3, 1, { hp: 99999 })], [mon('forest_slime', 0, 1), mon('forest_slime', 5, 2)]);
    const v = b.hero('velma');
    const [a, c] = b.monsters('forest_slime');
    b.monsters('forest_slime').forEach(b.root);
    b.put(v, a.pos.c - 4, 1);
    v.cd1 = 0;
    v.cd2 = 99;
    expect(b.e.skills.chooseSkill(v, a)).toBeNull();
    b.put(c, a.pos.c + 1, 1);
    expect(b.e.skills.chooseSkill(v, a)?.skill.id).toBe('soul_curse');
  });
});

// ------------------------------------------------------------------ healers

describe('(33–34) derived effects follow the new runtime stats', () => {
  it('DamageResolver uses the runtime ATK / DEF', () => {
    const b = battle([H('jin', 0, 1)], [mon('forest_slime', 0, 1)]);
    const jin = b.hero('jin');
    const slime = b.monsters('forest_slime')[0];
    const r = DamageResolver.resolve({ attacker: jin, target: slime, multiplier: 1, damageType: 'PHYSICAL', sourceId: 't', variance: 0.5 });
    expect(jin.atk).toBe(47);
    expect(r.amount).toBe(Math.round(47 * 100 / (100 + slime.def)));
  });

  it('Holy Blessing heals ATK × 2.2 + 10% of the target max HP with the new values', () => {
    const b = battle([H('lumina', 3, 1), H('aurel', 0, 1)], [mon('forest_slime', 5, 1)]);
    const [lum, tank] = [b.hero('lumina'), b.hero('aurel')];
    b.monsters('forest_slime').forEach(b.root);
    b.freeze();
    tank.hp = 1;
    b.use(lum, 'skill2', tank);
    b.run(1.5);
    const h = b.of('heal').find(x => x.dst === tank.id && x.src === lum.id)!;
    expect(lum.atk).toBe(30);
    expect(h.amount).toBe(Math.round(30 * 2.2 + 393 * 0.1));
  });

  it('Holy Fortress shield = 30% of the new tank max HP', () => {
    const b = battle([H('aurel', 0, 1)], [mon('forest_slime', 0, 1)]);
    const tank = b.hero('aurel');
    b.monsters('forest_slime').forEach(b.root);
    b.freeze('all');
    b.use(tank, 'ult', tank);
    b.run(1);
    expect(tank.maxHp).toBe(393);
    expect(tank.shield).toBeCloseTo(393 * 0.3, 0);
  });

  it('resurrection restores 40% of the new max HP; Shade poison ticks from the new Shade ATK', () => {
    const b = battle([H('lumina', 3, 1), H('jin', 0, 0), H('shade', 0, 1)], [mon('forest_slime', 0, 1)]);
    const [lum, jin, shade] = [b.hero('lumina'), b.hero('jin'), b.hero('shade')];
    const slime = b.monsters('forest_slime')[0];
    slime.hp = slime.maxHp = 99999;
    b.root(slime);
    b.freeze();
    b.kill(jin);
    b.use(lum, 'ult', lum);
    b.run(1.5);
    expect(jin.hp).toBe(Math.round(270 * 0.4));
    b.put(shade, slime.pos.c - 1, 1);
    b.use(shade, 'skill2', slime);
    b.run(1.5);
    const poison = slime.buffs.find(x => x.def.id === 'poison' && x.sourceId === shade.id)!;
    expect(shade.atk).toBe(49);
    expect(poison.magnitude).toBe(49);
  });
});

describe('Healers (Lumina / Corvin) and resurrection', () => {
  it('(17) Lumina: Holy Blessing is the top priority when an ally is below 35%', () => {
    const b = battle([H('lumina', 3, 1), H('aurel', 0, 1), H('jin', 0, 0)], [mon('forest_slime', 5, 1)]);
    const [lum, tank, jin] = [b.hero('lumina'), b.hero('aurel'), b.hero('jin')];
    tank.hp = Math.round(tank.maxHp * 0.3);
    jin.hp = Math.round(jin.maxHp * 0.6);
    lum.cd1 = lum.cd2 = 0;
    const pick = b.e.skills.chooseSkill(lum, null);
    expect(pick?.skill.id).toBe('holy_blessing');
    expect(pick?.tier).toBe('EMERGENCY');
    expect(pick?.target).toBe(tank);
  });

  it('Lumina normal action: Heal Bolt (130% ATK, projectile) while an ally is below 60%, attack otherwise', () => {
    const b = battle([H('lumina', 3, 1), H('aurel', 1, 1)], [mon('forest_slime', 0, 1)]);
    const [lum, tank] = [b.hero('lumina'), b.hero('aurel')];
    lum.cd1 = lum.cd2 = 99;
    expect(b.e.skills.healBoltTarget(lum)).toBeNull();
    tank.hp = Math.round(tank.maxHp * 0.5);
    expect(b.e.skills.healBoltTarget(lum)).toBe(tank);
    b.until(() => b.of('heal').some(h => h.dst === tank.id && h.src === lum.id), 5);
    expect(b.of('projectile').some(p => p.src === lum.id && p.dst === tank.id)).toBeTrue();
  });

  it('(18) Corvin Healing Mist heals several damaged allies at once, then over time', () => {
    const b = battle([H('corvin', 3, 1), H('aurel', 2, 1), H('jin', 4, 0)], [mon('forest_slime', 5, 1)]);
    const [cv, tank, jin] = [b.hero('corvin'), b.hero('aurel'), b.hero('jin')];
    b.monsters('forest_slime').forEach(b.root);
    tank.hp = Math.round(tank.maxHp * 0.5);
    jin.hp = Math.round(jin.maxHp * 0.5);
    cv.cd1 = 0;
    cv.cd2 = 99;
    const pick = b.e.skills.chooseSkill(cv, null);
    expect(pick?.skill.id).toBe('healing_mist');
    b.freeze();
    b.use(cv, 'skill', cv);
    b.run(4.5);
    for (const a of [tank, jin]) expect(b.of('heal').filter(h => h.dst === a.id && h.src === cv.id).length).toBeGreaterThanOrEqual(4);
  });

  it('(19 + 20 + 21) resurrection revives exactly one hero at 40% — and only once per stage', () => {
    const b = battle([H('lumina', 3, 1), H('aurel', 0, 1), H('jin', 0, 0), H('shade', 0, 2)], [mon('forest_slime', 5, 1)]);
    const [lum, jin, shade, tank] = [b.hero('lumina'), b.hero('jin'), b.hero('shade'), b.hero('aurel')];
    b.monsters('forest_slime').forEach(b.root);
    b.freeze();
    b.kill(jin);
    b.kill(shade);
    tank.hp = Math.round(tank.maxHp * 0.5);
    b.use(lum, 'ult', lum);
    b.run(1.5);
    const revived = b.of('HERO_REVIVE_STARTED');
    expect(revived.length).toBe(1);
    const who = b.e.units.find(u => u.id === revived[0].unit)!;
    expect(who.hp).toBe(Math.round(who.maxHp * 0.4));
    expect(b.of('heal').some(h => h.dst === tank.id)).toBeTrue();
    // second resurrection this stage: heals, revives nobody
    const healsBefore = b.of('heal').length;
    b.use(lum, 'ult', lum);
    b.run(1.5);
    expect(b.of('HERO_REVIVE_STARTED').length).toBe(1);
    expect(b.of('heal').length).toBeGreaterThan(healsBefore);
    expect(b.e.flow.limitedRevives).toBe(1);
  });
});

// ------------------------------------------------------------------ Stage 1–3 monsters

describe('Stage 1–3 monster rules', () => {
  const pack = () => {
    const b = battle([H('aurel', 0, 1, { hp: 99999 }), H('lumina', 4, 1, { hp: 99999 })], [mon('alpha_wolf', 1, 1), mon('forest_wolf', 0, 0), mon('forest_wolf', 0, 2)]);
    b.freeze();
    return { b, alpha: b.monsters('alpha_wolf')[0], wolves: b.monsters('forest_wolf') };
  };

  it('(25) Alpha Howl never deals direct damage', () => {
    const { b, alpha, wolves } = pack();
    [alpha, ...wolves].forEach(b.root); // nobody can reach a hero: any damage would have to come from the Howl
    b.until(() => b.of('castDone').length > 0, 10);
    expect(b.of('skillActivated')[0].targets.length).toBe(3);
    expect(b.of('damage').filter(d => b.e.units.find(u => u.id === d.dst)!.side === 'ally').length).toBe(0);
    expect(MONSTER_SKILLS['alpha_howl'].effects.every(x => x.type === 'APPLY_BUFF')).toBeTrue();
  });

  it('(26) Alpha cannot Howl when no normal Forest Wolf remains', () => {
    const { b, alpha, wolves } = pack();
    wolves.forEach(b.kill);
    b.run(12);
    expect(b.of('castStart').some(c => c.src === alpha.id)).toBeFalse();
  });

  it('(27 + 28) Howl = exactly ATK ×1.25, refresh never multiplies', () => {
    const { b, alpha } = pack();
    b.until(() => b.of('skillActivated').length > 0, 10);
    expect(attackModifier(alpha)).toBeCloseTo(1.25, 9);
    applyBuff(alpha, STATUS_EFFECTS['alpha_howl_buff'], alpha.id);
    expect(attackModifier(alpha)).toBeCloseTo(1.25, 9);
    expect(alpha.buffs.filter(x => x.def.id === 'alpha_howl_buff').length).toBe(1);
  });

  it('(29) an interrupted Howl goes on its full 12 s cooldown and never applies the buff', () => {
    const { b, alpha } = pack();
    b.until(() => !!alpha.casting, 8);
    (b.e as any).tryInterrupt(b.hero('aurel'), alpha);
    expect(alpha.castSkills[0].cd).toBe(12);
    b.run(4);
    expect(alpha.buffs.length).toBe(0);
  });

  it('(30) ordinary hits stagger the Alpha at most once per 2 s (CC still works)', () => {
    const { b, alpha } = pack();
    alpha.hp = alpha.maxHp = 99999;
    const start = b.e.time;
    for (let i = 0; i < 38; i++) {
      (b.e as any).applyDamage(alpha, 1, false);
      b.step();
    }
    const hurts = b.of('damage').filter(d => d.dst === alpha.id && d.t > start && d.hurt).length;
    expect(hurts).toBeLessThanOrEqual(1);
    applyBuff(alpha, STATUS_EFFECTS['stun'], 0);
    b.step();
    expect(alpha.monster!.state).toBe('HURT');
    expect(MONSTERS['alpha_wolf'].stats.minHitReactionInterval).toBe(2);
    expect(MONSTERS['alpha_wolf'].attack.damageMultiplier).toBe(1.25);
  });

  it('(31) Forest Wolf stays simple: no skills, frontline targeting, 110/24/6, 4.2 speed, 1.15 s', () => {
    const w = MONSTERS['forest_wolf'];
    expect(w.skills).toEqual([]);
    expect(w.ai.targeting.strategy).toBe('NEAREST_REACHABLE_FRONT');
    expect([w.stats.maxHp, w.stats.attack, w.stats.defense, w.stats.moveSpeed, w.stats.attackRange, w.stats.attackCooldown]).toEqual([110, 24, 6, 4.2, 1.2, 1.15]);
    const a = MONSTERS['alpha_wolf'];
    expect([a.stats.maxHp, a.stats.attack, a.stats.defense, a.stats.moveSpeed, a.stats.attackRange, a.stats.attackCooldown]).toEqual([450, 32, 15, 3.5, 1.4, 1.35]);
  });

  it('taunted monsters attack the tank; rooted monsters stop walking', () => {
    const { b, wolves } = pack();
    const tank = b.hero('aurel');
    const lum = b.hero('lumina');
    b.root(wolves[0]);
    const c0 = wolves[0].pos.c;
    b.run(2);
    expect(wolves[0].pos.c).toBe(c0);
    for (const w of wolves) applyBuff(w, STATUS_EFFECTS['taunted'], tank.id);
    b.run(0.5);
    for (const w of wolves) expect(w.monster!.currentTargetId).not.toBe(lum.id);
  });
});

// ------------------------------------------------------------------ Stage 3 balance (simulation)

describe('Stage 3 — Wolf Territory balance', () => {
  const state = newGameState();
  const starters = teamToUnits(state.team, state.heroes);
  /** an early party (tank + archer + healer) — long enough fights for the Howl to matter */
  const trio = starters.filter(a => ['aurel', 'sylvie', 'lumina'].includes(a.heroId!));

  function runStage(allies: UnitSpec[], interrupts: boolean, seeds = 12) {
    let wins = 0, howls = 0, interrupted = 0, deaths = 0, buffedHits = 0, hits = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const e = new BattleEngine({ allies, stage: STAGES[2], enemyTemplates: ENEMIES, seed, autoUlt: true });
      if (!interrupts) (e as any).tryInterrupt = () => {};
      // a player who plans to interrupt keeps the interrupt skills in RESERVE (AUTO spends them on damage)
      else for (const h of e.units.filter(u => u.side === 'ally')) for (const slot of ['skill', 'skill2'] as const) {
        if (kitOf(h.heroId, h.cls)[slot].ai?.tier === 'INTERRUPT') e.setSkillMode(h.id, slot, 'RESERVE');
      }
      e.subscribe(ev => {
        if (ev.type === 'skillActivated') howls++;
        if (ev.type === 'CAST_INTERRUPTED') interrupted++;
        if (ev.type === 'HERO_DIED') deaths++;
        if (ev.type === 'damage') {
          const dst = e.units.find(u => u.id === ev.dst);
          if (dst?.side !== 'ally' || ev.poison) return;
          hits++;
          if (e.units.some(u => u.monster && u.alive && hasStatus(u, 'alpha_howl_buff'))) buffedHits++;
        }
      });
      if (e.run() === 'win') wins++;
    }
    return { wins, howls, interrupted, deaths, buffedHits, hits, seeds };
  }

  it('(32) winnable without perfect interrupt timing (interrupts disabled entirely)', () => {
    expect(runStage(starters, false).wins).toBe(12);
    const r = runStage(trio, false);
    expect(r.wins).toBe(12);
    expect(r.howls).toBeGreaterThanOrEqual(12); // the Howl lands every time when nobody interrupts
  });

  it('(33) a successful interrupt prevents the pack buff (pressure removed)', () => {
    const r = runStage(trio, true);
    expect(r.interrupted).toBeGreaterThanOrEqual(12);
    expect(r.howls).toBe(0);
    expect(r.buffedHits).toBe(0);
  });

  it('(34) allowing the Howl is noticeable but survivable', () => {
    const r = runStage(trio, false);
    expect(r.buffedHits).toBeGreaterThan(0);
    expect(r.wins).toBe(r.seeds);
    expect(r.deaths).toBe(0);
  });
});
