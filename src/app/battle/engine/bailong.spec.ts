import '../../../testing/legacy-roster';
import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_KITS, HERO_DEFINITIONS, kitOf } from '../../core/data/hero-skills';
import { animEvents, animTiming, FX, FxDef, fxFor, fxNames, fxOffset, impactFeelOf, SHEETS } from '../../core/data/sprites';
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

/** Bai Long vs two slimes in his lane (adjacent + one behind): a skill used by hand at t0 */
function thrust(seed = 7, slot: 'skill' | 'skill2' | 'ult' = 'skill', foeHp = 99999) {
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
  for (const f of foes) f.hp = f.maxHp = foeHp;
  // line them up: hero c, target c+1, the one behind c+2 (same lane)
  (e as any).relocate(hero, { r: 1, c: 5 }, 'blink');
  (e as any).relocate(foes[0], { r: 1, c: 6 }, 'blink');
  (e as any).relocate(foes[1], { r: 1, c: 7 }, 'blink');
  hero.cd1 = hero.cd2 = 99;
  hero.atkCd = 99;
  const t0 = e.time;
  e.skills.use(hero, slot, kitOf('bailong', 'fighter')[slot], foes[0]);
  for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
  for (let i = 0; i < 70; i++) step();
  return { e, log, hero, foes, t0 };
}

