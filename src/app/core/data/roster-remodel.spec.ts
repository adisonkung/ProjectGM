import { SHIPPED_HERO_IDS, SHIPPED_STARTER_BENCH, SHIPPED_STARTER_TEAM } from '../../../testing/legacy-roster';
import { HERO_ART } from './hero-art';
import { SHEETS } from './sprites';
import { dropRemovedHeroes, prepare } from '../services/save.service';
import { GameState } from '../models/game-state';
import { newGameState } from './starter';

/** 2026-10 roster remodel: the old roster left the game — Bai Long is the only hero and the template for the new ones */
describe('Roster remodel — Bai Long only', () => {
  it('ships exactly one hero (Bai Long) as the whole starter team; no other hero sheet / art is left', () => {
    expect(SHIPPED_HERO_IDS).toEqual(['bailong']);
    expect(SHIPPED_STARTER_TEAM).toEqual(['bailong']);
    expect(SHIPPED_STARTER_BENCH).toEqual([]);
    expect(Object.keys(SHEETS).filter(k => k.startsWith('hero-'))).toEqual(['hero-bailong.png']);
    expect(Object.keys(HERO_ART)).toEqual(['bailong']);
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
