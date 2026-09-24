import { CLASS_BASE } from '../../core/data/classes';
import { ENEMIES } from '../../core/data/enemies';
import { STAGES } from '../../core/data/stages';
import { UnitSpec } from '../../core/models/unit';
import { BattleEngine } from './battle-engine';

const strongTeam: UnitSpec[] = [
  { name: 'T', cls: 'tank', stats: { ...CLASS_BASE.tank, hp: 2000, atk: 80 }, pos: { r: 0, c: 3 } },
  { name: 'F', cls: 'fighter', stats: { ...CLASS_BASE.fighter, hp: 1500, atk: 120 }, pos: { r: 0, c: 2 } },
  { name: 'A', cls: 'archer', stats: { ...CLASS_BASE.archer, hp: 900, atk: 110 }, pos: { r: 3, c: 1 } },
];

describe('BattleEngine', () => {
  it('a strong team clears floor 1', () => {
    const e = new BattleEngine({ allies: strongTeam, stage: STAGES[0], enemyTemplates: ENEMIES, seed: 1 });
    expect(e.run()).toBe('win');
  });

  it('is deterministic for the same seed', () => {
    const a = new BattleEngine({ allies: strongTeam, stage: STAGES[3], enemyTemplates: ENEMIES, seed: 42 });
    const b = new BattleEngine({ allies: strongTeam, stage: STAGES[3], enemyTemplates: ENEMIES, seed: 42 });
    a.run();
    b.run();
    expect(a.time).toBe(b.time);
    expect(a.result).toBe(b.result);
  });

  it('survive mode wins when the timer runs out', () => {
    const e = new BattleEngine({ allies: strongTeam, stage: STAGES[2], enemyTemplates: ENEMIES, seed: 3 });
    expect(e.run()).toBe('win');
    expect(e.time).toBeGreaterThanOrEqual(STAGES[2].timeLimit - 0.05);
  });

  it('never puts two living units on one cell', () => {
    const e = new BattleEngine({ allies: strongTeam, stage: STAGES[8], enemyTemplates: ENEMIES, seed: 7 });
    while (!e.result) {
      e.step(0.05);
      const cells = e.units.filter(u => u.alive).map(u => `${u.pos.r},${u.pos.c}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });
});
