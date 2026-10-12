import { kitOf } from '../../core/data/hero-skills';
import type { BattleEvent, BattleUnit } from './battle-engine';
import { SkillHost, SkillSystem } from './skill-system';

/** Tang Xun S1 Piercing Fang: one blade through a 1×3 line — the units behind take their hit when it gets there */
describe('line pierce (DAMAGE.pierceDelays)', () => {
  const unit = (id: number, side: 'ally' | 'enemy', c: number) =>
    ({ id, side, alive: true, pos: { r: 1, c }, hp: 100, maxHp: 100 }) as unknown as BattleUnit;

  function run() {
    const caster = unit(0, 'ally', 2);
    const foes = [unit(1, 'enemy', 5), unit(2, 'enemy', 6), unit(3, 'enemy', 7)];
    const hits: { id: number; mul: number; at: number }[] = [];
    const later: { delay: number; fn: () => void }[] = [];
    const events: BattleEvent[] = [];
    let now = 0;
    const host = {
      time: 0,
      rng: () => 0.99,
      emit: (e: BattleEvent) => events.push(e),
      foes: () => foes,
      hit: (_u: BattleUnit, f: BattleUnit, mul: number) => (hits.push({ id: f.id, mul, at: now }), true),
      later: (delay: number, _u: BattleUnit, fn: () => void) => later.push({ delay, fn }),
      interrupt: () => undefined,
    } as unknown as SkillHost;
    const sys = new SkillSystem(host);
    const s = kitOf('tangxun', 'archer').skill;
    const direct = sys.applyEffects(caster, s, 'skill', foes[0], foes[0].pos);
    for (const l of later.sort((a, b) => a.delay - b.delay)) {
      now = l.delay;
      l.fn();
    }
    return { direct, hits, later, events, foes };
  }

  it('first target now at 240 %, targets 2 / 3 at 120 % after +4 / +6 frames, each with its own impact (index 1 / 2)', () => {
    const r = run();
    expect(r.direct.map(u => u.id)).toEqual([1]);
    expect(r.hits.map(h => [h.id, h.mul, Math.round(h.at * 60)])).toEqual([[1, 2.4, 0], [2, 1.2, 4], [3, 1.2, 6]]);
    const imp = r.events.filter((e): e is Extract<BattleEvent, { type: 'impact' }> => e.type === 'impact');
    expect(imp.map(e => [e.dst, e.index])).toEqual([[2, 1], [3, 2]]);
  });

  it('a unit that died before the blade reached it takes nothing', () => {
    const caster = unit(0, 'ally', 2);
    const r = run();
    expect(r.hits.length).toBe(3);
    // re-run with target 3 dead before its delay fires
    const foes = [unit(1, 'enemy', 5), unit(2, 'enemy', 6), unit(3, 'enemy', 7)];
    const later: (() => void)[] = [];
    const hits: number[] = [];
    const host = {
      time: 0, rng: () => 0.99, emit: () => undefined, foes: () => foes, interrupt: () => undefined,
      hit: (_u: BattleUnit, f: BattleUnit) => (hits.push(f.id), true),
      later: (_d: number, _u: BattleUnit, fn: () => void) => later.push(fn),
    } as unknown as SkillHost;
    new SkillSystem(host).applyEffects(caster, kitOf('tangxun', 'archer').skill, 'skill', foes[0], foes[0].pos);
    (foes[2] as { alive: boolean }).alive = false;
    later.forEach(fn => fn());
    expect(hits).toEqual([1, 2]);
  });
});
