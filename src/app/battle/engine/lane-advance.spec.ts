import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { OwnedHero } from '../../core/models/hero';
import { StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { combatModifiers, skillRanksOf } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { BattleEngine } from './battle-engine';
import { Grid } from './grid';
import { LANE_ADVANCE_GAP, laneStep } from './pathfinding';

/** user 2026-10-26: at battle start units advance down their placed lane, then close in diagonally */
describe('Lane-first advance', () => {
  it('laneStep walks straight while far, hands over when close or blocked', () => {
    const g = new Grid();
    expect(laneStep(g, { r: 0, c: 2 }, { r: 2, c: 10 })).toEqual({ r: 0, c: 3 });
    expect(laneStep(g, { r: 0, c: 10 }, { r: 2, c: 2 })).toEqual({ r: 0, c: 9 });
    expect(laneStep(g, { r: 0, c: 8 }, { r: 2, c: 10 })).toBeNull();          // within the gap → BFS decides
    g.place(9, { r: 0, c: 3 });
    expect(laneStep(g, { r: 0, c: 2 }, { r: 2, c: 10 })).toBeNull();          // lane cell full
    expect(laneStep(new Grid(), { r: 0, c: 2 }, { r: 2, c: 10 }, c => c.c === 3)).toBeNull();
  });

  it('a melee hero and a monster in different lanes keep their lanes until close', () => {
    const t = HERO_BY_ID['garrick'];
    const h: OwnedHero = { uid: 1, templateId: 'garrick', level: 10, potential: 'B', breakthroughTier: 0 };
    const spec: UnitSpec = { name: t.name, cls: t.cls, heroId: 'garrick', heroUid: 1, sprite: t.sprite,
      stats: { ...heroStats(t, h), hp: 9999 }, mods: combatModifiers(h), skillRanks: skillRanksOf(h), pos: { r: 0, c: 0 } };
    const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'forest_wolf', r: 0, c: 2 }] };
    const e = new BattleEngine({ allies: [spec], stage, enemyTemplates: ENEMIES, seed: 5 });
    const hero = e.units.find(u => u.heroId === 'garrick')!;
    const foe = e.units.find(u => u.side !== 'ally')!;
    const heroLane = hero.pos.r, foeLane = foe.pos.r;
    expect(heroLane).not.toBe(foeLane);
    let closed = false;
    for (let i = 0; i < 400 && !closed; i++) {
      e.step(0.05);
      e.drainEvents();
      if (Math.abs(hero.pos.c - foe.pos.c) > LANE_ADVANCE_GAP) {
        expect(hero.pos.r).withContext(`hero t=${i}`).toBe(heroLane);
        expect(foe.pos.r).withContext(`foe t=${i}`).toBe(foeLane);
      } else closed = true;
    }
    expect(closed).toBeTrue();
  });
});
