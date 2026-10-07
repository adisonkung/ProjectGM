import { SHIPPED_HERO_IDS, SHIPPED_STARTER_BENCH, SHIPPED_STARTER_TEAM } from '../../../testing/legacy-roster';
import { HERO_ART } from './hero-art';
import { CLASS_KITS, kitOf } from './hero-skills';
import { HERO_BY_ID } from './heroes';
import { SHEETS } from './sprites';
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
describe('Yue Zheng (3★ Tank, base sheet)', () => {
  it('8 × 8 atlas 260 × 170 (skill rows reserved): idle 6 · walk 8 · hurt 4 · attack 7 (damage F4) · die 6', () => {
    const sh = SHEETS['hero-yuezheng.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH]).toEqual([8, 8, 260, 170]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die'] as const).map(k => [a[k]!.row, a[k]!.frames])).toEqual([[0, 6], [1, 8], [2, 4], [3, 7], [4, 6]]);
    expect(a.attack!.events!.DAMAGE).toBe(3);
    expect(a.skill).toBeUndefined();
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
    expect(HERO_ART['yuezheng'].s1).toBeUndefined();
  });
});
