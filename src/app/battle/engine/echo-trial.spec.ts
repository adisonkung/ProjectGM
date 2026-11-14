import { HEROES } from '../../core/data/heroes';
import { FARM_BY_ID, FARM_DUNGEONS } from '../../core/data/economy';
import { ECHO_PROFILE } from '../../core/data/echo-trial';
import { echoKit, echoSpec, safeEchoSkill } from '../../core/rules/echo-trial';
import { kitOf } from '../../core/data/hero-skills';
import { HERO_CLASS_BASE } from '../../core/data/classes';
import { UnitSpec } from '../../core/models/unit';
import { BattleEngine } from './battle-engine';
import { toBoard } from './grid';

const spec = (i: number): UnitSpec => {
  const h = HEROES[i];
  return { name: h.name, cls: h.cls, sprite: h.sprite, heroId: h.id, level: 10,
    pos: { r: i % 2 ? 3 : 0, c: i % 3 }, stats: { ...HERO_CLASS_BASE[h.cls] } };
};
const engine = (allies: UnitSpec[], tier = 1) => new BattleEngine({
  allies, stage: FARM_BY_ID[`trial_${tier}`].stage, enemyTemplates: {}, seed: 77, autoUlt: true,
});
const advance = (e: BattleEngine, seconds: number) => {
  for (let i = 0; i < seconds * 20 && !e.result; i++) e.step(.05);
};

