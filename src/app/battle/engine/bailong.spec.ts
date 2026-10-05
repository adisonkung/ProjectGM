import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_KITS, HERO_DEFINITIONS, kitOf } from '../../core/data/hero-skills';
import { animEvents, animTiming, FX, FxDef, impactFeelOf, SHEETS } from '../../core/data/sprites';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { BattleEngine, BattleEvent } from './battle-engine';
import { applyBuff } from './buffs';

/**
 * Bai Long (White Dragon Spear) — visual pipeline on the shared systems: SHEETS clip events → animEvents → engine
 * semantic events (presentation) · DAMAGE timing · separate VFX layer · contact feel · fighter baseline numbers.
 */

const SPRITE = 'hero-bailong.png';
const FX_NAME = 'bailong-dragon-thrust';
const DT = 0.05;
type Ev = BattleEvent & { t: number };

const spec = (id: string, depth = 0, lane = 1): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 900, sprite: t.sprite,
    stats: { ...heroStats(t, { uid: 0, templateId: id, level: 1, potential: 'B' }), hp: 99999 },
    pos: { r: depth, c: lane },
  };
};

/** Bai Long vs two slimes in his lane (adjacent + one behind): Dragon Thrust used by hand at t0 */
function thrust(seed = 7) {
  const enemies: EnemyPlacement[] = [{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 1, c: 1 }];
  const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies };
  const e = new BattleEngine({ allies: [spec('bailong')], stage, enemyTemplates: ENEMIES, seed });
  const log: Ev[] = [];
  const step = () => {
    for (const u of e.units) if (u.alive && u.side === 'enemy') applyBuff(u, STATUS_EFFECTS['stun'], 0, { duration: 1 });
    e.step(DT);
    for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
  };
  step();
  const hero = e.units.find(u => u.heroId === 'bailong')!;
  const foes = e.units.filter(u => u.side === 'enemy');
  for (const f of foes) f.hp = f.maxHp = 99999;
  // line them up: hero c, target c+1, the one behind c+2 (same lane)
  (e as any).relocate(hero, { r: 1, c: 5 }, 'blink');
  (e as any).relocate(foes[0], { r: 1, c: 6 }, 'blink');
  (e as any).relocate(foes[1], { r: 1, c: 7 }, 'blink');
  hero.cd1 = hero.cd2 = 99;
  hero.atkCd = 99;
  const t0 = e.time;
  e.skills.use(hero, 'skill', kitOf('bailong', 'fighter').skill, foes[0]);
  for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
  for (let i = 0; i < 40; i++) step();
  return { e, log, hero, foes, t0 };
}

