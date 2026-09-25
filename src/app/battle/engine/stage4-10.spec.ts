import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { kitOf } from '../../core/data/hero-skills';
import { MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { STAGE4_10_MONSTERS, STAGE4_10_SKILLS } from '../../core/data/monsters-stage4-10';
import { STAGES } from '../../core/data/stages';
import { newGameState } from '../../core/data/starter';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { VISUALS } from '../../core/data/visuals';
import { SkillSlot } from '../../core/models/combat';
import { MonsterSkillDefinition } from '../../core/models/monster';
import { EnemyPlacement, StageDef, wavesOf } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { teamToUnits } from '../../core/rules/team';
import { BattleEngine, BattleEvent, BattleUnit } from './battle-engine';
import { applyBuff, buffRemaining, hasFlag, hasStatus, modifier } from './buffs';
import { DamageResolver } from './damage-resolver';
import { distance, Grid } from './grid';
import { nextStep } from './pathfinding';
import { selectTarget } from './targeting';

// ------------------------------------------------------------------ harness

const DT = 0.05;
type Ev = BattleEvent & { t: number };

const H = (id: string, depth: number, lane: number, o: Partial<UnitSpec['stats']> = {}): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + depth * 10 + lane, sprite: t.sprite,
    stats: { ...heroStats(t, { uid: 0, templateId: id, level: 1, potential: 'B', injury: 0 }), ...o },
    pos: { r: depth, c: lane },
  };
};
const mon = (enemy: string, depth: number, lane: number): EnemyPlacement => ({ enemy, r: depth, c: lane });
const TOUGH = { hp: 99999 };

function battle(allies: UnitSpec[], enemies: EnemyPlacement[], opts: { rounds?: EnemyPlacement[][]; seed?: number } = {}) {
  const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies, rounds: opts.rounds };
  const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: opts.seed ?? 7 });
  const log: Ev[] = [];
  let frozen: 'none' | 'heroes' | 'all' = 'none';
  const step = () => {
    for (const u of e.units) {
      if (!u.alive) continue;
      if (u.side === 'ally' && frozen !== 'none') u.castLock = 1e9;
      if (u.side === 'enemy' && frozen === 'all' && !u.casting) applyBuff(u, STATUS_EFFECTS['stun'], 0, { duration: 1 });
    }
    e.step(DT);
    for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
  };
  const run = (sec: number) => {
    for (let i = 0; i < Math.round(sec / DT) && !e.result; i++) step();
  };
  const until = (cond: () => boolean, max = 30) => {
    for (let t = 0; t < max && !cond() && !e.result; t += DT) step();
    return cond();
  };
  const hero = (id: string) => e.units.find(u => u.heroId === id)!;
  const monsters = (id: string) => e.units.filter(u => u.monster?.definitionId === id);
  const flush = () => {
    for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
  };
  const of = <T extends BattleEvent['type']>(type: T) => {
    flush();
    return log.filter(x => x.type === type) as (Ev & Extract<BattleEvent, { type: T }>)[];
  };
  const x = e as any;
  const dmg = (u: BattleUnit, amount: number, src?: BattleUnit) => x.applyDamage(u, amount, false, false, src);
  const kill = (u: BattleUnit) => x.applyDamage(u, u.hp + u.shield + 1, false);
  const put = (u: BattleUnit, c: number, r: number) => x.relocate(u, { r, c }, 'blink');
  const cast = (u: BattleUnit, skill: string, target: BattleUnit | null = null) => {
    u.monster!.state = 'CASTING';
    u.monster!.currentSkillId = skill;
    x.beginCast(u, MONSTER_SKILLS[skill], target);
  };
  const use = (u: BattleUnit, slot: SkillSlot, target: BattleUnit) => e.skills.use(u, slot, kitOf(u.heroId, u.cls)[slot], target);
  const status = (u: BattleUnit, id: string, src: BattleUnit, duration?: number) => x.applyStatus(u, id, src, duration);
  step(); // PREPARATION → COMBAT
  return {
    e, log, step, run, until, hero, monsters, of, dmg, kill, put, cast, use, status,
    freeze: (m: 'heroes' | 'all' = 'heroes') => (frozen = m), unfreeze: () => (frozen = 'none'),
  };
}

const pct = (u: BattleUnit) => u.hp / u.maxHp;

// ------------------------------------------------------------------ data / architecture

