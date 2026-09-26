import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { kitOf } from '../../core/data/hero-skills';
import { MONSTER_SKILLS } from '../../core/data/monsters';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { EquipmentInstance, EquipStat, Rarity } from '../../core/models/equipment';
import { OwnedHero } from '../../core/models/hero';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { rollItem } from '../../core/rules/equipment';
import { combatModifiers, skillRanksOf } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { BattleEngine, BattleEvent, BattleUnit } from './battle-engine';
import { applyBuff, buffRemaining, modifier } from './buffs';
import { effectiveAttack } from './damage-resolver';

/** Skill Upgrade — engine integration (ranked kits per unit, status overrides, caps). */

let nextId = 1;
const item = (defId: string, rarity: Rarity, main: EquipStat, o: { affix?: string | null; level?: number; sec?: EquipStat[] } = {}): EquipmentInstance =>
  ({ ...rollItem(defId, rarity, () => 0, nextId++, { main, secondaries: o.sec ?? [], affix: o.affix ?? null }), upgradeLevel: o.level ?? 0 });
const hero = (templateId: string, o: Partial<OwnedHero> = {}): OwnedHero => ({ uid: 1, templateId, level: 10, potential: 'B', breakthroughTier: 3, ...o });
const spec = (id: string, h: OwnedHero, depth: number, lane: number, hp = 99999): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + depth * 10 + lane, sprite: t.sprite,
    stats: { ...heroStats(t, h), hp }, mods: combatModifiers(h), skillRanks: skillRanksOf(h), pos: { r: depth, c: lane },
  };
};
function battle(allies: UnitSpec[], enemies: EnemyPlacement[]) {
  const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies };
  const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: 7 });
  const log: BattleEvent[] = [];
  const run = (sec: number) => {
    for (let i = 0; i < Math.round(sec / 0.05) && !e.result; i++) {
      e.step(0.05);
      log.push(...e.drainEvents());
    }
  };
  run(0.05);
  const heroU = (id: string) => e.units.find(u => u.heroId === id)!;
  const monsters = (id: string) => e.units.filter(u => u.monster?.definitionId === id);
  const statue = (u: BattleUnit) => applyBuff(u, STATUS_EFFECTS['root'], 0, { duration: 999 });
  return { e, log, run, heroU, monsters, statue };
}

