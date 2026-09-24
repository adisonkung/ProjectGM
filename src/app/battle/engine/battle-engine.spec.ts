import { CLASS_BASE } from '../../core/data/classes';
import { ENEMIES } from '../../core/data/enemies';
import { STAGES } from '../../core/data/stages';
import { UnitSpec } from '../../core/models/unit';
import { BattleEngine, BattleEvent } from './battle-engine';

const strongTeam: UnitSpec[] = [
  { name: 'T', cls: 'tank', stats: { ...CLASS_BASE.tank, hp: 2000, atk: 80 }, pos: { r: 0, c: 1 } },
  { name: 'F', cls: 'fighter', stats: { ...CLASS_BASE.fighter, hp: 1500, atk: 120 }, pos: { r: 0, c: 0 } },
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

  it('starts every unit on its own cell and keeps the grid in sync with positions', () => {
    const e = new BattleEngine({ allies: strongTeam, stage: STAGES[8], enemyTemplates: ENEMIES, seed: 7 });
    const start = e.units.map(u => `${u.pos.r},${u.pos.c}`);
    expect(new Set(start).size).toBe(start.length);
    while (!e.result) {
      e.step(0.05);
      for (const u of e.units.filter(x => x.alive)) expect(e.grid.occupants(u.pos)).toContain(u.id);
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

  it('lets several melee units stack on the same cell while fighting', () => {
    const mob: UnitSpec[] = Array.from({ length: 5 }, (_, i) => ({
      name: `F${i}`, cls: 'fighter' as const, stats: { ...CLASS_BASE.fighter, hp: 3000 }, pos: { r: i % 3, c: i % 3 },
    }));
    const e = new BattleEngine({ allies: mob, stage: STAGES[0], enemyTemplates: ENEMIES, seed: 5 });
    let stacked = false;
    while (!e.result && e.time < 30 && !stacked) {
      e.step(0.05);
      const cells = e.units.filter(u => u.alive).map(u => `${u.pos.r},${u.pos.c}`);
      stacked = new Set(cells).size < cells.length;
    }
    expect(stacked).toBeTrue();
  });

  it('tank ultimate fires once on first contact and shields the whole team', () => {
    const weakTank: UnitSpec[] = [
      { name: 'T', cls: 'tank', stats: { ...CLASS_BASE.tank, hp: 300 }, pos: { r: 0, c: 1 } },
      { name: 'F', cls: 'fighter', stats: CLASS_BASE.fighter, pos: { r: 1, c: 1 } },
      { name: 'A', cls: 'archer', stats: CLASS_BASE.archer, pos: { r: 5, c: 0 } },
    ];
    const e = new BattleEngine({ allies: weakTank, stage: STAGES[9], enemyTemplates: ENEMIES, seed: 2 });
    const ults: BattleEvent[] = [];
    let shielded = false;
    while (!e.result && e.time < 60) {
      e.step(0.05);
      const evs = e.drainEvents();
      // โล่ขึ้นตอนท่าถึงเฟรม hit (impact) ไม่ใช่ตอนเริ่มท่า
      if (evs.some(ev => ev.type === 'impact' && ev.src === 1 && ev.kind === 'ult')) {
        shielded = e.units.filter(u => u.side === 'ally' && u.alive).every(u => u.shield > 0);
      }
      ults.push(...evs.filter(ev => ev.type === 'cast' && ev.src === 1 && ev.kind === 'ult'));
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

  it('lands damage on the hit frame, after the swing starts', () => {
    const e = new BattleEngine({ allies: strongTeam, stage: STAGES[0], enemyTemplates: ENEMIES, seed: 1 });
    const firstAttack = new Map<number, number>();
    let checked = 0;
    while (!e.result && e.time < 30) {
      e.step(0.05);
      for (const ev of e.drainEvents()) {
        if (ev.type === 'attack' && !firstAttack.has(ev.dst)) firstAttack.set(ev.dst, e.time);
        if (ev.type === 'damage' && firstAttack.has(ev.dst) && !ev.poison) {
          expect(e.time).toBeGreaterThan(firstAttack.get(ev.dst)!);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('assassin blinks before its teleport strike lands', () => {
    const team: UnitSpec[] = [
      { name: 'S', cls: 'assassin', sprite: 'hero-shade.png', stats: { ...CLASS_BASE.assassin, hp: 3000 }, pos: { r: 0, c: 1 } },
    ];
    const e = new BattleEngine({ allies: team, stage: STAGES[6], enemyTemplates: ENEMIES, seed: 2 });
    const seq: string[] = [];
    while (!e.result && e.time < 30 && seq.length < 3) {
      e.step(0.05);
      for (const ev of e.drainEvents()) {
        if (ev.type === 'cast' && ev.src === 1 && ev.kind === 'skill') seq.push('cast');
        if (seq.length && ev.type === 'blink' && ev.src === 1) seq.push('blink');
        if (seq.length && ev.type === 'impact' && ev.src === 1 && ev.kind === 'skill') seq.push('impact');
      }
    }
    expect(seq.slice(0, 3)).toEqual(['cast', 'blink', 'impact']);
  });

  it('archer arrows land after they fly, and the 3rd cast rains on every foe once', () => {
    const team: UnitSpec[] = [
      { name: 'T', cls: 'tank', stats: { ...CLASS_BASE.tank, hp: 5000 }, pos: { r: 0, c: 1 } },
      { name: 'A', cls: 'archer', stats: { ...CLASS_BASE.archer, hp: 3000 }, pos: { r: 4, c: 1 } },
    ];
    const e = new BattleEngine({ allies: team, stage: STAGES[4], enemyTemplates: ENEMIES, seed: 6 });
    const kinds: string[] = [];
    let arrows = 0;
    let sky = 0;
    while (!e.result && e.time < 60) {
      e.step(0.05);
      for (const ev of e.drainEvents()) {
        if (ev.type === 'cast' && ev.src === 2) kinds.push(ev.kind);
        if (ev.type === 'projectile' && ev.src === 2) {
          arrows++;
          if (ev.sky) sky++;
          expect(ev.flight).toBeGreaterThan(0);
        }
      }
    }
    expect(arrows).toBeGreaterThan(3);
    expect(sky).toBeGreaterThan(0);
    expect(kinds.slice(0, 3)).toEqual(['skill', 'skill2', 'ult']);
    expect(kinds.filter(k => k === 'ult').length).toBe(1);
  });

  it('healer revives a fallen ally once', () => {
    const team: UnitSpec[] = [
      { name: 'F', cls: 'fighter', stats: { ...CLASS_BASE.fighter, hp: 60 }, pos: { r: 0, c: 1 } },
      { name: 'H', cls: 'healer', stats: { ...CLASS_BASE.healer, hp: 4000 }, pos: { r: 3, c: 1 } },
    ];
    const e = new BattleEngine({ allies: team, stage: STAGES[2], enemyTemplates: ENEMIES, seed: 1 });
    let revives = 0;
    let revivedAlive = false;
    while (!e.result && e.time < 40) {
      e.step(0.05);
      for (const ev of e.drainEvents()) {
        if (ev.type === 'revive') {
          revives++;
          revivedAlive = e.units.find(u => u.id === ev.dst)!.alive;
        }
      }
    }
    expect(revives).toBe(1);
    expect(revivedAlive).toBeTrue();
  });

  it('eliminate floors run 3 waves: advance, regroup at home, then the next wave spawns', () => {
    const e = new BattleEngine({ allies: strongTeam, stage: STAGES[0], enemyTemplates: ENEMIES, seed: 11 });
    expect(e.totalRounds).toBe(3);
    const seen: BattleEvent[] = [];
    let regrouped = true;
    while (!e.result && e.time < 200) {
      e.step(0.05);
      const evs = e.drainEvents();
      seen.push(...evs);
      if (evs.some(ev => ev.type === 'advance')) {
        regrouped &&= e.alive('ally').every(u => u.pos.r === u.home.r && u.pos.c === u.home.c);
      }
    }
    expect(e.result).toBe('win');
    expect(seen.filter(ev => ev.type === 'advance').map(ev => (ev as { round: number }).round)).toEqual([1, 2]);
    expect(seen.filter(ev => ev.type === 'round').length).toBe(2);
    expect(regrouped).toBeTrue();
    expect(e.units.filter(u => u.side === 'enemy').map(u => u.round)).toContain(2);
    // เวลาเดินไม่ถูกนับเป็นเวลาต่อสู้
    expect(e.time - e.fightTime).toBeGreaterThanOrEqual(2 * 2.3);
  });

  it('survive floors stay a single area', () => {
    const e = new BattleEngine({ allies: strongTeam, stage: STAGES[2], enemyTemplates: ENEMIES, seed: 3 });
    expect(e.totalRounds).toBe(1);
  });
});
