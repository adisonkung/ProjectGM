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
  it('ships only the remodelled heroes (Bai Long + Yue Zheng) as the starter team; no old hero sheet / art is left', () => {
    expect(SHIPPED_HERO_IDS).toEqual(['bailong', 'yuezheng']);
    expect(SHIPPED_STARTER_TEAM).toEqual(['bailong', 'yuezheng']);
    expect(SHIPPED_STARTER_BENCH).toEqual([]);
    expect(Object.keys(SHEETS).filter(k => k.startsWith('hero-')).sort()).toEqual(['hero-bailong.png', 'hero-yuezheng.png']);
    expect(Object.keys(HERO_ART).sort()).toEqual(['bailong', 'yuezheng']);
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