describe('Skill Upgrade — engine', () => {
  it('each unit fights with its own ranked kit; enemies / rank-1 heroes keep the authored kit', () => {
    const b = battle([spec('aurel', hero('aurel', { skillRanks: { skill2: 5 } }), 0, 1), spec('jin', hero('jin'), 0, 0)], [{ enemy: 'forest_slime', r: 0, c: 1 }]);
    const tank = b.heroU('aurel');
    expect(b.e.skills.kit(tank).skill2.cooldown).toBe(11.5);
    expect(b.e.skills.kit(b.heroU('jin'))).toBe(kitOf('jin', 'fighter'));
    expect(kitOf('aurel', 'tank').skill2.cooldown).toBe(12);
  });

  it('Taunt R5: taunt 3.5 s on enemies, taunt_guard 45 % DR (derived status, global definition unchanged)', () => {
    const b = battle([spec('aurel', hero('aurel', { skillRanks: { skill: 5 } }), 0, 1)], [{ enemy: 'forest_slime', r: 0, c: 1 }]);
    const tank = b.heroU('aurel');
    const m = b.monsters('forest_slime')[0];
    (b.e as any).relocate(tank, { r: m.pos.r, c: m.pos.c - 1 }, 'blink');
    b.e.skills.use(tank, 'skill', b.e.skills.kit(tank).skill, m);
    b.run(1);
    expect(modifier(tank, 'damageTakenMultiplier')).toBeCloseTo(0.55, 5);
    expect(buffRemaining(m, 'taunted')).toBeGreaterThan(2.5);
    expect(buffRemaining(m, 'taunted')).toBeLessThanOrEqual(3.5);
    expect(STATUS_EFFECTS['taunt_guard'].modifiers.damageTakenMultiplier).toBe(0.6);
  });

  it('DoT uses final ATK × rank potency (Poison Smoke R5 poison ×1.2)', () => {
    const tick = (rank: number) => {
      const b = battle([spec('shade', hero('shade', { skillRanks: { skill2: rank } }), 0, 1)], [{ enemy: 'forest_slime', r: 0, c: 1 }]);
      const shade = b.heroU('shade');
      const m = b.monsters('forest_slime')[0];
      m.hp = m.maxHp = 99999;
      (b.e as any).relocate(shade, { r: m.pos.r, c: m.pos.c - 1 }, 'blink');
      b.e.skills.use(shade, 'skill2', b.e.skills.kit(shade).skill2, m);
      b.run(1.2);
      const p = m.buffs.find(x => x.def.id === 'poison')!;
      return p.magnitude / effectiveAttack(shade);
    };
    expect(tick(1)).toBeCloseTo(1, 5);
    expect(tick(5)).toBeCloseTo(1.2, 5);
  });

  it('heal = final ATK × rank × healing power (Holy Blessing R5 ≈ ×1.3)', () => {
    const healed = (rank: number) => {
      const b = battle([spec('lumina', hero('lumina', { skillRanks: { skill2: rank } }), 3, 1), spec('aurel', hero('aurel'), 0, 1)], [{ enemy: 'forest_slime', r: 5, c: 1 }]);
      const tank = b.heroU('aurel');
      tank.hp = 1;
      b.e.skills.use(b.heroU('lumina'), 'skill2', b.e.skills.kit(b.heroU('lumina')).skill2, tank);
      b.run(1.5);
      return b.log.filter(ev => ev.type === 'heal' && (ev as any).dst === tank.id).reduce((a, ev) => a + ((ev as any).amount ?? 0), 0);
    };
    const r = healed(5) / healed(1);
    expect(r).toBeGreaterThan(1.25);
    expect(r).toBeLessThan(1.36);
  });

  it('cooldown: ranked cooldown × gear CDR, never below authored × (1 − 22 %)', () => {
    const acc = item('trinket', 'EPIC', 'cooldownReduction', { level: 10, affix: 'focus', sec: ['cooldownReduction'] });
    const wpn = item('longbow', 'EPIC', 'atkPct', { affix: 'focus' });
    const h = hero('sylvie', { skillRanks: { skill2: 5 }, gear: { ACCESSORY: acc, WEAPON: wpn } });
    const b = battle([spec('sylvie', h, 3, 1)], [{ enemy: 'forest_slime', r: 0, c: 1 }]);
    const syl = b.heroU('sylvie');
    b.e.skills.use(syl, 'skill2', b.e.skills.kit(syl).skill2, b.monsters('forest_slime')[0]);
    // 10 s × 0.85 = 8.5 → floor 11 × 0.78 = 8.58
    expect(syl.cd2).toBeCloseTo(11 * 0.78, 5);
  });

  it('Break: R5 Shield Charge 70 + Arrow Rain R5 50 break Forest Oblivion together; one skill alone never can (cap 95)', () => {
    const gear = { ACCESSORY: item('trinket', 'EPIC', 'breakPower', { level: 10, affix: 'breaker' }), WEAPON: item('heavy_blade', 'EPIC', 'breakPower', { level: 10 }) };
    const b = battle([
      spec('aurel', hero('aurel', { skillRanks: { skill2: 5, ult: 5 }, gear }), 0, 1),
      spec('sylvie', hero('sylvie', { skillRanks: { skill2: 5 } }), 3, 1),
    ], [{ enemy: 'fallen_forest_guardian', r: 1, c: 1 }]);
    const g = b.monsters('fallen_forest_guardian')[0];
    b.statue(g);
    const tank = b.heroU('aurel');
    (b.e as any).relocate(tank, { r: g.pos.r, c: g.pos.c - 1 }, 'blink');
    g.monster!.state = 'CASTING';
    g.monster!.currentSkillId = 'forest_oblivion';
    (b.e as any).beginCast(g, MONSTER_SKILLS['forest_oblivion'], null);
    // ult: 75 + 20 gear = 95 (capped, < 100)
    b.e.skills.applyEffects(tank, b.e.skills.kit(tank).ult, 'ult', tank, tank.pos);
    expect(g.casting?.breakDamage).toBe(95);
    b.e.skills.applyEffects(b.heroU('sylvie'), b.e.skills.kit(b.heroU('sylvie')).skill2, 'skill2', g, g.pos);
    expect(b.log.concat(b.e.drainEvents()).some(ev => ev.type === 'broken')).toBeTrue();
  });

  it('Bone Hand R5 roots 1.8 s (≤ 2 s cap) and never interrupts', () => {
    const b = battle([spec('velma', hero('velma', { skillRanks: { skill2: 5 } }), 3, 1)], [{ enemy: 'goblin_shaman', r: 4, c: 1 }]);
    const s = b.monsters('goblin_shaman')[0];
    (b.e as any).beginCast(s, MONSTER_SKILLS['healing_ritual'], null);
    b.e.skills.applyEffects(b.heroU('velma'), b.e.skills.kit(b.heroU('velma')).skill2, 'skill2', s, s.pos);
    expect(buffRemaining(s, 'root')).toBeCloseTo(1.8, 5);
    expect(s.casting).not.toBeNull();
  });

  it('resurrection R5 revives at 50 % HP but still once per stage', () => {
    const b = battle([spec('lumina', hero('lumina', { skillRanks: { ult: 5 } }), 3, 1), spec('aurel', hero('aurel'), 0, 1), spec('jin', hero('jin'), 0, 0)], [{ enemy: 'forest_slime', r: 5, c: 1 }]);
    const lum = b.heroU('lumina');
    for (const id of ['aurel', 'jin']) {
      const u = b.heroU(id);
      (b.e as any).applyDamage(u, u.hp + 10, false, true);
    }
    b.run(0.1);
    b.e.skills.applyEffects(lum, b.e.skills.kit(lum).ult, 'ult', lum, lum.pos);
    b.run(2);
    const back = ['aurel', 'jin'].map(id => b.heroU(id)).filter(u => u.alive);
    expect(back.length).toBe(1);
    b.e.skills.applyEffects(lum, b.e.skills.kit(lum).ult, 'ult', lum, lum.pos);
    b.run(2);
    expect(['aurel', 'jin'].map(id => b.heroU(id)).filter(u => u.alive).length).toBe(1);
  });
});
