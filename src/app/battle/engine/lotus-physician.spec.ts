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
import { applyBuff, hasStatus } from './buffs';

/** Lin Xue — Lotus Spirit Physician: targeted heal + splash, cleanse, Qi Guard on the primary, team cleanse + revive */
describe('Lin Xue kit in the engine (HEAL around a target · CLEANSE · SHIELD to PRIMARY)', () => {
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
    // Lin Xue far back; Bai Long + Yue Zheng side by side (adjacent), Tang Xun far away from them
    const e = new BattleEngine({
      allies: [spec('linxue', 0, 0), spec('bailong', 2, 1), spec('yuezheng', 2, 2), spec('tangxun', 0, 4)],
      stage, enemyTemplates: ENEMIES, seed: 7,
    });
    const log: BattleEvent[] = [];
    e.step(0.05);
    log.push(...e.drainEvents());
    const hero = (id: string) => e.units.find(u => u.heroId === id)!;
    for (const u of e.units.filter(x => x.side === 'ally')) u.hp = Math.round(u.maxHp * 0.3);
    const run = (sec: number) => {
      for (let i = 0; i < Math.round(sec / 0.05); i++) {
        e.step(0.05);
        log.push(...e.drainEvents());
      }
    };
    return { e, log, hero, run };
  }

  it('Lotus Prayer: the primary gets the full heal, allies around it a light heal, an ally out of reach nothing', () => {
    const b = battle();
    const [lx, bl, yz, tx] = ['linxue', 'bailong', 'yuezheng', 'tangxun'].map(b.hero);
    const before = [bl.hp, yz.hp, tx.hp];
    b.e.skills.applyEffects(lx, kitOf('linxue', 'healer').skill, 'skill', bl, bl.pos);
    const gain = [bl.hp - before[0], yz.hp - before[1], tx.hp - before[2]];
    expect(gain[0]).toBeGreaterThan(0);
    expect(gain[1]).toBeGreaterThan(0);
    expect(gain[0]).toBeGreaterThan(gain[1] * 2);
    expect(gain[2]).toBe(0);
  });

  it('Spirit Mend: heals, removes the newest debuff only, keeps buffs, grants Qi Guard to the primary only', () => {
    const b = battle();
    const [lx, bl, yz] = ['linxue', 'bailong', 'yuezheng'].map(b.hero);
    applyBuff(bl, STATUS_EFFECTS['poison'], 0, { duration: 5 });
    applyBuff(bl, STATUS_EFFECTS['open_wound'], 0, { duration: 5 });
    applyBuff(bl, STATUS_EFFECTS['rally_haste'], 0, { duration: 5 });
    const hp = bl.hp;
    b.e.skills.applyEffects(lx, kitOf('linxue', 'healer').skill2, 'skill2', bl, bl.pos);
    b.log.push(...b.e.drainEvents());
    expect(bl.hp).toBeGreaterThan(hp);
    expect(hasStatus(bl, 'open_wound')).toBeFalse();
    expect(hasStatus(bl, 'poison')).toBeTrue();
    expect(hasStatus(bl, 'rally_haste')).toBeTrue();
    expect(bl.shield).toBeGreaterThan(0);
    expect(yz.shield).toBe(0);
    expect(b.log.some(ev => ev.type === 'cleanse' && ev.dst === bl.id)).toBeTrue();
  });

  it('Returning Spring Rite: heals the team, cleanses every debuff and revives one fallen ally', () => {
    const b = battle();
    const [lx, bl, yz, tx] = ['linxue', 'bailong', 'yuezheng', 'tangxun'].map(b.hero);
    applyBuff(bl, STATUS_EFFECTS['poison'], 0, { duration: 5 });
    applyBuff(bl, STATUS_EFFECTS['open_wound'], 0, { duration: 5 });
    applyBuff(yz, STATUS_EFFECTS['silence'], 0, { duration: 5 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b.e as any).applyDamage(tx, tx.hp + tx.shield + 1, false);
    expect(tx.life).toBe('DEAD_VISIBLE');
    const hp = lx.hp;
    b.e.skills.applyEffects(lx, kitOf('linxue', 'healer').ult, 'ult', lx, lx.pos);
    expect(lx.hp).toBeGreaterThan(hp);
    expect(['poison', 'open_wound'].some(id => hasStatus(bl, id))).toBeFalse();
    expect(hasStatus(yz, 'silence')).toBeFalse();
    expect(tx.life).toBe('REVIVING');
  });

  it('Lotus Prayer cast: the heal lands on the clip DAMAGE (T043) and its impact lists the healed allies (splash lotus FX)', () => {
    const b = battle();
    const [lx, bl, yz, tx] = ['linxue', 'bailong', 'yuezheng', 'tangxun'].map(b.hero);
    b.log.length = 0;
    b.e.skills.use(lx, 'skill', b.e.skills.kit(lx).skill, bl);
    b.run(1.2);
    const imp = b.log.find(ev => ev.type === 'impact' && ev.src === lx.id) as { dst?: number; hits: number[] } | undefined;
    expect(imp).toBeDefined();
    expect(imp!.dst).toBe(bl.id);
    expect(imp!.hits).toContain(bl.id);
    expect(imp!.hits).toContain(yz.id);
    expect(imp!.hits).not.toContain(tx.id);
  });
});