describe('Stage 4–10 data', () => {
  it('1. defines the 12 new monsters (+ the Sacrifice variant) with the design stats', () => {
    const ids = ['magic_mushroom', 'forest_spirit', 'shadow_panther', 'goblin_guard', 'goblin_shaman', 'elder_treant', 'corrupted_wolf',
      'mist_wraith', 'corrupted_treant', 'dark_shaman', 'mist_witch', 'fallen_forest_guardian'];
    for (const id of ids) expect(MONSTERS[id]).withContext(id).toBeDefined();
    expect(Object.keys(STAGE4_10_MONSTERS).length).toBe(13);
    const s = (id: string) => MONSTERS[id].stats;
    expect([s('magic_mushroom').maxHp, s('magic_mushroom').attack, s('magic_mushroom').defense]).toEqual([135, 30, 8]);
    expect([s('fallen_forest_guardian').maxHp, s('fallen_forest_guardian').attack, s('fallen_forest_guardian').defense]).toEqual([4200, 62, 42]);
    expect([s('elder_treant').maxHp, s('elder_treant').attack]).toEqual([1800, 48]);
    expect(s('forest_spirit').defenseIgnore).toBe(0.2);
    expect(s('corrupted_treant').bodyBlock).toBeTrue();
    expect(MONSTERS['elder_treant'].rank).toBe('BOSS');
    expect(MONSTERS['fallen_forest_guardian'].rank).toBe('FINAL_BOSS');
  });

  it('2. visuals are separate from gameplay: every new monster has a mock VisualDefinition and no art clips', () => {
    for (const m of Object.values(STAGE4_10_MONSTERS)) {
      expect(VISUALS[m.visual!]).withContext(m.id).toBeDefined();
      expect(Object.keys(m.animation.clips).length).toBe(0);
    }
    // mock FX live on the skill as optional presentation data — effects never read them
    for (const sk of Object.values(STAGE4_10_SKILLS)) expect(sk.effects.length).toBeGreaterThan(0);
  });

  it('3. every referenced skill / status / summon exists', () => {
    for (const m of Object.values(STAGE4_10_MONSTERS)) {
      for (const id of m.skills) expect(MONSTER_SKILLS[id]).withContext(`${m.id}.${id}`).toBeDefined();
      for (const ph of m.phases ?? []) {
        for (const st of ph.statuses ?? []) expect(STATUS_EFFECTS[st]).withContext(st).toBeDefined();
        for (const sm of ph.summon ?? []) expect(MONSTERS[sm.id]).withContext(sm.id).toBeDefined();
        for (const sk of ph.enableSkills ?? []) expect(MONSTER_SKILLS[sk.id]).withContext(sk.id).toBeDefined();
      }
      if (m.attack.onHitEveryN) expect(STATUS_EFFECTS[m.attack.onHitEveryN.status]).toBeDefined();
    }
    for (const sk of Object.values(STAGE4_10_SKILLS)) {
      for (const ef of sk.effects) {
        if (ef.type === 'APPLY_STATUS' || ef.type === 'SOUL_LINK') expect(STATUS_EFFECTS[ef.status]).withContext(ef.status).toBeDefined();
        if (ef.type === 'SACRIFICE') expect(STATUS_EFFECTS[ef.buffId]).toBeDefined();
        if (ef.type === 'SUMMON') for (const x of ef.monsters) expect(MONSTERS[x.id]).toBeDefined();
      }
    }
  });

  it('4. Stages 4–10 have 3 waves; boss waves hold only the boss', () => {
    for (const st of STAGES.slice(3)) {
      const w = wavesOf(st);
      expect(w.length).withContext(`F${st.floor}`).toBe(3);
      for (const sp of w.flatMap(x => x.spawns)) expect(MONSTERS[sp.monsterId]).withContext(sp.monsterId).toBeDefined();
    }
    expect(wavesOf(STAGES[6])[2].spawns.map(s => s.monsterId)).toEqual(['elder_treant']);
    expect(wavesOf(STAGES[9])[2].spawns.map(s => s.monsterId)).toEqual(['fallen_forest_guardian']);
  });

  it('5. Stages 1–10 are playable back to back (a strong team clears every stage)', () => {
    const state = newGameState();
    const allies = teamToUnits(state.team, state.heroes.map(h => ({ ...h, level: 20 })));
    for (const stage of STAGES) {
      const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: 3, autoUlt: true });
      expect(e.run(0.05, 400)).withContext(`F${stage.floor}`).toBe('win');
    }
  });
});

