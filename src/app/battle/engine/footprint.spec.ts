import { ascensionDuel } from '../../core/data/economy';
import { HERO_BY_ID } from '../../core/data/heroes';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { createBattle } from '../battle-session';
import { resolveArea, groundCell } from './area';
import { BattleEvent } from './battle-engine';
import { footprintCells, occupiesCell, unitDistance } from './footprint';
import { distance } from './grid';

const footprint = { cols: 3, rows: 2, anchorC: 1, anchorR: 1 };
const body = { id: 9, pos: { r: 2,c: 11 }, footprint };

function fight(id = 'bailong') {
  const h = HERO_BY_ID[id];
  const ally: UnitSpec = { name: h.name, cls: h.cls, heroId: id, heroUid: 1,
    stats: { ...heroStats(h,{ uid: 1,templateId: id,level: 1,potential: 'B' }),hp: 999999,atk: 1 },pos: { r: 0,c: 2 } };
  const e = createBattle({ allies: [ally],seed: 19,stage: ascensionDuel(1,'aegis_sentinel') });
  const boss = e.units.find(u => u.monster)!, hero = e.units.find(u => !u.monster)!;
  for (const cs of boss.castSkills) cs.cd = Infinity;
  for (const slot of ['skill','skill2','ult'] as const) e.setSkillMode(hero.id,slot,'MANUAL');
  const events: BattleEvent[] = [];
  const run = (seconds: number) => {
    for (let i = 0; i < seconds/.05; i++) {
      e.step(.05);events.push(...e.drainEvents());
      expect(occupiesCell(boss,hero.pos)).withContext(`hero overlaps boss at ${e.time}`).toBeFalse();
    }
  };
  return { e,boss,hero,events,run };
}

describe('logical boss footprint', () => {
  it('reserves three columns and two bottom rows with the boss in the lower middle cell', () => {
    expect(footprintCells(body)).toEqual([
      { r: 1,c: 10 },{ r: 1,c: 11 },{ r: 1,c: 12 },
      { r: 2,c: 10 },{ r: 2,c: 11 },{ r: 2,c: 12 },
    ]);
    expect(unitDistance({ pos: { r: 2,c: 9 } },body)).toBe(1);
    expect(unitDistance({ pos: { r: 2,c: 13 } },body)).toBe(1);
    expect(unitDistance({ pos: { r: 0,c: 11 } },body)).toBe(1);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 16; c++) {
      const a = { pos: { r,c } },b = { pos: { r: 2,c: 11 } };
      expect(unitDistance(a,b)).toBe(distance(a.pos,b.pos));
    }
  });

  it('an area touching several body cells returns one target and retains a main-cell multiplier', () => {
    const caster = { id: 1,pos: { r: 1,c: 9 } },candidates = [body];
    expect(resolveArea({ pattern: 'FRONT_3X3',caster,primary: body,candidates })).toEqual([body]);
    expect(resolveArea({ pattern: 'FRONT_CELL',caster,primary: body,candidates })).toEqual([body]);
    expect(groundCell('FRONT_CELL',caster,body,candidates,body)).toBeTrue();
    expect(resolveArea({ pattern: 'SINGLE',caster,primary: body,candidates })).toEqual([body]);
  });

  it('melee approaches the perimeter, both sides can attack, and no actor walks into the reserved space', () => {
    const s = fight();s.run(20);
    expect(s.boss.pos).toEqual({ r: 2,c: 11 });
    expect(s.boss.footprint).toEqual(footprint);
    expect(s.events.some(e => e.type === 'attack' && e.src === s.hero.id && e.dst === s.boss.id)).toBeTrue();
    expect(s.events.some(e => e.type === 'damage' && e.dst === s.boss.id)).toBeTrue();
    expect(s.events.some(e => e.type === 'attack' && e.src === s.boss.id && e.dst === s.hero.id)).toBeTrue();
    expect(distance(s.hero.pos,s.boss.pos)).toBeGreaterThanOrEqual(2);
    expect(unitDistance(s.hero,s.boss)).toBe(1);
  });

  it('a blink lands behind the body perimeter and can still damage the single boss', () => {
    const s = fight('moye');
    const cell = { r: 2,c: 9 };
    s.e.grid.move(s.hero.id,s.hero.pos,cell);s.hero.pos = cell;s.hero.x = cell.c;s.hero.y = cell.r;
    s.run(.2);s.hero.cd2 = 0;
    expect(s.e.requestSkill(s.hero.id,'skill2')).toBeTrue();
    s.run(5);
    expect(s.events.some(e => e.type === 'blink' && e.src === s.hero.id)).toBeTrue();
    expect(s.hero.pos.c).toBeGreaterThan(s.boss.pos.c+1);
    expect(s.events.some(e => e.type === 'damage' && e.dst === s.boss.id)).toBeTrue();
  });
});
