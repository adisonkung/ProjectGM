import { SHIPPED_HERO_IDS, SHIPPED_STARTER_BENCH, SHIPPED_STARTER_TEAM } from '../../../testing/legacy-roster';
import { HERO_ART } from './hero-art';
import { CLASS_KITS, kitOf } from './hero-skills';
import { HERO_BY_ID } from './heroes';
import { animEvents, animTiming, clipClock, FX, fxFor, SHEETS } from './sprites';
import { fxDuration } from '../../battle/fx-sprite/fx-sprite.component';
import { dropRemovedHeroes, prepare } from '../services/save.service';
import { GameState } from '../models/game-state';
import { newGameState } from './starter';
import { SYLVARA_PRODUCTION } from './sylvara-production';

/** 2026-10 roster remodel: the old roster left the game — Bai Long is the only hero and the template for the new ones */
describe('Roster remodel — Bai Long lead + new heroes', () => {
  it('ships the remodelled roster, keeps the starter team/bench and registers only supplied hero art', () => {
    expect(SHIPPED_HERO_IDS).toEqual(['bailong', 'yuezheng', 'moye', 'tangxun', 'linxue', 'garrick', 'kael', 'mirelle', 'sylvara']);
    expect(SHIPPED_STARTER_TEAM).toEqual(['bailong', 'yuezheng', 'moye', 'tangxun', 'linxue']);
    expect(SHIPPED_STARTER_BENCH).toEqual(['garrick', 'kael']);
    expect(Object.keys(SHEETS).filter(k => k.startsWith('hero-')).sort()).toEqual(['hero-bailong.png', 'hero-garrick.png', 'hero-kael.png', 'hero-linxue.png', 'hero-mirelle.png', 'hero-moye.png', 'hero-sylvara.png', 'hero-tangxun.png', 'hero-yuezheng.png']);
    expect(Object.keys(HERO_ART).sort()).toEqual(['bailong', 'garrick', 'kael', 'linxue', 'mirelle', 'moye', 'sylvara', 'tangxun', 'yuezheng']);
  });

  it('an old save drops heroes whose template is gone: gear back to the bag, team / slots / memory forget them', () => {
    const s = newGameState();
    const gone = { uid: 900, templateId: 'removed_hero', level: 7, potential: 'B' as const,
      gear: { WEAPON: { instanceId: 5, equippedHeroId: 900 } as never } };
    s.heroes.push(gone);
    s.team = [{ uid: 900, r: 0, c: 1 }];
    s.trainingSlots = [900];
    s.heroMemory = { removed_hero: 30, bailong: 10 };
    dropRemovedHeroes(s);
    expect(s.heroes.some(h => h.uid === 900)).toBeFalse();
    expect(s.equipment.map(i => [i.instanceId, i.equippedHeroId])).toEqual([[5, null]]);
    expect(s.team).toEqual([]);
    expect(s.trainingSlots).toEqual([]);
    expect(s.heroMemory).toEqual({ bailong: 10 });
  });

  it('loading a save whose whole team was removed fields the heroes left (and adds Bai Long if missing)', () => {
    const raw = JSON.parse(JSON.stringify(newGameState())) as GameState;
    raw.heroes = [{ uid: 1, templateId: 'removed_hero', level: 3, potential: 'B' }];
    raw.team = [{ uid: 1, r: 0, c: 1 }];
    raw.nextUid = 2;
    const s = prepare(raw)!;
    expect(s.heroes.map(h => h.templateId)).toContain('bailong');
    expect(s.heroes.some(h => h.templateId === 'removed_hero')).toBeFalse();
    expect(s.team.length).toBeGreaterThan(0);
    expect(s.team.every(t => s.heroes.some(h => h.uid === t.uid))).toBeTrue();
    expect(s.heroes.some(h => h.uid === s.island!.mainIslandHeroId)).toBeTrue();
  });
});