// ------------------------------------------------------------------ statuses

describe('Stage 4–10 statuses', () => {
  it('6. Poison Cloud aims at the hero cluster and poisons every hero it hits', () => {
    const b = battle([H('aurel', 0, 0, TOUGH), H('jin', 0, 1, TOUGH), H('sylvie', 4, 2, TOUGH)], [mon('magic_mushroom', 0, 1)]);
    b.freeze('heroes');
    const m = b.monsters('magic_mushroom')[0];
    expect(b.until(() => !!m.casting && m.casting.def.id === 'poison_cloud', 15)).toBeTrue();
    const aim = b.e.units.find(u => u.id === m.casting!.target)!;
    expect(['aurel', 'jin']).toContain(aim.heroId!);
    b.until(() => b.of('skillActivated').some(s => s.skill === 'poison_cloud'), 3);
    expect(hasStatus(b.hero('aurel'), 'poison')).toBeTrue();
    expect(hasStatus(b.hero('jin'), 'poison')).toBeTrue();
    expect(hasStatus(b.hero('sylvie'), 'poison')).toBeFalse();
  });

  it('7. ROOT stops a hero walking but it may still attack', () => {
    const b = battle([H('jin', 5, 1, TOUGH)], [mon('goblin_guard', 5, 1)]);
    const jin = b.hero('jin');
    const guard = b.monsters('goblin_guard')[0];
    b.status(jin, 'root', guard, 3);
    const c0 = jin.pos.c;
    b.run(2);
    expect(jin.pos.c).toBe(c0);
    expect(hasFlag(jin, 'root')).toBeTrue();
  });

  it('8. Nightmare stuns the highest-ATK hero for 3 s (no actions)', () => {
    const b = battle([H('aurel', 0, 0, TOUGH), H('jin', 0, 1, TOUGH), H('lumina', 4, 1, TOUGH)], [mon('mist_witch', 3, 1)]);
    const w = b.monsters('mist_witch')[0];
    b.cast(w, 'nightmare', w.monster ? b.hero('jin') : null);
    expect((b.e as any).monsterAI.aimTarget(w, MONSTER_SKILLS['nightmare']).heroId).toBe('jin');
    b.until(() => !w.casting, 4);
    expect(buffRemaining(b.hero('jin'), 'stun')).toBeGreaterThan(2.5);
    const attacks = b.of('attack').filter(a => a.src === b.hero('jin').id).length;
    b.run(2);
    expect(b.of('attack').filter(a => a.src === b.hero('jin').id).length).toBe(attacks);
  });

  it('9. a stun on a casting monster does not cancel the cast (only a dedicated interrupt does)', () => {
    const b = battle([H('lumina', 5, 0, TOUGH)], [mon('goblin_shaman', 3, 1), mon('goblin_guard', 0, 0)]);
    b.freeze('heroes');
    const sh = b.monsters('goblin_shaman')[0];
    b.cast(sh, 'healing_ritual');
    b.status(sh, 'stun', b.hero('lumina'), 1);
    b.run(0.5);
    expect(sh.casting?.def.id).toBe('healing_ritual');
  });

  it('10. Corrupted Wolf: every 3rd successful bite on the same target applies BLEED (counter resets on a new target)', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('corrupted_wolf', 0, 1)]);
    b.freeze('heroes');
    const a = b.hero('aurel');
    const w = b.monsters('corrupted_wolf')[0];
    const bites = () => b.of('damage').filter(d => d.dst === a.id && !d.poison).length;
    b.until(() => bites() === 2, 20);
    expect(hasStatus(a, 'bleed')).toBeFalse();
    b.until(() => bites() === 3, 5);
    expect(hasStatus(a, 'bleed')).toBeTrue();
    w.monster!.hitStreak = { targetId: 999, count: 2 };
    b.until(() => bites() === 4, 5);
    expect(w.monster!.hitStreak.count).toBe(1);
  });

  it('11. BLEED ticks 15% of the source ATK per second for 5 s', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('corrupted_wolf', 5, 1)]);
    b.freeze('all');
    const a = b.hero('aurel');
    const w = b.monsters('corrupted_wolf')[0];
    b.status(a, 'bleed', w);
    const t0 = b.e.time;
    b.run(5.2);
    const ticks = b.of('damage').filter(d => d.dst === a.id && d.poison && d.t > t0);
    const total = ticks.reduce((s, d) => s + d.amount, 0);
    expect(ticks.length).toBe(10);
    expect(total).toBeCloseTo(w.atk * 0.15 * 5, -1);
  });

  it('12. DARK FOG: ranged basic ×0.75, ranged skills ×0.85, melee and healing unaffected', () => {
    const b = battle([H('sylvie', 4, 1, TOUGH), H('jin', 0, 1, TOUGH)], [mon('goblin_guard', 0, 1, )]);
    const sy = b.hero('sylvie');
    const jin = b.hero('jin');
    const g = b.monsters('goblin_guard')[0];
    b.status(sy, 'dark_fog', g);
    b.status(jin, 'dark_fog', g);
    expect(modifier(sy, 'rangedAttackMultiplier')).toBe(0.75);
    expect(modifier(sy, 'rangedSkillMultiplier')).toBe(0.85);
    // the engine applies them only to ranged units, per slot
    const spy = spyOn(DamageResolver, 'resolve').and.callThrough();
    (b.e as any).hit(sy, g, 1, { sourceId: 'x', slot: 'attack' });
    (b.e as any).hit(sy, g, 1, { sourceId: 'x', slot: 'skill' });
    (b.e as any).hit(jin, g, 1, { sourceId: 'x', slot: 'attack' });
    const muls = spy.calls.allArgs().map(a => a[0].multiplier);
    expect(muls[0]).toBeCloseTo(0.75, 5);
    expect(muls[1]).toBeCloseTo(0.85, 5);
    expect(muls[2]).toBeCloseTo(1, 5);
    expect(modifier(sy, 'healingReceivedMultiplier')).toBe(1);
  });

  it('13. SOUL LINK: 70% of the shaman\'s damage goes to the linked treant; the link ends when the treant dies', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('corrupted_treant', 0, 1), mon('dark_shaman', 4, 1)]);
    b.freeze('all');
    const t = b.monsters('corrupted_treant')[0];
    const s = b.monsters('dark_shaman')[0];
    b.cast(s, 'soul_link', t);
    b.until(() => hasStatus(s, 'soul_link'), 4);
    const sh0 = s.hp, tr0 = t.hp;
    b.dmg(s, 100);
    expect(sh0 - s.hp).toBe(30);
    expect(tr0 - t.hp).toBe(70);
    b.kill(t);
    expect(hasStatus(s, 'soul_link')).toBeFalse();
    const sh1 = s.hp;
    b.dmg(s, 50);
    expect(sh1 - s.hp).toBe(50);
  });

  it('14. SOUL LINK transfer never crits, never chains and triggers no on-hit', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('corrupted_treant', 0, 1), mon('dark_shaman', 4, 1)]);
    b.freeze('all');
    const t = b.monsters('corrupted_treant')[0];
    const s = b.monsters('dark_shaman')[0];
    applyBuff(s, STATUS_EFFECTS['soul_link'], t.id);
    applyBuff(t, STATUS_EFFECTS['soul_link'], s.id); // a (bogus) reverse link must not ping-pong
    (b.e as any).applyDamage(s, 100, true);
    b.of('damage');
    const toTreant = b.log.filter(x => x.type === 'damage' && (x as any).dst === t.id) as any[];
    expect(toTreant.length).toBe(1);
    expect(toTreant[0].crit).toBeFalse();
    expect(b.of('soulLink').length).toBe(1);
  });

  it('15. UNTARGETABLE (Mist Form): not selectable, projectiles pass, Focus stays but is temporarily invalid', () => {
    const b = battle([H('sylvie', 4, 1, TOUGH), H('aurel', 0, 1, TOUGH)], [mon('mist_wraith', 1, 1)]);
    const w = b.monsters('mist_wraith')[0];
    b.e.setFocus(w.id);
    b.cast(w, 'mist_form', b.hero('sylvie'));
    expect(hasFlag(w, 'untargetable')).toBeTrue();
    expect(b.e.isValidTarget(b.hero('aurel'), w)).toBeFalse();
    expect(b.of('castStart').at(-1)!.hidden).toBeTrue();
    const hp = w.hp;
    b.run(0.5);
    expect(w.hp).toBe(hp);
    expect(b.e.focusTargetId).toBe(w.id);
  });

  it('16. an untargetable unit takes no DoT damage', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('mist_wraith', 3, 1)]);
    b.freeze('all');
    const w = b.monsters('mist_wraith')[0];
    b.status(w, 'poison', b.hero('lumina'));
    b.status(w, 'untargetable', w, 5);
    const hp = w.hp;
    b.run(2);
    expect(w.hp).toBe(hp);
  });

  it('17. Forest Spirit ignores 20% of the target DEF', () => {
    const a = { id: 1, atk: 100, buffs: [], defenseIgnore: 0.2 };
    const res = DamageResolver.resolve({ attacker: a, target: { def: 100, buffs: [] }, damageType: 'MAGIC', sourceId: 'x' });
    expect(res.amount).toBe(Math.round(100 * (100 / (100 + 80))));
  });

  it('18. LOWEST_EFFECTIVE_DEF picks the softest hero; CLASS_PRIORITY picks healer > mage > archer', () => {
    const t = (id: number, def: number, cls: any, c: number) => ({ id, pos: { r: 1, c }, hp: 100, maxHp: 100, line: 'front' as const, def, cls });
    const heroes = [t(1, 80, 'tank', 5), t(2, 10, 'mage', 2), t(3, 30, 'healer', 1)];
    expect(selectTarget({ from: { r: 1, c: 10 }, candidates: heroes, attackRange: 6, cfg: { strategy: 'LOWEST_EFFECTIVE_DEF', targetLockDuration: 1 } })!.id).toBe(2);
    expect(selectTarget({ from: { r: 1, c: 10 }, candidates: heroes, attackRange: 1, cfg: { strategy: 'CLASS_PRIORITY', classPriority: ['healer', 'mage', 'archer'], targetLockDuration: 1 } })!.id).toBe(3);
  });
});

