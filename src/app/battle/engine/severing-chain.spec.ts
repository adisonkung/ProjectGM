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
