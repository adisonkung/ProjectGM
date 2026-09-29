import { HERO_BY_ID } from '../../core/data/heroes';
import { BLADE_TRACE } from '../../core/data/special-skills';
import { StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { FINISHER_START, finisherPlan, gradeOf, gradeStroke, Pt, slashPattern, strokeMultipliers, toSpace } from '../../core/rules/slash-trace';
import { heroStats } from '../../core/rules/stats';
import { createBattle } from '../battle-session';
import { BattleEvent } from './battle-engine';
import { effectiveAttack } from './damage-resolver';
import { BattlePhase } from './stage/types';

/** Player special skill (Blade Trace): separate button, mini-game grades → damage; heroes untouched */

const H = (id: string, depth: number, lane: number): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + depth * 10 + lane,
    stats: heroStats(t, { uid: 0, templateId: id, level: 1, potential: 'B' }), pos: { r: depth, c: lane },
  };
};
const stage = (enemies: StageDef['enemies'], extra: Partial<StageDef> = {}): StageDef => ({ floor: 0, id: 'sp', mode: 'eliminate', timeLimit: 300, enemies, ...extra });

function fight(st: StageDef) {
  const e = createBattle({ allies: [H('aurel', 0, 1), H('sylvie', 3, 1)], stage: st, seed: 3 });
  const log: BattleEvent[] = [];
  const run = (sec: number) => {
    for (let i = 0; i < Math.round(sec / 0.05) && !e.result; i++) {
      e.step(0.05);
      log.push(...e.drainEvents());
    }
  };
  return { e, log, run };
}

describe('Special skill — Blade Trace (rules)', () => {
  const tol = 30;
  const W = 800;
  const H_ = 450;
  const trail = toSpace(slashPattern(4, (() => { let x = 0.3; return () => (x = (x * 16807 + 0.12345) % 1); })())[0], W, H_);

  it('pattern: n trails, each a sampled curve inside the field, different angles', () => {
    let x = 0.5;
    const rng = () => (x = (x * 16807 + 0.12345) % 1);
    const p = slashPattern(4, rng);
    expect(p.length).toBe(4);
    const angles = p.map(s => {
      const a = s.points[0];
      const b = s.points.at(-1)!;
      return (Math.atan2(b.y - a.y, b.x - a.x) + Math.PI) % Math.PI;
    });
    for (const s of p) for (const q of s.points) expect(q.x >= 0 && q.x <= 1 && q.y >= 0 && q.y <= 1).toBeTrue();
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const d = Math.abs(angles[i] - angles[j]);
      expect(Math.min(d, Math.PI - d)).toBeGreaterThan(0.25);
    }
  });

  it('tracing the trail exactly, start → end, in time = PERFECT', () => {
    const r = gradeStroke(trail, trail.points, tol, true, BLADE_TRACE);
    expect(r.grade).toBe('PERFECT');
    expect(r.coverage).toBe(1);
    expect(r.rightWay).toBeTrue();
  });

  it('a fast swipe with few pointer points still counts (the drawn path is densified)', () => {
    const pts = trail.points;
    const sparse = [pts[0], pts[8], pts[16], pts[24]];
    expect(gradeStroke(trail, sparse, tol, true, BLADE_TRACE).grade).not.toBe('MISS');
  });

  it('wrong way (end → start) loses most of the damage', () => {
    const r = gradeStroke(trail, [...trail.points].reverse(), tol, true, BLADE_TRACE);
    expect(r.rightWay).toBeFalse();
    expect(['OK', 'MISS']).toContain(r.grade);
  });

  it('half the trail = lower grade · drawn far off the trail = MISS · out of time = MISS', () => {
    const half = gradeStroke(trail, trail.points.slice(0, 13), tol, true, BLADE_TRACE);
    expect(['GOOD', 'OK']).toContain(half.grade);
    const off: Pt[] = trail.points.map(p => ({ x: p.x, y: p.y + tol * 4 }));
    expect(gradeStroke(trail, off, tol, true, BLADE_TRACE).grade).toBe('MISS');
    expect(gradeStroke(trail, trail.points, tol, false, BLADE_TRACE).grade).toBe('MISS');
  });

  it('a slightly shaky trace stays GOOD or better', () => {
    const shaky = trail.points.map((p, i) => ({ x: p.x, y: p.y + (i % 2 ? 1 : -1) * tol * 0.4 }));
    expect(['PERFECT', 'GOOD']).toContain(gradeStroke(trail, shaky, tol, true, BLADE_TRACE).grade);
  });

  it('finisher: a flurry of cuts per trail grade (PERFECT 3 · GOOD 2 · OK 1 · MISS 1 red), in time order, then the final split', () => {
    let x = 0.2;
    const p = finisherPlan(['PERFECT', 'GOOD', 'OK', 'MISS'], () => (x = (x * 16807 + 0.12345) % 1));
    expect(p.cuts.map(c => c.grade)).toEqual(['PERFECT', 'PERFECT', 'PERFECT', 'GOOD', 'GOOD', 'OK', 'MISS']);
    expect(p.cuts[0].at).toBeCloseTo(FINISHER_START, 5);
    for (let i = 1; i < p.cuts.length; i++) expect(p.cuts[i].at).toBeGreaterThan(p.cuts[i - 1].at);
    expect(p.finalAt).toBeGreaterThan(p.cuts.at(-1)!.at);
    expect(p.duration).toBeGreaterThan(p.finalAt);
    expect(p.duration).toBeLessThan(2.5);
  });

  it('grade thresholds and multipliers: PERFECT 1.2 · GOOD 1 · OK 0.65 · MISS 0.3 (never 0)', () => {
    expect(gradeOf(0.9, BLADE_TRACE)).toBe('PERFECT');
    expect(gradeOf(0.7, BLADE_TRACE)).toBe('GOOD');
    expect(gradeOf(0.4, BLADE_TRACE)).toBe('OK');
    expect(gradeOf(0.1, BLADE_TRACE)).toBe('MISS');
    expect(strokeMultipliers(['PERFECT', 'GOOD', 'OK', 'MISS'], BLADE_TRACE)).toEqual([1.2, 1, 0.65, 0.3]);
  });
});

