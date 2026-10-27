import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { HERO_ART } from '../../core/data/hero-art';
import { CLASS_KITS, kitOf } from '../../core/data/hero-skills';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { animEvents, FX, fxFor, fxNames, projectileOf, projectileOrigin, SHEETS } from '../../core/data/sprites';
import { OwnedHero } from '../../core/models/hero';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { combatModifiers, skillRanksOf } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { BattleEngine, BattleEvent } from './battle-engine';
import { hasStatus } from './buffs';
import { repeatHit } from './skill-system';

const SPRITE = 'hero-sylas.png';
const ms = (k: 'attack' | 'skill' | 'skill2' | 'ult', ev: string) =>
  animEvents(SPRITE, k).filter(e => e.event === ev).map(e => Math.round(e.t * 1000));

/** Sylas Veyrn — The Dusk Reaver (Archer: Ranged DPS / Hunter / Sharpshooter): Dusk Mark · Reaver Volley · Nightfall Execution */
describe('Sylas Veyrn (3★ Archer) — data / timeline', () => {
  it('23 × 8 atlas 260 × 170: idle 18 · walk 8 · hurt 11 · attack 12 · die 19 · S1 19 · S2 21 · Ult 23', () => {
    const sh = SHEETS[SPRITE];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH, !!sh.pixelated]).toEqual([23, 8, 260, 170, false]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die', 'skill', 'skill2', 'ult'] as const).map(k => [a[k]!.row, a[k]!.frames]))
      .toEqual([[0, 18], [1, 8], [2, 11], [3, 12], [4, 19], [5, 19], [6, 21], [7, 23]]);
    for (const k of ['attack', 'skill', 'skill2', 'ult'] as const) expect(a[k]!.steps!.length).toBe(a[k]!.frames);
    expect(HERO_BY_ID['sylas']).toEqual(jasmine.objectContaining({ cls: 'archer', star: 3, sprite: SPRITE }));
    expect(HERO_ART['sylas']).toEqual({ portrait: 'portraits/sylas.webp' });
    for (const n of fxNames(SPRITE, 'skill').concat(fxNames(SPRITE, 'skill2'), fxNames(SPRITE, 'ult'))) expect(FX[n]).toBeDefined();
  });

  it('timings: basic attack releases 0.245 s · S1 charges 0.20 → release 0.51 · S2 three shots · Ult holds 1.2 s then fires', () => {
    expect(ms('attack', 'DAMAGE')).toEqual([245]);
    expect(ms('skill', 'CHARGE_START')).toEqual([200]);
    expect(ms('skill', 'DAMAGE')).toEqual([510]);
    expect(ms('skill2', 'DAMAGE')).toEqual([270, 495, 835]); // 3rd shot a beat later (user 2026-10-27)
    expect(ms('ult', 'CHARGE_START')).toEqual([560]);
    expect(ms('ult', 'DAMAGE')).toEqual([1760]);
    expect(SHEETS[SPRITE].anims.ult!.steps!.reduce((x, y) => x + y, 0)).toBe(2500);
  });

  it('VFX sync: S1 charge collapses on the release · S2 one muzzle flash per shot · Ult charge + aura last exactly the hold', () => {
    const ch = FX['sy-s1-charge'];
    expect(ms('skill', 'CHARGE_START')[0] + ch.frames * ch.frameMs).toBe(ms('skill', 'DAMAGE')[0] + 10);
    for (const i of [0, 1, 2]) expect(fxFor(SPRITE, 'skill2', { on: 'event', event: 'DAMAGE', index: i })).toEqual([`sy-s2-muzzle${i + 1}`]);
    const hold = ms('ult', 'DAMAGE')[0] - ms('ult', 'CHARGE_START')[0];
    for (const n of ['sy-ult-charge', 'sy-ult-aura']) expect(FX[n].frames * FX[n].frameMs * (FX[n].repeat ?? 1)).toBe(hold);
    expect(fxFor(SPRITE, 'ult', { on: 'event', event: 'CAST_START' })).toEqual(['sy-ult-lock']);
    expect(fxFor(SPRITE, 'ult', { on: 'impact', hit: 0 })).toEqual(['sy-ult-impact', 'sy-ult-flash', 'sy-ult-marked']);
    expect([FX['sy-ult-marked'].bonusOnly, FX['sy-s2-burst'].bonusOnly, FX['sy-s2-burst'].hitIndex]).toEqual([true, true, 2]);
    expect(SHEETS[SPRITE].statusFx!['dusk_mark']).toEqual({ start: 'sy-s1-mark-in', loop: 'sy-s1-mark' });
  });

  it('revision (user 2026-10-27): S2 flashes ahead of the tip + sparks shots 1–2 on the target · Ult recoil / shake / bigger impact', () => {
    for (const i of [1, 2, 3]) expect(FX[`sy-s2-muzzle${i}`].dx).toBeGreaterThan(0);
    expect(fxFor(SPRITE, 'skill2', { on: 'impact', hit: 0 })).toEqual(['sy-s2-hit1']);
    expect(fxFor(SPRITE, 'skill2', { on: 'impact', hit: 1 })).toEqual(['sy-s2-hit2']);
    expect(fxFor(SPRITE, 'skill2', { on: 'impact', hit: 2 })).toEqual(['sy-s2-burst']);
    const ult = SHEETS[SPRITE].anims.ult!;
    expect(ult.eventFeel!.DAMAGE!.shakePx).toBeGreaterThan(0); // the release shakes the screen
    const root = ult.root!;
    expect(Math.min(...root.map(k => k[1]))).toBe(-56); // 0.7 cell back (80 atlas px a cell)
    expect(root[root.length - 1]).toEqual([22.5, 0, 0]); // back home before the clip ends (23 steps)
    expect(root.find(k => k[1] < 0)![0]).toBeGreaterThan(11); // only after the release
    const imp = FX['sy-ult-impact'];
    expect(imp.frames * imp.frameMs + imp.fadeOutMs!).toBeGreaterThan(1000);
    expect(kitOf('sylas', 'archer').ult.projectileSpeed).toBe(1.8);
  });

  it('projectiles: Dusk Bolt from the crossbow tip · S2 two rapid bolts then the Final Piercing Shot (per shot)', () => {
    expect([projectileOf(SPRITE, 'attack'), projectileOf(SPRITE, 'skill'), projectileOf(SPRITE, 'ult')])
      .toEqual(['sy-bolt', 'sy-s1-bolt', 'sy-ult-bolt']);
    expect([0, 1, 2, 5].map(i => projectileOf(SPRITE, 'skill2', i))).toEqual(['sy-s2-bolt', 'sy-s2-bolt', 'sy-s2-final', 'sy-s2-final']);
    expect(projectileOf('hero-mordrienne.png', 'skill', 2)).toBe('mo-s1-bolt');
    expect(FX['sy-s2-final'].overshoot).toBeGreaterThan(0);
    // the muzzle mirrors with the facing
    const o = projectileOrigin('sy-s1-bolt', { x: 3, y: 4 }, 8);
    expect([o.x, o.y]).toEqual([3 + 0.54, 4 - 0.429]);
  });

  it('kit keeps the Archer ids / cooldowns (rank tables), no interrupt; Dusk Mark = an 8 s marker', () => {
    const k = kitOf('sylas', 'archer');
    const c = CLASS_KITS.archer;
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Dusk Mark', 'Reaver Volley', 'Nightfall Execution']);
    expect([k.skill.id, k.skill2.id, k.ult.id]).toEqual([c.skill.id, c.skill2.id, c.ult.id]);
    expect([k.skill.cooldown, k.skill2.cooldown]).toEqual([c.skill.cooldown, c.skill2.cooldown]);
    for (const s of [k.skill, k.skill2, k.ult]) {
      expect(s.effects.some(e => e.type === 'INTERRUPT' || (e.type === 'DAMAGE' && (!!e.interrupt || !!e.breakPower)))).toBeFalse();
    }
    const m = STATUS_EFFECTS['dusk_mark'];
    expect([m.duration, m.stackPolicy, Object.keys(m.modifiers).length]).toEqual([8, 'REFRESH_DURATION', 0]);
  });
});

