import { kitOf } from '../../core/data/hero-skills';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import type { BattleUnit } from './battle-engine';
import { repeatHit, SkillHost, SkillSystem } from './skill-system';

/** Tang Xun S2 Severing Chain: three throws of one blade, 25 / 30 / 45 % — interrupt + Open Wound ride on throw 3 only */
describe('multi-hit effect gating (SkillEffect.onHits) — Severing Chain', () => {
  const unit = (id: number, side: 'ally' | 'enemy', c: number, casting = false) =>
    ({ id, side, alive: true, pos: { r: 1, c }, hp: 100, maxHp: 100, casting: casting ? { def: {} } : undefined }) as unknown as BattleUnit;

  function throwAt(i: number) {
    const caster = unit(0, 'ally', 2);
    const foe = unit(1, 'enemy', 6, true);
    const log: string[] = [];
    const host = {
      time: 0, rng: () => 0.99, emit: () => undefined, foes: () => [foe], allies: () => [caster], later: () => undefined,
      hit: (_u: BattleUnit, _f: BattleUnit, mul: number) => (log.push(`hit ${mul.toFixed(2)}`), true),
      interrupt: (_u: BattleUnit, _f: BattleUnit, bp?: number) => log.push(`interrupt ${bp}`),
      applyStatus: (_f: BattleUnit, id: string) => log.push(`status ${id}`),
    } as unknown as SkillHost;
    new SkillSystem(host).applyEffects(caster, repeatHit(kitOf('tangxun', 'archer').skill2, i), 'skill2', foe, foe.pos);
    return log;
  }

  it('throws 1 / 2 only damage (25 % / 30 % of 160 %); throw 3 = 45 % + interrupt (Break 40) + Open Wound', () => {
    expect(throwAt(0)).toEqual(['hit 0.40']);
    expect(throwAt(1)).toEqual(['hit 0.48']);
    expect(throwAt(2)).toEqual(['hit 0.72', 'interrupt 40', 'status open_wound']);
  });

  it('repeatHit leaves skills without weights / gates untouched', () => {
    const s = kitOf('tangxun', 'archer').skill;
    expect(repeatHit(s, 0)).toBe(s);
  });

  it('Open Wound = +10 % damage taken for 5 s, refreshes', () => {
    const w = STATUS_EFFECTS['open_wound'];
    expect([w.duration, w.stackPolicy, w.modifiers.damageTakenMultiplier]).toEqual([5, 'REFRESH_DURATION', 1.1]);
  });
});

/** Tang Xun Ult Heaven-Snaring Blade Array: lock priority + 4 minor cuts then the converging finisher */
describe('Heaven-Snaring Blade Array — lock priority (FOCUS → MARKED) and hit gating', () => {
  const foe = (id: number, c: number, opts: { hp?: number; back?: boolean; wound?: boolean } = {}) =>
    ({
      id, side: 'enemy', alive: true, pos: { r: 1, c }, hp: opts.hp ?? 100, maxHp: 100, line: opts.back ? 'back' : 'front',
      buffs: opts.wound ? [{ def: { id: 'open_wound' } }] : [],
    }) as unknown as BattleUnit;
  const caster = { id: 0, side: 'ally', heroId: 'tangxun', cls: 'archer', alive: true, pos: { r: 1, c: 1 }, hp: 100, maxHp: 100, buffs: [] } as unknown as BattleUnit;

  function pick(foes: BattleUnit[], focus: BattleUnit | null = null) {
    const host = {
      foes: () => foes, allies: () => [caster], focus: () => focus, freeCellNear: () => ({ r: 0, c: 0 }),
    } as unknown as SkillHost;
    return new SkillSystem(host).pickTarget(caster, kitOf('tangxun', 'archer').ult, foes[0])?.id;
  }

  it('player focus first, then the Open Wound target, then the back line, then the current target', () => {
    const a = foe(1, 6), b = foe(2, 8, { back: true }), c = foe(3, 7, { wound: true, hp: 90 });
    expect(pick([a, b, c], a)).toBe(1);
    expect(pick([a, b, c])).toBe(3);
    expect(pick([a, b])).toBe(2);
    expect(pick([a])).toBe(1);
  });

  it('cuts 1–4 hit the locked target only (cut 1 interrupts, Break 60); the finisher always crits and hits around it', () => {
    const t = foe(1, 6), side = foe(2, 7);
    (t as unknown as { casting: object }).casting = { def: {} };
    const run = (i: number) => {
      const log: string[] = [];
      const host = {
        time: 0, rng: () => 0.99, emit: () => undefined, foes: () => [t, side], allies: () => [caster], later: () => undefined,
        hit: (_u: BattleUnit, f: BattleUnit, mul: number, o: { crit: boolean }) => (log.push(`${f.id}:${mul.toFixed(2)}${o.crit ? '!' : ''}`), true),
        interrupt: (_u: BattleUnit, _f: BattleUnit, bp?: number) => log.push(`interrupt ${bp}`),
      } as unknown as SkillHost;
      new SkillSystem(host).applyEffects(caster, repeatHit(kitOf('tangxun', 'archer').ult, i), 'ult', t, t.pos);
      return log;
    };
    expect(run(0)).toEqual(['1:0.30', 'interrupt 60']);
    expect(run(3)).toEqual(['1:0.45']);
    expect(run(4)).toEqual(['1:1.65!', '2:1.00!']);
  });
});