describe('Bai Long — data (sheet / clip events / VFX)', () => {
  const sheet = SHEETS[SPRITE];

  it('atlas rows + frame counts: idle 6 · move 8 · hurt 4 · attack 6 · death 7 · Dragon Thrust 10 (2×5)', () => {
    const a = sheet.anims;
    expect([a.idle!.frames, a.walk!.frames, a.hurt!.frames, a.attack!.frames, a.die!.frames, a.skill!.frames]).toEqual([6, 8, 4, 6, 7, 10]);
    expect(new Set(Object.values(a).map(x => x!.row)).size).toBe(6);
    expect(sheet.cols).toBe(10);
    expect(sheet.rows).toBe(6);
    expect(sheet.cellW).toBe(200);
    expect(sheet.cellH).toBe(120);
    expect(sheet.pixelated).toBeTrue();
  });

  it('Dragon Thrust character clip lasts 0.8–1.1 s; VFX may outlast it', () => {
    const tm = animTiming(SPRITE, 'skill');
    expect(tm.total).toBeGreaterThanOrEqual(0.8);
    expect(tm.total).toBeLessThanOrEqual(1.1);
    const vfx = FX[FX_NAME];
    const spawn = animEvents(SPRITE, 'skill').find(x => x.event === 'VFX_SPAWN')!.t;
    expect(spawn + (vfx.frames * vfx.frameMs) / 1000).toBeGreaterThan(tm.total);
  });

  it('semantic events are ordered and inside the clip; DAMAGE drives animTiming().hit', () => {
    const ev = animEvents(SPRITE, 'skill');
    const names = ev.map(x => x.event);
    expect(names).toEqual(['CAST_START', 'SKILL_ACTIVATE', 'VFX_SPAWN', 'DAMAGE', 'IMPACT', 'RECOVERY_START', 'ANIMATION_END']);
    for (let i = 1; i < ev.length; i++) expect(ev[i].t).toBeGreaterThanOrEqual(ev[i - 1].t);
    const at = (n: string) => ev.find(x => x.event === n)!.t;
    expect(at('VFX_SPAWN')).toBeLessThan(at('DAMAGE'));
    expect(at('IMPACT')).toBe(at('DAMAGE'));
    expect(animTiming(SPRITE, 'skill').hit).toBeCloseTo(at('DAMAGE'), 6);
    expect(at('ANIMATION_END')).toBeCloseTo(animTiming(SPRITE, 'skill').total, 6);
  });

  it('hit-stop 40–60 ms + small shake are data on the clip', () => {
    const f = impactFeelOf(SPRITE, 'skill')!;
    expect(f.hitStopMs!).toBeGreaterThanOrEqual(40);
    expect(f.hitStopMs!).toBeLessThanOrEqual(60);
    expect(f.shakePx!).toBeGreaterThan(0);
    expect(f.shakePx!).toBeLessThanOrEqual(4);
  });

  it('VFX is a separate layer: own strip, spawns on VFX_SPAWN, left-centre pivot, flips with the owner, anchored ahead of the root', () => {
    const v: FxDef = FX[sheet.fx!.skill!];
    expect(sheet.fx!.skill).toBe(FX_NAME);
    expect(v.file).not.toBe(SPRITE);
    expect(v.frames).toBe(14);
    expect(v.on).toBe('vfx');
    expect(v.at).toBe('self');
    expect(v.orient).toBe('flip');
    expect(v.pivot![0]).toBeLessThan(0.15);
    expect(v.pivot![1]).toBeCloseTo(0.5, 1);
    expect(v.dx!).toBeGreaterThan(50); // weapon tip in front of the feet
    expect(v.dy!).toBeLessThan(0); // above the feet line
  });

  it('Skill 2 / Ultimate do not reuse the Dragon Thrust clip or VFX (not implemented yet)', () => {
    expect(sheet.anims.skill2!.row).toBe(sheet.anims.attack!.row);
    expect(sheet.anims.ult!.row).toBe(sheet.anims.attack!.row);
    expect(sheet.fx!.skill2).toBeUndefined();
    expect(sheet.fx!.ult).toBeUndefined();
    expect(animEvents(SPRITE, 'skill2')).toEqual([]);
  });

  it('every other sheet keeps the old hit-frame timing (no events authored)', () => {
    const withEvents = Object.entries(SHEETS).filter(([, d]) => Object.values(d.anims).some(a => a?.events)).map(([k]) => k);
    expect(withEvents).toEqual([SPRITE]);
  });
});

describe('Bai Long — balance unchanged (fighter baseline)', () => {
  const kit = HERO_DEFINITIONS['bailong'].kit;
  const fighter = CLASS_KITS.fighter;

  it('3★ fighter; stats = fighter formula; range from data, not from the PNG', () => {
    expect(HERO_BY_ID['bailong']).toEqual(jasmine.objectContaining({ cls: 'fighter', star: 3, sprite: SPRITE }));
    const s = (id: string) => heroStats(HERO_BY_ID[id], { uid: 0, templateId: id, level: 1, potential: 'B' });
    expect(s('bailong')).toEqual(s('jin'));
  });

  it('Dragon Thrust = the fighter line thrust numbers (LINE_2 180 % / 120 %, cd 10, same rank table id)', () => {
    expect(kit.skill.effects).toEqual(fighter.skill2.effects);
    expect(kit.skill.cooldown).toBe(fighter.skill2.cooldown);
    expect(kit.skill.id).toBe(fighter.skill2.id);
    expect(kit.skill.slot).toBe('skill');
    expect(kit.attack).toBe(fighter.attack);
    expect(kit.ult.effects).toEqual(fighter.ult.effects);
  });
});