describe('Bai Long — data (sheet / clip events / VFX)', () => {
  const sheet = SHEETS[SPRITE];

  it('atlas rows + frame counts: idle 6 · move 8 · hurt 4 · attack 6 · death 7 · Dragon Thrust 10 (2×5)', () => {
    const a = sheet.anims;
    expect([a.idle!.frames, a.walk!.frames, a.hurt!.frames, a.attack!.frames, a.die!.frames, a.skill!.frames]).toEqual([6, 8, 4, 6, 7, 10]);
    expect(new Set(Object.values(a).map(x => x!.row)).size).toBe(8);
    expect(sheet.cols).toBe(19);
    expect(sheet.rows).toBe(8);
    expect(sheet.cellW).toBe(220);
    expect(sheet.cellH).toBe(170);
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
    const v: FxDef = FX[sheet.fx!.skill as string];
    expect(sheet.fx!.skill).toBe(FX_NAME);
    expect(v.file).not.toBe(SPRITE);
    expect(v.frames).toBe(14);
    expect(v.on).toBe('vfx');
    expect(v.at).toBe('self');
    expect(v.orient).toBe('flip');
    expect(v.pivot![0]).toBeLessThan(0.15);
    expect(v.pivot![1]).toBeCloseTo(0.5, 1);
    expect(fxOffset(FX_NAME, SPRITE)[0]).toBeGreaterThan(50); // weapon tip in front of the feet
    expect(fxOffset(FX_NAME, SPRITE)[1]).toBeLessThan(0); // above the feet line
  });

  it('Skill 2 / Ultimate have their own rows and never reuse the Dragon Thrust clip or VFX', () => {
    const rows = ['skill', 'skill2', 'ult'].map(k => (sheet.anims as any)[k].row);
    expect(new Set(rows).size).toBe(3);
    expect(fxNames(SPRITE, 'skill2')).not.toContain(FX_NAME);
    expect(fxNames(SPRITE, 'ult')).not.toContain(FX_NAME);
    expect([sheet.anims.skill2!.frames, sheet.anims.ult!.frames]).toEqual([12, 19]);
  });

  it('every other sheet keeps the old hit-frame timing (events authored only on the remodelled heroes)', () => {
    const withEvents = Object.entries(SHEETS).filter(([, d]) => Object.values(d.anims).some(a => a?.events)).map(([k]) => k);
    expect(withEvents.sort()).toEqual([SPRITE, 'hero-moye.png', 'hero-yuezheng.png'].sort());
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

  it('Dragon Thrust: ground [main][main] — the 2 cells ahead at 180 %, cd 10, same rank table id', () => {
    expect(kit.skill.effects).toEqual([{ type: 'DAMAGE', area: 'FRONT_LINE_2', primary: 1.8 }]);
    expect(kit.skill.cooldown).toBe(fighter.skill2.cooldown);
    expect(kit.skill.id).toBe(fighter.skill2.id);
    expect(kit.skill.slot).toBe('skill');
    expect(kit.attack).toBe(fighter.attack);
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

// ------------------------------------------------------------------ Skill 2 · Sweeping Moon

describe('Bai Long — Sweeping Moon (Skill 2) visuals', () => {
  const at = (n: string, i = 0) => animEvents(SPRITE, 'skill2').find(x => x.event === n && x.index === i)!;

  it('12-frame clip, 1.0–1.3 s; anticipation F5 · activation + VFX F7 · damage F8 (art frames, 1-based)', () => {
    const tm = animTiming(SPRITE, 'skill2');
    expect(tm.total).toBeGreaterThanOrEqual(1.0);
    expect(tm.total).toBeLessThanOrEqual(1.3);
    expect(at('ANTICIPATION_PEAK').frame + 1).toBe(5);
    expect(at('SKILL_ACTIVATE').frame + 1).toBe(7);
    expect(at('VFX_SPAWN').frame + 1).toBe(7);
    expect(at('DAMAGE').frame + 1).toBe(8);
    expect(at('CAST_START').t).toBeLessThan(at('ANTICIPATION_PEAK').t);
    expect(at('RECOVERY_START').t).toBeGreaterThan(at('DAMAGE').t);
    expect(tm.hit).toBeCloseTo(at('DAMAGE').t, 6);
  });

  it('main crescent = separate VFX on VFX_SPAWN at skillOrigin, left-centre pivot, flips; impact FX on hit targets (max 3)', () => {
    expect(fxFor(SPRITE, 'skill2', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['bailong-sweeping-moon']);
    const main = FX['bailong-sweeping-moon'];
    expect([main.at, main.orient, main.anchor]).toEqual(['self', 'flip', 'skillOrigin']);
    expect(main.pivot![0]).toBeLessThan(0.1);
    // ≈ 2–2.5 hero widths forward (hero ≈ 1 cell): frame width × px→cell × scale × FX scale
    const cells = (main.w * 1.25 * main.scale! * 1.5) / 100;
    expect(cells).toBeGreaterThan(1.8);
    expect(cells).toBeLessThan(2.8);
    expect(fxFor(SPRITE, 'skill2', { on: 'impact' })).toEqual(['bailong-sweeping-moon-hit']);
    expect(FX['bailong-sweeping-moon-hit'].at).toBe('target');
    expect(FX['bailong-sweeping-moon-hit'].perHit).toBe(3);
    expect(fxOffset('bailong-sweeping-moon', SPRITE)).toEqual(SHEETS[SPRITE].anchors!['skillOrigin']);
  });

  it('hit-stop 50–70 ms, small shake (below the ultimate final hit)', () => {
    const f = impactFeelOf(SPRITE, 'skill2')!;
    expect(f.hitStopMs!).toBeGreaterThanOrEqual(50);
    expect(f.hitStopMs!).toBeLessThanOrEqual(70);
    expect(f.shakePx!).toBeLessThan(impactFeelOf(SPRITE, 'ult', 2)!.shakePx!);
  });

  it('engine: damage on the DAMAGE event, impact lists every unit hit, events in order', () => {
    const b = thrust(5, 'skill2');
    const evs = b.log.filter(x => x.type === 'animEvent' && x.src === b.hero.id).map(x => (x as any).event);
    expect(evs).toEqual(['CAST_START', 'ANTICIPATION_PEAK', 'SKILL_ACTIVATE', 'VFX_SPAWN', 'DAMAGE', 'IMPACT', 'RECOVERY_START', 'ANIMATION_END']);
    const ids = b.foes.map(f => f.id);
    const dmg = b.log.filter(x => x.type === 'damage' && ids.includes((x as any).dst));
    expect(dmg.length).toBeGreaterThan(0);
    for (const d of dmg) expect(d.t - b.t0).toBeCloseTo(animTiming(SPRITE, 'skill2').hit, 1);
    const imp = b.log.find(x => x.type === 'impact' && x.src === b.hero.id) as any;
    expect(imp.hits.sort()).toEqual([...new Set(dmg.map(d => (d as any).dst))].sort());
  });

  it('kit: ground column in front (up / front / down) at 170 %, cd / id / AI tier of the fighter Spinning Sword', () => {
    const k = HERO_DEFINITIONS['bailong'].kit.skill2;
    const f = CLASS_KITS.fighter.skill;
    expect(k.effects).toEqual([{ type: 'DAMAGE', area: 'FRONT_COLUMN_3', primary: 1.7 }]);
    expect([k.id, k.cooldown, k.target]).toEqual([f.id, f.cooldown, f.target]);
    expect(k.ai!.tier).toBe(f.ai!.tier);
    expect(k.ai!.minTargets).toBe(1); // like S1 / ult: one enemy in the area is enough
    expect(k.label).toBe('Sweeping Moon');
  });
});

// ------------------------------------------------------------------ Ultimate · Nine Dragon Sequence

describe('Bai Long — Nine Dragon Sequence (Ultimate) visuals', () => {
  const ev = () => animEvents(SPRITE, 'ult');
  const at = (n: string, i = 0) => ev().find(x => x.event === n && x.index === i)!;

  it('v3 19-frame dance, 2.0–2.7 s: thrust F5 · sweep F7 · ground contact F17 · overhead gather F14', () => {
    const tm = animTiming(SPRITE, 'ult');
    expect(tm.total).toBeGreaterThanOrEqual(2.0);
    expect(tm.total).toBeLessThanOrEqual(2.7);
    expect([0, 1, 2].map(i => at('DAMAGE', i).art! + 1)).toEqual([5, 7, 17]);
    expect(at('FINAL_ANTICIPATION').art! + 1).toBe(14);
    expect(tm.hits.length).toBe(3);
    const ult = SHEETS[SPRITE].anims.ult!;
    expect(ult.seq!.length).toBe(ult.steps!.length);
    for (const i of [0, 1]) expect(at('STRIKE_START', i).t).toBeLessThan(at('DAMAGE', i).t);
  });

  it('dragon VFX phases: hint (thrust) · emerge (sweep) · ascent (leap, under) · coil (air) · dive on the target before contact', () => {
    const one = (trig: any) => fxFor(SPRITE, 'ult', trig);
    expect(one({ on: 'event', event: 'STRIKE_START', index: 0 })).toEqual(['bl3-hint']);
    expect(one({ on: 'event', event: 'STRIKE_START', index: 1 })).toEqual(['bl3-emerge']);
    expect(one({ on: 'event', event: 'STRIKE_START', index: 2 })).toEqual(['bl3-ascent']);
    expect(one({ on: 'event', event: 'VFX_SPAWN', index: 0 })).toEqual(['bl3-coil']);
    expect(one({ on: 'event', event: 'VFX_SPAWN', index: 1 })).toEqual(['bl3-dive']);
    expect(FX['bl3-ascent'].layer).toBe('under');
    const d = FX['bl3-dive'];
    expect([d.at, d.dx]).toEqual(['self', 100]); // ground-targeted: the cell in front
    // the dive finishes as the spear lands (within one held contact pose)
    const end = at('VFX_SPAWN', 1).t + (d.frames * d.frameMs) / 1000;
    expect(Math.abs(end - at('DAMAGE', 2).t)).toBeLessThan(0.1);
  });

  it('final impact FX only on the last hit; hit-stop / shake escalate (+ flash on the last)', () => {
    expect(fxFor(SPRITE, 'ult', { on: 'impact', hit: 0 })).toEqual([]);
    expect(fxFor(SPRITE, 'ult', { on: 'impact', hit: 1 })).toEqual([]);
    expect(fxFor(SPRITE, 'ult', { on: 'impact', hit: 2 })).toEqual(['bl3-impact', 'bl3-residual']);
    const f = [0, 1, 2].map(i => impactFeelOf(SPRITE, 'ult', i)!);
    expect(f[0].hitStopMs!).toBeGreaterThanOrEqual(20);
    expect(f[2].hitStopMs!).toBeGreaterThanOrEqual(80);
    expect(f[2].hitStopMs!).toBeLessThanOrEqual(110);
    for (let i = 1; i < 3; i++) expect(f[i].shakePx!).toBeGreaterThan(f[i - 1].shakePx!);
    expect(f[2].flashMs!).toBeGreaterThan(0);
  });

  it('balance: ground cross — front cell 280 %, splash 140 % above / below / one further; 3 weights sum to 1', () => {
    const k = HERO_DEFINITIONS['bailong'].kit.ult;
    expect(k.effects).toEqual([{ type: 'DAMAGE', area: 'FRONT_CROSS', primary: 2.8, secondary: 1.4 }]);
    expect([k.id, k.range]).toEqual([CLASS_KITS.fighter.ult.id, 1]);
    const w = k.repeat!.weights!;
    expect(w.length).toBe(3);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('engine: three hits on the three DAMAGE events; per-hit damage follows the weights', () => {
    const b = thrust(3, 'ult');
    const hits = b.log.filter(x => x.type === 'animEvent' && x.src === b.hero.id && (x as any).event === 'DAMAGE') as any[];
    expect(hits.map(h => h.index)).toEqual([0, 1, 2]);
    const want = animTiming(SPRITE, 'ult').hits;
    hits.forEach((h, i) => expect(Math.abs(h.t - b.t0 - want[i])).toBeLessThan(0.11)); // ≤ 2 engine ticks
    const prim = b.foes[0].id;
    const amounts = [0, 1, 2].map(i => b.log.filter(x => x.type === 'damage' && (x as any).dst === prim && Math.abs(x.t - hits[i].t) < 0.06).reduce((a, d: any) => a + d.amount, 0));
    expect(amounts.every(a => a > 0)).toBeTrue();
    // ratio check (±10 % variance + crit per hit → loose)
    expect(amounts[2]).toBeGreaterThan(amounts[0]);
    const impacts = b.log.filter(x => x.type === 'impact' && x.src === b.hero.id) as any[];
    expect(impacts.map(i => i.index)).toEqual([0, 1, 2]);
  });

  it('later hits keep striking the spot when the first hit kills the target (no damage lost vs one hit)', () => {
    const b = thrust(3, 'ult', 30);
    const back = b.foes[1].id;
    const want = animTiming(SPRITE, 'ult').hits;
    const late = b.log.filter(x => x.type === 'damage' && (x as any).dst === back && x.t - b.t0 > want[1] - 0.06);
    expect(late.length).toBeGreaterThan(0);
  });

  it('missing ultimate VFX never changes combat', () => {
    const names = fxNames(SPRITE, 'ult');
    const a = thrust(9, 'ult');
    const saved = names.map(n => FX[n]);
    names.forEach(n => delete (FX as any)[n]);
    try {
      const b = thrust(9, 'ult');
      const pick = (r: ReturnType<typeof thrust>) => r.log.filter(x => x.type === 'damage').map(x => [x.t.toFixed(3), (x as any).amount]);
      expect(pick(b)).toEqual(pick(a));
    } finally {
      names.forEach((n, i) => ((FX as any)[n] = saved[i]));
    }
  });

  it('the hero footprint / logical position never follows the art (no root motion)', () => {
    const b = thrust(4, 'ult');
    expect(b.hero.pos).toEqual({ r: 1, c: 5 });
  });
});