describe('Special skill — Blade Trace (engine)', () => {
  it('charges only during COMBAT (starts at 50 %, full after 15 s more) and is not usable before', () => {
    const s = fight(stage([{ enemy: 'forest_slime', r: 0, c: 1 }]));
    for (const u of s.e.units.filter(x => x.side !== 'ally')) u.hp = u.maxHp = 1e7;
    expect(s.e.specialCharge).toBe(BLADE_TRACE.startCharge);
    expect(s.e.canUseSpecial()).toBeFalse();
    expect(s.e.useSpecial([1, 1, 1, 1])).toBeFalse();
    s.run(8);
    expect(s.e.phase).toBe(BattlePhase.COMBAT);
    expect(s.e.canUseSpecial()).toBeFalse();
    s.run(9);
    expect(s.e.specialCharge).toBe(1);
    expect(s.e.canUseSpecial()).toBeTrue();
  });

  it('hits every enemy once per trail for avg team ATK × 0.75 × grade (DEF applies), uses the whole charge', () => {
    const s = fight(stage([{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 1, c: 0 }, { enemy: 'forest_slime', r: 1, c: 2 }]));
    const foes = s.e.units.filter(x => x.side !== 'ally');
    for (const u of foes) u.hp = u.maxHp = 1e7;
    s.run(0.1);
    s.e.specialCharge = 1;
    const heroes = s.e.units.filter(u => u.side === 'ally');
    const avg = heroes.reduce((a, u) => a + effectiveAttack(u), 0) / heroes.length;
    const before = foes.map(u => u.hp);
    s.log.length = 0;
    const manaBefore = heroes.map(u => u.mana);
    expect(s.e.useSpecial([1.2, 1, 0.65, 0.3])).toBeTrue();
    const ev = s.e.drainEvents();
    const dmg = ev.filter(x => x.type === 'damage');
    expect(dmg.length).toBe(4 * foes.length);
    const mit = 100 / (100 + foes[0].def);
    const expected = [1.2, 1, 0.65, 0.3].reduce((a, m) => a + Math.max(1, Math.round(avg * 0.75 * m * mit)), 0);
    foes.forEach((u, i) => expect(before[i] - u.hp).toBe(expected));
    const sp = ev.find(x => x.type === 'special') as Extract<BattleEvent, { type: 'special' }>;
    expect(sp.targets).toBe(3);
    expect(sp.total).toBe(expected * 3);
    expect(s.e.specialCharge).toBe(0);
    expect(s.e.canUseSpecial()).toBeFalse();
    expect(s.e.metrics.specialUses).toBe(1);
    // heroes untouched: no gauge / no damage / no cooldown change from the special skill
    expect(heroes.map(u => u.mana)).toEqual(manaBefore);
  });

  it('never reflected (MIRROR STANCE) and skips untargetable enemies', () => {
    const s = fight(stage([{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 1, c: 2 }]));
    const foes = s.e.units.filter(x => x.side !== 'ally');
    for (const u of foes) u.hp = u.maxHp = 1e7;
    s.run(0.1);
    foes[1].buffs.push({ def: { id: 'untargetable', name: 'x', kind: 'BUFF', duration: 99, stackPolicy: 'NONE', flags: ['untargetable'], modifiers: {} } as never, remaining: 99, sourceId: 0, stacks: 1, magnitude: 0 } as never);
    foes[0].buffs.push({ def: { id: 'mirror', name: 'm', kind: 'BUFF', duration: 99, stackPolicy: 'NONE', modifiers: { reflectDamage: 0.6 } } as never, remaining: 99, sourceId: 0, stacks: 1, magnitude: 0 } as never);
    const heroHp = s.e.units.filter(u => u.side === 'ally').map(u => u.hp);
    s.e.specialCharge = 1;
    expect(s.e.useSpecial([1, 1, 1, 1])).toBeTrue();
    expect(foes[0].hp).toBeLessThan(1e7);
    expect(foes[1].hp).toBe(1e7);
    expect(s.e.units.filter(u => u.side === 'ally').map(u => u.hp)).toEqual(heroHp);
  });

  it('a battle without the player using it is unchanged (bots / AUTO / balance tools never use it)', () => {
    const a = fight(stage([{ enemy: 'forest_slime', r: 0, c: 1 }]));
    const b = fight(stage([{ enemy: 'forest_slime', r: 0, c: 1 }]));
    a.run(60);
    b.run(60);
    expect(a.e.result).toBe(b.e.result);
    expect(a.e.time).toBe(b.e.time);
    expect(a.e.metrics.specialUses).toBe(0);
  });
});
