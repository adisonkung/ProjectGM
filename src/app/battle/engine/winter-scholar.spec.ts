import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_KITS, kitInterrupts, kitOf } from '../../core/data/hero-skills';
import { HERO_ART } from '../../core/data/hero-art';
import { MIRELLE_PRODUCTION } from '../../core/data/mirelle-production';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { MONSTERS } from '../../core/data/monsters';
import { ENEMIES } from '../../core/data/enemies';
import { FX, SHEETS } from '../../core/data/sprites';
import { STARTER_BENCH, STARTER_TEAM } from '../../core/data/starter';
import { SkillSlot } from '../../core/models/combat';
import { Cell } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { rankedKit, skillLines } from '../../core/rules/skill-ranks';
import { resolveArea } from './area';
import { BattleEngine, BattleUnit } from './battle-engine';
import { applyBuff, attackSpeedReduction, effectiveMoveSpeed, hasStatus, modifier, tickStatuses } from './buffs';

describe('Mirelle Frostglass — Winter Scholar, Phase A', () => {
  const kit = () => kitOf('mirelle', 'mage');

  function battle(count = 3, rounds = false) {
    const t = HERO_BY_ID['mirelle'];
    const spawns = Array.from({ length: count }, (_, i) => ({ enemy: 'forest_slime', r: i % 6, c: i % 3 }));
    const e = new BattleEngine({
      allies: [{ name: t.name, cls: t.cls, heroId: t.id, pos: { r: 3, c: 1 },
        stats: { ...heroStats(t, { uid: 1, templateId: t.id, level: 1, potential: 'B' }), hp: 10000 } }],
      stage: { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: spawns, ...(rounds ? { rounds: [spawns, spawns] } : {}) },
      enemyTemplates: ENEMIES, monsters: { ...MONSTERS }, seed: 7,
    });
    e.step(0.05);
    const caster = e.units.find(u => u.heroId === 'mirelle')!;
    const foes = e.units.filter(u => u.side === 'enemy' && u.alive);
    const place = (u: BattleUnit, cell: Cell) => { e.grid.move(u.id, u.pos, cell); u.pos = { ...cell }; u.x = cell.c; u.y = cell.r; };
    place(caster, { r: 1, c: 5 });
    foes.forEach((f, i) => { f.hp = f.maxHp = 1e6; place(f, { r: i % 3, c: 7 }); });
    const freeze = () => e.units.forEach(u => { u.castLock = 1e6; u.cd1 = u.cd2 = 1e6; });
    freeze();
    const run = (seconds: number) => { for (let i = 0; i < Math.round(seconds / 0.05); i++) { freeze(); e.step(0.05); } };
    const apply = (slot: SkillSlot, target = foes[0], skill = kit()[slot]) => e.skills.applyEffects(caster, skill, slot, target, { ...target.pos });
    const kill = (u: BattleUnit) => (e as unknown as { applyDamage(dst: BattleUnit, total: number, crit: boolean): void })
      .applyDamage(u, u.hp + u.shield + 1, false);
    return { e, caster, foes, place, run, apply, kill };
  }

  it('registers an existing Mage, retaining Mage stats/basic attack and the established skill rank ids', () => {
    expect(HERO_BY_ID['mirelle']).toEqual({ id: 'mirelle', name: 'มิเรลล์ ฟรอสต์กลาส', cls: 'mage', star: 3 });
    expect(kit().attack).toBe(CLASS_KITS.mage.attack);
    expect([kit().skill.id, kit().skill2.id, kit().ult.id]).toEqual(['soul_curse', 'bone_hand', 'soul_beam']);
    expect(STARTER_TEAM).not.toContain('mirelle');
    expect(STARTER_BENCH).not.toContain('mirelle');
    for (const slot of ['skill', 'skill2', 'ult'] as const) expect(kitInterrupts(kit(), slot)).toBeFalse();
  });

  it('records pending assets and semantic requirements without broken runtime registrations or final timings', () => {
    expect(HERO_ART['mirelle']).toBeUndefined();
    expect(SHEETS['hero-mirelle.png']).toBeUndefined();
    expect(MIRELLE_PRODUCTION.sourcesAvailableInWorkspace).toBeFalse();
    for (const clip of Object.values(MIRELLE_PRODUCTION.clips)) {
      expect(clip.state).toBe('AWAITING_SKILL_REVIEW');
      expect(clip.events).toContain('CAST_START');
      expect(clip.events).toContain('ANIMATION_END');
      for (const asset of clip.assets) expect(FX[asset.key]).toBeUndefined();
    }
  });

  it('Frost Needle hits one target and applies normal Slow without Chill', () => {
    const b = battle();
    const hp = b.foes.map(f => f.hp);
    b.apply('skill');
    expect(b.foes.map((f, i) => f.hp < hp[i])).toEqual([true, false, false]);
    expect(modifier(b.foes[0], 'moveSpeedMultiplier')).toBe(0.75);
    expect(hasStatus(b.foes[0], 'chill')).toBeFalse();
  });

  it('Frost Needle upgrades an existing Slow on a Chilled target, and later weaker Slow cannot dilute it', () => {
    const b = battle();
    b.apply('skill');
    applyBuff(b.foes[0], STATUS_EFFECTS['chill'], b.caster.id);
    b.apply('skill');
    expect(modifier(b.foes[0], 'moveSpeedMultiplier')).toBe(0.55);
    b.foes[0].buffs = b.foes[0].buffs.filter(s => s.def.id !== 'chill');
    b.apply('skill');
    expect(modifier(b.foes[0], 'moveSpeedMultiplier')).toBe(0.55);
    expect(b.foes[0].buffs.filter(s => s.def.id === 'slow').length).toBe(1);
    tickStatuses(b.foes[0], 2);
    expect(effectiveMoveSpeed(b.foes[0])).toBe(b.foes[0].moveSpeed);
  });

  it('Frost Needle applies damage and Slow on projectile arrival, never at launch', () => {
    const b = battle(1);
    b.e.skills.use(b.caster, 'skill', kit().skill, b.foes[0]);
    expect(hasStatus(b.foes[0], 'slow')).toBeFalse();
    b.run(0.3); // token wind-up/flight are fallback only, not an authored Mirelle timeline
    expect(b.e.drainEvents().some(e => e.type === 'projectile')).toBeTrue();
    expect(hasStatus(b.foes[0], 'slow')).toBeFalse();
    b.run(1);
    expect(hasStatus(b.foes[0], 'slow')).toBeTrue();
  });

  it('Glassbind hits stacked occupants in 2×2; only previously Chilled recipients Root, all hit recipients Chill', () => {
    const b = battle(6);
    const cells = [{ r: 1, c: 7 }, { r: 1, c: 7 }, { r: 2, c: 7 }, { r: 2, c: 8 }, { r: 0, c: 7 }, { r: 1, c: 9 }];
    b.foes.forEach((f, i) => b.place(f, cells[i]));
    applyBuff(b.foes[1], STATUS_EFFECTS['chill'], b.caster.id);
    b.apply('skill2');
    expect(b.foes.map(f => hasStatus(f, 'chill'))).toEqual([true, true, true, true, false, false]);
    expect(b.foes.map(f => hasStatus(f, 'root'))).toEqual([false, true, false, false, false, false]);
    expect(kitInterrupts(kit(), 'skill2')).toBeFalse();
    b.apply('skill2');
    expect(b.foes.slice(0, 4).every(f => hasStatus(f, 'root'))).toBeTrue();
  });

  it('AI prefers actual 2×2 clusters and can set up Chill against a lone enemy', () => {
    const b = battle(3);
    b.place(b.foes[0], { r: 0, c: 6 });
    b.place(b.foes[1], { r: 1, c: 8 });
    b.place(b.foes[2], { r: 2, c: 9 });
    expect(b.e.skills.pickTarget(b.caster, kit().skill2, b.foes[0])).toBe(b.foes[1]);
    b.foes[1].alive = b.foes[2].alive = false;
    b.caster.cd2 = 0;
    expect(b.e.skills.chooseSkill(b.caster, b.foes[0])?.slot).toBe('skill2');
  });

  it('status conditions use pre-hit state even when the Chill effect appears before Root', () => {
    const b = battle(1);
    const s = kit().skill2;
    b.apply('skill2', b.foes[0], { ...s, effects: [s.effects[0], s.effects[2], s.effects[1]] });
    expect(hasStatus(b.foes[0], 'chill')).toBeTrue();
    expect(hasStatus(b.foes[0], 'root')).toBeFalse();
  });

  it('Root conversion respects monster ROOT immunity and Unstoppable', () => {
    const b = battle(2);
    const bossDef = structuredClone(b.e.monsterAI.def(b.foes[0]));
    bossDef.id = 'root_immune_fixture'; bossDef.immune = ['ROOT'];
    const defs = (b.e as unknown as { monsterDefs: Record<string, typeof bossDef> }).monsterDefs;
    defs[bossDef.id] = bossDef;
    b.foes[0].monster!.definitionId = bossDef.id;
    applyBuff(b.foes[1], STATUS_EFFECTS['gate_stance'], b.foes[1].id);
    for (const f of b.foes) applyBuff(f, STATUS_EFFECTS['chill'], b.caster.id);
    b.apply('skill2');
    expect(b.foes.every(f => !hasStatus(f, 'root'))).toBeTrue();
    delete defs[bossDef.id];
  });

  it('Slow changes both hero and monster voluntary movement cadence without mutating base speed', () => {
    const normal = battle(1);
    const slowed = battle(1);
    for (const b of [normal, slowed]) {
      b.place(b.foes[0], { r: 1, c: 12 });
      b.caster.castLock = b.foes[0].castLock = 0;
      if (b === slowed) for (const u of [b.caster, b.foes[0]]) applyBuff(u, STATUS_EFFECTS['slow'], u.id);
      for (const u of [b.caster, b.foes[0]]) u.moveCd = 0;
      b.e.step(0.05);
    }
    expect(slowed.caster.moveSpeed).toBe(normal.caster.moveSpeed);
    expect(slowed.foes[0].moveSpeed).toBe(normal.foes[0].moveSpeed);
    expect(slowed.caster.moveCd).toBeGreaterThan(normal.caster.moveCd);
    expect(slowed.foes[0].moveCd).toBeGreaterThan(normal.foes[0].moveCd);
  });

  it('field attack-speed reduction slows the monster cooldown clock and preserves existing haste behavior', () => {
    const b = battle(1);
    const f = b.foes[0];
    f.monster!.attackCooldownRemaining = 2;
    applyBuff(f, STATUS_EFFECTS['frost_fatigue'], b.caster.id);
    expect(attackSpeedReduction(f)).toBe(0.9);
    b.e.monsterAI.update(f, 0.5);
    expect(f.monster!.attackCooldownRemaining).toBeCloseTo(1.55, 6);
    applyBuff(f, STATUS_EFFECTS['axe_frenzy'], f.id);
    expect(attackSpeedReduction(f)).toBe(0.9);
    f.buffs = f.buffs.filter(s => s.def.id !== 'frost_fatigue');
    expect(attackSpeedReduction(f)).toBe(1);
  });

  it('Winterglass Field has no launch burst, stays fixed after target/source movement, and affects new occupants', () => {
    const b = battle(3);
    b.place(b.foes[0], { r: 1, c: 7 });
    b.place(b.foes[1], { r: 2, c: 8 });
    b.place(b.foes[2], { r: 1, c: 10 });
    b.apply('ult');
    expect(b.foes.every(f => f.hp === 1e6)).toBeTrue();
    expect(b.e.fields.active[0].center).toEqual({ r: 1, c: 7 });
    b.place(b.foes[0], { r: 1, c: 11 });
    b.place(b.foes[2], { r: 0, c: 6 });
    b.place(b.caster, { r: 1, c: 4 });
    b.run(1);
    expect(b.foes.map(f => f.hp < 1e6)).toEqual([false, true, true]);
    expect(b.foes.map(f => hasStatus(f, 'frost_fatigue'))).toEqual([false, true, true]);
    expect(modifier(b.foes[1], 'attackSpeedMultiplier')).toBe(0.9);
    expect(modifier(b.foes[1], 'moveSpeedMultiplier')).toBe(0.75);
    const hp = b.foes[1].hp;
    b.place(b.foes[1], { r: 2, c: 10 });
    b.run(1.2);
    expect(b.foes[1].hp).toBe(hp);
    expect(hasStatus(b.foes[1], 'frost_fatigue')).toBeFalse();
  });

  it('field does not depend on the original target surviving; expires after six light pulses', () => {
    const b = battle(2);
    b.apply('ult');
    b.kill(b.foes[0]);
    const mana = b.caster.mana;
    b.run(6);
    expect(b.e.fields.active.length).toBe(0);
    expect(b.foes[1].hp).toBeLessThan(1e6);
    expect(b.caster.mana).toBe(mana); // skill pulses do not generate basic-attack gauge
    const hp = b.foes[1].hp;
    b.run(2);
    expect(b.foes[1].hp).toBe(hp);
  });

  it('cancels fields when the caster dies', () => {
    const b = battle(2);
    b.apply('ult');
    b.kill(b.caster);
    b.run(0.05);
    expect(b.e.fields.active.length).toBe(0);
    expect(b.foes.every(f => f.hp === 1e6)).toBeTrue();
  });

  it('clears fields on stage end and wave advance, with no field damage in the next encounter', () => {
    for (const rounds of [false, true]) {
      const b = battle(1, rounds);
      b.apply('ult');
      b.kill(b.foes[0]);
      b.run(2);
      expect(b.e.fields.active.length).withContext(`rounds=${rounds}`).toBe(0);
    }
  });

  it('ranks scale field pulse damage on copies, never mutate base kit or remove condition gates', () => {
    const base = kit();
    const snapshot = JSON.stringify(base);
    const r5 = rankedKit('mirelle', 'mage', { skill: 5, skill2: 5, ult: 5 });
    const field = r5.ult.effects[0];
    expect(field.type).toBe('FIELD');
    if (field.type === 'FIELD') {
      const damage = field.field.effects[0];
      expect(damage.type).toBe('DAMAGE');
      if (damage.type === 'DAMAGE') expect(damage.primary).toBeGreaterThan(0.15);
      expect(field.field.duration).toBe(6);
    }
    expect(JSON.stringify(base)).toBe(snapshot);
    const root = r5.skill2.effects.find(e => e.type === 'APPLY_STATUS' && e.status === 'root');
    if (root?.type === 'APPLY_STATUS') {
      expect(root.duration).toBeLessThanOrEqual(2);
      expect(root.when).toEqual({ status: 'chill', present: true });
    }
    expect(skillLines(r5.ult).some(line => line.includes('3×3'))).toBeTrue();
  });
});

describe('generic SQUARE_2 area', () => {
  const u = (id: number, r: number, c: number) => ({ id, pos: { r, c } });
  it('mirrors toward the enemy and keeps two lanes at the bottom edge', () => {
    const caster = u(0, 1, 10);
    const primary = u(1, 2, 7);
    const candidates = [primary, u(2, 2, 6), u(3, 1, 6), u(4, 0, 6), u(5, 2, 8)];
    expect(resolveArea({ pattern: 'SQUARE_2', caster, primary, candidates }).map(f => f.id)).toEqual([1, 2, 3]);
  });
});