// ------------------------------------------------------------------ monsters

describe('Stage 4–10 monsters', () => {
  it('19. Shadow Panther leaps behind a back-row healer onto a free cell (never overlapping)', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('lumina', 4, 1, TOUGH), H('jin', 0, 0, TOUGH)], [mon('shadow_panther', 0, 1)]);
    b.freeze('heroes');
    const p = b.monsters('shadow_panther')[0];
    expect(b.until(() => b.of('skillActivated').some(s => s.skill === 'shadow_leap'), 15)).toBeTrue();
    const lum = b.hero('lumina');
    expect(distance(p.pos, lum.pos)).toBeLessThanOrEqual(1);
    expect(b.e.units.filter(u => u.alive && u !== p && u.pos.r === p.pos.r && u.pos.c === p.pos.c).length).toBe(0);
    expect(b.of('damage').some(d => d.dst === lum.id)).toBeTrue();
    expect(hasStatus(p, 'panther_frenzy')).toBeTrue();
  });

  it('20. Healing Ritual: skipped while allies are healthy, cast when 2 allies < 70%, heals 20% max HP', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('goblin_shaman', 4, 1), mon('goblin_guard', 0, 0), mon('goblin_guard', 0, 2)]);
    b.freeze('heroes');
    const sh = b.monsters('goblin_shaman')[0];
    const [g1, g2] = b.monsters('goblin_guard');
    b.run(9);
    expect(b.of('castStart').some(c => c.src === sh.id)).toBeFalse();
    g1.hp = Math.round(g1.maxHp * 0.5);
    g2.hp = Math.round(g2.maxHp * 0.6);
    const h1 = g1.hp;
    expect(b.until(() => b.of('skillActivated').some(s => s.skill === 'healing_ritual'), 6)).toBeTrue();
    expect(g1.hp - h1).toBeGreaterThanOrEqual(Math.round(g1.maxHp * 0.2) - 1);
  });

  it('21. two Goblin Shamans do not synchronise their first cast (initialDelayRandom ±1 s)', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('goblin_shaman', 4, 0), mon('goblin_shaman', 4, 2)], { seed: 11 });
    const cds = b.monsters('goblin_shaman').map(s => s.castSkills[0].cd);
    const base = MONSTER_SKILLS['healing_ritual'].cooldown * 0.5;
    for (const cd of cds) expect(Math.abs(cd + DT - base)).toBeLessThanOrEqual(1.01);
    expect(cds[0]).not.toBeCloseTo(cds[1], 3);
  });

  it('22. default first cast = cooldown × 0.5 (Magic Mushroom)', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('magic_mushroom', 4, 1)]);
    expect(b.monsters('magic_mushroom')[0].castSkills[0].cd + DT).toBeCloseTo(MONSTER_SKILLS['poison_cloud'].cooldown * 0.5, 5);
  });

  it('23. Corrupted Treant body-blocks hero movement (paths go around its cell)', () => {
    const b = battle([H('jin', 0, 1, TOUGH)], [mon('corrupted_treant', 0, 1)]);
    const t = b.monsters('corrupted_treant')[0];
    const jin = b.hero('jin');
    const blocked = (b.e as any).bodyBlocked(jin);
    expect(blocked(t.pos)).toBeTrue();
    const g = new Grid(Infinity);
    const step = nextStep(g, { r: 1, c: t.pos.c - 1 }, c => c.c === t.pos.c + 1 && c.r === 1, blocked);
    expect(step).not.toEqual(t.pos);
  });

  it('24. Dark Heal prefers a boss / elite ally below 60%, else the lowest HP% ally', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('dark_shaman', 4, 0), mon('dark_shaman', 4, 2), mon('corrupted_wolf', 0, 1)]);
    b.freeze('all');
    const [s1, s2] = b.monsters('dark_shaman');
    const wolf = b.monsters('corrupted_wolf')[0];
    wolf.hp = Math.round(wolf.maxHp * 0.2);
    s2.hp = Math.round(s2.maxHp * 0.55);
    const ai = (b.e as any).monsterAI;
    expect(ai.aimTarget(s1, MONSTER_SKILLS['dark_heal']).id).toBe(s2.id);
    s2.hp = Math.round(s2.maxHp * 0.9);
    expect(ai.aimTarget(s1, MONSTER_SKILLS['dark_heal']).id).toBe(wolf.id);
  });
});

