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

  it('ultimate waits for a full gauge and the player tap, then the tank shields the whole team', () => {
    const team: UnitSpec[] = [
      { name: 'T', cls: 'tank', stats: { ...CLASS_BASE.tank, hp: 3000 }, pos: { r: 0, c: 1 } },
      { name: 'F', cls: 'fighter', stats: { ...CLASS_BASE.fighter, hp: 3000 }, pos: { r: 1, c: 1 } },
      { name: 'A', cls: 'archer', stats: { ...CLASS_BASE.archer, hp: 3000 }, pos: { r: 5, c: 0 } },
    ];
    const e = new BattleEngine({ allies: team, stage: STAGES[9], enemyTemplates: ENEMIES, seed: 2 });
    const tank = e.units[0];
    expect(e.requestUlt(tank.id)).toBeFalse(); // เกจยังไม่เต็ม
    let ults = 0;
    let shielded = false;
    let tappedAt = -1;
    while (!e.result && e.time < 60 && !shielded) {
      e.step(0.05);
      if (tank.mana >= tank.maxMana && tappedAt < 0) {
        // เต็มแล้วแต่ยังไม่กด: ต้องไม่ร่ายเอง
        e.step(0.5);
        expect(e.drainEvents().some(ev => ev.type === 'cast' && ev.src === tank.id && ev.kind === 'ult')).toBeFalse();
        expect(e.requestUlt(tank.id)).toBeTrue();
        tappedAt = e.time;
      }
      for (const ev of e.drainEvents()) {
        if (ev.type === 'cast' && ev.src === tank.id && ev.kind === 'ult') ults++;
        if (ev.type === 'impact' && ev.src === tank.id && ev.kind === 'ult') {
          shielded = e.units.filter(u => u.side === 'ally' && u.alive).every(u => u.shield > 0);
        }
      }
    }
    expect(tappedAt).toBeGreaterThan(0);
    expect(ults).toBe(1);
    expect(tank.mana).toBeLessThan(tank.maxMana);
    expect(shielded).toBeTrue();
  });

  it('assassin blinks, poisons on cooldown, and executes with a full gauge (auto)', () => {
    const team: UnitSpec[] = [
      { name: 'T', cls: 'tank', stats: { ...CLASS_BASE.tank, hp: 3000 }, pos: { r: 0, c: 1 } },
      { name: 'S', cls: 'assassin', stats: { ...CLASS_BASE.assassin, hp: 2000 }, pos: { r: 0, c: 0 } },
    ];
    const e = new BattleEngine({ allies: team, stage: STAGES[6], enemyTemplates: ENEMIES, seed: 4, autoUlt: true });
    const kinds: string[] = [];
    let poisoned = false;
    while (!e.result && e.time < 90) {
      e.step(0.05);
      for (const ev of e.drainEvents()) {
        if (ev.type === 'cast' && ev.src === 2) kinds.push(ev.kind);
        if (ev.type === 'damage' && ev.poison) poisoned = true;
      }
    }
    expect(kinds).toContain('ult');
    expect(kinds).toContain('skill');
    expect(kinds).toContain('skill2');
    expect(poisoned).toBeTrue();
  });

  it('skills run on cooldowns (skill 1 every 5-8 s, skill 2 every 10-16 s) and never ult without a tap', () => {
    const team: UnitSpec[] = [
      { name: 'F', cls: 'fighter', stats: { ...CLASS_BASE.fighter, hp: 6000 }, pos: { r: 0, c: 1 } },
    ];
    const e = new BattleEngine({ allies: team, stage: STAGES[4], enemyTemplates: ENEMIES, seed: 3 });
    const casts: { kind: string; t: number }[] = [];
    while (!e.result && e.time < 60) {
      e.step(0.05);
      for (const ev of e.drainEvents()) if (ev.type === 'cast' && ev.src === 1) casts.push({ kind: ev.kind, t: e.fightTime });
    }
    const s1 = casts.filter(c => c.kind === 'skill').map(c => c.t);
    const s2 = casts.filter(c => c.kind === 'skill2').map(c => c.t);
    expect(s1.length).toBeGreaterThan(1);
    expect(s2.length).toBeGreaterThan(0);
    for (let i = 1; i < s1.length; i++) expect(s1[i] - s1[i - 1]).toBeGreaterThanOrEqual(5 - 0.06);
    for (let i = 1; i < s2.length; i++) expect(s2[i] - s2[i - 1]).toBeGreaterThanOrEqual(10 - 0.06);
    expect(casts.some(c => c.kind === 'ult')).toBeFalse();
  });

  it('the ultimate gauge carries over to the next wave', () => {
    const e = new BattleEngine({ allies: strongTeam, stage: STAGES[0], enemyTemplates: ENEMIES, seed: 11 });
    let before = -1;
    let after = -1;
    while (!e.result && e.time < 200 && after < 0) {
      e.step(0.05);
      for (const ev of e.drainEvents()) {
        if (ev.type === 'advance') before = e.units[0].mana;
        if (ev.type === 'round') after = e.units[0].mana;
      }
    }
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(before);
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

  it('archer arrows fly, the volley falls from the sky, and the ultimate rains on every foe', () => {
    const team: UnitSpec[] = [
      { name: 'T', cls: 'tank', stats: { ...CLASS_BASE.tank, hp: 5000 }, pos: { r: 0, c: 1 } },
      { name: 'A', cls: 'archer', stats: { ...CLASS_BASE.archer, hp: 3000 }, pos: { r: 4, c: 1 } },
    ];
    const e = new BattleEngine({ allies: team, stage: STAGES[4], enemyTemplates: ENEMIES, seed: 6, autoUlt: true });
    const kinds: string[] = [];
    let arrows = 0;
    let sky = 0;
    while (!e.result && e.time < 90) {
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
    expect(kinds).toContain('skill');
    expect(kinds).toContain('skill2');
    expect(kinds).toContain('ult');
  });

  it('healer ultimate heals the team and revives a fallen ally', () => {
    const team: UnitSpec[] = [
      { name: 'F', cls: 'fighter', stats: { ...CLASS_BASE.fighter, hp: 60 }, pos: { r: 0, c: 1 } },
      { name: 'H', cls: 'healer', stats: { ...CLASS_BASE.healer, hp: 4000 }, pos: { r: 3, c: 1 } },
    ];
    const e = new BattleEngine({ allies: team, stage: STAGES[2], enemyTemplates: ENEMIES, seed: 1, autoUlt: true });
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
    expect(revives).toBeGreaterThan(0);
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
