import { CLASS_BASE } from '../../core/data/classes';
import { ENEMIES } from '../../core/data/enemies';
import { STAGES } from '../../core/data/stages';
import { UnitSpec } from '../../core/models/unit';
import { BattleEngine, BattleEvent } from './battle-engine';

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

  it('tank alternates defense stance and shield charge', () => {
    const e = new BattleEngine({ allies: strongTeam, stage: STAGES[4], enemyTemplates: ENEMIES, seed: 5 });
    const kinds: string[] = [];
    while (!e.result && e.time < 60) {
      e.step(0.05);
      for (const ev of e.drainEvents()) if (ev.type === 'cast' && ev.src === 1 && ev.kind !== 'ult') kinds.push(ev.kind);
    }
    expect(kinds.length).toBeGreaterThan(1);
    kinds.forEach((k, i) => expect(k).toBe(i % 2 ? 'skill2' : 'skill'));
  });

  it('tank ultimate fires once below 40% hp and shields nearby allies', () => {
    const weakTank: UnitSpec[] = [
      { name: 'T', cls: 'tank', stats: { ...CLASS_BASE.tank, hp: 300 }, pos: { r: 0, c: 3 } },
      { name: 'F', cls: 'fighter', stats: CLASS_BASE.fighter, pos: { r: 1, c: 3 } },
    ];
    const e = new BattleEngine({ allies: weakTank, stage: STAGES[9], enemyTemplates: ENEMIES, seed: 2 });
    const ults: BattleEvent[] = [];
    let shielded = false;
    while (!e.result && e.time < 60) {
      e.step(0.05);
      const evs = e.drainEvents().filter(ev => ev.type === 'cast' && ev.kind === 'ult');
      if (evs.length) shielded = e.units.filter(u => u.side === 'ally' && u.alive).every(u => u.shield > 0);
      ults.push(...evs);
    }
    expect(ults.length).toBe(1);
    expect(shielded).toBeTrue();
  });

  it('assassin blinks to the weakest foe, poisons, and executes once', () => {
    const team: UnitSpec[] = [
      { name: 'T', cls: 'tank', stats: { ...CLASS_BASE.tank, hp: 3000 }, pos: { r: 0, c: 3 } },
      { name: 'S', cls: 'assassin', stats: { ...CLASS_BASE.assassin, hp: 2000 }, pos: { r: 0, c: 2 } },
    ];
    const e = new BattleEngine({ allies: team, stage: STAGES[6], enemyTemplates: ENEMIES, seed: 4 });
    const kinds: string[] = [];
    let poisoned = false;
    while (!e.result && e.time < 60) {
      e.step(0.05);
      for (const ev of e.drainEvents()) {
        if (ev.type === 'cast' && ev.src === 2) kinds.push(ev.kind);
        if (ev.type === 'damage' && ev.poison) poisoned = true;
      }
    }
    expect(kinds.filter(k => k === 'ult').length).toBe(1);
    expect(kinds).toContain('skill');
    expect(kinds).toContain('skill2');
    expect(poisoned).toBeTrue();
  });

  it('fighter casts skill, skill2, then its ultimate once', () => {
    const team: UnitSpec[] = [
      { name: 'F', cls: 'fighter', stats: { ...CLASS_BASE.fighter, hp: 4000 }, pos: { r: 0, c: 3 } },
    ];
    const e = new BattleEngine({ allies: team, stage: STAGES[4], enemyTemplates: ENEMIES, seed: 3 });
    const kinds: string[] = [];
    while (!e.result && e.time < 60) {
      e.step(0.05);
      for (const ev of e.drainEvents()) if (ev.type === 'cast' && ev.src === 1) kinds.push(ev.kind);
    }
    expect(kinds.slice(0, 3)).toEqual(['skill', 'skill2', 'ult']);
    expect(kinds.filter(k => k === 'ult').length).toBe(1);
  });
});
