import { CLASS_KITS, HERO_DEFINITIONS, kitOf } from '../../core/data/hero-skills';
import { animEvents, animTiming, clipClock, SHEETS } from '../../core/data/sprites';

/** Aurel — Dawn Bastion (v2 art): sheet layout + damage frames from the art spec, Tank baseline numbers untouched */
describe('Aurel — Dawn Bastion (v2 art)', () => {
  const sheet = SHEETS['hero-aurel.png'];

  it('16 × 8 atlas, 260 × 132 cells, pixel art, rows idle 6 · walk 8 · hurt 4 · attack 7 · die 6 · 10 · 12 · 16', () => {
    expect([sheet.cols, sheet.rows, sheet.cellW, sheet.cellH, sheet.pixelated]).toEqual([16, 8, 260, 132, true]);
    const a = sheet.anims;
    const rows = ['idle', 'walk', 'hurt', 'attack', 'die', 'skill', 'skill2', 'ult'] as const;
    expect(rows.map(k => a[k]!.row)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(rows.map(k => a[k]!.frames)).toEqual([6, 8, 4, 7, 6, 10, 12, 16]);
  });

  it('damage on the spec frames: attack F4 · Shield Bash F7 · Guardian Rush F8 · ultimate slam F9 after the F5 charge peak', () => {
    const at = (k: 'attack' | 'skill' | 'skill2' | 'ult', f: number) => clipClock(sheet.anims[k]!).at(f - 1);
    expect(animTiming('hero-aurel.png', 'attack').hit).toBeCloseTo(at('attack', 4), 6);
    expect(animTiming('hero-aurel.png', 'skill').hit).toBeCloseTo(at('skill', 7), 6);
    expect(animTiming('hero-aurel.png', 'skill2').hit).toBeCloseTo(at('skill2', 8), 6);
    expect(animTiming('hero-aurel.png', 'ult').hit).toBeCloseTo(at('ult', 9), 6);
    const ult = animEvents('hero-aurel.png', 'ult');
    expect(ult.find(e => e.event === 'CHARGE_PEAK')!.art).toBe(4);
    expect(ult.find(e => e.event === 'IMPACT')!.art).toBe(8);
    // the charge peak is held longer than the frames around it
    const steps = sheet.anims.ult!.steps!;
    expect(steps[4]).toBeGreaterThan(steps[3]);
    expect(steps[8]).toBeGreaterThan(steps[7]);
  });

  it('Tank baseline kit (ids, numbers, cooldowns) — only the skill names follow the new art', () => {
    const k = kitOf('aurel', 'tank');
    const t = CLASS_KITS.tank;
    for (const slot of ['skill', 'skill2', 'ult'] as const) {
      const { name: _n, label: _l, ...rest } = k[slot];
      const { name: _tn, label: _tl, ...base } = t[slot];
      expect(rest).toEqual(base);
    }
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Shield Bash', 'Guardian Rush', 'Bastion of Dawn']);
    expect(HERO_DEFINITIONS['aurel'].cls).toBe('tank');
  });
});
