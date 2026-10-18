import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_KITS, kitOf } from '../../core/data/hero-skills';
import { ENEMIES } from '../../core/data/enemies';
import { MONSTERS } from '../../core/data/monsters';
import { STARTER_TEAM, STARTER_BENCH } from '../../core/data/starter';
import { animTiming } from '../../core/data/sprites';
import { Cell } from '../../core/models/unit';
import { SkillSlot } from '../../core/models/combat';
import { heroStats } from '../../core/rules/stats';
import { rankedKit, skillLines } from '../../core/rules/skill-ranks';
import { BattleEngine, BattleUnit } from './battle-engine';
import { applyBuff, modifier } from './buffs';
import { DamageResolver } from './damage-resolver';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { resolveArea } from './area';

describe('Elira Dawnmere — Keeper of the Hearthlight, Phase A', () => {
  const kit = () => kitOf('elira', 'healer');
  function battle() {
    const t = HERO_BY_ID['elira'];
    const e = new BattleEngine({
      allies: ['elira', 'bailong', 'kael'].map((id, i) => {
        const h = HERO_BY_ID[id];
        return { name: h.name, cls: h.cls, heroId: h.id, sprite: h.sprite, pos: { r: 3, c: i },
          stats: { ...heroStats(h, { uid: i + 1, templateId: id, level: 1, potential: 'B' }), hp: 10000 } };
      }),
      stage: { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [{ enemy: 'forest_slime', r: 0, c: 1 }] },
      enemyTemplates: ENEMIES, monsters: { ...MONSTERS }, seed: 7,
    });
    const freeze = () => e.units.forEach(u => { u.castLock = u.cd1 = u.cd2 = 1e6; });
    freeze(); e.step(0.05);
    const caster = e.units.find(u => u.heroId === t.id)!;
    const allies = e.units.filter(u => u.side === 'ally');
    const foe = e.units.find(u => u.side === 'enemy')!;
    foe.hp = foe.maxHp = 1e6;
    const place = (u: BattleUnit, cell: Cell) => {
      e.grid.move(u.id, u.pos, cell); u.pos = { ...cell }; u.x = cell.c; u.y = cell.r;
    };
    allies.forEach((u, i) => place(u, { r: i, c: 2 }));
    place(foe, { r: 1, c: 8 });
    const run = (s: number) => { for (let i = 0; i < Math.round(s / 0.05); i++) { freeze(); e.step(0.05); } };
    const apply = (slot: SkillSlot, target = caster) => e.skills.applyEffects(caster, kit()[slot], slot, target, { ...target.pos });
    e.drainEvents();
    return { e, caster, allies, foe, place, run, apply };
  }

  it('uses Healer progression with a Holy-themed Magic basic, without Heal Bolt or inherited revive', () => {
    expect(HERO_BY_ID['elira'].cls).toBe('healer');
    expect(kit().attack).toBe(CLASS_KITS.healer.attack);
    expect(kit().healBolt).toBeUndefined();
    expect([kit().skill.id, kit().skill2.id, kit().ult.id]).toEqual(['prayer', 'holy_blessing', 'holy_resurrection']);
    expect(kit().ult.effects.some(e => e.type === 'REVIVE' || e.type === 'HEAL' || e.type === 'DAMAGE')).toBeFalse();
    expect(STARTER_TEAM).not.toContain('elira'); expect(STARTER_BENCH).not.toContain('elira');
  });

  it('S1 targets the lowest HP percentage across allies including self, rather than lowest raw HP', () => {
    const b = battle();
    b.caster.hp = 2500; b.caster.maxHp = 10000;
    b.allies[1].hp = 1000; b.allies[1].maxHp = 2000;
    b.place(b.allies[1], { r: 2, c: 15 });
    expect(b.e.skills.pickTarget(b.caster, kit().skill, b.foe)).toBe(b.caster);
    b.caster.hp = 10000;
    expect(b.e.skills.pickTarget(b.caster, kit().skill, b.foe)).toBe(b.allies[1]);
  });

  it('S1 heals only its selected living ally at activation, with no projectile or damage', () => {
    const b = battle(), a = b.allies[1];
    a.hp = 1000;
    b.e.skills.use(b.caster, 'skill', kit().skill, a);
    b.run(0.45); expect(a.hp).toBe(1000);
    b.run(0.05);
    expect(a.hp).toBe(1000 + Math.round(b.caster.atk * 2.2 + a.maxHp * 0.1));
    const events = b.e.drainEvents();
    expect(events.filter(e => e.type === 'heal').length).toBe(1);
    expect(events.some(e => e.type === 'damage' || e.type === 'projectile')).toBeFalse();
    b.run(1); expect(b.e.drainEvents().some(e => e.type === 'heal')).toBeFalse();
  });

  it('respects healing reduction and does not redirect healing when the selected ally dies', () => {
    const b = battle(), a = b.allies[1]; a.hp = 1000;
    applyBuff(a, STATUS_EFFECTS['healing_reduction'], b.foe.id);
    b.apply('skill', a);
    expect(a.hp).toBe(1000 + Math.round((b.caster.atk * 2.2 + a.maxHp * 0.1) * 0.5));
    b.e.skills.use(b.caster, 'skill', kit().skill, a); a.alive = false; a.hp = 0;
    b.run(0.6); expect(a.hp).toBe(0); expect(a.alive).toBeFalse();
    expect(b.caster.hp).toBe(b.caster.maxHp);
  });

  it('S2 shields one ally using caster Max HP, with no heal or damage; the shield expires', () => {
    const b = battle(), a = b.allies[1]; a.maxHp = 5000; a.hp = 1000;
    b.apply('skill2', a);
    expect(a.shield).toBe(1500); expect(a.hp).toBe(1000);
    expect(b.caster.shield).toBe(0); expect(b.allies[2].shield).toBe(0);
    b.run(4.05); expect(a.shield).toBe(0);
    b.apply('skill2'); expect(b.caster.shield).toBe(1500);
  });

  it('S2 grants once at activation and targets self correctly without healing or enemy damage', () => {
    const b = battle(); b.caster.hp = 1000;
    expect(b.e.skills.pickTarget(b.caster, kit().skill2, b.foe)).toBe(b.caster);
    b.e.skills.use(b.caster, 'skill2', kit().skill2, b.caster);
    b.run(0.45); expect(b.caster.shield).toBe(0);
    b.run(0.05); expect(b.caster.shield).toBe(1500);
    const events = b.e.drainEvents();
    expect(events.filter(e => e.type === 'shield').length).toBe(1);
    const impact = events.find(e => e.type === 'impact');
    if (impact?.type !== 'impact') throw new Error('Missing shield impact');
    expect(impact.hits).toEqual([b.caster.id]);
    expect(events.some(e => e.type === 'heal' || e.type === 'damage' || e.type === 'projectile')).toBeFalse();
    b.run(1.5); expect(b.e.drainEvents().some(e => e.type === 'shield')).toBeFalse();
  });

  it('S2 does not shield a dead recipient or grant protection when the caster dies during anticipation', () => {
    for (const dies of ['target', 'caster']) {
      const b = battle(), a = b.allies[1];
      b.e.skills.use(b.caster, 'skill2', kit().skill2, a);
      if (dies === 'target') { a.alive = false; a.hp = 0; } else { b.caster.alive = false; b.caster.hp = 0; }
      b.run(0.65); expect(a.shield).toBe(0);
      const events = b.e.drainEvents(); expect(events.some(e => e.type === 'shield')).toBeFalse();
      for (const e of events) if (e.type === 'impact') expect(e.hits).toEqual([]);
    }
  });

  it('Ult protects exactly the home 6×3 occupants immediately and tracks movement without lingering buffs', () => {
    const b = battle(); b.apply('ult');
    const f = b.e.fields.active[0];
    expect(f.center).toEqual({ r: 1, c: 2 });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      b.place(b.allies[1], { r, c }); expect(modifier(b.allies[1], 'damageTakenMultiplier')).toBe(0.8);
    }
    b.place(b.allies[1], { r: 1, c: 6 }); expect(modifier(b.allies[1], 'damageTakenMultiplier')).toBe(1);
    b.place(b.allies[1], { r: 1, c: 5 }); expect(modifier(b.allies[1], 'damageTakenMultiplier')).toBe(0.8);
    expect(b.allies[1].buffs.length).toBe(0);
    b.place(b.foe, { r: 1, c: 5 }); expect(modifier(b.foe, 'damageTakenMultiplier')).toBe(1);
    b.place(b.caster, { r: 1, c: 9 }); expect(b.e.fields.active[0].center).toEqual(f.center);
    expect(modifier(b.allies[1], 'damageTakenMultiplier')).toBe(0.8);
  });

  it('reduces resolved incoming damage and composes with existing status reduction without changing base DEF', () => {
    const b = battle(), a = b.allies[1]; a.def = 0;
    const hit = () => DamageResolver.resolve({ attacker: b.foe, target: a, baseDamage: 1000, damageType: 'PHYSICAL', sourceId: 'test' }).amount;
    expect(hit()).toBe(1000); b.apply('ult'); expect(hit()).toBe(800);
    applyBuff(a, STATUS_EFFECTS['taunt_guard'], a.id); expect(hit()).toBe(480); expect(a.def).toBe(0);
    b.place(a, { r: 1, c: 6 }); expect(hit()).toBe(600);
  });

  it('ends protection at duration, source death or encounter clear without a burst or lingering status', () => {
    for (const reason of ['EXPIRED', 'SOURCE_DIED', 'CLEARED'] as const) {
      const b = battle(); b.apply('ult');
      if (reason === 'EXPIRED') { b.run(5.95); expect(modifier(b.allies[1], 'damageTakenMultiplier')).toBe(0.8); b.run(0.05); }
      if (reason === 'SOURCE_DIED') { b.caster.alive = false; expect(modifier(b.allies[1], 'damageTakenMultiplier')).toBe(1); b.run(0.05); }
      if (reason === 'CLEARED') b.e.fields.clear();
      expect(b.e.fields.active.length).toBe(0);
      expect(modifier(b.allies[1], 'damageTakenMultiplier')).toBe(1);
      const events = b.e.drainEvents();
      expect(events.some(e => e.type === 'FIELD_ENDED' && e.reason === reason)).toBeTrue();
      expect(events.some(e => e.type === 'damage' || e.type === 'heal')).toBeFalse();
    }
  });

  it('mirrors a source-side sanctuary independently of caster location and leaves neutral/enemy occupants out', () => {
    const b = battle(); b.caster.side = 'enemy'; b.place(b.caster, { r: 1, c: 4 }); b.apply('ult');
    expect(b.e.fields.active[0].center).toEqual({ r: 1, c: 12 });
    for (let c = 10; c < 16; c++) { b.place(b.foe, { r: 2, c }); expect(modifier(b.foe, 'damageTakenMultiplier')).toBe(0.8); }
    b.place(b.foe, { r: 1, c: 9 }); expect(modifier(b.foe, 'damageTakenMultiplier')).toBe(1);
    b.place(b.allies[1], { r: 1, c: 12 }); expect(modifier(b.allies[1], 'damageTakenMultiplier')).toBe(1);
  });

  it('AUTO protects injured occupants rather than allies outside the zone; manual casting remains available', () => {
    const b = battle(), a = b.allies[1];
    expect(b.e.skills.chooseUltimate(b.caster, b.foe, false)).toBeNull();
    a.hp = 1000;
    expect(b.e.skills.chooseUltimate(b.caster, b.foe, false)).toBe(b.caster);
    b.place(a, { r: 1, c: 6 });
    expect(b.e.skills.chooseUltimate(b.caster, b.foe, false)).toBeNull();
    expect(b.e.skills.chooseUltimate(b.caster, b.foe, true)).toBe(b.caster);
  });

  it('shields absorb incoming damage before HP', () => {
    const b = battle(), a = b.allies[1];
    b.apply('skill2', a); expect(a.shield).toBe(1500);
    (b.e as unknown as { applyDamage(dst: BattleUnit, total: number, crit: boolean): void }).applyDamage(a, 1700, false);
    expect(a.shield).toBe(0); expect(a.hp).toBe(a.maxHp - 200);
  });

  it('has an 18-cell geometry at both edges, independent of candidate ordering', () => {
    const cells = Array.from({ length: 48 }, (_, id) => ({ id, pos: { r: Math.floor(id / 16), c: id % 16 } }));
    for (const c of [0, 2, 12, 15]) {
      const anchor = { id: 99, pos: { r: 1, c } };
      const hits = resolveArea({ pattern: 'RECT_6X3', caster: anchor, primary: anchor, candidates: cells });
      expect(hits.length).toBe(18);
      expect(new Set(hits.map(u => u.id)).size).toBe(18);
    }
  });

  it('keeps class rank data compatible and copies aura data without mutating R1', () => {
    const ranked = rankedKit('elira', 'healer', { skill: 5, skill2: 5, ult: 5 });
    const field = ranked.ult.effects[0];
    if (field.type !== 'FIELD') throw new Error('Expected field');
    field.field.aura!.modifiers.damageTakenMultiplier = 0.1;
    const original = kit().ult.effects[0];
    expect(original.type === 'FIELD' && original.field.aura!.modifiers.damageTakenMultiplier).toBe(0.8);
    expect(ranked.skill2.cooldown).toBe(14.25);
    expect(skillLines(kit().ult).join(' ')).toContain('6×3');
    expect(skillLines(kit().ult).join(' ')).toContain('20%');
    expect(animTiming('hero-elira.png', 'ult').hit).toBeCloseTo(0.5, 6);
  });
});

describe('Elira S1 visual-review contract', () => {
  it('keeps healing amount/cooldown/targeting and has one activation without repeats', () => {
    const s = kitOf('elira', 'healer').skill;
    expect(s.cooldown).toBe(8); expect(s.target).toBe('LOWEST_HP_ALLY');
    expect(s.effects).toEqual([{ type: 'HEAL', area: 'PRIMARY', atk: 2.2, maxHpPct: 0.1 }]);
    expect(s.repeat).toBeUndefined(); expect(s.delivery).toBe('INSTANT');
    expect(animTiming('hero-elira.png', 'skill').hit).toBeCloseTo(0.5, 6);
  });
});