describe('Bai Long — engine (semantic events, damage timing, missing VFX)', () => {
  it('emits CAST_START → SKILL_ACTIVATE → VFX_SPAWN → DAMAGE → IMPACT → RECOVERY_START → ANIMATION_END', () => {
    const b = thrust();
    const evs = b.log.filter(x => x.type === 'animEvent' && x.src === b.hero.id) as (Ev & { event: string; kind?: string })[];
    expect(evs.map(x => x.event)).toEqual(['CAST_START', 'SKILL_ACTIVATE', 'VFX_SPAWN', 'DAMAGE', 'IMPACT', 'RECOVERY_START', 'ANIMATION_END']);
    expect(evs.filter(x => x.event !== 'DAMAGE').every(x => x.kind === 'skill')).toBeTrue();
  });

  it('damage lands at the DAMAGE event (not at cast / VFX spawn) on the target and the one behind', () => {
    const b = thrust();
    const want = animEvents(SPRITE, 'skill').find(x => x.event === 'DAMAGE')!.t;
    const ids = b.foes.map(f => f.id);
    const dmg = b.log.filter(x => x.type === 'damage' && ids.includes((x as any).dst)) as (Ev & { dst: number; amount: number })[];
    expect(dmg.map(d => d.dst).sort()).toEqual(b.foes.map(f => f.id).sort());
    for (const d of dmg) expect(d.t - b.t0).toBeCloseTo(want, 1);
    const spawn = b.log.find(x => x.type === 'animEvent' && (x as any).event === 'VFX_SPAWN')!;
    expect(spawn.t).toBeLessThan(dmg[0].t);
    const impact = b.log.find(x => x.type === 'impact' && x.src === b.hero.id)!;
    expect(impact.t).toBe(dmg[0].t);
  });

  it('a missing VFX never changes combat (same damage / timing without the FX entry)', () => {
    const a = thrust(11);
    const saved = FX[FX_NAME];
    delete (FX as any)[FX_NAME];
    try {
      const b = thrust(11);
      const pick = (r: ReturnType<typeof thrust>) =>
        r.log.filter(x => x.type === 'damage').map(x => [x.t.toFixed(3), (x as any).amount]);
      expect(pick(b)).toEqual(pick(a));
    } finally {
      (FX as any)[FX_NAME] = saved;
    }
  });

  it('a dead caster drops the rest of the clip events', () => {
    const enemies: EnemyPlacement[] = [{ enemy: 'forest_slime', r: 0, c: 1 }];
    const e = new BattleEngine({ allies: [spec('bailong')], stage: { floor: 1, mode: 'eliminate', timeLimit: 999, enemies }, enemyTemplates: ENEMIES, seed: 3 });
    e.step(DT);
    e.drainEvents();
    const hero = e.units.find(u => u.heroId === 'bailong')!;
    const foe = e.units.find(u => u.side === 'enemy')!;
    e.skills.use(hero, 'skill', kitOf('bailong', 'fighter').skill, foe);
    e.step(0.1);
    (e as any).applyDamage(hero, hero.hp + hero.shield + 1, false);
    for (let i = 0; i < 30; i++) e.step(DT);
    const names = e.drainEvents().filter(x => x.type === 'animEvent' && x.src === hero.id).map(x => (x as any).event);
    expect(names).not.toContain('VFX_SPAWN');
    expect(names).not.toContain('DAMAGE');
  });
});
