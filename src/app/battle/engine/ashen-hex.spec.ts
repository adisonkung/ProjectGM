import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_KITS, kitOf } from '../../core/data/hero-skills';
import { HERO_ART } from '../../core/data/hero-art';
import { animEvents, FX, projectileOrigin, SHEETS } from '../../core/data/sprites';
import { OwnedHero } from '../../core/models/hero';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { combatModifiers, skillRanksOf } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { BattleEngine } from './battle-engine';
import { hasFlag, hasStatus, modifier } from './buffs';

/** Mordrienne Vale (Mage — Control / Debuff, Phase A): Hex Mark · Cinderbind Hex · House of Ashes */
describe('Mordrienne Vale (3★ Mage, Phase A)', () => {
  it('31 × 8 atlas 260 × 170: idle 12 · walk 8 · hurt 3 · attack 10 · die 14 · S1 17 · S2 30 · Ult 31 + hex bolt', () => {
    const sh = SHEETS['hero-mordrienne.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH, !!sh.pixelated]).toEqual([31, 8, 260, 170, false]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die', 'skill', 'skill2', 'ult'] as const).map(k => [a[k]!.row, a[k]!.frames]))
      .toEqual([[0, 12], [1, 8], [2, 3], [3, 10], [4, 14], [5, 17], [6, 30], [7, 31]]);
    for (const k of ['attack', 'skill', 'skill2', 'ult'] as const) expect(a[k]!.steps!.length).toBe(a[k]!.frames);
    expect(HERO_BY_ID['mordrienne']).toEqual(jasmine.objectContaining({ cls: 'mage', star: 3, sprite: 'hero-mordrienne.png' }));
    expect(HERO_ART['mordrienne']).toEqual({ portrait: 'portraits/mordrienne.webp' });
    expect(sh.projectile).toEqual({ attack: 'mo-hex-bolt', skill: 'mo-s1-bolt' });
    expect(FX['mo-hex-bolt'].file).toBe('fx-mordrienne-hex-bolt.png');
  });

  it('timings: one release per clip; S2 places the hex before the activation; the Ult holds the charge 0.5 s before the slam', () => {
    const at = (k: 'attack' | 'skill' | 'skill2' | 'ult', ev: string) =>
      animEvents('hero-mordrienne.png', k).filter(e => e.event === ev).map(e => Math.round(e.t * 1000));
    expect(at('attack', 'DAMAGE')).toEqual([280]);
    expect(at('skill', 'DAMAGE')).toEqual([300]);
    expect(at('skill2', 'DAMAGE').length).toBe(1);
    expect(at('skill2', 'VFX_SPAWN')[0]).toBeLessThan(at('skill2', 'CHARGE_START')[0]);
    expect(at('skill2', 'CHARGE_START')[0]).toBeLessThan(at('skill2', 'DAMAGE')[0]);
    expect(at('ult', 'DAMAGE').length).toBe(1);
    expect(at('ult', 'STRIKE_START')[0] - at('ult', 'CHARGE_PEAK')[0]).toBe(500);
    expect(at('ult', 'DAMAGE')[0]).toBeGreaterThan(at('ult', 'STRIKE_START')[0]);
  });

  it('S1 Timeline Sync: charge at the wand tip from 0.05 s to the release 0.30 s, bolt from the muzzle, Hex Mark owned by the status', () => {
    const sh = SHEETS['hero-mordrienne.png'];
    const at = (ev: string) => animEvents('hero-mordrienne.png', 'skill').filter(e => e.event === ev).map(e => Math.round(e.t * 1000));
    expect(at('CAST_START')).toEqual([50]);
    expect(at('DAMAGE')).toEqual([300]);
    expect(at('RECOVERY_START')).toEqual([710]);
    expect(sh.anims.skill!.steps!.reduce((a, b) => a + b, 0)).toBe(1110);
    const ch = FX['mo-s1-charge'];
    expect(sh.fx!.skill).toBe('mo-s1-charge');
    expect([ch.on, ch.delayMs, ch.pixelated]).toEqual(['cast', 50, true]);
    // grows until the release, then collapses in 3 frames — never replays after the launch
    expect(ch.delayMs! + (ch.frames - 3) * ch.frameMs).toBe(300);
    const bolt = FX['mo-s1-bolt'];
    expect(bolt.muzzle).toEqual([91.25, -38.5]);
    expect([bolt.angle0, bolt.noRotate, bolt.pixelated]).toEqual([0, undefined, true]);
    expect(sh.statusFx!['hex_mark']).toEqual({ start: 'mo-s1-mark-in', loop: 'mo-s1-mark' });
    const mi = FX['mo-s1-mark-in'], ml = FX['mo-s1-mark'];
    expect(ml.delayMs).toBe(mi.frames * mi.frameMs);
    expect([mi.attach, ml.attach]).toEqual([true, true]);
    // the muzzle mirrors with the facing
    expect(projectileOrigin('mo-s1-bolt', { x: 3, y: 4 }, 8)).toEqual({ x: 3 + 0.9125, y: 4 - 0.385 });
    expect(projectileOrigin('mo-s1-bolt', { x: 8, y: 4 }, 3)).toEqual({ x: 8 - 0.9125, y: 4 - 0.385 });
    expect(projectileOrigin('mo-hex-bolt', { x: 3, y: 4 }, 8)).toEqual({ x: 3, y: 4 });
  });

  it('kit keeps the Mage class ids + cooldowns; control, not burst: no shield / heal / interrupt / Break', () => {
    const k = kitOf('mordrienne', 'mage');
    const c = CLASS_KITS.mage;
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Ashen Mark', 'Cinderbind Hex', 'House of Ashes']);
    expect([k.skill.id, k.skill2.id, k.ult.id]).toEqual([c.skill.id, c.skill2.id, c.ult.id]);
    expect([k.skill.cooldown, k.skill2.cooldown]).toEqual([c.skill.cooldown, c.skill2.cooldown]);
    for (const s of [k.skill, k.skill2, k.ult]) {
      expect(s.effects.some(e => e.type === 'SHIELD' || e.type === 'HEAL' || e.type === 'INTERRUPT')).toBeFalse();
      expect(s.effects.some(e => e.type === 'DAMAGE' && (!!e.interrupt || !!e.breakPower))).toBeFalse();
    }
  });

  // ---------------------------------------------------------------- engine
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
    const e = new BattleEngine({ allies: [spec('mordrienne', 3, 1)], stage, enemyTemplates: ENEMIES, seed: 3 });
    e.step(0.05);
    e.drainEvents();
    // deterministic damage: mid variance, never a crit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e as any).rng = () => 0.5;
    const mo = e.units.find(u => u.heroId === 'mordrienne')!;
    const foes = () => e.units.filter(u => u.side !== 'ally' && u.alive);
    for (const f of foes()) f.hp = f.maxHp = 1e6;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grid = (e as any).grid;
    const place = (u: { id: number; pos: { r: number; c: number } }, cell: { r: number; c: number }) => { grid.move(u.id, u.pos, cell); u.pos = cell; };
    const kit = kitOf('mordrienne', 'mage');
    return { e, mo, foes, place, kit };
  }

  it('Ashen Mark marks the target; her spells then hit the marked foe ×1.2', () => {
    const b = battle();
    const [f] = b.foes();
    let hp = f.hp;
    b.e.skills.applyEffects(b.mo, b.kit.skill, 'skill', f, f.pos);
    const first = hp - f.hp;
    expect(first).toBeGreaterThan(0);
    expect(hasStatus(f, 'hex_mark')).toBeTrue();
    hp = f.hp;
    b.e.skills.applyEffects(b.mo, b.kit.skill, 'skill', f, f.pos);
    expect((hp - f.hp) / first).toBeCloseTo(1.2, 1);
  });

  it('Cinderbind Hex: AoE + Slow + Cinder Hex (ATK −15 %, cast speed −20 %); only Hex-Marked foes are Rooted', () => {
    const b = battle([{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 1, c: 1 }]);
    const [a, c] = b.foes();
    b.place(a, { r: 1, c: 11 });
    b.place(c, { r: 2, c: 11 });
    b.e.skills.applyEffects(b.mo, b.kit.skill, 'skill', a, a.pos);
    const hpA = a.hp, hpC = c.hp;
    b.e.skills.applyEffects(b.mo, b.kit.skill2, 'skill2', a, a.pos);
    expect(a.hp).toBeLessThan(hpA);
    expect(c.hp).toBeLessThan(hpC);
    expect((hpA - a.hp) / (hpC - c.hp)).toBeCloseTo(1.2, 1);
    for (const f of [a, c]) {
      expect(hasStatus(f, 'slow')).toBeTrue();
      expect(modifier(f, 'attackMultiplier')).toBeCloseTo(0.85, 5);
      expect(modifier(f, 'castSpeedMultiplier')).toBeCloseTo(0.8, 5);
    }
    expect(hasFlag(a, 'root')).toBeTrue();
    expect(hasFlag(c, 'root')).toBeFalse();
  });

  it('House of Ashes: opening burst only on Hex-Marked foes, then a 6 s curse field (pulse damage + DEF / ATK / cast down)', () => {
    const b = battle([{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 1, c: 1 }]);
    const [a, c] = b.foes();
    b.place(a, { r: 1, c: 11 });
    b.place(c, { r: 2, c: 11 });
    b.e.skills.applyEffects(b.mo, b.kit.skill, 'skill', a, a.pos);
    const hpA = a.hp, hpC = c.hp;
    b.e.skills.applyEffects(b.mo, b.kit.ult, 'ult', a, a.pos);
    expect(a.hp).toBeLessThan(hpA);
    expect(c.hp).toBe(hpC);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields = (b.e as any).fields;
    expect(fields).toBeDefined();
    // keep both foes inside the field (they would walk out toward her)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const f of [a, c]) (b.e as any).applyStatus(f, 'root', f, 30);
    for (let i = 0; i < 25; i++) b.e.step(0.05);
    expect(c.hp).toBeLessThan(hpC);
    for (const f of [a, c]) {
      expect(hasStatus(f, 'ash_curse')).toBeTrue();
      expect(modifier(f, 'defenseMultiplier')).toBeCloseTo(0.85, 5);
      expect(modifier(f, 'castSpeedMultiplier')).toBeCloseTo(0.8, 5);
    }
  });

  it('castSpeedMultiplier (generic): a channelled cast under ×0.8 progresses 20 % slower', () => {
    const b = battle();
    const [f] = b.foes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eng = b.e as any;
    const cast = { def: { id: 'test', castTime: 2 }, left: 2, target: null, token: 1, nextProgress: 2, breakDamage: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f as any).casting = { ...cast };
    eng.updateCast(f, 0.5);
    expect((f as any).casting.left).toBeCloseTo(1.5, 5);
    eng.applyStatus(f, 'cinder_hex', b.mo, 4);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f as any).casting = { ...cast };
    eng.updateCast(f, 0.5);
    expect((f as any).casting.left).toBeCloseTo(1.6, 5);
  });
});