describe('Sylas Veyrn (3★ Archer) — engine', () => {
  const owned = (templateId: string): OwnedHero => ({ uid: 1, templateId, level: 10, potential: 'B', breakthroughTier: 0 });
  const spec = (id: string, r: number, c: number): UnitSpec => {
    const t = HERO_BY_ID[id];
    const h = owned(id);
    return {
      name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + r * 10 + c, sprite: t.sprite,
      stats: { ...heroStats(t, h), hp: 5000 }, mods: combatModifiers(h), skillRanks: skillRanksOf(h), pos: { r, c },
    };
  };
  function battle(enemies: EnemyPlacement[] = [{ enemy: 'forest_slime', r: 0, c: 1 }]) {
    const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies };
    const e = new BattleEngine({ allies: [spec('sylas', 1, 2)], stage, enemyTemplates: ENEMIES, seed: 3 });
    e.step(0.05);
    e.drainEvents();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e as any).rng = () => 0.5;
    const sy = e.units.find(u => u.heroId === 'sylas')!;
    const foes = () => e.units.filter(u => u.side !== 'ally' && u.alive);
    for (const f of foes()) f.hp = f.maxHp = 1e6;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grid = (e as any).grid;
    const place = (u: { id: number; pos: { r: number; c: number } }, cell: { r: number; c: number }) => { grid.move(u.id, u.pos, cell); u.pos = cell; };
    return { e, sy, foes, place, kit: kitOf('sylas', 'archer') };
  }
  const run = (e: BattleEngine, sec: number) => {
    const out: BattleEvent[] = [];
    for (let t = 0; t < sec; t += 0.05) { e.step(0.05); out.push(...e.drainEvents()); }
    return out;
  };

  it('Dusk Mark marks the target; his attack and skills then hit it ×1.15', () => {
    const b = battle();
    const [f] = b.foes();
    let hp = f.hp;
    b.e.skills.applyEffects(b.sy, b.kit.attack, 'attack', f, f.pos);
    const plain = hp - f.hp;
    hp = f.hp;
    b.e.skills.applyEffects(b.sy, b.kit.skill, 'skill', f, f.pos);
    expect(hasStatus(f, 'dusk_mark')).toBeTrue();
    hp = f.hp;
    b.e.skills.applyEffects(b.sy, b.kit.attack, 'attack', f, f.pos);
    expect((hp - f.hp) / plain).toBeCloseTo(1.15, 1);
  });

  it('Reaver Volley: the final bolt pierces the line; the Marked Burst only lands on a Dusk-Marked target', () => {
    const b = battle([{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 1, c: 1 }]);
    const [a, c] = b.foes();
    b.place(a, { r: 1, c: 6 });
    b.place(c, { r: 1, c: 7 });
    const final = repeatHit(b.kit.skill2, 2);
    const hp0 = a.hp;
    b.e.skills.applyEffects(b.sy, final, 'skill2', a, a.pos);
    const unmarked = hp0 - a.hp;
    run(b.e, 0.2);
    expect(c.hp).toBeLessThan(c.maxHp); // pierced (delayed) hit behind
    b.e.skills.applyEffects(b.sy, b.kit.skill, 'skill', a, a.pos);
    const hp1 = a.hp;
    b.e.skills.applyEffects(b.sy, final, 'skill2', a, a.pos);
    // marked: ×1.15 on the piercing bolt + the burst (1.0 vs 2.0 base)
    expect((hp1 - a.hp) / unmarked).toBeCloseTo(1.15 + 0.5, 1);
  });

  it('S2 in battle: three projectiles (index 0 / 1 / 2 → rapid, rapid, final); the final impact lists the marked target as bonus', () => {
    const b = battle();
    const [f] = b.foes();
    b.place(f, { r: 1, c: 6 });
    b.e.skills.applyEffects(b.sy, b.kit.skill, 'skill', f, f.pos);
    b.sy.cd2 = 0;
    expect(b.e.requestSkill(b.sy.id, 'skill2')).toBeTrue();
    const ev = run(b.e, 2.5);
    const shots = ev.filter(x => x.type === 'projectile' && x.src === b.sy.id && x.kind === 'skill2') as Extract<BattleEvent, { type: 'projectile' }>[];
    expect(shots.map(s => s.index ?? 0)).toEqual([0, 1, 2]);
    expect(shots.map(s => projectileOf(SPRITE, 'skill2', s.index))).toEqual(['sy-s2-bolt', 'sy-s2-bolt', 'sy-s2-final']);
    const imp = ev.filter(x => x.type === 'impact' && x.src === b.sy.id && x.kind === 'skill2') as Extract<BattleEvent, { type: 'impact' }>[];
    expect(imp.find(i => i.index === 2)!.bonus).toContain(f.id);
  });

  it('the Execution Bolt flies 1.8 × faster than his normal bolt (projectileSpeed)', () => {
    const b = battle();
    const [f] = b.foes();
    b.place(f, { r: 1, c: 8 });
    b.sy.mana = b.sy.maxMana;
    expect(b.e.requestUlt(b.sy.id)).toBeTrue();
    const ev = run(b.e, 3);
    const shot = ev.find(x => x.type === 'projectile' && x.src === b.sy.id && x.kind === 'ult') as Extract<BattleEvent, { type: 'projectile' }>;
    const d = Math.max(Math.abs(b.sy.pos.r - f.pos.r), Math.abs(b.sy.pos.c - f.pos.c));
    expect(shot.flight).toBeCloseTo((0.1 + 0.06 * d) / 1.8, 3);
  });

  it('Nightfall Execution: locks the focus, else a Dusk-Marked foe; a marked target takes the execution bonus ×1.4', () => {
    const b = battle([{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 2, c: 1 }]);
    const [a, c] = b.foes();
    b.place(a, { r: 0, c: 6 });
    b.place(c, { r: 2, c: 7 });
    expect(b.e.skills.pickTarget(b.sy, b.kit.ult, a)?.id).toBe(a.id);
    b.e.skills.applyEffects(b.sy, b.kit.skill, 'skill', c, c.pos);
    expect(b.e.skills.pickTarget(b.sy, b.kit.ult, a)?.id).toBe(c.id);
    b.e.setFocus(a.id);
    expect(b.e.skills.pickTarget(b.sy, b.kit.ult, c)?.id).toBe(a.id);
    let hp = a.hp;
    b.e.skills.applyEffects(b.sy, b.kit.ult, 'ult', a, a.pos);
    const plain = hp - a.hp;
    hp = c.hp;
    b.e.skills.applyEffects(b.sy, b.kit.ult, 'ult', c, c.pos);
    expect((hp - c.hp) / plain).toBeCloseTo(1.4, 1);
  });
});
