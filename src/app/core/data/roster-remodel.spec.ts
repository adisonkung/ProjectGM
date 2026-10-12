import { SHIPPED_HERO_IDS, SHIPPED_STARTER_BENCH, SHIPPED_STARTER_TEAM } from '../../../testing/legacy-roster';
import { HERO_ART } from './hero-art';
import { CLASS_KITS, kitOf } from './hero-skills';
import { HERO_BY_ID } from './heroes';
import { animEvents, animTiming, clipClock, FX, fxFor, SHEETS } from './sprites';
import { fxDuration } from '../../battle/fx-sprite/fx-sprite.component';
import { dropRemovedHeroes, prepare } from '../services/save.service';
import { GameState } from '../models/game-state';
import { newGameState } from './starter';

/** 2026-10 roster remodel: the old roster left the game — Bai Long is the only hero and the template for the new ones */
describe('Roster remodel — Bai Long lead + new heroes', () => {
  it('ships only the remodelled heroes (Bai Long + Yue Zheng + Mo Ye + Tang Xun + Lin Xue) as the starter team; no old hero sheet / art is left', () => {
    expect(SHIPPED_HERO_IDS).toEqual(['bailong', 'yuezheng', 'moye', 'tangxun', 'linxue']);
    expect(SHIPPED_STARTER_TEAM).toEqual(['bailong', 'yuezheng', 'moye', 'tangxun', 'linxue']);
    expect(SHIPPED_STARTER_BENCH).toEqual([]);
    expect(Object.keys(SHEETS).filter(k => k.startsWith('hero-')).sort()).toEqual(['hero-bailong.png', 'hero-linxue.png', 'hero-moye.png', 'hero-tangxun.png', 'hero-yuezheng.png']);
    expect(Object.keys(HERO_ART).sort()).toEqual(['bailong', 'linxue', 'moye', 'tangxun', 'yuezheng']);
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
    expect([a.skill2!.row, a.skill2!.frames]).toEqual([6, 10]);
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

  it('Ult Heaven-Snaring Blade Array on its Timeline Sync Sheet: 2.50 s, charge T018, array T040, cuts T108–T120, finisher T130 (55 %, crit), residual T140', () => {
    const clip = SHEETS['hero-tangxun.png'].anims.ult!;
    expect(clipClock(clip).total * 60).toBeCloseTo(150, 0);
    const ev = (e: string) => animEvents('hero-tangxun.png', 'ult').filter(x => x.event === e).map(x => Math.round(x.t * 60));
    expect(ev('CHARGE_START')).toEqual([18]);
    expect(ev('CHARGE_PEAK')).toEqual([36]);
    expect(ev('VFX_SPAWN')).toEqual([40]);
    expect(ev('FINAL_ANTICIPATION')).toEqual([124]);
    expect(ev('DAMAGE')).toEqual([108, 112, 116, 120, 130]);
    expect(ev('RECOVERY_START')).toEqual([146]);
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
    expect(FX['tx-ult-main'].delayMs).toBeGreaterThan(100);
    for (const i of [0, 1, 2, 3]) expect(fxFor('hero-tangxun.png', 'ult', { on: 'impact', hit: i })).toEqual([`tx-ult-spark${i}`]);
    expect(fxFor('hero-tangxun.png', 'ult', { on: 'event', event: 'FINAL_ANTICIPATION' })).toEqual([]);
    expect(fxFor('hero-tangxun.png', 'ult', { on: 'impact', hit: 4 })).toEqual(['tx-ult-impact', 'tx-ult-shock', 'tx-ult-residual']);
    expect(FX['tx-ult-residual'].delayMs).toBeCloseTo(167, -1);
    const imp = clip.impact as { hitStopMs?: number; shakePx?: number }[];
    expect(imp.map(i => i.hitStopMs)).toEqual([17, 17, 17, 17, 100]);
    expect(imp[4].shakePx).toBe(8);
  });
});

/** Lin Xue — Lotus Spirit Physician (remodel #5): base sheet only, Healer class ids arranged to her skills */
describe('Lin Xue (3★ Healer / Support, base sheet)', () => {
  it('6 × 8 atlas 260 × 170: idle 3 · walk 6 · hurt 3 · cast 6 (lotus released F4) · die 5 · upright lotus projectile', () => {
    const sh = SHEETS['hero-linxue.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH]).toEqual([6, 8, 260, 170]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die'] as const).map(k => [a[k]!.row, a[k]!.frames])).toEqual([[0, 3], [1, 6], [2, 3], [3, 6], [4, 5]]);
    expect(a.attack!.events!.DAMAGE).toBe(3);
    expect(a.skill).toBeUndefined();
    expect(sh.projectile!.attack).toBe('linxue-lotus');
    expect(FX['linxue-lotus'].noRotate).toBeTrue();
    expect(HERO_BY_ID['linxue']).toEqual(jasmine.objectContaining({ name: 'หลินเสวี่ย', cls: 'healer', star: 3, sprite: 'hero-linxue.png' }));
    expect(HERO_ART['linxue']).toEqual(jasmine.objectContaining({ portrait: 'portraits/linxue.webp' }));
  });

  it('Lotus Prayer = targeted heal + splash · Spirit Mend = heal + cleanse 1 + Qi Guard · Returning Spring Rite = team heal + cleanse + revive', () => {
    const k = kitOf('linxue', 'healer');
    const c = CLASS_KITS.healer;
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Lotus Prayer', 'Spirit Mend', 'Returning Spring Rite']);
    expect([k.skill.id, k.skill2.id, k.ult.id]).toEqual([c.skill.id, c.skill2.id, c.ult.id]);
    expect([k.skill.cooldown, k.skill2.cooldown]).toEqual([c.skill.cooldown, c.skill2.cooldown]);
    expect(k.skill.target).toBe('LOWEST_HP_ALLY');
    expect(k.skill2.effects.map(e => e.type)).toEqual(['HEAL', 'CLEANSE', 'SHIELD']);
    expect(k.skill2.effects).toContain(jasmine.objectContaining({ type: 'CLEANSE', to: 'PRIMARY', count: 1 }));
    expect(k.ult.effects.map(e => e.type)).toEqual(['HEAL', 'CLEANSE', 'REVIVE']);
    expect(k.healBolt).toEqual(c.healBolt);
  });
});
