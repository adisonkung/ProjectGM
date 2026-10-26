import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_KITS, kitInterrupts, kitOf } from '../../core/data/hero-skills';
import { HERO_ART } from '../../core/data/hero-art';
import { animEvents, FX, SHEETS } from '../../core/data/sprites';
import { OwnedHero } from '../../core/models/hero';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { combatModifiers, skillRanksOf } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { BattleEngine, BattleEvent } from './battle-engine';
import { hasStatus, modifier } from './buffs';

/** Draeven Morcant — The Bloodwrought Sovereign (Phase A): taunt → Blood Debt → Blood Reprisal · Blood Brand · heavy ult */
describe('Draeven (3★ Tank / Fighter label → Tank class, Phase A)', () => {
  it('28 × 8 atlas 260 × 170: idle 12 · walk 8 · hurt 3 · attack 21 (19 played) · die 14 · S1 28 · S2 27 · Ult 28', () => {
    const sh = SHEETS['hero-draeven.png'];
    expect([sh.cols, sh.rows, sh.cellW, sh.cellH, !!sh.pixelated]).toEqual([28, 8, 290, 170, false]);
    const a = sh.anims;
    expect((['idle', 'walk', 'hurt', 'attack', 'die', 'skill', 'skill2', 'ult'] as const).map(k => [a[k]!.row, a[k]!.frames]))
      .toEqual([[0, 12], [1, 8], [2, 3], [3, 21], [4, 14], [5, 28], [6, 27], [7, 28]]);
    expect(HERO_BY_ID['draeven']).toEqual(jasmine.objectContaining({ cls: 'tank', star: 3, sprite: 'hero-draeven.png' }));
    expect(HERO_ART['draeven']).toEqual({ portrait: 'portraits/draeven.webp' });
  });

  it('timings: attack 0.8 s (damage 0.34 s) · S1 1.6 s · S2 one hit · ult holds the charge 1.5 s, then ONE final hit', () => {
    const sum = (k: 'attack' | 'ult') => SHEETS['hero-draeven.png'].anims[k]!.steps!.reduce((x, y) => x + y, 0);
    expect(sum('attack')).toBe(800);
    const at = (k: 'attack' | 'skill' | 'skill2' | 'ult', ev: string) => animEvents('hero-draeven.png', k).filter(e => e.event === ev).map(e => e.t);
    expect(at('attack', 'DAMAGE').map(t => Math.round(t * 1000))).toEqual([340]);
    expect(at('skill', 'DAMAGE').length).toBe(1);
    expect(at('skill2', 'DAMAGE').length).toBe(1);
    expect(at('ult', 'DAMAGE').length).toBe(1);
    expect(at('ult', 'CHARGE_START')[0]).toBeLessThan(at('ult', 'DAMAGE')[0]);
    expect(Math.max(...SHEETS['hero-draeven.png'].anims.ult!.steps!)).toBe(1500);
    // the charge aura spans the hold exactly: it starts at CHARGE_START and its strip ends at STRIKE_START
    const aura = FX['dr-ult-charge'];
    expect(aura.event).toBe('CHARGE_START');
    // S1: the taunt loop runs from the cast start — one cycle as a cast FX ends exactly at the taunt (status applied)
    const lead = FX['dr-s1-loop-lead'];
    expect(lead.on).toBe('cast');
    expect(lead.frames * lead.frameMs / 1000).toBeCloseTo(at('skill', 'SKILL_ACTIVATE')[0], 3);
    expect(FX['dr-s1-loop'].frameMs).toBe(lead.frameMs);
    expect(at('ult', 'STRIKE_START')[0] - at('ult', 'CHARGE_START')[0]).toBeCloseTo((aura.frames * aura.frameMs) / 1000, 3);
  });

  it('kit keeps the Tank class ids + cooldowns, and stays PUNISH: no shield, no interrupt, no stun / knockback / Break', () => {
    const k = kitOf('draeven', 'tank');
    const c = CLASS_KITS.tank;
    expect([k.skill.label, k.skill2.label]).toEqual(['Blood Debt', "Sovereign's Reprisal"]);
    expect([k.skill.id, k.skill2.id, k.ult.id]).toEqual([c.skill.id, c.skill2.id, c.ult.id]);
    expect([k.skill.cooldown, k.skill2.cooldown]).toEqual([c.skill.cooldown, c.skill2.cooldown]);
    for (const s of [k.skill, k.skill2, k.ult]) {
      expect(s.effects.some(e => e.type === 'SHIELD' || e.type === 'KNOCKBACK' || e.type === 'INTERRUPT')).toBeFalse();
      expect(s.effects.some(e => e.type === 'APPLY_STATUS' && e.status === 'stun')).toBeFalse();
      expect(s.effects.some(e => e.type === 'DAMAGE' && !!e.breakPower)).toBeFalse();
    }
    expect((['skill', 'skill2', 'ult'] as const).some(s => kitInterrupts(k, s))).toBeFalse();
    expect(k.skill2.movement).toBeUndefined();
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
    const e = new BattleEngine({ allies: [spec('draeven', 0, 1)], stage, enemyTemplates: ENEMIES, seed: 3 });
    e.step(0.05);
    e.drainEvents();
    const dr = e.units.find(u => u.heroId === 'draeven')!;
    const foes = () => e.units.filter(u => u.side !== 'ally' && u.alive);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dmg = (dst: unknown, n: number, src?: unknown) => (e as any).applyDamage(dst, n, false, false, src);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grid = (e as any).grid;
    const place = (u: { id: number; pos: { r: number; c: number } }, cell: { r: number; c: number }) => { grid.move(u.id, u.pos, cell); u.pos = cell; };
    // advance only the engine's delayed actions (the Blood Reprisal peak), without a combat tick
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wait = (sec: number) => { (e as any).time += sec; (e as any).runPending(); };
    return { e, dr, foes, dmg, place, wait };
  }

  it('Blood Debt: taunts, then every foe hit adds a stack; the 5th erupts once (damage around him + capped heal) and ends', () => {
    const b = battle();
    const [f] = b.foes();
    b.place(f, { r: b.dr.pos.r, c: b.dr.pos.c + 1 });
    b.e.skills.applyEffects(b.dr, kitOf('draeven', 'tank').skill, 'skill', f, f.pos);
    expect(hasStatus(b.dr, 'blood_debt')).toBeTrue();
    expect(hasStatus(f, 'taunted')).toBeTrue();
    b.dr.hp = 2000;
    const fhp = f.hp;
    for (let i = 0; i < 4; i++) b.dmg(b.dr, 50, f);
    let ev: BattleEvent[] = b.e.drainEvents();
    expect(ev.filter(x => x.type === 'retaliateStack').length).toBe(4);
    expect(ev.some(x => x.type === 'retaliate')).toBeFalse();
    expect(f.hp).toBe(fhp);
    b.dmg(b.dr, 50, f);
    ev = b.e.drainEvents();
    // the 5th hit: the status ends and the Crimson Spike Eruption starts; damage + heal land at its peak (0.16 s)
    expect(ev.some(x => x.type === 'retaliateStart')).toBeTrue();
    expect(ev.some(x => x.type === 'retaliate')).toBeFalse();
    expect(hasStatus(b.dr, 'blood_debt')).toBeFalse();
    expect(f.hp).toBe(fhp);
    b.wait(0.16);
    ev = b.e.drainEvents();
    const r = ev.find(x => x.type === 'retaliate') as Extract<BattleEvent, { type: 'retaliate' }>;
    expect(r).toBeDefined();
    expect(r.targets).toEqual([f.id]);
    expect(f.hp).toBeLessThan(fhp);
    expect(r.healed).toBe(Math.round(b.dr.maxHp * 0.15));
    expect(hasStatus(b.dr, 'blood_debt')).toBeFalse();
    b.dmg(b.dr, 50, f);
    expect(b.e.drainEvents().some(x => x.type === 'retaliateStack')).toBeFalse();
  });

  it('Blood Reprisal only reaches foes within 1 cell; allies\' hits and DoT never add Blood Debt', () => {
    const b = battle([{ enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 2, c: 1 }]);
    const [near, far] = b.foes();
    b.place(near, { r: b.dr.pos.r, c: b.dr.pos.c + 1 });
    b.place(far, { r: b.dr.pos.r, c: b.dr.pos.c + 4 });
    b.e.skills.applyEffects(b.dr, kitOf('draeven', 'tank').skill, 'skill', near, near.pos);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.e as any).applyDamage(b.dr, 30, false, true, near);
    b.dmg(b.dr, 30, b.dr);
    expect(b.e.drainEvents().some(x => x.type === 'retaliateStack')).toBeFalse();
    const farHp = far.hp;
    for (let i = 0; i < 5; i++) b.dmg(b.dr, 30, near);
    b.wait(0.16);
    const r = b.e.drainEvents().find(x => x.type === 'retaliate') as Extract<BattleEvent, { type: 'retaliate' }>;
    expect(r.targets).toEqual([near.id]);
    expect(far.hp).toBe(farHp);
  });

  it('Blood Reprisal: a holder who falls before the eruption peak never erupts', () => {
    const b = battle();
    const [f] = b.foes();
    b.place(f, { r: b.dr.pos.r, c: b.dr.pos.c + 1 });
    b.e.skills.applyEffects(b.dr, kitOf('draeven', 'tank').skill, 'skill', f, f.pos);
    const fhp = f.hp;
    for (let i = 0; i < 5; i++) b.dmg(b.dr, 10, f);
    b.dmg(b.dr, b.dr.hp, f);
    b.wait(0.16);
    expect(b.e.drainEvents().some(x => x.type === 'retaliate')).toBeFalse();
    expect(f.hp).toBe(fhp);
  });

  it('Sovereign\'s Reprisal: frontal wave + Blood Brand (ATK −15 %); his hits on a branded foe heal him', () => {
    const b = battle();
    const [f] = b.foes();
    b.place(f, { r: b.dr.pos.r, c: b.dr.pos.c + 1 });
    const atk = modifier(f, 'attackMultiplier');
    const hp = f.hp;
    b.e.skills.applyEffects(b.dr, kitOf('draeven', 'tank').skill2, 'skill2', f, f.pos);
    expect(f.hp).toBeLessThan(hp);
    expect(hasStatus(f, 'blood_brand')).toBeTrue();
    expect(modifier(f, 'attackMultiplier')).toBeCloseTo(atk * 0.85, 5);
    b.dr.hp = 3000;
    b.dmg(f, 100, b.dr);
    expect(b.dr.hp).toBe(3012);
  });

  it('Ult: one strike on the front cell, Blood Brand on the hit, −20 % damage taken, Blood Debt re-armed with a taunt', () => {
    const b = battle();
    const [f] = b.foes();
    b.place(f, { r: b.dr.pos.r, c: b.dr.pos.c + 1 });
    const hp = f.hp;
    b.e.skills.applyEffects(b.dr, kitOf('draeven', 'tank').ult, 'ult', f, f.pos);
    expect(f.hp).toBeLessThan(hp);
    expect(hasStatus(f, 'blood_brand')).toBeTrue();
    expect(hasStatus(f, 'taunted')).toBeTrue();
    expect(hasStatus(b.dr, 'sovereign_dominion')).toBeTrue();
    expect(hasStatus(b.dr, 'blood_debt')).toBeTrue();
    expect(modifier(b.dr, 'damageTakenMultiplier')).toBeCloseTo(0.8, 5);
  });
});
