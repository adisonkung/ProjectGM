import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_KITS, kitOf } from '../../core/data/hero-skills';
import { HERO_ART } from '../../core/data/hero-art';
import { animEvents, FX, fxFor, SHEETS } from '../../core/data/sprites';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { OwnedHero } from '../../core/models/hero';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { combatModifiers, skillRanksOf } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { BattleEngine, BattleEvent } from './battle-engine';
import { applyBuff, hasStatus } from './buffs';

/** Garrick Stoneward — The Iron Bell (remodel #6): counter stance · hammer slam · team damage interception */
describe('Garrick (3★ Tank, base sheet + kit)', () => {
  it('14 × 8 atlas 260 × 170: idle 5 · walk 7 · hurt 4 · hammer slam 7 (damage F5) · die 6 · on the starter bench', () => {
    const sh = SHEETS['hero-garrick.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH]).toEqual([14, 8, 260, 170]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die'] as const).map(k => [a[k]!.row, a[k]!.frames])).toEqual([[0, 5], [1, 7], [2, 4], [3, 7], [4, 6]]);
    expect(a.attack!.events!.DAMAGE).toBe(4);
    expect(a.skill!.row).toBe(5);
    expect(HERO_BY_ID['garrick']).toEqual(jasmine.objectContaining({ name: 'การ์ริก', cls: 'tank', star: 3, sprite: 'hero-garrick.png' }));
    expect(HERO_ART['garrick']).toEqual(jasmine.objectContaining({
      portrait: 'portraits/garrick.webp', s1: 'skills/garrick-s1.webp', s2: 'skills/garrick-s2.webp', ult: 'skills/garrick-ult.webp',
      banner: 'banners/garrick.webp',
    }));
  });

  it('S1 Brace for Impact sync sheet: 1.10 s clip, brace start F18, activation (DR + taunt + counter) F30, aura loops 3 s', () => {
    const ev = animEvents('hero-garrick.png', 'skill');
    const at = (k: string) => ev.find(e => e.event === k)!.t;
    expect(SHEETS['hero-garrick.png'].anims.skill!.steps!.reduce((x, y) => x + y, 0)).toBe(1100);
    expect(Math.abs(at('STRIKE_START') - 18 / 60)).toBeLessThan(0.01);
    expect(Math.abs(at('DAMAGE') - 30 / 60)).toBeLessThan(0.01);
    expect(Math.abs(at('VFX_SPAWN') - 20 / 60)).toBeLessThan(0.01);
    expect(fxFor('hero-garrick.png', 'skill', { on: 'event', event: 'VFX_SPAWN' }).map(f => FX[f].layer ?? 'over')).toEqual(['over']);
    const aura = FX['gr-s1-aura'];
    expect(aura.frames * aura.frameMs * aura.repeat!).toBe(3000);
    expect(fxFor('hero-garrick.png', 'skill', { on: 'impact', hit: 0 })).toEqual(['gr-s1-aura']);
    expect(aura.layer).toBeUndefined();
  });

  it('S2 Hammerfall sync sheet: 0.90 s clip, release F24, damage + break + knockback + impact F31, recovery F37', () => {
    const ev = animEvents('hero-garrick.png', 'skill2');
    const at = (k: string) => ev.find(e => e.event === k)!.t;
    const a = SHEETS['hero-garrick.png'].anims.skill2!;
    expect(a.row).toBe(6);
    expect(a.steps!.reduce((x, y) => x + y, 0)).toBe(900);
    expect(Math.abs(at('ANTICIPATION_PEAK') - 10 / 60)).toBeLessThan(0.01);
    expect(Math.abs(at('STRIKE_START') - 24 / 60)).toBeLessThan(0.01);
    expect(Math.abs(at('DAMAGE') - 31 / 60)).toBeLessThan(0.01);
    expect(Math.abs(at('RECOVERY_START') - 37 / 60)).toBeLessThan(0.01);
    expect(fxFor('hero-garrick.png', 'skill2', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['gr-s2-main']);
    expect(fxFor('hero-garrick.png', 'skill2', { on: 'impact', hit: 0 })).toEqual(['gr-s2-impact', 'gr-s2-shock']);
    expect(FX['gr-s2-shock']).toEqual(jasmine.objectContaining({ exceptPrimary: true }));
  });

  it('Ult Hold the Gate sync sheet: 1.60 s clip, cast start F18, activation F48, recovery F78 · aura covers the 6 s buff', () => {
    const ev = animEvents('hero-garrick.png', 'ult');
    const at = (k: string) => ev.find(e => e.event === k)!.t;
    const a = SHEETS['hero-garrick.png'].anims.ult!;
    expect([a.row, a.frames]).toEqual([7, 14]);
    expect(a.steps!.reduce((x, y) => x + y, 0)).toBe(1600);
    expect(Math.abs(at('VFX_SPAWN') - 18 / 60)).toBeLessThan(0.01);
    expect(Math.abs(at('CHARGE_PEAK') - 36 / 60)).toBeLessThan(0.01);
    expect(Math.abs(at('DAMAGE') - 48 / 60)).toBeLessThan(0.01);
    expect(Math.abs(at('RECOVERY_START') - 78 / 60)).toBeLessThan(0.01);
    expect(fxFor('hero-garrick.png', 'ult', { on: 'event', event: 'VFX_SPAWN' })).toEqual(['gr-ult-main']);
    expect(fxFor('hero-garrick.png', 'ult', { on: 'impact', hit: 0 })).toEqual(['gr-ult-aura']);
    const aura = FX['gr-ult-aura'];
    const lasts = aura.delayMs! + aura.frames * aura.frameMs;
    expect(Math.abs(lasts - STATUS_EFFECTS['gate_ward'].duration * 1000)).toBeLessThan(150);
    expect([FX['gr-ult-main'].layer, aura.layer]).toEqual(['under', 'under']);
  });

  it('Brace for Impact / Hammerfall / Hold the Gate keep the Tank class ids + cooldowns', () => {
    const k = kitOf('garrick', 'tank');
    const c = CLASS_KITS.tank;
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Brace for Impact', 'Hammerfall', 'Hold the Gate']);
    expect([k.skill.id, k.skill2.id, k.ult.id]).toEqual([c.skill.id, c.skill2.id, c.ult.id]);
    expect([k.skill.cooldown, k.skill2.cooldown]).toEqual([c.skill.cooldown, c.skill2.cooldown]);
    expect(k.skill.effects.some(e => e.type === 'DAMAGE')).toBeFalse();
    expect(k.skill2.movement).toBeUndefined();
    expect(k.skill2.effects[0]).toEqual(jasmine.objectContaining({ type: 'DAMAGE', area: 'FRONT_T3', breakPower: 70 }));
    expect(k.ult.effects.some(e => e.type === 'SHIELD' || e.type === 'HEAL')).toBeFalse();
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
    const e = new BattleEngine({ allies: [spec('garrick', 0, 1), spec('linxue', 3, 1)], stage, enemyTemplates: ENEMIES, seed: 3 });
    const log: BattleEvent[] = [];
    e.step(0.05);
    log.push(...e.drainEvents());
    const hero = (id: string) => e.units.find(u => u.heroId === id)!;
    const foes = () => e.units.filter(u => u.side !== 'ally' && u.alive);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dmg = (dst: unknown, n: number, src?: unknown) => (e as any).applyDamage(dst, n, false, false, src);
    return { e, log, hero, foes, dmg };
  }

  it('Brace for Impact: guard DR on himself, and the first foe that hits him is staggered — once per stance', () => {
    const b = battle();
    const g = b.hero('garrick');
    const [f] = b.foes();
    b.e.skills.applyEffects(g, kitOf('garrick', 'tank').skill, 'skill', f, f.pos);
    expect(hasStatus(g, 'taunt_guard')).toBeTrue();
    expect(hasStatus(g, 'brace_counter')).toBeTrue();
    b.dmg(g, 50, f);
    expect(hasStatus(f, 'stagger')).toBeTrue();
    expect(b.e.drainEvents().some(ev => ev.type === 'counter' && ev.dst === f.id)).toBeTrue();
    f.buffs = f.buffs.filter(x => x.def.id !== 'stagger');
    b.dmg(g, 50, f);
    expect(hasStatus(f, 'stagger')).toBeFalse();
    // a fresh cast re-arms the counter
    b.e.skills.applyEffects(g, kitOf('garrick', 'tank').skill, 'skill', f, f.pos);
    b.dmg(g, 50, f);
    expect(hasStatus(f, 'stagger')).toBeTrue();
  });

  it('Hammerfall: the cell in front takes the full hit, the lanes above / below a light splash; small knockback', () => {
    const b = battle([{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 0, c: 0 }, { enemy: 'forest_slime', r: 0, c: 2 }]);
    const g = b.hero('garrick');
    const foes = b.foes();
    // stand them right in front of him: main on his lane, splash one lane up / down
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grid = (b.e as any).grid;
    const front = { r: g.pos.r, c: g.pos.c + 1 };
    const place = (u: typeof g, cell: { r: number; c: number }) => { grid.move(u.id, u.pos, cell); u.pos = cell; };
    place(foes[0], front);
    place(foes[1], { r: front.r - 1 < 0 ? front.r + 2 : front.r - 1, c: front.c });
    place(foes[2], { r: front.r + 1 > 2 ? front.r - 2 : front.r + 1, c: front.c });
    const lanes = [front.r - 1, front.r + 1].filter(r => r >= 0 && r <= 2);
    const side = foes.slice(1).filter(u => lanes.includes(u.pos.r));
    const hp = foes.map(u => u.hp);
    b.e.skills.applyEffects(g, kitOf('garrick', 'tank').skill2, 'skill2', foes[0], foes[0].pos);
    const lost = foes.map((u, i) => hp[i] - u.hp);
    expect(lost[0]).toBeGreaterThan(0);
    for (const u of side) expect(hp[foes.indexOf(u)] - u.hp).toBeLessThan(lost[0]);
    for (const u of side) expect(hp[foes.indexOf(u)] - u.hp).toBeGreaterThan(0);
    expect(foes[0].pos.c).toBe(front.c + 1);
  });

  it('Hold the Gate: taunt + team damage cut; part of an ally\'s damage is taken by Garrick; he cannot be stunned', () => {
    const b = battle();
    const [g, lx] = ['garrick', 'linxue'].map(b.hero);
    const [f] = b.foes();
    b.e.skills.applyEffects(g, kitOf('garrick', 'tank').ult, 'ult', g, g.pos);
    expect(hasStatus(lx, 'gate_ward')).toBeTrue();
    expect(hasStatus(g, 'gate_stance')).toBeTrue();
    const [gh, lh] = [g.hp, lx.hp];
    b.dmg(lx, 100, f);
    expect(lh - lx.hp).toBe(75);
    expect(gh - g.hp).toBe(25);
    applyBuff(g, STATUS_EFFECTS['stun'], f.id, {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.e as any).applyStatus(g, 'stun', f);
    expect(g.buffs.filter(x => x.def.id === 'stun').length).toBeLessThanOrEqual(1);
    g.buffs = g.buffs.filter(x => x.def.id !== 'stun');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.e as any).applyStatus(g, 'stun', f);
    expect(hasStatus(g, 'stun')).toBeFalse();
  });
});