// ------------------------------------------------------------------ bosses

describe('Stage 4–10 bosses', () => {
  it('25. Elder Treant ignores stun and knockback; BROKEN (boss-valid) still lands', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    b.freeze('all');
    const t = b.monsters('elder_treant')[0];
    t.buffs = [];
    b.status(t, 'stun', b.hero('aurel'), 1);
    expect(hasFlag(t, 'stun')).toBeFalse();
    expect(b.of('immune').length).toBeGreaterThan(0);
    const c0 = t.pos.c;
    (b.e as any).skillHost().knockback(b.hero('aurel'), t, 1);
    expect(t.pos.c).toBe(c0);
    b.status(t, 'broken', b.hero('aurel'));
    expect(hasFlag(t, 'broken')).toBeTrue();
  });

  it('26. Elder Treant at 50%: attack speed ×1.2 and Call of the Forest cooldown 14 → 10', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    b.freeze('all');
    const t = b.monsters('elder_treant')[0];
    b.dmg(t, Math.ceil(t.maxHp * 0.51));
    expect(b.of('bossPhase').map(p => p.phase)).toEqual(['enraged_forest']);
    expect(modifier(t, 'attackSpeedMultiplier')).toBeCloseTo(1.2, 5);
    expect((b.e as any).monsterAI.cooldownOf(t, MONSTER_SKILLS['call_of_the_forest'])).toBe(10);
  });

  it('27. Call of the Forest summons 2 Forest Spirits + 1 Magic Mushroom, never more than 3 alive', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    b.freeze('all');
    const t = b.monsters('elder_treant')[0];
    b.cast(t, 'call_of_the_forest');
    b.until(() => !t.casting, 4);
    expect(b.monsters('forest_spirit').length).toBe(2);
    expect(b.monsters('magic_mushroom').length).toBe(1);
    const cond = MONSTER_SKILLS['call_of_the_forest'].conditions;
    expect(cond.every(c => (b.e as any).monsterAI.conditionHolds(t, MONSTER_SKILLS['call_of_the_forest'], c))).toBeFalse();
    b.kill(b.monsters('forest_spirit')[0]);
    (b.e as any).summon(t, 'call_of_the_forest', [{ id: 'forest_spirit', count: 2 }], 3);
    expect(b.monsters('forest_spirit').filter(u => u.alive).length).toBe(2);
  });

  it('28. phases are never skipped: a huge hit stops at the next threshold', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('all');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.dmg(g, g.maxHp * 5);
    expect(g.alive).toBeTrue();
    expect(pct(g)).toBeCloseTo(0.7, 2);
    expect(b.of('bossPhase').length).toBe(1);
  });

  it('29. Guardian 70%: sealed (untargetable) with 2 Mist Wraiths, Dark Pulse every 3 s, seal ends when they die', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('lumina', 4, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.dmg(g, Math.ceil(g.maxHp * 0.31));
    expect(hasFlag(g, 'untargetable')).toBeTrue();
    const wraiths = b.monsters('mist_wraith');
    expect(wraiths.length).toBe(2);
    wraiths.forEach(w => b.status(w, 'stun', g, 99));
    b.run(6.2);
    expect(b.of('pulse').length).toBe(2);
    const pulseHits = b.of('damage').filter(d => d.dst === b.hero('lumina').id);
    expect(pulseHits.length).toBeGreaterThanOrEqual(2);
    wraiths.forEach(w => b.kill(w));
    b.step();
    expect(hasFlag(g, 'untargetable')).toBeFalse();
    expect(b.of('sealBroken').length).toBe(1);
  });

  it('30. Guardian is immune to taunt, root, stun and knockback', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('all');
    const g = b.monsters('fallen_forest_guardian')[0];
    g.buffs = [];
    for (const s of ['taunted', 'root', 'stun']) b.status(g, s, b.hero('aurel'));
    expect(g.buffs.length).toBe(0);
    const c0 = g.pos.c;
    (b.e as any).skillHost().knockback(b.hero('aurel'), g, 1);
    expect(g.pos.c).toBe(c0);
  });

  it('31. Guardian 40%: the ritual shaman casts Sacrifice 2 s after spawning (5 s); success heals the boss 20% and ATK ×1.2', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    g.monster!.phaseIndex = 1; // past the seal phase
    b.dmg(g, Math.ceil(g.maxHp * 0.61));
    const sh = b.monsters('dark_shaman_ritual')[0];
    expect(sh).toBeDefined();
    const t0 = b.e.time;
    expect(b.until(() => sh.casting?.def.id === 'sacrifice', 4)).toBeTrue();
    // 2 s after spawning (+ at most the swing it is finishing)
    expect(b.e.time - t0).toBeGreaterThanOrEqual(1.95);
    expect(b.e.time - t0).toBeLessThan(2.8);
    expect(sh.casting!.def.castTime).toBe(5);
    const hp = g.hp;
    b.until(() => !sh.alive, 6);
    expect(g.hp - hp).toBeCloseTo(g.maxHp * 0.2, -1);
    expect(hasStatus(g, 'guardian_empowered')).toBeTrue();
    expect(modifier(g, 'attackMultiplier')).toBeCloseTo(1.2, 5);
  });

  it('32. an interrupted Sacrifice gives nothing and is never cast again', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    g.monster!.phaseIndex = 1;
    b.dmg(g, Math.ceil(g.maxHp * 0.61));
    const sh = b.monsters('dark_shaman_ritual')[0];
    b.until(() => sh.casting?.def.id === 'sacrifice', 4);
    (b.e as any).tryInterrupt(b.hero('aurel'), sh);
    expect(sh.castSkills.find(c => c.def.id === 'sacrifice')!.cd).toBe(Infinity);
    b.run(8);
    expect(hasStatus(g, 'guardian_empowered')).toBeFalse();
    expect(b.of('castStart').filter(c => c.src === sh.id && c.label === 'SACRIFICE').length).toBe(1);
  });

  it('33. Sacrifice ATK bonus never stacks', () => {
    const g = { buffs: [] as any[] };
    expect(applyBuff(g, STATUS_EFFECTS['guardian_empowered'], 1)).toBe('applied');
    expect(applyBuff(g, STATUS_EFFECTS['guardian_empowered'], 2)).toBe('ignored');
    expect(modifier(g, 'attackMultiplier')).toBeCloseTo(1.2, 5);
  });

  it('34. Guardian 15%: enrage (atk speed ×1.4, damage ×1.3), cooldowns ×0.7, Forest Oblivion unlocked (first cast after 2 s)', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('all');
    const g = b.monsters('fallen_forest_guardian')[0];
    g.monster!.phaseIndex = 2;
    b.dmg(g, Math.ceil(g.maxHp * 0.86));
    expect(b.of('bossPhase').at(-1)!.phase).toBe('enrage');
    expect(modifier(g, 'attackSpeedMultiplier')).toBeCloseTo(1.4, 5);
    expect(modifier(g, 'damageMultiplier')).toBeCloseTo(1.3, 5);
    expect((b.e as any).monsterAI.cooldownOf(g, MONSTER_SKILLS['death_root'])).toBeCloseTo(9 * 0.7, 5);
    const fo = g.castSkills.find(c => c.def.id === 'forest_oblivion')!;
    expect(fo.cd).toBeCloseTo(2, 5);
    expect(MONSTER_SKILLS['forest_oblivion'].castTime).toBe(6);
  });

  it('35. Forest Oblivion is not interruptible: an interrupt without break power is refused', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.cast(g, 'forest_oblivion');
    (b.e as any).tryInterrupt(b.hero('aurel'), g);
    expect(g.casting?.def.id).toBe('forest_oblivion');
    expect(b.of('immune').length).toBe(1);
  });

  it('36. Break Gauge: 60 + 40 fills 100 → cast cancelled, BROKEN 3 s (×1.25 damage taken, no actions), full cooldown', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('sylvie', 4, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    g.castSkills.push({ def: MONSTER_SKILLS['forest_oblivion'], cd: 0 }); // (normally unlocked by phase 4)
    b.cast(g, 'forest_oblivion');
    (b.e as any).tryInterrupt(b.hero('aurel'), g, 60);
    expect(g.casting!.breakDamage).toBe(60);
    (b.e as any).tryInterrupt(b.hero('sylvie'), g, 40);
    expect(g.casting).toBeNull();
    expect(b.of('broken').length).toBe(1);
    expect(buffRemaining(g, 'broken')).toBeCloseTo(3, 1);
    expect(modifier(g, 'damageTakenMultiplier')).toBeCloseTo(1.25, 5);
    expect(g.castSkills.find(c => c.def.id === 'forest_oblivion')!.cd).toBeCloseTo(12, 5);
    const acts = b.of('attack').filter(a => a.src === g.id).length + b.of('castStart').filter(a => a.src === g.id).length;
    b.run(2.5);
    expect(b.of('attack').filter(a => a.src === g.id).length + b.of('castStart').filter(a => a.src === g.id).length).toBe(acts);
    // the hero break values come from the kit data
    const bp = (id: string, slot: SkillSlot) => (kitOf(id, HERO_BY_ID[id].cls)[slot].effects.find(e => 'breakPower' in e) as any)?.breakPower;
    expect([bp('aurel', 'skill2'), bp('aurel', 'ult'), bp('sylvie', 'skill2'), bp('sylvie', 'ult')]).toEqual([60, 70, 40, 60]);
  });

  it('37. the Break Gauge resets with the next cast', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.cast(g, 'forest_oblivion');
    (b.e as any).tryInterrupt(b.hero('aurel'), g, 60);
    b.until(() => !g.casting, 7);
    b.cast(g, 'forest_oblivion');
    expect(g.casting!.breakDamage).toBe(0);
  });

  it('38. Forest Oblivion lands: 260% ATK on every hero + healing received −50% for 6 s', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('lumina', 4, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.cast(g, 'forest_oblivion');
    const spy = spyOn(DamageResolver, 'resolve').and.callThrough();
    b.until(() => b.of('skillActivated').some(s => s.skill === 'forest_oblivion'), 7);
    const calls = spy.calls.allArgs().filter(a => a[0].sourceId === 'forest_oblivion');
    expect(calls.length).toBe(2);
    expect(calls[0][0].multiplier).toBe(2.6);
    const lum = b.hero('lumina');
    expect(buffRemaining(lum, 'healing_reduction')).toBeGreaterThan(5.5);
    lum.hp = 100;
    (b.e as any).heal(lum, 100);
    expect(lum.hp).toBe(150);
  });

  it('39. a fallen boss takes its summons with it', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    b.freeze('all');
    const t = b.monsters('elder_treant')[0];
    (b.e as any).summon(t, 'call_of_the_forest', [{ id: 'forest_spirit', count: 2 }], 3);
    t.monster!.phaseIndex = 99; // (phases would stop a one-shot at 50%)
    b.kill(t);
    expect(b.monsters('forest_spirit').every(s => !s.alive)).toBeTrue();
  });

  it('40. hero interrupt AI treats a breakable cast as a target (Tank / Sylvie go for Forest Oblivion)', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('sylvie', 4, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    const g = b.monsters('fallen_forest_guardian')[0];
    const a = b.hero('aurel');
    b.put(g, a.pos.c + 1, a.pos.r);
    b.cast(g, 'forest_oblivion');
    a.cd2 = 0;
    const pick = b.e.skills.chooseInterrupt(a, g);
    expect(pick?.target).toBe(g);
    expect((MONSTER_SKILLS['forest_oblivion'] as MonsterSkillDefinition).breakRequired).toBe(100);
  });
});
