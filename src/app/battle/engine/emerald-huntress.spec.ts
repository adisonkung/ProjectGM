import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_KITS, kitInterrupts, kitOf } from '../../core/data/hero-skills';
import { ENEMIES } from '../../core/data/enemies';
import { MONSTERS } from '../../core/data/monsters';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { STARTER_BENCH, STARTER_TEAM } from '../../core/data/starter';
import { animTiming } from '../../core/data/sprites';
import { SkillSlot } from '../../core/models/combat';
import { Cell } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { rankedKit, skillLines } from '../../core/rules/skill-ranks';
import { rect3x2Center, resolveArea } from './area';
import { BattleEngine, BattleUnit } from './battle-engine';
import { applyBuff, hasStatus } from './buffs';

describe('Sylvara Windwhisper — Emerald Huntress, Phase A', () => {
  const kit = () => kitOf('sylvara', 'archer');

  function battle(count = 3, rounds = false) {
    const t = HERO_BY_ID['sylvara'];
    const spawns = Array.from({ length: count }, (_, i) => ({ enemy: 'forest_slime', r: i % 6, c: i % 3 }));
    const e = new BattleEngine({
      allies: [{ name: t.name, cls: t.cls, heroId: t.id, sprite: t.sprite, pos: { r: 3, c: 1 },
        stats: { ...heroStats(t, { uid: 1, templateId: t.id, level: 1, potential: 'B' }), hp: 10000 } }],
      stage: { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: spawns,
        ...(rounds ? { rounds: [spawns, spawns] } : {}) },
      enemyTemplates: ENEMIES, monsters: { ...MONSTERS }, seed: 7,
    });
    const freeze = () => e.units.forEach(u => { u.castLock = 1e6; u.cd1 = u.cd2 = 1e6; });
    freeze();
    e.step(0.05);
    const caster = e.units.find(u => u.heroId === 'sylvara')!;
    const foes = e.units.filter(u => u.side === 'enemy' && u.alive);
    const place = (u: BattleUnit, cell: Cell) => {
      e.grid.move(u.id, u.pos, cell); u.pos = { ...cell }; u.x = cell.c; u.y = cell.r;
    };
    place(caster, { r: 1, c: 5 });
    foes.forEach((f, i) => { f.hp = f.maxHp = 1e6; place(f, { r: i % 3, c: 8 }); });
    const run = (seconds: number) => {
      for (let i = 0; i < Math.round(seconds / 0.05); i++) { freeze(); e.step(0.05); }
    };
    const apply = (slot: SkillSlot, target = foes[0]) =>
      e.skills.applyEffects(caster, kit()[slot], slot, target, { ...target.pos });
    const kill = (u: BattleUnit) => (e as unknown as { applyDamage(dst: BattleUnit, total: number, crit: boolean): void })
      .applyDamage(u, u.hp + u.shield + 1, false);
    e.drainEvents();
    return { e, caster, foes, place, run, apply, kill };
  }

  it('uses the existing Archer class/basic/rank ids without inheriting rapid repeats or interrupts', () => {
    expect(HERO_BY_ID['sylvara']).toEqual({ id: 'sylvara', name: 'ซิลวารา วินด์วิสเปอร์',
      cls: 'archer', star: 3, sprite: 'hero-sylvara.png' });
    expect(kit().attack).toBe(CLASS_KITS.archer.attack);
    expect([kit().skill.id, kit().skill2.id, kit().ult.id]).toEqual(['rapid_shot', 'arrow_rain', 'heavenly_arrow_rain']);
    expect(kit().skill.repeat).toBeUndefined();
    expect(STARTER_TEAM).not.toContain('sylvara');
    expect(STARTER_BENCH).not.toContain('sylvara');
    for (const slot of ['skill', 'skill2', 'ult'] as const) expect(kitInterrupts(kit(), slot)).toBeFalse();
  });

  it('S1 prefers valid focus, then a low-HP enemy within Archer range', () => {
    const b = battle();
    b.foes[1].hp = 1e5;
    b.place(b.foes[2], { r: 1, c: 14 }); b.foes[2].hp = 1;
    expect(b.e.skills.pickTarget(b.caster, kit().skill, b.foes[0])).toBe(b.foes[1]);
    b.e.setFocus(b.foes[0].id);
    expect(b.e.skills.pickTarget(b.caster, kit().skill, b.foes[1])).toBe(b.foes[0]);
  });

  it('S1 fires exactly one projectile and damages only its target on arrival', () => {
    const b = battle();
    b.e.skills.use(b.caster, 'skill', kit().skill, b.foes[0]);
    b.run(animTiming(b.caster.sprite, 'skill').hit + 0.05);
    const launch = b.e.drainEvents();
    expect(launch.filter(e => e.type === 'projectile').length).toBe(1);
    expect(launch.some(e => e.type === 'damage')).toBeFalse();
    b.run(1);
    expect(b.foes.map(f => f.hp < 1e6)).toEqual([true, false, false]);
    expect(b.e.drainEvents().filter(e => e.type === 'damage').length).toBe(1);
  });

  it('S1 never retargets or damages a target that dies in flight', () => {
    const b = battle(2);
    b.e.skills.use(b.caster, 'skill', kit().skill, b.foes[0]);
    b.run(animTiming(b.caster.sprite, 'skill').hit + 0.05);
    b.kill(b.foes[0]); b.e.drainEvents();
    b.run(1);
    expect(b.e.drainEvents().some(e => e.type === 'damage')).toBeFalse();
    expect(b.foes[1].hp).toBe(1e6);
  });

  it('S2 damages and Roots each stacked 2×2 occupant once on arrow arrival, with no persistent damage', () => {
    const b = battle(6);
    const cells = [{ r: 1, c: 8 }, { r: 1, c: 8 }, { r: 2, c: 8 }, { r: 2, c: 9 }, { r: 0, c: 8 }, { r: 1, c: 10 }];
    b.foes.forEach((f, i) => b.place(f, cells[i]));
    b.e.skills.use(b.caster, 'skill2', kit().skill2, b.foes[0]);
    b.run(animTiming(b.caster.sprite, 'skill2').hit + 0.05);
    expect(b.foes.every(f => !hasStatus(f, 'root'))).toBeTrue();
    expect(b.e.drainEvents().filter(e => e.type === 'projectile').length).toBe(1);
    b.run(0.75);
    expect(b.foes.map(f => f.hp < 1e6)).toEqual([true, true, true, true, false, false]);
    expect(b.foes.map(f => hasStatus(f, 'root'))).toEqual([true, true, true, true, false, false]);
    expect(b.e.drainEvents().filter(e => e.type === 'damage').length).toBe(4);
    expect(b.e.fields.active.length).toBe(0);
    const hp = b.foes.map(f => f.hp);
    b.run(3);
    expect(b.foes.map(f => f.hp)).toEqual(hp);
    expect(b.foes.every(f => !hasStatus(f, 'root'))).toBeTrue();
  });

  it('S2 Root respects ROOT immunity and Unstoppable while its damage still lands', () => {
    const b = battle(2);
    const def = structuredClone(b.e.monsterAI.def(b.foes[0]));
    def.id = 'sylvara_root_immune_fixture'; def.immune = ['ROOT'];
    (b.e as unknown as { monsterDefs: Record<string, typeof def> }).monsterDefs[def.id] = def;
    b.foes[0].monster!.definitionId = def.id;
    applyBuff(b.foes[1], STATUS_EFFECTS['gate_stance'], b.foes[1].id);
    b.apply('skill2');
    expect(b.foes.every(f => !hasStatus(f, 'root'))).toBeTrue();
    expect(b.foes.every(f => f.hp < 1e6)).toBeTrue();
  });

  it('Ult activates once with no projectile damage or burst, then hits exactly five times per occupant', () => {
    const b = battle(1);
    b.caster.mana = 100;
    b.e.skills.use(b.caster, 'ult', kit().ult, b.foes[0]);
    b.run(animTiming(b.caster.sprite, 'ult').hit + 0.05);
    const launch = b.e.drainEvents();
    expect(launch.filter(e => e.type === 'FIELD_STARTED').length).toBe(1);
    expect(launch.some(e => e.type === 'damage' || e.type === 'projectile')).toBeFalse();
    expect(b.foes[0].hp).toBe(1e6);
    const mana = b.caster.mana;
    b.run(5);
    const rain = b.e.drainEvents();
    expect(rain.filter(e => e.type === 'damage' && e.dst === b.foes[0].id).length).toBe(5);
    expect(rain.filter(e => e.type === 'FIELD_ENDED' && e.reason === 'EXPIRED').length).toBe(1);
    expect(b.e.fields.active.length).toBe(0);
    expect(b.caster.mana).toBe(mana);
    const hp = b.foes[0].hp;
    b.run(2);
    expect(b.foes[0].hp).toBe(hp);
  });

  it('rain stays on its original six cells after target/caster movement; entrants are hit and leavers escape', () => {
    const b = battle(4);
    b.place(b.foes[0], { r: 1, c: 8 });
    b.place(b.foes[1], { r: 2, c: 9 });
    b.place(b.foes[2], { r: 0, c: 8 });
    b.place(b.foes[3], { r: 1, c: 11 });
    b.apply('ult');
    b.place(b.foes[0], { r: 1, c: 12 });
    b.place(b.foes[3], { r: 1, c: 7 });
    b.place(b.caster, { r: 0, c: 3 });
    b.run(1);
    expect(b.foes.map(f => f.hp < 1e6)).toEqual([false, true, false, true]);
    const hp = b.foes[1].hp;
    b.place(b.foes[1], { r: 2, c: 10 });
    b.run(4);
    expect(b.foes[1].hp).toBe(hp);
    expect(b.e.drainEvents().filter(e => e.type === 'damage' && e.dst === b.foes[3].id).length).toBe(5);
  });

  it('rain continues after the aimed target dies, cancels on source death and clears between encounters', () => {
    const b = battle(2);
    b.apply('ult'); b.kill(b.foes[0]); b.run(1);
    expect(b.foes[1].hp).toBeLessThan(1e6);
    b.kill(b.caster); b.e.drainEvents(); b.run(1);
    expect(b.e.fields.active.length).toBe(0);
    expect(b.e.drainEvents().some(e => e.type === 'damage')).toBeFalse();
    for (const rounds of [false, true]) {
      const c = battle(1, rounds);
      c.apply('ult'); c.kill(c.foes[0]); c.run(2);
      expect(c.e.fields.active.length).toBe(0);
    }
  });

  it('Root prevents voluntary movement during rain without adding a hidden damage bonus or interrupt', () => {
    const b = battle(1);
    b.apply('skill2');
    const pos = { ...b.foes[0].pos };
    b.apply('ult');
    b.foes[0].castLock = 0; b.foes[0].moveCd = 0;
    b.e.step(0.05);
    expect(b.foes[0].pos).toEqual(pos);
    expect(hasStatus(b.foes[0], 'root')).toBeTrue();
    expect(kit().ult.effects[0].type).toBe('FIELD');
  });

  it('AI counts the real rectangle, and rank damage scales all five pulses without changing area or duration', () => {
    const b = battle(3);
    b.place(b.foes[0], { r: 0, c: 6 });
    b.place(b.foes[1], { r: 1, c: 11 });
    b.place(b.foes[2], { r: 2, c: 12 });
    expect(b.e.skills.pickTarget(b.caster, kit().ult, b.foes[0])).toBe(b.foes[1]);
    const snapshot = JSON.stringify(kit());
    const r5 = rankedKit('sylvara', 'archer', { skill: 5, skill2: 5, ult: 5 });
    const field = r5.ult.effects[0];
    if (field.type !== 'FIELD') throw new Error('Missing rain field');
    expect(field.field.area).toBe('RECT_3X2');
    expect(field.field.duration / field.field.interval).toBe(5);
    const damage = field.field.effects[0];
    if (damage.type !== 'DAMAGE') throw new Error('Missing pulse damage');
    expect(damage.primary).toBeGreaterThan(0.6);
    expect(JSON.stringify(kit())).toBe(snapshot);
    expect(skillLines(r5.ult).some(l => l.includes('3×2'))).toBeTrue();
    const root = r5.skill2.effects.find(e => e.type === 'APPLY_STATUS');
    if (root?.type === 'APPLY_STATUS') expect(root.duration).toBe(2);
  });
});

