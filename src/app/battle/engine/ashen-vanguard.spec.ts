import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_KITS, kitInterrupts, kitOf } from '../../core/data/hero-skills';
import { HERO_ART } from '../../core/data/hero-art';
import { SHEETS } from '../../core/data/sprites';
import { OwnedHero } from '../../core/models/hero';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { combatModifiers, skillRanksOf } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { BattleEngine, BattleUnit } from './battle-engine';
import { SkillHost, SkillSystem } from './skill-system';

/** Kael Ashen Vanguard (remodel #7): guard-breaking cut · two-slash combo · sword wave down the lane */
describe('Kael (3★ Fighter, base sheet + kit)', () => {
  it('7 × 8 atlas 260 × 170: idle 5 · run 7 · hurt 4 · cut → thrust 7 (damage F4) · die 6 · on the starter bench', () => {
    const sh = SHEETS['hero-kael.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH]).toEqual([7, 8, 260, 170]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die'] as const).map(k => [a[k]!.row, a[k]!.frames])).toEqual([[0, 5], [1, 7], [2, 4], [3, 7], [4, 6]]);
    expect(a.attack!.events!.DAMAGE).toBe(3);
    expect(HERO_BY_ID['kael']).toEqual(jasmine.objectContaining({ name: 'เคล', cls: 'fighter', star: 3, sprite: 'hero-kael.png' }));
    expect(HERO_ART['kael']).toEqual({ portrait: 'portraits/kael.webp' });
  });

  it('Sundering Edge / Relentless Cross / Ashen Rupture keep the Fighter ids + cooldowns (Bai Long slot order), no interrupt', () => {
    const k = kitOf('kael', 'fighter');
    const c = CLASS_KITS.fighter;
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Sundering Edge', 'Relentless Cross', 'Ashen Rupture']);
    expect([k.skill.id, k.skill2.id, k.ult.id]).toEqual([c.skill2.id, c.skill.id, c.ult.id]);
    expect([k.skill.cooldown, k.skill2.cooldown]).toEqual([c.skill2.cooldown, c.skill.cooldown]);
    expect((['skill', 'skill2', 'ult'] as const).some(s => kitInterrupts(k, s))).toBeFalse();
    expect(k.skill2.repeat).toEqual(jasmine.objectContaining({ count: 2, weights: [0.4, 0.6], comboBonus: 0.2 }));
    expect(k.ult.effects).toEqual([jasmine.objectContaining({ type: 'DAMAGE', area: 'FRONT_LINE_4' })]);
    expect(k.ult.repeat).toBeUndefined();
  });

  // ---------------------------------------------------------------- S1 with a stub host
  const unit = (id: number, side: 'ally' | 'enemy', c: number) =>
    ({ id, side, alive: true, pos: { r: 1, c }, hp: 100, maxHp: 100, buffs: [] }) as unknown as BattleUnit;

  function sunder(opts: { guarded?: boolean; casting?: object } = {}) {
    const caster = unit(0, 'ally', 2);
    const foe = unit(1, 'enemy', 3);
    if (opts.casting) (foe as unknown as { casting: object }).casting = opts.casting;
    const log: string[] = [];
    const host = {
      time: 0, rng: () => 0.99, emit: () => undefined, foes: () => [foe], allies: () => [caster], later: () => undefined,
      hit: (_u: BattleUnit, _f: BattleUnit, mul: number) => (log.push(`hit ${mul.toFixed(2)}`), true),
      interrupt: (_u: BattleUnit, _f: BattleUnit, bp?: number) => log.push(`interrupt ${bp}`),
      breakCast: (_u: BattleUnit, _f: BattleUnit, bp: number) => log.push(`break ${bp}`),
      guarded: () => !!opts.guarded,
    } as unknown as SkillHost;
    new SkillSystem(host).applyEffects(caster, kitOf('kael', 'fighter').skill, 'skill', foe, foe.pos);
    return log;
  }

  it('Sundering Edge: 220 %, ×1.3 against a guarded target (shield / damage cut)', () => {
    expect(sunder()).toEqual(['hit 2.20']);
    expect(sunder({ guarded: true })).toEqual(['hit 2.86']);
  });

  it('Sundering Edge breaks (Break 60) a cast it lands on — break only, never a dedicated interrupt', () => {
    expect(sunder({ casting: { def: {} } })).toEqual(['break 60', 'hit 2.20']);
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
  function battle(enemies: EnemyPlacement[]) {
    const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies };
    const e = new BattleEngine({ allies: [spec('kael', 0, 1)], stage, enemyTemplates: ENEMIES, seed: 3 });
    e.step(0.05);
    e.drainEvents();
    const k = e.units.find(u => u.heroId === 'kael')!;
    const foes = () => e.units.filter(u => u.side !== 'ally' && u.alive);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grid = (e as any).grid;
    const place = (u: BattleUnit, cell: { r: number; c: number }) => { grid.move(u.id, u.pos, cell); u.pos = cell; };
    return { e, k, foes, place };
  }

  it('Engine: guarded = carries a shield or a damage-reducing status', () => {
    const b = battle([{ enemy: 'forest_slime', r: 0, c: 1 }]);
    const [f] = b.foes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const host = (b.e.skills as any).h as SkillHost;
    f.buffs = [];
    f.shield = 0;
    expect(host.guarded(f)).toBeFalse();
    f.shield = 30;
    expect(host.guarded(f)).toBeTrue();
  });

  it('Relentless Cross: two cuts 40 / 60 %, the second +20 % when both land on the same target', () => {
    const b = battle([{ enemy: 'forest_slime', r: 0, c: 1 }]);
    const [f] = b.foes();
    f.hp = f.maxHp = 1e6;
    b.place(f, { r: b.k.pos.r, c: b.k.pos.c + 1 });
    const muls: number[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eng = b.e as any;
    const hit = eng.hit.bind(eng);
    const id = kitOf('kael', 'fighter').skill2.id;
    eng.hit = (src: BattleUnit, dst: BattleUnit, mul: number, o: { sourceId: string }) =>
      (src === b.k && o.sourceId === id && muls.push(+mul.toFixed(3)), hit(src, dst, mul, o));
    eng.dodged = () => false;
    b.e.skills.use(b.k, 'skill2', kitOf('kael', 'fighter').skill2, f);
    for (let i = 0; i < 60; i++) b.e.step(0.05);
    expect(muls).toEqual([+(1.7 * 0.4).toFixed(3), +(1.7 * 0.6 * 1.2).toFixed(3)]);
  });

  it('Ashen Rupture: one wave down the lane — every unit in the 4 cells ahead is hit, nothing beside or beyond', () => {
    const b = battle([0, 1, 2, 3, 4, 5].map(c => ({ enemy: 'forest_slime', r: 0, c })));
    const foes = b.foes();
    for (const f of foes) f.hp = f.maxHp = 1e6;
    const { r, c } = b.k.pos;
    const cells = [{ r, c: c + 1 }, { r, c: c + 2 }, { r, c: c + 3 }, { r, c: c + 4 }, { r, c: c + 5 }, { r: r === 0 ? 1 : r - 1, c: c + 1 }];
    foes.forEach((f, i) => b.place(f, cells[i]));
    const hp = foes.map(f => f.hp);
    b.e.skills.applyEffects(b.k, kitOf('kael', 'fighter').ult, 'ult', foes[0], foes[0].pos);
    const hit = foes.map((f, i) => hp[i] - f.hp > 0);
    expect(hit).toEqual([true, true, true, true, false, false]);
  });
});
