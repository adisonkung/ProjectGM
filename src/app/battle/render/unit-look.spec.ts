import { LOOK_COLORS, unitLook } from './unit-look';

/** the CSS state looks of a `.unit` as Pixi data — same conditions as board.component.html */
describe('unitLook', () => {
  const hero = { alive: true, side: 'player' };

  it('plain unit: nothing', () => {
    expect(unitLook(hero)).toBeUndefined();
  });

  it('glows: reviving > enraged > buffed (buffed pulses); only while alive (revive is the exception)', () => {
    expect(unitLook({ ...hero, buffed: true })).toEqual({ glow: LOOK_COLORS.buffed, glowPulse: true });
    expect(unitLook({ ...hero, buffed: true, enraged: true })!.glow).toBe(LOOK_COLORS.enraged);
    expect(unitLook({ ...hero, alive: false, reviving: true, buffed: true })!.glow).toBe(LOOK_COLORS.reviving);
    expect(unitLook({ ...hero, alive: false, buffed: true })).toBeUndefined();
  });

  it('broken / untargetable tones', () => {
    expect(unitLook({ ...hero, broken: true })).toEqual({ broken: true });
    expect(unitLook({ ...hero, untargetable: true })).toEqual({ gray: true });
  });

  it('ground rings: taunt replaces the star aura, 6★ over 5★, enemies never get a star aura, elite adds its ring', () => {
    expect(unitLook({ ...hero, star: 5 })!.rings).toEqual(['aura5']);
    expect(unitLook({ ...hero, star: 6 })!.rings).toEqual(['aura6']);
    expect(unitLook({ ...hero, star: 6, taunt: true })!.rings).toEqual(['taunt']);
    expect(unitLook({ alive: true, side: 'enemy', star: 6 })).toBeUndefined();
    expect(unitLook({ alive: true, side: 'enemy', elite: true })!.rings).toEqual(['elite']);
    expect(unitLook({ ...hero, star: 5, alive: false })).toBeUndefined();
  });
});