describe('generic RECT_3X2 footprint', () => {
  const u = (id: number, r: number, c: number) => ({ id, pos: { r, c } });
  it('selects all occupants in six cells, including stacked units, with primary first', () => {
    const caster = u(0, 1, 5), primary = u(9, 1, 8);
    const candidates = [u(1, 1, 7), u(2, 1, 8), primary, u(3, 1, 9), u(4, 2, 7), u(5, 2, 8), u(6, 2, 9), u(7, 0, 8), u(8, 1, 10)];
    expect(resolveArea({ pattern: 'RECT_3X2', caster, primary, candidates }).map(x => x.id)).toEqual([9, 1, 2, 3, 4, 5, 6]);
    expect(rect3x2Center(primary.pos)).toEqual({ r: 1.5, c: 8 });
  });

  it('keeps six valid cells at every corner and behaves identically when mirrored', () => {
    const all = Array.from({ length: 48 }, (_, i) => u(i + 1, Math.floor(i / 16), i % 16));
    for (const at of [{ r: 0, c: 0 }, { r: 0, c: 15 }, { r: 2, c: 0 }, { r: 2, c: 15 }]) {
      const primary = all.find(x => x.pos.r === at.r && x.pos.c === at.c)!;
      for (const caster of [u(0, 1, 0), u(0, 1, 15)]) {
        const hit = resolveArea({ pattern: 'RECT_3X2', caster, primary, candidates: all });
        expect(hit.length).withContext(JSON.stringify(at)).toBe(6);
        expect(hit[0]).toBe(primary);
      }
    }
  });
});