describe('Sylvara base art and provisional skill slots', () => {
  it('uses the supplied five base rows; skill production cannot accidentally become final via fallback', () => {
    const sh = SHEETS['hero-sylvara.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH]).toEqual([10, 8, 260, 170]);
    expect((['idle', 'walk', 'hurt', 'attack', 'die'] as const).map(k => [sh.anims[k]!.row, sh.anims[k]!.frames]))
      .toEqual([[0, 5], [1, 7], [2, 4], [3, 7], [4, 6]]);
    expect(sh.anims.attack!.events!.PROJECTILE_SPAWN).toBe(4);
    expect([sh.anims.skill!.row, sh.anims.skill!.frames]).toEqual([5, 10]);
    expect([sh.anims.skill2!.row, sh.anims.skill2!.frames]).toEqual([6, 10]);
    expect(sh.anims.ult!.row).toBe(7);
    expect(animEvents('hero-sylvara.png', 'ult').filter(e => e.event === 'PROJECTILE_SPAWN').length).toBe(1);
    expect(SYLVARA_PRODUCTION.timing).toBe('PROVISIONAL_REVIEW');
    expect(SYLVARA_PRODUCTION.clips.skill.state).toBe('PROVISIONAL_REVIEW');
    expect(SYLVARA_PRODUCTION.clips.skill.finalSync).toBe('AWAITING_REVIEW');
    expect(SYLVARA_PRODUCTION.clips.skill2.state).toBe('PROVISIONAL_REVIEW');
    for (const slot of ['ult'] as const) {
      expect(SYLVARA_PRODUCTION.clips[slot].state).toBe('PROVISIONAL_REVIEW');
    }
    expect(HERO_ART['sylvara']).toEqual({ portrait: 'portraits/sylvara.webp', s1: 'skills/sylvara-s1.webp',
      s2: 'skills/sylvara-s2.webp', ult: 'skills/sylvara-ult.webp', banner: 'banners/sylvara.webp' });
    expect(sh.projectile!.attack).toBe('sw-basic-arrow');
    expect(sh.projectile!.skill).toBe('sw-s1-projectile');
    expect(sh.fx!.skill).toBe('sw-s1-impact');
    expect(sh.fieldFx!.wave!.leadMs).toBe(800);
    expect(Object.keys(FX).filter(k => k.startsWith('sw-')).sort()).toEqual(['sw-basic-arrow', 'sw-s1-impact', 'sw-s1-projectile',
      'sw-s2-impact', 'sw-s2-projectile', 'sw-s2-root-loop', 'sw-s2-root-start',
      'sw-ult-ascent', 'sw-ult-charge', 'sw-ult-field-loop', 'sw-ult-field-start', 'sw-ult-impact', 'sw-ult-rain', 'sw-ult-residual']);
  });

  it('S1 has one release/contact marker and arrival-only impact; basic timing stays unchanged', () => {
    const events = animEvents('hero-sylvara.png', 'skill');
    expect(events.filter(e => e.event === 'PROJECTILE_SPAWN').length).toBe(1);
    expect(events.filter(e => e.event === 'DAMAGE').length).toBe(1);
    expect(animTiming('hero-sylvara.png', 'skill').hit).toBeCloseTo(0.5, 8);
    expect(animTiming('hero-sylvara.png', 'skill').total).toBeCloseTo(10 / 12, 8);
    for (const slot of ['attack'] as const) {
      expect(animTiming('hero-sylvara.png', slot).hit).toBeCloseTo(0.34, 8);
      expect(animTiming('hero-sylvara.png', slot).total).toBeCloseTo(0.595, 8);
    }
    expect(fxFor('hero-sylvara.png', 'skill', { on: 'cast' })).toEqual([]);
    expect(fxFor('hero-sylvara.png', 'skill', { on: 'impact' })).toEqual(['sw-s1-impact']);
  });

  it('Ult releases one arrow before field activation, with no impact burst or damaging projectile', () => {
    const events = animEvents('hero-sylvara.png', 'ult');
    expect(events.find(e => e.event === 'PROJECTILE_SPAWN')!.t).toBeCloseTo(0.7, 8);
    expect(animTiming('hero-sylvara.png', 'ult').hit).toBeCloseTo(1.2, 8);
    expect(animTiming('hero-sylvara.png', 'ult').total).toBeCloseTo(1.4, 8);
    expect(fxFor('hero-sylvara.png', 'ult', { on: 'event', event: 'PROJECTILE_SPAWN' })).toEqual(['sw-ult-ascent']);
    expect(fxFor('hero-sylvara.png', 'ult', { on: 'impact' })).toEqual([]);
    expect(SHEETS['hero-sylvara.png'].projectile!.ult).toBeUndefined();
    expect(SYLVARA_PRODUCTION.clips.ult.finalSync).toBe('AWAITING_REVIEW');
  });

  it('S2 release follows audited F5, keeps arrival-only 2×2 impact and a status-owned stable Root loop', () => {
    const tm = animTiming('hero-sylvara.png', 'skill2');
    expect(tm.hit).toBeCloseTo(4 / 12, 8);
    expect(tm.total).toBeCloseTo(10 / 12, 8);
    expect(SHEETS['hero-sylvara.png'].anims.skill2!.seq).toEqual([0, 1, 2, 3, 4, 5, 5, 7, 8, 9]);
    expect(animEvents('hero-sylvara.png', 'skill2').filter(e => e.event === 'PROJECTILE_SPAWN').length).toBe(1);
    expect(fxFor('hero-sylvara.png', 'skill2', { on: 'cast' })).toEqual([]);
    expect(fxFor('hero-sylvara.png', 'skill2', { on: 'impact' })).toEqual(['sw-s2-impact']);
    expect(FX['sw-s2-impact'].groundArea).toBe('SQUARE_2');
    expect(SHEETS['hero-sylvara.png'].statusFx!['root']).toEqual({ start: 'sw-s2-root-start', loop: 'sw-s2-root-loop' });
    expect([FX['sw-s2-root-loop'].from, FX['sw-s2-root-loop'].frames]).toEqual([5, 5]);
  });
});

/** Yue Zheng — Iron Mountain Bastion (remodel #2): base sheet only, Tank baseline kit with the character's names */
describe('Yue Zheng (3★ Tank, full sheet)', () => {
  it('16 × 8 atlas 260 × 170: idle 6 · walk 8 · hurt 4 · attack 7 (damage F4) · die 6 · S1 10 · S2 12 · Ult Mountain Seal Bastion 16', () => {
    const sh = SHEETS['hero-yuezheng.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH]).toEqual([16, 8, 260, 170]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die'] as const).map(k => [a[k]!.row, a[k]!.frames])).toEqual([[0, 6], [1, 8], [2, 4], [3, 7], [4, 6]]);
    expect(a.attack!.events!.DAMAGE).toBe(3);
    expect([a.skill!.row, a.skill!.frames]).toEqual([5, 10]);
    // sync sheet: activation + main VFX T026, taunt / damage reduction T030 (step 5.4), recovery T048, 1.00 s in all
    expect(a.skill!.events).toEqual(jasmine.objectContaining({ ANTICIPATION_PEAK: 4, SKILL_ACTIVATE: 5, VFX_SPAWN: 5, DAMAGE: 5.4, RECOVERY_START: 7 }));
    const clk = clipClock(a.skill!);
    expect(clk.total).toBeCloseTo(1.0, 6);
    expect(clk.at(5) * 60).toBeCloseTo(26, 0);
    expect(animTiming('hero-yuezheng.png', 'skill').hit * 60).toBeCloseTo(30, 0);
    expect(clk.at(7) * 60).toBeCloseTo(48, 0);
    expect(fxFor('hero-yuezheng.png', 'skill', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['yz-s1-main', 'yz-s1-impact']);
    expect(Math.max(...a.skill!.steps!)).toBe(a.skill!.steps![6]);
    // S2 Tiger Gate Ram: collision F8 (held) = damage / interrupt, the charge move starts on the first step F5
    expect([a.skill2!.row, a.skill2!.frames, a.skill2!.move]).toEqual([6, 12, 4]);
    // sync sheet: rush + main VFX T018, collision (damage / interrupt / stun / impact) T032, recovery T044, 0.87 s
    expect(a.skill2!.events).toEqual(jasmine.objectContaining({ ANTICIPATION_PEAK: 3, STRIKE_START: 4, VFX_SPAWN: 4, DAMAGE: 7, RECOVERY_START: 9 }));
    const c2 = clipClock(a.skill2!);
    expect(c2.total * 60).toBeCloseTo(52, 0);
    expect(c2.at(4) * 60).toBeCloseTo(18, 0);
    expect(animTiming('hero-yuezheng.png', 'skill2').hit * 60).toBeCloseTo(32, 0);
    expect(c2.at(9) * 60).toBeCloseTo(44, 0);
    expect(fxFor('hero-yuezheng.png', 'skill2', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['yz-s2-main']);
    expect(fxFor('hero-yuezheng.png', 'skill2', { on: 'impact' })).toEqual(['yz-s2-impact']);
    // Ult Mountain Seal Bastion: F11 ground contact = the master sync frame (damage / interrupt / shields / taunt)
    expect([a.ult!.row, a.ult!.frames]).toEqual([7, 16]);
    expect(a.ult!.events).toEqual(jasmine.objectContaining({ STRIKE_START: 7, DAMAGE: 10, IMPACT: 10, RECOVERY_START: 13 }));
    const cu = clipClock(a.ult!);
    // sync sheet: 2.20 s · charge T040 · descent T096 · ground contact T100 (impact held to T130, no Main sheet) · recovery T122
    expect(cu.total * 60).toBeCloseTo(132, 0);
    expect(animTiming('hero-yuezheng.png', 'ult').hit * 60).toBeCloseTo(100, 0);
    const ev = (e: string) => animEvents('hero-yuezheng.png', 'ult').find(x => x.event === e)!.t * 60;
    expect(ev('CHARGE_START')).toBeCloseTo(40, 0);
    expect(ev('STRIKE_START')).toBeCloseTo(96, 0);
    expect(animEvents('hero-yuezheng.png', 'ult').some(x => x.event === 'VFX_SPAWN')).toBeFalse();
    expect(ev('RECOVERY_START')).toBeCloseTo(122, 0);
    expect(fxFor('hero-yuezheng.png', 'ult', { on: 'event', event: 'CHARGE_START' })).toEqual(['yz-ult-charge']);
    expect(fxFor('hero-yuezheng.png', 'ult', { on: 'impact' })).toEqual(['yz-ult-impact', 'yz-ult-field-back', 'yz-ult-field-front']);
    expect(fxFor('hero-yuezheng.png', 'ult', { on: 'event', event: 'VFX_SPAWN' })).toEqual([]);
    expect(FX['yz-ult-main-back']).toBeUndefined();
    // impact sustains to T130: 16 frames × 33 ms ≈ 0.53 s
    expect(fxDuration('yz-ult-impact')).toBeGreaterThan(500);
    // the field loops as long as the taunt lasts (≈ 3 s), 18 frames after the hit
    expect(fxDuration('yz-ult-field-back')).toBeGreaterThan(3000);
    expect(FX['yz-ult-field-back'].delayMs! * 60 / 1000).toBeCloseTo(18, 0);
    expect(HERO_BY_ID['yuezheng']).toEqual(jasmine.objectContaining({ cls: 'tank', star: 3, sprite: 'hero-yuezheng.png' }));
  });

  it('fights with the Tank kit (ids / numbers / cooldowns unchanged) under its own skill names', () => {
    const k = kitOf('yuezheng', 'tank');
    for (const slot of ['skill', 'skill2', 'ult'] as const) {
      const { name: _n, label: _l, ...rest } = k[slot];
      const { name: _tn, label: _tl, ...base } = CLASS_KITS.tank[slot];
      expect(rest).toEqual(base);
    }
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Iron Wall Taunt', 'Tiger Gate Ram', 'Mountain Seal Bastion']);
    expect(HERO_ART['yuezheng']).toEqual({
      portrait: 'portraits/yuezheng.webp', s1: 'skills/yuezheng-s1.webp', s2: 'skills/yuezheng-s2.webp',
      ult: 'skills/yuezheng-ult.webp', banner: 'banners/yuezheng.webp',
    });
  });
});

/** Mo Ye — Shadow Orchid Blade (remodel #3): base sheet only, Assassin class ids / numbers arranged to her skills */
describe('Mo Ye (3★ Assassin, base sheet)', () => {
  it('10 × 8 atlas 260 × 170: idle 6 · walk 8 · hurt 4 · attack 8 (damage F4) · die 7 · S1 Orchid Sever 10 · S2 Phantom Step 10 · Ult Thousand Petal Execution 16', () => {
    const sh = SHEETS['hero-moye.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH]).toEqual([16, 8, 260, 170]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die'] as const).map(k => [a[k]!.row, a[k]!.frames])).toEqual([[0, 6], [1, 8], [2, 4], [3, 8], [4, 7]]);
    expect(a.attack!.events!.DAMAGE).toBe(3);
    expect([a.skill!.row, a.skill!.frames]).toEqual([5, 10]);
    expect([a.ult!.row, a.ult!.frames]).toEqual([7, 16]);
    expect(HERO_BY_ID['moye']).toEqual(jasmine.objectContaining({ name: 'โม่เย่', cls: 'assassin', star: 3, sprite: 'hero-moye.png' }));
    expect(HERO_ART['moye']).toEqual(jasmine.objectContaining({ portrait: 'portraits/moye.webp', banner: 'banners/moye.webp' }));
  });

  it('Orchid Sever = 2 cuts on the current target · Phantom Step = blink behind + strike · Thousand Petal Execution = flurry + final hit', () => {
    const k = kitOf('moye', 'assassin');
    const c = CLASS_KITS.assassin;
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Orchid Sever', 'Phantom Step', 'Thousand Petal Execution']);
    // class ids + cooldowns → the skill rank tables / costs apply unchanged
    expect([k.skill.id, k.skill2.id, k.ult.id]).toEqual([c.skill.id, c.skill2.id, c.ult.id]);
    expect([k.skill.cooldown, k.skill2.cooldown]).toEqual([c.skill.cooldown, c.skill2.cooldown]);
    expect(k.skill.movement).toBeUndefined();
    expect(k.skill.repeat!.count).toBe(2);
    expect(k.skill.effects).toEqual(c.skill.effects);
    expect(k.skill2.movement).toEqual({ type: 'BLINK_BEHIND' });
    expect(k.skill2.effects.some(e => e.type === 'APPLY_STATUS')).toBeFalse();
    expect(k.ult.repeat!.count).toBe(4);
    expect(k.ult.repeat!.weights).toEqual([0.15, 0.15, 0.2, 0.5]);
    expect(k.ult.repeat!.weights!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(k.ult.effects).toEqual(c.ult.effects);
  });

  it('S1 Orchid Sever on its Timeline Sync Sheet: 0.80 s, hit 1 T012 (big blade) · hit 2 T024 (small blade), FX on the target per hit', () => {
    const c = clipClock(SHEETS['hero-moye.png'].anims.skill!);
    expect(c.total * 60).toBeCloseTo(48, 0);
    const ev = (e: string) => animEvents('hero-moye.png', 'skill').filter(x => x.event === e).map(x => Math.round(x.t * 60));
    expect(ev('DAMAGE')).toEqual([12, 24]);
    expect(ev('ANTICIPATION_PEAK')).toEqual([6]);
    expect(ev('STRIKE_START')).toEqual([8, 20]);
    expect(ev('RECOVERY_START')).toEqual([40]);
    expect(animTiming('hero-moye.png', 'skill').hit * 60).toBeCloseTo(12, 0);
    // the kit's two cuts land on the clip's two DAMAGE events
    expect(kitOf('moye', 'assassin').skill.repeat!.count).toBe(2);
    expect(fxFor('hero-moye.png', 'skill', { on: 'impact', hit: 0 }).sort()).toEqual(['my-s1-impact1', 'my-s1-main']);
    expect(fxFor('hero-moye.png', 'skill', { on: 'impact', hit: 1 })).toEqual(['my-s1-impact2']);
    expect(['my-s1-main', 'my-s1-impact1', 'my-s1-impact2'].every(k => FX[k].at === 'target')).toBeTrue();
    expect(FX['my-s1-impact2'].h).toBeGreaterThan(FX['my-s1-impact1'].h);
  });

  it('S2 Phantom Step on its Timeline Sync Sheet: 0.97 s, vanish T008 · blink T025 · reappear T028 · strike damage T040, opacity runtime', () => {
    const clip = SHEETS['hero-moye.png'].anims.skill2!;
    const c = clipClock(clip);
    expect(c.total * 60).toBeCloseTo(58, 0);
    const ev = (e: string) => animEvents('hero-moye.png', 'skill2').filter(x => x.event === e).map(x => Math.round(x.t * 60));
    expect(ev('CAST_START')).toEqual([0]);
    expect(ev('ANTICIPATION_PEAK')).toEqual([6]);
    expect(ev('VANISH_START')).toEqual([8]);
    expect(ev('VFX_SPAWN')).toEqual([10]);
    expect(ev('REAPPEAR_START')).toEqual([28]);
    expect(ev('STRIKE_START')).toEqual([36]);
    expect(ev('DAMAGE')).toEqual([40]);
    expect(ev('RECOVERY_START')).toEqual([46]);
    const tm = animTiming('hero-moye.png', 'skill2');
    expect(tm.move * 60).toBeCloseTo(25, 0);          // the engine's BLINK_BEHIND relocation
    expect(tm.hit * 60).toBeCloseTo(40, 0);
    // opacity keys (step → %): 100 → 80 T008 → 45 T010 → ≤ 15 while travelling → 20 T025 → 55 T028 → 80 T030 → 100 T032
    const op = (t: number) => {
      const k = clip.opacity!.map(([s, o]) => [c.at(s) * 60, o]);
      for (let i = 0; i < k.length - 1; i++) if (k[i][0] <= t && t <= k[i + 1][0]) return k[i][1] + ((k[i + 1][1] - k[i][1]) * (t - k[i][0])) / (k[i + 1][0] - k[i][0] || 1);
      return k[k.length - 1][1];
    };
    expect([0, 8, 10, 25, 28, 30, 32, 50].map(t => Math.round(op(t) * 100))).toEqual([100, 80, 45, 20, 55, 80, 100, 100]);
    for (let t = 12; t <= 24; t++) expect(op(t)).toBeLessThanOrEqual(0.15);
    // trail at her origin from VFX_SPAWN · cluster where she comes back · X burst on the target, bigger than S1's
    expect(fxFor('hero-moye.png', 'skill2', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['my-s2-main']);
    expect(fxFor('hero-moye.png', 'skill2', { on: 'event', event: 'REAPPEAR_START' })).toEqual(['my-s2-reappear']);
    expect(fxFor('hero-moye.png', 'skill2', { on: 'impact' })).toEqual(['my-s2-impact']);
    expect([FX['my-s2-main'].at, FX['my-s2-reappear'].at, FX['my-s2-impact'].at]).toEqual(['self', 'self', 'target']);
    expect(FX['my-s2-main'].pivot![0]).toBeLessThan(0.05);
    expect(FX['my-s2-impact'].h).toBeGreaterThan(FX['my-s1-impact2'].h);
    expect(fxDuration('my-s2-main', 1)).toBeLessThan((35 - 10) * (1000 / 60) + 40);
  });

  it('Ult Thousand Petal Execution on its Timeline Sync Sheet: 2.10 s, blink T024 · hits T032 / T048 / T064 · FINAL T104 heaviest', () => {
    const clip = SHEETS['hero-moye.png'].anims.ult!;
    const c = clipClock(clip);
    expect(c.total * 60).toBeCloseTo(126, 0);
    const ev = (e: string) => animEvents('hero-moye.png', 'ult').filter(x => x.event === e).map(x => Math.round(x.t * 60));
    expect(ev('ANTICIPATION_PEAK')).toEqual([8]);
    expect(ev('VANISH_START')).toEqual([12]);
    expect(ev('VFX_SPAWN')).toEqual([16]);
    expect(ev('REAPPEAR_START')).toEqual([28]);
    expect(ev('STRIKE_START')).toEqual([30, 44, 58, 96]);
    expect(ev('DAMAGE')).toEqual([32, 48, 64, 104]);
    expect(ev('CHARGE_START')).toEqual([80]);
    expect(ev('FINAL_ANTICIPATION')).toEqual([88]);
    expect(ev('RECOVERY_START')).toEqual([118]);
    const tm = animTiming('hero-moye.png', 'ult');
    expect(tm.move * 60).toBeCloseTo(24, 0);
    expect(tm.hits.length).toBe(kitOf('moye', 'assassin').ult.repeat!.count);
    // runtime root: leap peak about −62 px around T094, back on the ground for the final hit, nothing left at the end
    const at = (t: number) => clip.root!.reduce((best, k) => (Math.abs(c.at(k[0]) * 60 - t) < Math.abs(c.at(best[0]) * 60 - t) ? k : best));
    expect(at(94)[2]).toBeLessThanOrEqual(-58);
    expect(at(104)[2]).toBe(0);
    expect(clip.root![clip.root!.length - 1].slice(1)).toEqual([0, 0]);
    expect(Math.max(...clip.root!.map(k => k[1]))).toBeLessThanOrEqual(24);
    // final hit pauses / shakes the most
    const imp = clip.impact as { hitStopMs: number; shakePx: number }[];
    expect(imp.length).toBe(4);
    expect(imp[3].hitStopMs).toBeGreaterThan(Math.max(...imp.slice(0, 3).map(i => i.hitStopMs)));
    expect(imp[3].shakePx).toBeGreaterThanOrEqual(8);
    expect(fxFor('hero-moye.png', 'ult', { on: 'impact', hit: 3 }).sort()).toEqual(['my-ult-impact', 'my-ult-residual']);
    expect(fxFor('hero-moye.png', 'ult', { on: 'impact', hit: 0 })).toEqual([]);
    expect(fxFor('hero-moye.png', 'ult', { on: 'event', event: 'STRIKE_START', index: 3 })).toEqual(['my-ult-descent']);
    expect(fxFor('hero-moye.png', 'ult', { on: 'event', event: 'CHARGE_START' })).toEqual(['my-ult-aura']);
    expect(FX['my-ult-impact'].w).toBeGreaterThan(FX['my-s2-impact'].w);
    expect(FX['my-ult-residual'].delayMs).toBeCloseTo(167, -1);
  });
});

/** Tang Xun — Whispering Blade (remodel #4): base sheet only, Archer class ids arranged to his hidden-weapon skills */
describe('Tang Xun (3★ ranged hidden-weapon specialist, base sheet)', () => {
  it('17 × 8 atlas 260 × 170: idle 6 · run 8 · hurt 3 · throw 8 (release F5) · die 6 · S1 10 · S2 16 · Ult 17 · knife projectile, no bow', () => {
    const sh = SHEETS['hero-tangxun.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH]).toEqual([17, 8, 260, 170]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die'] as const).map(k => [a[k]!.row, a[k]!.frames])).toEqual([[0, 6], [1, 8], [2, 3], [3, 8], [4, 6]]);
    expect(a.attack!.events!.DAMAGE).toBe(4);
    expect([a.skill!.row, a.skill!.frames]).toEqual([5, 10]);
    expect([a.skill2!.row, a.skill2!.frames]).toEqual([6, 16]);
    expect([a.ult!.row, a.ult!.frames]).toEqual([7, 17]);
    expect(sh.projectile!.attack).toBe('tangxun-knife');
    expect(FX['tangxun-knife'].angle0).toBe(0);
    expect(HERO_BY_ID['tangxun']).toEqual(jasmine.objectContaining({ name: 'ถังซวิ่น', cls: 'archer', star: 3, sprite: 'hero-tangxun.png' }));
    expect(HERO_ART['tangxun']).toEqual(jasmine.objectContaining({ portrait: 'portraits/tangxun.webp', banner: 'banners/tangxun.webp' }));
  });

  it('Piercing Fang = 1×3 line, first target hardest · Severing Chain = anti-cast · Blade Array = focused, not full-screen', () => {
    const k = kitOf('tangxun', 'archer');
    const c = CLASS_KITS.archer;
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Piercing Fang', 'Severing Chain', 'Heaven-Snaring Blade Array']);
    expect([k.skill.id, k.skill2.id, k.ult.id]).toEqual([c.skill.id, c.skill2.id, c.ult.id]);
    expect([k.skill.cooldown, k.skill2.cooldown]).toEqual([c.skill.cooldown, c.skill2.cooldown]);
    const s1 = k.skill.effects[0] as { area: string; primary: number; secondary: number };
    expect(s1.area).toBe('LINE_3');
    expect(s1.primary).toBeGreaterThan(s1.secondary);
    expect(k.skill2.effects.some(e => e.type === 'INTERRUPT')).toBeTrue();
    expect(k.skill2.target).toBe('CASTING_INTERRUPTIBLE');
    expect(k.ult.effects.every(e => e.type !== 'DAMAGE' || e.area !== 'ALL_ENEMIES')).toBeTrue();
    expect([k.ult.target, ...(k.ult.fallback ?? [])].slice(0, 2)).toEqual(['FOCUS', 'MARKED']);
  });

  it('S1 Piercing Fang on its Timeline Sync Sheet: 0.77 s, release T019, one blade (projectile + overshoot), hits T030 / T034 / T036', () => {
    const clip = SHEETS['hero-tangxun.png'].anims.skill!;
    expect(clipClock(clip).total * 60).toBeCloseTo(46, 0);
    const ev = (e: string) => animEvents('hero-tangxun.png', 'skill').filter(x => x.event === e).map(x => Math.round(x.t * 60));
    expect(ev('ANTICIPATION_PEAK')).toEqual([12]);
    expect(ev('STRIKE_START')).toEqual([16]);
    expect(ev('DAMAGE')).toEqual([19]);
    expect(ev('RECOVERY_START')).toEqual([41]);
    expect(Math.max(...clip.root!.map(k => Math.abs(k[1])))).toBeLessThanOrEqual(6);
    expect(SHEETS['hero-tangxun.png'].projectile!.skill).toBe('tx-s1-fang');
    expect(FX['tx-s1-fang'].overshoot).toBeGreaterThanOrEqual(2);
    const dmg = kitOf('tangxun', 'archer').skill.effects[0] as { pierceDelays?: number[] };
    expect(dmg.pierceDelays!.map(d => Math.round(d * 60))).toEqual([4, 6]);
    expect(fxFor('hero-tangxun.png', 'skill', { on: 'impact', hit: 0 })).toEqual(['tx-s1-impact1']);
    expect(fxFor('hero-tangxun.png', 'skill', { on: 'impact', hit: 1 })).toEqual(['tx-s1-impact2']);
    expect(fxFor('hero-tangxun.png', 'skill', { on: 'impact', hit: 2 })).toEqual(['tx-s1-impact3']);
    expect(FX['tx-s1-impact1'].w).toBeGreaterThan(FX['tx-s1-impact2'].w);
    const imp = clip.impact as { hitStopMs?: number }[];
    expect(imp[0].hitStopMs).toBeCloseTo(33, 0);
    expect(imp.slice(1).every(i => !i.hitStopMs)).toBeTrue();
  });

  it('S2 Severing Chain on its Timeline Sync Sheet: 1.20 s, one blade spawned 3× (T014 / T030 / T045), 25 / 30 / 45 %, interrupt + Open Wound on throw 3', () => {
    const clip = SHEETS['hero-tangxun.png'].anims.skill2!;
    expect(clipClock(clip).total * 60).toBeCloseTo(72, 0);
    const ev = (e: string) => animEvents('hero-tangxun.png', 'skill2').filter(x => x.event === e).map(x => Math.round(x.t * 60));
    expect(ev('ANTICIPATION_PEAK')).toEqual([6]);
    expect(ev('STRIKE_START')).toEqual([10, 26, 40]);
    expect(ev('DAMAGE')).toEqual([14, 30, 45]);
    expect(ev('RECOVERY_START')).toEqual([64]);
    expect(Math.max(...clip.root!.map(k => Math.abs(k[1])))).toBeLessThanOrEqual(10);
    expect(SHEETS['hero-tangxun.png'].projectile!.skill2).toBe('tx-s2-blade');
    const s2 = kitOf('tangxun', 'archer').skill2;
    expect(s2.repeat).toEqual(jasmine.objectContaining({ count: 3, weights: [0.25, 0.3, 0.45] }));
    expect(s2.delivery).toBe('PROJECTILE');
    const gated = s2.effects.filter(e => e.onHits);
    expect(gated.map(e => e.type).sort()).toEqual(['APPLY_STATUS', 'INTERRUPT']);
    expect(gated.every(e => e.onHits!.join() === '2')).toBeTrue();
    expect(s2.effects.find(e => e.type === 'DAMAGE')!.onHits).toBeUndefined();
    for (const i of [0, 1, 2]) expect(fxFor('hero-tangxun.png', 'skill2', { on: 'impact', hit: i })).toEqual([`tx-s2-impact${i + 1}`]);
    expect(FX['tx-s2-impact1'].h).toBeLessThan(FX['tx-s2-impact2'].h);
    expect(FX['tx-s2-impact2'].h).toBeLessThan(FX['tx-s2-impact3'].h);
    expect((clip.impact as { hitStopMs?: number; shakePx?: number }[]).map(i => [i.hitStopMs, i.shakePx])).toEqual([[17, 1], [17, 1], [50, 4]]);
  });

  it('Ult Heaven-Snaring Blade Array on its Timeline Sync Sheet ×1.15 (slowed 2026-10): charge T018 (loops, held), blades thrown once T064, cuts T132–T144, finisher T154 (55 %, crit)', () => {
    const clip = SHEETS['hero-tangxun.png'].anims.ult!;
    // the sheet's 60 FPS timeline played 15 % slower: T (sheet) = game time × 60 / 1.15
    const K = 1.15;
    expect(clipClock(clip).total * 60 / K).toBeCloseTo(174, 0);
    const ev = (e: string) => animEvents('hero-tangxun.png', 'ult').filter(x => x.event === e).map(x => Math.round((x.t * 60) / K));
    expect(ev('CHARGE_START')).toEqual([18]);
    expect(ev('CHARGE_PEAK')).toEqual([60]);
    expect(ev('VFX_SPAWN')).toEqual([64]);
    expect(ev('FINAL_ANTICIPATION')).toEqual([148]);
    expect(ev('DAMAGE')).toEqual([132, 136, 140, 144, 154]);
    expect(ev('RECOVERY_START')).toEqual([170]);
    expect(Math.max(...clip.root!.map(k => Math.abs(k[1])))).toBeLessThanOrEqual(12);
    const ult = kitOf('tangxun', 'archer').ult;
    expect(ult.delivery).toBe('INSTANT');
    expect(ult.repeat).toEqual(jasmine.objectContaining({ count: 5, weights: [0.1, 0.1, 0.1, 0.15, 0.55] }));
    expect(ult.markStatus).toBe('open_wound');
    const fin = ult.effects.find(e => e.onHits?.includes(4))! as { guaranteedCrit?: boolean; area: string };
    expect([fin.area, fin.guaranteedCrit]).toEqual(['ADJACENT_8', true]);
    expect(fxFor('hero-tangxun.png', 'ult', { on: 'event', event: 'CHARGE_START' })).toEqual(['tx-ult-charge']);
    // blades thrown at T040 surround the target first; the array storm follows after they land
    expect(fxFor('hero-tangxun.png', 'ult', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['tx-ult-surround', 'tx-ult-main']);
    // charge holds until the throw (CHARGE_START T018 → fades by T070) · storm starts after the blades dive in (T094)
    expect(Math.round((FX['tx-ult-charge'].frames * FX['tx-ult-charge'].frameMs / K) * 60 / 1000) + 18).toBeCloseTo(70, -1);
    expect(Math.round(FX['tx-ult-main'].delayMs! / K * 60 / 1000) + 64).toBe(94);
    expect(Math.round(FX['tx-ult-surround'].frames * FX['tx-ult-surround'].frameMs / K * 60 / 1000) + 64).toBe(100);
    for (const i of [0, 1, 2, 3]) expect(fxFor('hero-tangxun.png', 'ult', { on: 'impact', hit: i })).toEqual([`tx-ult-spark${i}`]);
    expect(fxFor('hero-tangxun.png', 'ult', { on: 'event', event: 'FINAL_ANTICIPATION' })).toEqual([]);
    expect(fxFor('hero-tangxun.png', 'ult', { on: 'impact', hit: 4 })).toEqual(['tx-ult-impact', 'tx-ult-shock', 'tx-ult-residual']);
    expect(FX['tx-ult-residual'].delayMs! / K).toBeCloseTo(167, -1);
    // every ult FX slowed by the same factor as the clip (stays in sync)
    expect(FX['tx-ult-main'].frameMs / K).toBeCloseTo(33.33, 1);
    expect(FX['tx-ult-charge'].frameMs / K).toBeCloseTo(33.33, 1);
    const imp = clip.impact as { hitStopMs?: number; shakePx?: number; zoomPct?: number }[];
    expect(imp.slice(0, 4).every(i => (i.hitStopMs ?? 0) <= 25)).toBeTrue();
    expect(imp[4].hitStopMs!).toBeGreaterThanOrEqual(100);
    expect(imp[4].shakePx!).toBeGreaterThanOrEqual(8);
    expect(imp[4].zoomPct).toBeGreaterThan(0);
  });
});

