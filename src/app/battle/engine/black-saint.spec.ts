import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { kitOf } from '../../core/data/hero-skills';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { OwnedHero } from '../../core/models/hero';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { combatModifiers, skillRanksOf } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { BattleEngine, BattleEvent } from './battle-engine';
import { applyBuff, hasStatus, modifier, statusStacks } from './buffs';

/**
 * Lucien Valthorne — The Black Saint (V1 prototype values, user 2026-10-28): Sacred Burden (−4 % damage taken per
 * stack, additive, max 5, kept until the Ult) · S1 Black Benediction · S2 Martyr's Veil (30 % redirect × 0.85 × his DR)
 * · Ult Black Miracle (consume all Burden → team heal × (1 + 0.15 × stacks) + ward + delayed recovery)
 */
describe('Lucien Valthorne (3★ Healer) — The Black Saint', () => {
  const owned = (templateId: string): OwnedHero => ({ uid: 1, templateId, level: 10, potential: 'B', breakthroughTier: 0 });
  const spec = (id: string, r: number, c: number): UnitSpec => {
    const t = HERO_BY_ID[id];
    const h = owned(id);
    return {
      name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + r * 10 + c, sprite: t.sprite,
      stats: { ...heroStats(t, h), hp: 5000 }, mods: combatModifiers(h), skillRanks: skillRanksOf(h), pos: { r, c },
    };
  };
  function battle() {
    const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'forest_slime', r: 0, c: 1 }] as EnemyPlacement[] };
    const e = new BattleEngine({
      allies: [spec('lucien', 0, 3), spec('bailong', 2, 1), spec('yuezheng', 2, 2)], stage, enemyTemplates: ENEMIES, seed: 7,
    });
    const log: BattleEvent[] = [];
    e.step(0.05);
    log.push(...e.drainEvents());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e as any).rng = () => 0.5;
    const hero = (id: string) => e.units.find(u => u.heroId === id)!;
    const kit = kitOf('lucien', 'healer');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const damage = (dst: ReturnType<typeof hero>, amount: number) => (e as any).applyDamage(dst, amount, false, false);
    const run = (sec: number) => {
      for (let i = 0; i < Math.round(sec / 0.05); i++) {
        e.step(0.05);
        log.push(...e.drainEvents());
      }
    };
    return { e, log, hero, kit, damage, run };
  }

  it('registry: existing Healer class ids, no Heal Bolt — the normal attack is a 100 % MAGIC bolt at a foe', () => {
    const k = kitOf('lucien', 'healer');
    expect(HERO_BY_ID['lucien'].cls).toBe('healer');
    expect(k.healBolt).toBeUndefined();
    expect(k.attack.target).toBe('CURRENT');
    expect(k.attack.effects).toEqual([{ type: 'DAMAGE', area: 'SINGLE', primary: 1, damageType: 'MAGIC' }]);
    expect([k.skill.label, k.skill2.label, k.ult.label]).toEqual(['Black Benediction', "Martyr's Veil", 'Black Miracle']);
    expect([k.skill.id, k.skill2.id, k.ult.id]).toEqual(['prayer', 'holy_blessing', 'holy_resurrection']);
  });

  it('Sacred Burden: max 5 stacks, −4 % damage taken each, additive (5 = −20 %), no expiry', () => {
    const b = battle();
    const lu = b.hero('lucien');
    for (let i = 0; i < 7; i++) applyBuff(lu, STATUS_EFFECTS['sacred_burden'], lu.id, { duration: Infinity });
    expect(statusStacks(lu, 'sacred_burden')).toBe(5);
    expect(modifier(lu, 'damageTakenMultiplier')).toBeCloseTo(0.8, 6);
    b.run(30);
    expect(statusStacks(lu, 'sacred_burden')).toBe(5);
  });

  it('S1 Black Benediction: heals the lowest HP % ally 180 % ATK + 6 % of its max HP at once, +1 Burden', () => {
    const b = battle();
    const [lu, bl, yz] = ['lucien', 'bailong', 'yuezheng'].map(b.hero);
    bl.hp = Math.round(bl.maxHp * 0.4);
    yz.hp = Math.round(yz.maxHp * 0.3);
    expect(b.e.skills.pickTarget(lu, b.kit.skill, null)?.id).toBe(yz.id);
    const hp = yz.hp;
    b.e.skills.applyEffects(lu, b.kit.skill, 'skill', yz, yz.pos);
    expect(yz.hp).toBeGreaterThan(hp + yz.maxHp * 0.06);
    expect(statusStacks(lu, 'sacred_burden')).toBe(1);
  });

  it("S2 Martyr's Veil: links the lowest HP % ally (never himself), +2 Burden; 30 % redirected, Lucien takes it × 0.85 × his DR", () => {
    const b = battle();
    const [lu, bl, yz] = ['lucien', 'bailong', 'yuezheng'].map(b.hero);
    lu.hp = Math.round(lu.maxHp * 0.1); // lowest himself — still links someone else
    bl.hp = Math.round(bl.maxHp * 0.5);
    const target = b.e.skills.pickTarget(lu, b.kit.skill2, null)!;
    expect(target.id).toBe(bl.id);
    lu.hp = lu.maxHp;
    b.e.skills.applyEffects(lu, b.kit.skill2, 'skill2', bl, bl.pos);
    expect(hasStatus(bl, 'martyr_veil')).toBeTrue();
    expect(hasStatus(yz, 'martyr_veil')).toBeFalse();
    expect(statusStacks(lu, 'sacred_burden')).toBe(2);
    // 1000 damage on the ally: ally 700 · Lucien 300 × 0.85 × (1 − 0.08) = 235
    const [a0, l0] = [bl.hp, lu.hp];
    b.damage(bl, 1000);
    expect(a0 - bl.hp).toBe(700);
    expect(l0 - lu.hp).toBe(Math.round(300 * 0.85 * 0.92));
    // at 5 stacks the spec's example: 300 × 0.85 × 0.80 = 204
    for (let i = 0; i < 3; i++) applyBuff(lu, STATUS_EFFECTS['sacred_burden'], lu.id, { duration: Infinity });
    const l1 = lu.hp;
    b.damage(bl, 1000);
    expect(l1 - lu.hp).toBe(204);
  });

  it('Garrick-style links (no damageTransferTaken) keep landing the share unmodified', () => {
    expect(STATUS_EFFECTS['gate_ward'].damageTransferTaken).toBeUndefined();
    expect(STATUS_EFFECTS['soul_link'].damageTransferTaken).toBeUndefined();
  });

  it('Ult Black Miracle: consumes all Burden; heal × (1 + 0.15 × stacks); team ward ×0.85 5 s; recovery HoT scales too', () => {
    const heal = (stacks: number) => {
      const b = battle();
      const [lu, bl, yz] = ['lucien', 'bailong', 'yuezheng'].map(b.hero);
      for (let i = 0; i < stacks; i++) applyBuff(lu, STATUS_EFFECTS['sacred_burden'], lu.id, { duration: Infinity });
      for (const u of [lu, bl, yz]) u.hp = 100;
      const before = bl.hp;
      b.e.skills.applyEffects(lu, b.kit.ult, 'ult', lu, lu.pos);
      const gained = bl.hp - before;
      expect(statusStacks(lu, 'sacred_burden')).toBe(0);
      for (const u of [lu, bl, yz]) {
        expect(modifier(u, 'damageTakenMultiplier')).toBeCloseTo(0.85, 6);
        expect(hasStatus(u, 'miracle_recovery')).toBeTrue();
      }
      const hot = bl.buffs.find(x => x.def.id === 'miracle_recovery')!.magnitude;
      return { gained, hot };
    };
    const zero = heal(0);
    const five = heal(5);
    expect(five.gained / zero.gained).toBeCloseTo(1.75, 2);
    expect(five.hot / zero.hot).toBeCloseTo(2.25, 3); // potency × (1 + 0.25 × 5)
  });
});
