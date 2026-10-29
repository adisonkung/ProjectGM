import { CLASS_BASE } from '../../core/data/classes';
import { ENEMIES } from '../../core/data/enemies';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { StageDef } from '../../core/models/stage';
import { BattleEngine, BattleEvent, BattleUnit } from './battle-engine';
import { applyBuff } from './buffs';
import { ContactBody, inBasicAttackRange, meleeStandY } from './melee-contact';

const body = (r: number, c: number): ContactBody => ({ pos: { r, c }, x: c, y: r });

describe('Fractional melee contact geometry', () => {
  it('requires half-lane contact, even though diagonal logical cells are adjacent', () => {
    const a = body(1, 6), b = body(2, 7);
    expect(inBasicAttackRange(a, b, 1)).toBeFalse();
    a.y += .25; b.y -= .25;
    expect(inBasicAttackRange(a, b, 1)).toBeTrue();
    a.y -= .1;
    expect(inBasicAttackRange(a, b, 1)).toBeFalse();
  });
  it('allows one mover to close half a cell, up or down; never changes the logical lane', () => {
    const a = body(1, 6);
    expect(meleeStandY(a, body(2, 7))).toBe(1.5);
    expect(meleeStandY(a, body(0, 7))).toBe(.5);
    expect(meleeStandY(a, body(1, 7))).toBe(1);
    expect(a.pos).toEqual({ r: 1, c: 6 });
  });
  it('does not hit early while the bodies are still gliding into adjacent columns', () => {
    const a = body(1, 6), b = body(1, 7);
    a.x = 5.5;
    expect(inBasicAttackRange(a, b, 1)).toBeFalse();
    a.x = 6;
    expect(inBasicAttackRange(a, b, 1)).toBeTrue();
  });
  it('approaches a large boss by the nearest occupied lane rather than its anchor', () => {
    const boss = { ...body(2, 10), footprint: { rows: 3, cols: 2, anchorR: 2, anchorC: 0 } };
    for (const r of [0, 1, 2]) {
      const a = body(r, 9);
      expect(meleeStandY(a, boss)).toBe(r);
      expect(inBasicAttackRange(a, boss, 1)).toBeTrue();
    }
  });
  it('keeps ranged logical reach and monster horizontal swing tolerance', () => {
    const a = body(0, 2), b = body(2, 7);
    expect(inBasicAttackRange(a, b, 5)).toBeTrue();
    expect(inBasicAttackRange(a, b, 4)).toBeFalse();
    const near = body(0, 3); near.x = 3.2;
    expect(inBasicAttackRange(a, near, 1)).toBeFalse();
    expect(inBasicAttackRange(a, near, 1, .25)).toBeTrue();
    near.y = 1;
    expect(inBasicAttackRange(a, near, 1, .25)).toBeFalse();
  });
});

function encounter(heroLane = 1, foeLane = 2) {
  const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'forest_wolf', r: 0, c: 1 }] };
  const e = new BattleEngine({ allies: [{ name: 'Melee', cls: 'fighter', heroId: 'bailong',
    stats: { ...CLASS_BASE.fighter, hp: 99999 }, pos: { r: 0, c: 1 } }], stage, enemyTemplates: ENEMIES, seed: 7 });
  e.step(.05);
  const h = e.units.find(u => u.side === 'ally')!, f = e.units.find(u => u.side !== 'ally')!;
  const place = (u: BattleUnit, r: number, c: number) => (e as any).relocate(u, { r, c }, 'blink');
  place(h, heroLane, 6); place(f, foeLane, 7);
  h.cd1 = h.cd2 = 999; h.mana = 0; h.atkCd = 0; h.castLock = 0;
  f.maxHp = f.hp = 99999; f.castSkills = []; f.monster!.state = 'IDLE'; f.monster!.attackCooldownRemaining = 0;
  e.drainEvents();
  const events: BattleEvent[] = [];
  const tick = () => { e.step(.05); const out = e.drainEvents(); events.push(...out); return out; };
  const run = (n = 40) => { for (let i = 0; i < n; i++) tick(); };
  const stop = (u: BattleUnit, kind: 'root' | 'stun') => applyBuff(u, STATUS_EFFECTS[kind], 0, { duration: 999 });
  return { e, h, f, place, events, tick, run, stop };
}

describe('Melee contact during real combat', () => {
  for (const lane of [0, 2]) it(`walks half a lane toward a stationary foe in lane ${lane} before swinging`, () => {
    const b = encounter(1, lane); b.stop(b.f, 'stun');
    let started = false;
    for (let i = 0; i < 60 && !started; i++) {
      started = b.tick().some(e => e.type === 'attack' && e.src === b.h.id);
      if (started) {
        expect(Math.abs(b.h.y - b.f.y)).toBeLessThanOrEqual(.51);
        expect(Math.abs(b.h.y - 1)).toBeGreaterThanOrEqual(.49);
      }
    }
    expect(started).toBeTrue();
    expect(b.h.pos).toEqual({ r: 1, c: 6 });
  });
  it('both melee sides close fractionally without changing cells before their first attack', () => {
    const b = encounter(); let started = false;
    for (let i = 0; i < 60 && !started; i++) started = b.tick().some(e => e.type === 'attack');
    expect(started).toBeTrue();
    expect(b.h.y).toBeGreaterThan(1.1);
    expect(b.f.y).toBeLessThan(1.9);
    expect(Math.abs(b.h.y - b.f.y)).toBeLessThanOrEqual(.51);
    expect(b.h.pos).toEqual({ r: 1, c: 6 });
    expect(b.f.pos).toEqual({ r: 2, c: 7 });
  });
  it('rooted opponents in diagonal cells cannot close or exchange melee hits', () => {
    const b = encounter(); b.stop(b.h, 'root'); b.stop(b.f, 'root'); b.run();
    expect(b.events.filter(e => e.type === 'attack')).toEqual([]);
    expect(b.h.y).toBe(1); expect(b.f.y).toBe(2);
  });
  it('same-lane contact still attacks without a vertical detour', () => {
    const b = encounter(1, 1); b.stop(b.f, 'stun'); b.run(2);
    expect(b.events.some(e => e.type === 'attack' && e.src === b.h.id)).toBeTrue();
    expect(b.h.y).toBe(1);
  });
  it('a hero misses when its target leaves physical reach during the windup', () => {
    const b = encounter(); b.h.y = 1.5; b.stop(b.h, 'root'); b.stop(b.f, 'stun');
    expect(b.e.skills.basic(b.h, b.f)).toBeTrue();
    b.place(b.f, 0, 7); const hp = b.f.hp;
    b.run(20);
    expect(b.f.hp).toBe(hp);
    expect(b.events.some(e => e.type === 'miss' && e.src === b.h.id)).toBeTrue();
  });
  it('a monster also misses when its target leaves contact during the windup', () => {
    const b = encounter(); b.f.y = 1.5; b.h.castLock = 999;
    let started = false;
    for (let i = 0; i < 30 && !started; i++) started = b.tick().some(e => e.type === 'attack' && e.src === b.f.id);
    expect(started).toBeTrue(); b.place(b.h, 0, 6); const hp = b.h.hp;
    b.run(20);
    expect(b.h.hp).toBe(hp);
    expect(b.events.some(e => e.type === 'miss' && e.src === b.f.id)).toBeTrue();
  });
});
