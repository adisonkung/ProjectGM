import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { animTiming } from '../../core/data/sprites';
import { STAGES } from '../../core/data/stages';
import { newGameState } from '../../core/data/starter';
import { OwnedHero } from '../../core/models/hero';
import { StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { combatModifiers, skillRanksOf } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { autoPlace, teamToUnits } from '../../core/rules/team';
import { BattleEngine, BattleUnit } from './battle-engine';

/**
 * user 2026-11-16: "เดินกระตุก ๆ ไม่ลื่นไหล และยังเดินไปตีไป … เดินถึงเป้าค่อยตี หรือเดินให้ถึงระยะตีก่อนค่อยตีหรือสกิล"
 *   · a walking body keeps one steady speed from cell to cell (no dip at every cell border)
 *   · an attack / skill clip never plays on a body that is still travelling (walk → stop → act → walk)
 *   · game timing is unchanged: a unit may still step once the hit of a basic attack is out — the view then drops the
 *     recovery frames for the walk cycle (render/unit-clip.spec.ts)
 */
describe('Combat motion: steady walk, no sliding actions', () => {
  const DT = 0.05;
  const owned = (id: string): OwnedHero => ({ uid: 1, templateId: id, level: 10, potential: 'B', breakthroughTier: 0 });
  const spec = (id: string, pos: { r: number; c: number }, stats: Partial<UnitSpec['stats']> = {}): UnitSpec => {
    const t = HERO_BY_ID[id];
    const h = owned(id);
    return { name: t.name, cls: t.cls, heroId: id, heroUid: 1, sprite: t.sprite, stats: { ...heroStats(t, h), hp: 50000, ...stats },
      mods: combatModifiers(h), skillRanks: skillRanksOf(h), pos };
  };

  /**
   * Runs the battle and returns the largest distance any body travelled while one of its action clips was playing and its
   * logical cell stayed the same (a changed cell = the skill's own movement, a knockback, or the next step after the hit
   * of a basic attack — the view shows the walk cycle from there).
   */
  function worstSlide(e: BattleEngine, seconds: number): { slide: number; who: string; clips: number } {
    const clips = new Map<number, { end: number; x: number; y: number; c: number; r: number; label: string }>();
    let worst = { slide: 0, who: '', clips: 0 };
    while (!e.result && e.time < seconds) {
      const cells = new Map(e.units.map(u => [u.id, u.pos]));
      e.step(DT);
      for (const ev of e.drainEvents()) {
        if (ev.type !== 'attack' && ev.type !== 'cast') continue;
        const u = e.units.find(x => x.id === ev.src)!;
        const kind = ev.type === 'attack' ? 'attack' : ev.kind;
        // the skill moved its caster as it began (charge): that travel is the skill's own movement
        const was = cells.get(u.id);
        if (was && (was.c !== u.pos.c || was.r !== u.pos.r)) { clips.delete(u.id); continue; }
        clips.set(u.id, { end: e.time + animTiming(u.sprite, kind).total, x: u.x, y: u.y, c: u.pos.c, r: u.pos.r, label: `${u.name} ${kind} @${e.time.toFixed(2)}` });
        worst.clips++;
      }
      for (const [id, c] of clips) {
        const u = e.units.find(x => x.id === id) as BattleUnit;
        // monsters: the swing lasts as long as their ATTACKING state
        const playing = u.monster ? u.monster.state === 'ATTACKING' : e.time <= c.end + 1e-9;
        if (!u.alive || !playing || u.pos.c !== c.c || u.pos.r !== c.r || u.dashMotion) { clips.delete(id); continue; }
        const d = Math.hypot(u.x - c.x, u.y - c.y);
        if (d > worst.slide) worst = { ...worst, slide: d, who: c.label };
      }
    }
    return worst;
  }

  it('a walking hero keeps a steady speed across cell borders (no stop-and-go)', () => {
    for (const id of ['kael', 'yuezheng', 'bailong', 'moye']) {
      const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'crossbow_dummy', r: 5, c: 1 }] };
      const e = new BattleEngine({ allies: [spec(id, { r: 5, c: 1 })], stage, enemyTemplates: ENEMIES, seed: 1 });
      const h = e.units.find(u => u.heroId === id)!;
      const speeds: number[] = [];
      let px = h.x, py = h.y, attacked = false;
      while (!attacked && e.time < 20) {
        const combat = e.phase === 'COMBAT';
        e.step(DT);
        attacked = e.drainEvents().some(ev => (ev.type === 'attack' || ev.type === 'cast') && ev.src === h.id);
        const v = Math.hypot(h.x - px, h.y - py) / DT;
        px = h.x; py = h.y;
        if (combat && !attacked && (speeds.length || v > 0)) speeds.push(v);
      }
      // the walk itself: without the first steps (start) and the last ones (arrival)
      const walk = speeds.slice(5, -5);
      expect(walk.length).withContext(id).toBeGreaterThan(40);
      expect(Math.min(...walk)).withContext(`${id} slowest tick of the walk (cells/s) — ${walk.map(v => v.toFixed(1)).join(' ')}`).toBeGreaterThan(h.moveSpeed * 0.85);
      expect(Math.max(...walk)).withContext(id).toBeLessThan(h.moveSpeed * 1.3);
    }
  });

  it('a walking monster keeps a steady speed across cell borders', () => {
    const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'forest_slime', r: 5, c: 1 }] };
    const e = new BattleEngine({ allies: [spec('linxue', { r: 5, c: 1 }, { range: 1 })], stage, enemyTemplates: ENEMIES, seed: 1 });
    const m = e.units.find(u => u.monster)!;
    const speeds: number[] = [];
    let px = m.x, attacked = false;
    while (!attacked && e.time < 20) {
      const combat = e.phase === 'COMBAT';
      e.step(DT);
      attacked = e.drainEvents().some(ev => ev.type === 'attack');
      const v = Math.abs(m.x - px) / DT;
      px = m.x;
      if (combat && !attacked && (speeds.length || v > 0)) speeds.push(v);
    }
    // it stands waiting for its swing after arriving: only the walk counts
    while (speeds.length && speeds[speeds.length - 1] === 0) speeds.pop();
    const walk = speeds.slice(5, -5);
    expect(walk.length).toBeGreaterThan(20);
    expect(Math.min(...walk)).withContext(walk.map(v => v.toFixed(1)).join(' ')).toBeGreaterThan(m.moveSpeed * 0.85);
  });

  it('ranged heroes arrive before they shoot, and stand still for the whole attack clip', () => {
    for (const id of ['tangxun', 'linxue', 'mirelle', 'sylvara']) {
      const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'forest_slime', r: 2, c: 0 }, { enemy: 'forest_slime', r: 4, c: 2 }] };
      const e = new BattleEngine({ allies: [spec(id, { r: 4, c: 1 }), spec('yuezheng', { r: 0, c: 1 })], stage, enemyTemplates: ENEMIES, seed: 2 });
      const w = worstSlide(e, 25);
      expect(w.clips).withContext(id).toBeGreaterThan(5);
      expect(w.slide).withContext(`${id}: ${w.who}`).toBeLessThan(0.06);
    }
  });

  it('melee heroes stand for the swing: they only travel again by taking a real step after the hit', () => {
    // one-hit kills on scattered slimes: after every hit the next target is a walk away
    const enemies = [0, 1, 2, 3, 4, 5].map(i => ({ enemy: 'forest_slime', r: i, c: i % 3 }));
    for (const id of ['kael', 'bailong', 'moye', 'garrick']) {
      const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies };
      const e = new BattleEngine({ allies: [spec(id, { r: 0, c: 1 }, { atk: 99999 })], stage, enemyTemplates: ENEMIES, seed: 4 });
      const w = worstSlide(e, 40);
      expect(w.clips).withContext(id).toBeGreaterThan(3);
      expect(w.slide).withContext(`${id}: ${w.who}`).toBeLessThan(0.06);
    }
  });

  it('a basic attack holds the body until its hit: no step, no drift toward the next stance before the damage', () => {
    const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 3, c: 0 }] };
    const e = new BattleEngine({ allies: [spec('kael', { r: 0, c: 1 }, { atk: 5 })], stage, enemyTemplates: ENEMIES, seed: 1 });   // weak: many swings
    const k = e.units.find(u => u.heroId === 'kael')!;
    const hit = animTiming(k.sprite, 'attack').hit;
    let swings = 0;
    while (!e.result && e.time < 20 && swings < 6) {
      e.step(DT);
      if (!e.drainEvents().some(ev => ev.type === 'attack' && ev.src === k.id)) continue;
      swings++;
      const at = { x: k.x, y: k.y, c: k.pos.c, r: k.pos.r, t: e.time };
      while (e.time < at.t + hit - 1e-9) {
        e.step(DT);
        e.drainEvents();
        expect(k.pos.c === at.c && k.pos.r === at.r).withContext('no step during the wind-up').toBeTrue();
        expect(Math.hypot(k.x - at.x, k.y - at.y)).toBeLessThan(0.01);
      }
    }
    expect(swings).toBeGreaterThan(2);
  });

  it('a real fight (starter team, floors 1 / 3 / 6): no hero or monster clip plays on a travelling body', () => {
    const state = newGameState();
    const heroes = state.team.map(s => state.heroes.find(h => h.uid === s.uid)!).map(h => ({ ...h, level: 6 }));
    for (const floor of [1, 3, 6]) {
      const e = new BattleEngine({ allies: teamToUnits(autoPlace(heroes), heroes), stage: STAGES[floor - 1], enemyTemplates: ENEMIES, seed: 1, autoUlt: true });
      const w = worstSlide(e, 120);
      expect(w.clips).withContext(`floor ${floor}`).toBeGreaterThan(30);
      expect(w.slide).withContext(`floor ${floor}: ${w.who}`).toBeLessThan(0.06);
    }
  });
});