/** Lin Xue — Lotus Spirit Physician (remodel #5): base sheet only, Healer class ids arranged to her skills */
describe('Lin Xue (3★ Healer / Support, base sheet)', () => {
  it('21 × 8 atlas 260 × 170: idle 3 · walk 6 · hurt 3 · cast 6 (lotus released F4) · die 5 · S1 10 · S2 10 · Ult 21 · upright lotus projectile', () => {
    const sh = SHEETS['hero-linxue.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH]).toEqual([21, 8, 260, 170]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die'] as const).map(k => [a[k]!.row, a[k]!.frames])).toEqual([[0, 3], [1, 6], [2, 3], [3, 6], [4, 5]]);
    expect(a.attack!.events!.DAMAGE).toBe(3);
    expect([a.skill!.row, a.skill!.frames]).toEqual([5, 10]);
    expect([a.skill2!.row, a.skill2!.frames]).toEqual([6, 10]);
    expect([a.ult!.row, a.ult!.frames]).toEqual([7, 21]);
    expect(sh.projectile!.attack).toBe('linxue-lotus');
    expect(FX['linxue-lotus'].noRotate).toBeTrue();
    expect(HERO_BY_ID['linxue']).toEqual(jasmine.objectContaining({ name: 'หลินเสวี่ย', cls: 'healer', star: 3, sprite: 'hero-linxue.png' }));
    expect(HERO_ART['linxue']).toEqual(jasmine.objectContaining({
      portrait: 'portraits/linxue.webp', s1: 'skills/linxue-s1.webp', s2: 'skills/linxue-s2.webp', ult: 'skills/linxue-ult.webp',
      banner: 'banners/linxue.webp',
    }));
  });

  it('Lotus Prayer = targeted heal + splash · Spirit Mend = heal + cleanse 1 + Qi Guard · Returning Spring Rite = team heal + cleanse + revive', () => {
    const k = kitOf('linxue', 'healer');
    const c = CLASS_KITS.healer;
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Lotus Prayer', 'Spirit Mend', 'Returning Spring Rite']);
    expect([k.skill.id, k.skill2.id, k.ult.id]).toEqual([c.skill.id, c.skill2.id, c.ult.id]);
    expect([k.skill.cooldown, k.skill2.cooldown]).toEqual([c.skill.cooldown, c.skill2.cooldown]);
    expect(k.skill.target).toBe('LOWEST_HP_ALLY');
    expect(k.skill2.effects.map(e => e.type)).toEqual(['CLEANSE', 'HEAL', 'SHIELD']);
    expect(k.skill2.effects).toContain(jasmine.objectContaining({ type: 'CLEANSE', to: 'PRIMARY', count: 1 }));
    expect(k.ult.effects.map(e => e.type)).toEqual(['HEAL', 'CLEANSE', 'REVIVE']);
    expect(k.ult.effects.map(e => e.onHits)).toEqual([[0], [1], [2]]);
    expect(k.healBolt).toEqual(c.healBolt);
  });

  it('S1 Lotus Prayer on its production Timeline Sync Sheet: 45 frames, burst T024, primary heal T025, splash heal T031, recovery T036', () => {
    const clip = SHEETS['hero-linxue.png'].anims.skill!;
    expect(clipClock(clip).total * 60).toBeCloseTo(45, 0);
    const ev = (e: string) => animEvents('hero-linxue.png', 'skill').filter(x => x.event === e).map(x => Math.round(x.t * 60));
    expect(ev('ANTICIPATION_PEAK')).toEqual([14]);
    expect(ev('STRIKE_START')).toEqual([18]);
    expect(ev('SKILL_ACTIVATE')).toEqual([22]);
    expect(ev('VFX_SPAWN')).toEqual([24]);
    expect(ev('DAMAGE')).toEqual([25, 31]);
    expect(ev('RECOVERY_START')).toEqual([36]);
    expect(Math.max(...clip.root!.map(k => Math.abs(k[1])))).toBeLessThanOrEqual(4);
    expect(clip.impact).toBeUndefined();
    expect(fxFor('hero-linxue.png', 'skill', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['lx-s1-bloom']);
    expect(fxFor('hero-linxue.png', 'skill', { on: 'impact', hit: 0 })).toEqual([]);
    expect(fxFor('hero-linxue.png', 'skill', { on: 'impact', hit: 1 })).toEqual(['lx-s1-splash']);
    expect(FX['lx-s1-splash'].exceptPrimary).toBeTrue();
    // nearby copy = 65 % of the primary burst
    expect(FX['lx-s1-splash'].w / FX['lx-s1-bloom'].w).toBeLessThan(0.7);
    // the burst peaks (strip frame 4 at 60 FPS: spawn T024 → T027) two frames after the primary heal
    expect(24 + Math.round(3 * FX['lx-s1-bloom'].frameMs / (1000 / 60))).toBe(27);
    const k = kitOf('linxue', 'healer').skill;
    expect(k.repeat!.count).toBe(2);
    expect(k.effects.map(e => e.onHits)).toEqual([[0], [1]]);
  });

  it('S2 Spirit Mend on its production Timeline Sync Sheet: 63 frames, Main VFX on the ally T020, cleanse T030 > heal T038 > Qi Guard T048, no impact VFX', () => {
    const clip = SHEETS['hero-linxue.png'].anims.skill2!;
    expect(clipClock(clip).total * 60).toBeCloseTo(63, 0);
    const ev = (e: string) => animEvents('hero-linxue.png', 'skill2').filter(x => x.event === e).map(x => Math.round(x.t * 60));
    expect(ev('STRIKE_START')).toEqual([10]);
    expect(ev('ANTICIPATION_PEAK')).toEqual([17]);
    expect(ev('VFX_SPAWN')).toEqual([20]);
    expect(ev('DAMAGE')).toEqual([30, 38, 48]);
    expect(ev('RECOVERY_START')).toEqual([54]);
    expect(Math.max(...clip.root!.map(k => Math.abs(k[1])))).toBeLessThanOrEqual(6);
    expect(clip.impact).toBeUndefined();
    expect(fxFor('hero-linxue.png', 'skill2', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['lx-s2-main']);
    expect(FX['lx-s2-main'].at).toBe('target');
    // no impact VFX on the cleanse / heal beats — only the persistent guard shell when the Qi Guard lands
    expect(fxFor('hero-linxue.png', 'skill2', { on: 'impact', hit: 0 })).toEqual([]);
    expect(fxFor('hero-linxue.png', 'skill2', { on: 'impact', hit: 1 })).toEqual([]);
    expect(fxFor('hero-linxue.png', 'skill2', { on: 'impact', hit: 2 })).toEqual(['lx-s2-guard']);
    // the Main VFX runs T020–T067; the guard shell starts T058 and covers the 4 s Qi Guard
    expect(FX['lx-s2-main'].frames).toBe(48);
    const g = FX['lx-s2-guard'];
    expect(48 + Math.round(g.delayMs! / (1000 / 60))).toBe(58);
    expect((g.delayMs! + g.frames * g.frameMs * g.repeat! + g.fadeOutMs!) / 1000).toBeCloseTo(4, 0);
    const k = kitOf('linxue', 'healer').skill2;
    expect(k.repeat!.count).toBe(3);
    expect(k.effects.map(e => [e.type, e.onHits])).toEqual([['CLEANSE', [0]], ['HEAL', [1]], ['SHIELD', [2]]]);
  });

  it('Ult Returning Spring Rite on its production Timeline Sync Sheet: 144 frames, charge T018, field on the team T070, heal T092 > cleanse T104 > revival T114 / T118', () => {
    const clip = SHEETS['hero-linxue.png'].anims.ult!;
    expect(clipClock(clip).total * 60).toBeCloseTo(144, 0);
    const ev = (e: string) => animEvents('hero-linxue.png', 'ult').filter(x => x.event === e).map(x => Math.round(x.t * 60));
    expect(ev('CHARGE_START')).toEqual([18]);
    expect(ev('CHARGE_PEAK')).toEqual([52]);
    expect(ev('FINAL_ANTICIPATION')).toEqual([60]);
    expect(ev('SKILL_ACTIVATE')).toEqual([64]);
    expect(ev('VFX_SPAWN')).toEqual([70]);
    expect(ev('DAMAGE')).toEqual([92, 104, 114]);
    expect(ev('RECOVERY_START')).toEqual([134]);
    expect(Math.max(...clip.root!.map(k => Math.abs(k[1])))).toBeLessThanOrEqual(4);
    expect(clip.impact).toBeUndefined();
    expect(fxFor('hero-linxue.png', 'ult', { on: 'event', event: 'CHARGE_START' })).toEqual(['lx-ult-charge']);
    expect(FX['lx-ult-charge'].at).toBe('self');
    expect(fxFor('hero-linxue.png', 'ult', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['lx-ult-main']);
    expect(FX['lx-ult-main'].at).toBe('allies');
    // no impact VFX / per-ally heal pulse on the heal / cleanse beats — only the localized revival cue
    expect(fxFor('hero-linxue.png', 'ult', { on: 'impact', hit: 0 })).toEqual([]);
    expect(fxFor('hero-linxue.png', 'ult', { on: 'impact', hit: 1 })).toEqual([]);
    expect(fxFor('hero-linxue.png', 'ult', { on: 'impact', hit: 2 })).toEqual(['lx-ult-revive']);
    expect(FX['lx-ult-revive'].exceptPrimary).toBeTrue();
    // charge drains by T073 (4 frames over the field) · field ends on the clip end T143
    expect(18 + FX['lx-ult-charge'].frames).toBe(74);
    expect(70 + FX['lx-ult-main'].frames).toBe(144);
    const rev = kitOf('linxue', 'healer').ult.effects[2] as { delay?: number };
    expect(Math.round(rev.delay! * 60)).toBe(4);
  });
});
