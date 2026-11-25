import { BattleEngine } from './battle-engine';
import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID, HEROES } from '../../core/data/heroes';
import { animTiming } from '../../core/data/sprites';
import { heroStats } from '../../core/rules/stats';
import { UnitSpec } from '../../core/models/unit';
import { BattlePhase } from './stage/types';

function battle(id = 'bailong', autoUlt = false) {
  const spec = (heroId: string, lane: number): UnitSpec => {
    const h = HERO_BY_ID[heroId];
    return { name: h.name, heroId, cls: h.cls, sprite: h.sprite, pos: { r: 0, c: lane },
      stats: { ...heroStats(h, { uid: lane, templateId: heroId, level: 1, potential: 'B' }), hp: 999999 } };
  };
  const e = new BattleEngine({ allies: [spec(id, 1), spec('garrick', 0)], seed: 8, autoUlt,
    exclusiveUltimates: true, enemyTemplates: ENEMIES,
    stage: { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'forest_slime', r: 0, c: 1 }] } });
  for (const u of e.units) { u.atkCd = u.cd1 = u.cd2 = 999; u.moveCd = 999; }
  while (e.phase !== BattlePhase.COMBAT && e.time < 5) e.step(.05);
  const [hero, other] = e.units.filter(u => u.side === 'ally'), foe = e.units.find(u => u.side === 'enemy')!;
  (e as any).relocate(hero, { r: 1, c: 5 }, 'blink');
  (e as any).relocate(other, { r: 1, c: 4 }, 'blink');
  (e as any).relocate(foe, { r: 1, c: 6 }, 'blink');
  for (const u of e.units) { u.x = u.pos.c; u.y = u.pos.r; u.castLock = 0; u.dashMotion = undefined; }
  foe.hp = foe.maxHp = 999999;
  hero.hp /= 2; // manual healing ultimates have a useful recipient
  hero.mana = hero.maxMana; other.mana = other.maxMana;
  e.drainEvents();
  return { e, hero, other, foe };
}

describe('exclusive party ultimate', () => {
  it('keeps the world, cooldowns, stage clock and older delayed work held while the ultimate lands', () => {
    const { e, hero, other, foe } = battle();
    let oldHit = false;
    e.later(.15, other, () => oldHit = true);
    expect(e.requestUlt(hero.id)).toBeTrue();
    expect(e.requestUlt(other.id)).toBeFalse();
    e.step(.05);
    expect(e.ultimateActor).toBe(hero.id);
    const start = e.time, fight = e.fightTime, cd = other.cd1, position = [other.x, other.y, foe.x, foe.y];
    const hp = foe.hp;
    for (let i = 0; i < 10; i++) e.step(.05);
    expect(e.time).toBeGreaterThan(start);
    expect(e.fightTime).toBe(fight);
    expect(other.cd1).toBe(cd);
    expect([other.x, other.y, foe.x, foe.y]).toEqual(position);
    expect(oldHit).toBeFalse();
    expect(e.requestUlt(other.id)).toBeFalse();
    expect(e.requestSkill(other.id, 'skill')).toBeFalse();
    while (e.ultimateActor != null && e.time - start < 15) e.step(.05);
    expect(e.ultimateActor).toBeNull();
    expect(e.time - start).toBeGreaterThanOrEqual(animTiming(hero.sprite, 'ult').total - .05);
    expect(foe.hp).toBeLessThan(hp);
    expect(oldHit).toBeFalse();
    for (let i = 0; i < 4; i++) e.step(.05);
    expect(oldHit).toBeTrue();
    expect(e.fightTime).toBeGreaterThan(fight);
    expect(e.requestUlt(other.id)).toBeTrue();
    e.dispose();
  });

  for (const h of HEROES) it(`${h.id}: completes the authored ultimate and releases the next cast`, () => {
    const { e, hero, other } = battle(h.id);
    expect(e.requestUlt(hero.id)).toBeTrue();
    e.step(.05);
    expect(e.ultimateActor).toBe(hero.id);
    const start = e.time;
    while (e.ultimateActor != null && e.time - start < 20) e.step(.05);
    expect(e.ultimateActor).toBeNull();
    expect(e.time - start).toBeGreaterThanOrEqual(animTiming(hero.sprite, 'ult').total - .05);
    expect(e.requestUlt(other.id)).toBeTrue();
    e.dispose();
  });

  it('serializes AUTO and gives a pending manual request priority', () => {
    const { e, hero, other } = battle('bailong', true);
    expect(e.requestUlt(other.id)).toBeTrue();
    e.step(.05);
    expect(e.ultimateActor).toBe(other.id);
    expect(hero.mana).toBe(hero.maxMana);
    const before = e.time;
    while (e.ultimateActor != null && e.time - before < 15) e.step(.05);
    e.step(.05);
    expect(e.ultimateActor).toBe(hero.id);
    e.dispose();
    expect(e.ultimateActor).toBeNull();
  });

  it('defers the last-enemy result until the action is complete', () => {
    const { e, hero, foe } = battle();
    e.requestUlt(hero.id); e.step(.05);
    foe.hp = 1;
    const start = e.time;
    while (foe.alive && e.time - start < 10) e.step(.05);
    expect(foe.alive).toBeFalse();
    expect(e.ultimateActor).toBe(hero.id);
    expect(e.result).toBeNull();
    while (e.ultimateActor != null && e.time - start < 15) e.step(.05);
    for (let i = 0; i < 30 && !e.result; i++) e.step(.05);
    expect(e.result).toBe('win');
    e.dispose();
  });
});