describe('Echo Trial', () => {
  it('mirrors exactly the deployed identities and formation with independent faction state', () => {
    for (const count of [1, 3, 5]) {
      const allies = Array.from({ length: count }, (_, i) => spec(i));
      const e = engine(allies), foes = e.units.filter(u => u.side === 'enemy');
      expect(e.totalWaves).toBe(1);
      expect(foes.length).toBe(count);
      foes.forEach((u, i) => {
        expect(u.heroId).toBe(allies[i].heroId);
        expect(u.sprite).toBe(allies[i].sprite);
        expect(u.pos).toEqual(toBoard('enemy', allies[i].pos));
        expect(u.monster).toBeUndefined();
        expect(u.echo).toBeDefined();
        expect(u.kit!.skill.id).toBe(kitOf(u.heroId, u.cls).skill.id);
        expect(u.kit!.skill2.id).toBe(kitOf(u.heroId, u.cls).skill2.id);
      });
    }
  });

  it('supports duplicate heroes without linking health or cooldown state', () => {
    const a = spec(0), b = { ...spec(0), pos: { r: 1, c: 2 } };
    const foes = engine([a, b]).units.filter(u => u.echo);
    expect(foes.length).toBe(2);
    expect(foes[0].id).not.toBe(foes[1].id);
    foes[0].hp = 1;
    expect(foes[1].hp).toBe(foes[1].maxHp);
  });

  it('normalizes player gear, star, ranks and level away while scaling by tier', () => {
    const source = spec(0), changed = { ...source, star: 6, level: 1,
      stats: { ...source.stats, hp: 999999, atk: 99999, range: 99 } };
    expect(echoSpec(source, ECHO_PROFILE).stats).toEqual(echoSpec(changed, ECHO_PROFILE).stats);
    const low = engine([source], 1).units.find(u => u.echo)!;
    const high = engine([source], 4).units.find(u => u.echo)!;
    expect(high.maxHp).toBeGreaterThan(low.maxHp);
    expect(high.atk).toBeGreaterThan(low.atk);
  });

  it('runs every shipped archetype, using basic and both skills but never an ultimate or gauge', () => {
    for (let i = 0; i < HEROES.length; i++) {
      const e = engine([spec(i)]), u = e.units.find(u => u.echo)!;
      const t = e.units.find(u => u.side === 'ally')!;
      const events: string[] = [];
      e.subscribe(ev => { if ('src' in ev && ev.src === u.id && ev.type === 'cast') events.push(ev.kind); });
      (e as any).gainMana(u, 100);
      expect(u.mana).toBe(0);
      expect(u.maxMana).toBe(0);
      expect((e as any).tryUltimate(u, true)).toBeFalse();
      // Direct skill execution exercises authored targeting/effects on each faction, even conditional support kits.
      for (const slot of ['attack', 'skill', 'skill2'] as const) {
        expect(() => e.skills.use(u, slot, u.kit![slot], slot === 'attack' ? t : e.skills.pickTarget(u, u.kit![slot], t) ?? t)).withContext(u.name + slot).not.toThrow();
      }
      advance(e, 8);
      expect(events).not.toContain('ult');
      expect(u.mana).toBe(0);
    }
  });

  it('applies Echo healing and shields only to their own faction, caps CC and rejects revival', () => {
    const e = engine([spec(0), spec(1)]), x = e as any;
    const u = e.units.find(v => v.echo)!, ally = e.units.find(v => v.side === 'ally')!;
    const friend = e.units.filter(v => v.echo)[1];
    u.hp -= 200; ally.hp -= 200;
    x.heal(u, 100, u); x.heal(ally, 100, ally);
    expect(u.hp).toBe(u.maxHp - 140);
    expect(ally.hp).toBe(ally.maxHp - 100);
    x.skillHost().shield(u, friend, 100, 5);
    expect(friend.shield).toBe(70);
    x.applyStatus(ally, 'stun', u, 20);
    expect(ally.buffs.find((b: any) => b.def.id === 'stun')!.remaining).toBeLessThanOrEqual(3);
    expect(x.skillHost().allies(u).every((v: any) => v.side === 'enemy')).toBeTrue();
    expect(x.skillHost().foes(u).every((v: any) => v.side === 'ally')).toBeTrue();
    expect(x.skillHost().revive(u, friend, .4)).toBeFalse();
  });

  it('filters only revive components and leaves the original kit untouched', () => {
    for (let i = 0; i < HEROES.length; i++) {
      const source = spec(i), kit = kitOf(source.heroId, source.cls), before = JSON.stringify(kit);
      const clone = echoKit(source, { ...ECHO_PROFILE, cooldownMultiplier: 1.5 });
      for (const slot of ['skill', 'skill2'] as const) {
        expect(clone[slot].effects.some(e => e.type === 'REVIVE')).toBeFalse();
        expect(clone[slot].effects.length).toBe(kit[slot].effects.filter(e => e.type !== 'REVIVE').length);
      }
      expect(JSON.stringify(kit)).toBe(before);
    }
  });

  it('finishes with victory or defeat and never creates later waves or monsters', () => {
    for (const win of [true, false]) {
      const e = engine([spec(0)]);
      e.units.filter(u => win ? !!u.echo : u.side === 'ally').forEach(u => (e as any).applyDamage(u, u.maxHp * 10, false));
      advance(e, 5);
      expect(e.result).toBe(win ? 'win' : 'lose');
      expect(e.totalWaves).toBe(1);
      expect(e.units.length).toBe(2);
    }
    const e = engine([spec(4), spec(9), spec(14)]);
    expect(['win', 'lose']).toContain(e.run(.05, 240));
  });

  it('automatically casts both cooldown skills without player orders', () => {
    const e = engine([spec(0)]), u = e.units.find(v => v.echo)!, player = e.units.find(v => !v.echo)!;
    const seen: string[] = [];
    e.subscribe(ev => { if (ev.type === 'cast' && ev.src === u.id) seen.push(ev.kind); });
    u.hp = u.maxHp = player.hp = player.maxHp = 999999;
    (e as any).relocate(u, { r: 1, c: 8 }, 'blink');
    (e as any).relocate(player, { r: 1, c: 7 }, 'blink');
    advance(e, 80);
    expect(seen).toContain('skill');
    expect(seen).toContain('skill2');
    expect(seen).not.toContain('ult');
  });

  it('removes only revive from a mixed heal/cleanse/revive skill', () => {
    const base = kitOf('linxue', 'healer').skill;
    const source = { ...base, effects: [
      { type: 'HEAL' as const, area: 'ALL_ALLIES' as const, atk: 1 },
      { type: 'CLEANSE' as const, to: 'ALL_ALLIES' as const },
      { type: 'REVIVE' as const, hpPct: .4, count: 1 },
    ] };
    const clone = safeEchoSkill(source, ECHO_PROFILE);
    expect(clone.effects.map(e => e.type)).toEqual(['HEAL', 'CLEANSE']);
    expect(source.effects.length).toBe(3);
  });

  it('heals, shields and cleanses actual Echo allies while leaving player effects untouched', () => {
    const e = engine([spec(0), spec(4), spec(1)]), u = e.units.find(v => v.echo && v.cls === 'healer')!;
    advance(e, .7);
    const friends = e.units.filter(v => v.echo), foes = e.units.filter(v => !v.echo);
    for (const v of e.units) {
      v.hp = v.maxHp - 200;
      (e as any).applyStatus(v, 'stun', v, 10);
      v.atkCd = v.cd1 = v.cd2 = 999;
    }
    const effect = { ...u.kit!.skill, effects: [
      { type: 'HEAL' as const, area: 'ALL_ALLIES' as const, atk: 0, maxHpPct: .1 },
      { type: 'SHIELD' as const, selfPct: .1, allyPct: .1, duration: 4 },
      { type: 'CLEANSE' as const, to: 'ALL_ALLIES' as const },
      { type: 'APPLY_STATUS' as const, to: 'AREA' as const, area: 'ALL_ALLIES' as const, team: 'ALLY' as const, status: 'taunt_guard', duration: 5 },
    ] };
    const before = new Map(e.units.map(v => [v.id, v.hp]));
    e.skills.applyEffects(u, effect, 'skill', u, u.pos);
    for (const v of friends) {
      expect(v.hp - before.get(v.id)!).toBe(Math.round(v.maxHp * .1 * .6));
      expect(v.shield).toBe(Math.round(Math.round(u.maxHp * .1) * .7));
      expect(v.buffs.some(b => b.def.id === 'stun')).toBeFalse();
      expect(v.buffs.some(b => b.def.id === 'taunt_guard')).toBeTrue();
    }
    for (const v of foes) {
      expect(v.hp).toBe(before.get(v.id)!);
      expect(v.shield).toBe(0);
      expect(v.buffs.some(b => b.def.id === 'taunt_guard')).toBeFalse();
      expect(v.buffs.some(b => b.def.id === 'stun')).toBeTrue();
    }
  });

  it('resolves AoE damage/debuffs and lowest-HP ally targets relative to the Echo faction', () => {
    const e = engine([spec(0), spec(1), spec(4)]);
    advance(e, .7);
    const src = e.units.find(v => v.echo)!, friends = e.units.filter(v => v.echo), foes = e.units.filter(v => !v.echo);
    friends[1].hp = 1;
    expect(e.skills.pickTarget(src, { ...src.kit!.skill, target: 'LOWEST_HP_ALLY', range: 999 }, foes[0])).toBe(friends[1]);
    expect(e.skills.pickTarget(src, { ...src.kit!.skill, target: 'NEAREST_ENEMY', range: 999 }, friends[1])!.side).toBe('ally');
    const before = new Map(e.units.map(v => [v.id, v.hp]));
    e.skills.applyEffects(src, { ...src.kit!.skill, effects: [
      { type: 'DAMAGE', area: 'ALL_ENEMIES', primary: .1, secondary: .1 },
      { type: 'APPLY_STATUS', to: 'AREA', area: 'ALL_ENEMIES', team: 'ENEMY', status: 'stun', duration: 99 },
    ] }, 'skill', foes[0], foes[0].pos);
    friends.forEach(v => expect(v.hp).toBe(before.get(v.id)!));
    foes.forEach(v => {
      expect(v.hp).toBeLessThan(before.get(v.id)!);
      expect(v.buffs.find(b => b.def.id === 'stun')!.remaining).toBe(3);
    });
  });

  it('disposes scheduled effects and runtime Echoes idempotently before a new session', () => {
    const e = engine([spec(0), spec(4)]);
    let fired = false;
    e.later(1, e.units[0], () => fired = true);
    e.dispose(); e.dispose();
    e.step(5);
    expect(e.disposed).toBeTrue();
    expect(e.units).toEqual([]);
    expect(e.projectiles).toEqual([]);
    expect(e.drainEvents()).toEqual([]);
    expect(fired).toBeFalse();
    const next = engine([spec(1)]);
    expect(next.disposed).toBeFalse();
    expect(next.units.filter(v => v.echo).length).toBe(1);
  });

  it('honors independent tier stat and cooldown overrides', () => {
    const source = spec(0), stage = FARM_BY_ID['trial_1'].stage;
    const e = new BattleEngine({ allies: [source], enemyTemplates: {}, seed: 2,
      stage: { ...stage, special: { ...stage.special!, echo: {
        ...stage.special!.echo!, hpMultiplier: 2, attackMultiplier: .75, defenseMultiplier: 1.5, cooldownMultiplier: .5,
      } } } });
    const normal = engine([source]).units.find(u => u.echo)!, tuned = e.units.find(u => u.echo)!;
    expect(Math.abs(tuned.maxHp - normal.maxHp * 2)).toBeLessThanOrEqual(1);
    expect(tuned.atk).toBeCloseTo(normal.atk * .75, -1);
    expect(tuned.def).toBeCloseTo(normal.def * 1.5, -1);
    expect(tuned.kit!.skill.cooldown).toBe(normal.kit!.skill.cooldown! * .5);
    expect(tuned.kit!.skill2.cooldown).toBe(normal.kit!.skill2.cooldown! * .5);
  });

  it('keeps the other dungeon families and skill material rewards', () => {
    for (const d of FARM_DUNGEONS) {
      expect(!!d.stage.special?.echo).toBe(d.type === 'SKILL');
      if (d.type === 'SKILL') expect(d.baseRewards.items!.every(x => x.itemId.startsWith('skill_tome'))).toBeTrue();
    }
  });
});
