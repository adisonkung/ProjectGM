import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID, HEROES } from '../../core/data/heroes';
import { RUN_STRIDE, SHEETS } from '../../core/data/sprites';
import { OwnedHero } from '../../core/models/hero';
import { StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { combatModifiers, skillRanksOf } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { BattleEngine } from './battle-engine';

/** user 2026-10-22: skills wait until the body has arrived in its cell (no sliding cast) · shared run cadence */
describe('Settle before casting + shared run cadence', () => {
  const owned = (id: string): OwnedHero => ({ uid: 1, templateId: id, level: 10, potential: 'B', breakthroughTier: 0 });
  const spec = (id: string): UnitSpec => {
    const t = HERO_BY_ID[id];
    const h = owned(id);
    return { name: t.name, cls: t.cls, heroId: id, heroUid: 1, sprite: t.sprite, stats: { ...heroStats(t, h), hp: 5000 },
      mods: combatModifiers(h), skillRanks: skillRanksOf(h), pos: { r: 0, c: 1 } };
  };

  it('a ready skill is held while the unit still glides into its cell, then fires once it has arrived', () => {
    const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'forest_slime', r: 0, c: 1 }] };
    const e = new BattleEngine({ allies: [spec('garrick')], stage, enemyTemplates: ENEMIES, seed: 3 });
    e.step(0.05);
    e.drainEvents();
    const g = e.units.find(u => u.heroId === 'garrick')!;
    const [f] = e.units.filter(u => u.side !== 'ally');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grid = (e as any).grid;
    const front = { r: g.pos.r, c: g.pos.c + 1 };
    grid.move(f.id, f.pos, front);
    f.pos = front;
    g.x -= 0.6;                                          // still sliding toward its cell
    g.cd1 = 0; g.cd2 = 99; g.mana = 0; g.atkCd = 0; g.castLock = 0;
    e.step(0.05);
    expect(e.drainEvents().some(ev => ev.type === 'cast' && ev.src === g.id)).toBeFalse();
    let cast = false;
    for (let i = 0; i < 40 && !cast; i++) {
      e.step(0.05);
      const ev = e.drainEvents().find(x => x.type === 'cast' && x.src === g.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (ev) { cast = true; expect(Math.abs((e as any).flow.formation.originPosition + g.pos.c - g.x)).toBeLessThan(0.06); }
    }
    expect(cast).toBeTrue();
  });

  it('every hero walk cycle covers the same ground (Draeven cadence: 8 × 85 ms at 1.7 cells/s)', () => {
    expect(SHEETS['hero-draeven.png'].anims.walk!.pace).toBe(1.7);
    for (const h of HEROES.filter(x => x.sprite?.startsWith('hero-') && SHEETS[x.sprite])) {   // legacy fixtures have no sheet
      const w = SHEETS[h.sprite!].anims.walk!;
      const stride = w.pace! * (w.frames * (w.ms ?? 85)) / 1000;
      expect(Math.abs(stride - RUN_STRIDE)).withContext(h.id).toBeLessThan(0.02);
    }
  });
});
