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
    expect(at('ult', 'CHARGE_PEAK')[0] - at('ult', 'CHARGE_START')[0]).toBe(630);
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

  it('S2 Timeline Sync: strike 1 places the ground hex, the spin loops it in place, strike 2 swaps it for the burst whose peak is the hit', () => {
    const sh = SHEETS['hero-mordrienne.png'];
    const at = (ev: string) => animEvents('hero-mordrienne.png', 'skill2').filter(e => e.event === ev).map(e => Math.round(e.t * 1000));
    expect(at('CAST_START')).toEqual([50]);
    expect(at('VFX_SPAWN')).toEqual([400, 1270]);
    expect(at('CHARGE_START')).toEqual([650]);
    expect(at('DAMAGE')).toEqual([1370]);
    expect(at('RECOVERY_START')).toEqual([1460]);
    expect(sh.anims.skill2!.steps!.reduce((a, b) => a + b, 0)).toBe(1890);
    expect(sh.fx!.skill2).toEqual(['mo-s2-spawn', 'mo-s2-loop', 'mo-s2-burst', 'mo-s2-tip1', 'mo-s2-tip2']);
    // green flash on the wand tip at each strike, riding on her
    const t1 = FX['mo-s2-tip1'], t2 = FX['mo-s2-tip2'];
    expect([t1.at, t1.event, t1.eventIndex, t2.eventIndex, t1.attach, t1.pixelated]).toEqual(['self', 'VFX_SPAWN', 0, 1, true, true]);
    expect([t2.dx, t2.dy]).toEqual([t1.dx, t1.dy]);
    const sp = FX['mo-s2-spawn'], lp = FX['mo-s2-loop'], bu = FX['mo-s2-burst'];
    // all three on the ground plane at the same 2 × 2 area centre, never attached to her or the target
    for (const d of [sp, lp, bu]) {
      expect([d.at, d.groundArea, d.dy, d.layer, d.attach, d.pixelated]).toEqual(['target', 'SQUARE_2', 27.25, 'under', false, true]);
      expect(d.pivot![0]).toBe(0.5);
      expect(d.repeat).toBeUndefined();
    }
    // same ring diameter on the board: ring source px × scale is equal (spawn / loop ring 200 px, burst 250 px)
    expect(200 * sp.scale!).toBeCloseTo(250 * bu.scale!, 6);
    expect(sp.scale).toBe(lp.scale!);
    expect([sp.event, sp.eventIndex, lp.event, bu.event, bu.eventIndex]).toEqual(['VFX_SPAWN', 0, 'CHARGE_START', 'VFX_SPAWN', 1]);
    // spawn ends as the loop starts; the loop's single cycle ends exactly at strike 2; the burst peaks (f3) on the hit
    expect(Math.round(400 + sp.frames * sp.frameMs)).toBe(650);
    expect(650 + lp.frames * lp.frameMs).toBe(1270);
    expect(1270 + 2 * bu.frameMs).toBe(1370);
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

  it('Ult Timeline Sync: circle while drawing, charge on the raise, burst on the ground frame, its peak = the field opening', () => {
    const sh = SHEETS['hero-mordrienne.png'];
    const at = (ev: string) => animEvents('hero-mordrienne.png', 'ult').filter(e => e.event === ev).map(e => Math.round(e.t * 1000));
    expect(at('CAST_START')).toEqual([50]);
    expect(at('CHARGE_START')).toEqual([1030]);
    expect(at('CHARGE_PEAK')).toEqual([1660]);
    expect(at('STRIKE_START')).toEqual([1840]);
    expect(at('VFX_SPAWN')).toEqual([2020]);
    expect(at('DAMAGE')).toEqual([2270]);
    expect(sh.anims.ult!.steps!.reduce((a, b) => a + b, 0)).toBe(2430);
    expect(sh.fx!.ult).toEqual(['mo-ult-circle', 'mo-ult-charge', 'mo-ult-burst']);
    expect(sh.fieldFx).toEqual({ loop: 'mo-ult-field', end: 'mo-ult-field-end' });
    const ci = FX['mo-ult-circle'], ch = FX['mo-ult-charge'], bu = FX['mo-ult-burst'], fl = FX['mo-ult-field'], en = FX['mo-ult-field-end'];
    // the circle is drawn until the raise, the charge holds its peak until the wand-down frame then collapses
    expect([ci.event, Math.round(50 + ci.frames * ci.frameMs)]).toEqual(['CAST_START', 1030]);
    expect([ch.event, 1030 + (ch.frames - 3) * ch.frameMs]).toEqual(['CHARGE_START', 1840]);
    // burst peak f6 = DAMAGE; the loop starts on the burst's last frame and its cycles end with the 6 s field
    expect(2020 + 5 * bu.frameMs).toBe(2270);
    expect(fl.delayMs).toBe(bu.frames * bu.frameMs - 5 * bu.frameMs);
    expect((6000 - fl.delayMs!) / (fl.frames * fl.frameMs)).toBeCloseTo(6, 2);
    for (const d of [bu, fl, en]) {
      expect([d.w, d.h, d.pivot, d.scale, d.dy, d.layer, d.attach, d.pixelated])
        .toEqual([bu.w, bu.h, bu.pivot, bu.scale, 27.25, 'under', false, true]);
    }
  });

  it('FIELD pulseOnStart (generic): pulse 0 at the opening, then every interval, same count over the duration', () => {
    const b = battle([{ enemy: 'forest_slime', r: 0, c: 1 }]);
    const [a] = b.foes();
    b.place(a, { r: 1, c: 11 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.e as any).applyStatus(a, 'root', a, 30);
    b.e.drainEvents();
    const before = a.hp;
    b.e.skills.applyEffects(b.mo, b.kit.ult, 'ult', a, a.pos);
    expect(a.hp).toBeLessThan(before);
    expect(hasStatus(a, 'ash_curse')).toBeTrue();
    const pulses: number[] = [];
    const take = () => { for (const ev of b.e.drainEvents()) if (ev.type === 'FIELD_PULSED') pulses.push(ev.index); };
    take();
    for (let i = 0; i < 140; i++) { b.e.step(0.05); take(); }
    const hits = pulses.length;
    expect(pulses).toEqual([0, 1, 2, 3, 4, 5]);
    expect(hits).toBe(6);
  });

  it('House of Ashes: opening burst only on Hex-Marked foes, then a 6 s curse field (pulse damage + DEF / ATK / cast down)', () => {
    const b = battle([{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 1, c: 1 }]);
    const [a, c] = b.foes();
    b.place(a, { r: 1, c: 11 });
    b.place(c, { r: 2, c: 11 });
    b.e.skills.applyEffects(b.mo, b.kit.skill, 'skill', a, a.pos);
    const hpA = a.hp, hpC = c.hp;
    b.e.skills.applyEffects(b.mo, b.kit.ult, 'ult', a, a.pos);
    // the opening pulse hits both; the Hex Mark burst only the marked one (a takes much more)
    expect(hpA - a.hp).toBeGreaterThan(2 * (hpC - c.hp));
    expect(c.hp).toBeLessThan(hpC);
    const opened = c.hp;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields = (b.e as any).fields;
    expect(fields).toBeDefined();
    // keep both foes inside the field (they would walk out toward her)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const f of [a, c]) (b.e as any).applyStatus(f, 'root', f, 30);
    for (let i = 0; i < 25; i++) b.e.step(0.05);
    expect(c.hp).toBeLessThan(opened);
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
