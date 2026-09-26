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
import { applyProfile } from '../../core/rules/progression';
import { POWER_PROFILES } from '../../core/data/progression';
import { TacticalBot, tacticalFormation } from './bots/tactical-bot';
import { BattleEngine, BattleEvent, BattleUnit } from './battle-engine';
import { applyBuff, buffRemaining, hasFlag, hasStatus, modifier } from './buffs';
import { DamageResolver } from './damage-resolver';
import { distance, Grid } from './grid';
import { nextStep } from './pathfinding';
import { selectTarget, TARGET_STRATEGIES } from './targeting';

// ------------------------------------------------------------------ harness

const DT = 0.05;
type Ev = BattleEvent & { t: number };

const H = (id: string, depth: number, lane: number, o: Partial<UnitSpec['stats']> = {}): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + depth * 10 + lane, sprite: t.sprite,
    stats: { ...heroStats(t, { uid: 0, templateId: id, level: 1, potential: 'B' }), ...o },
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
  it('extra 1 — defines the 12 new monsters (+ the Sacrifice variant) with the design stats', () => {
    const ids = ['magic_mushroom', 'forest_spirit', 'shadow_panther', 'goblin_guard', 'goblin_shaman', 'elder_treant', 'corrupted_wolf',
      'mist_wraith', 'corrupted_treant', 'dark_shaman', 'mist_witch', 'fallen_forest_guardian'];
    for (const id of ids) expect(MONSTERS[id]).withContext(id).toBeDefined();
    expect(Object.keys(STAGE4_10_MONSTERS).length).toBe(13);
    const s = (id: string) => MONSTERS[id].stats;
    // Patch 1 re-authored stats (tower progression content; the spec's first values were for a Lv1–5 slice)
    expect([s('magic_mushroom').maxHp, s('magic_mushroom').attack, s('magic_mushroom').defense]).toEqual([220, 48, 12]);
    expect([s('fallen_forest_guardian').maxHp, s('fallen_forest_guardian').attack, s('fallen_forest_guardian').defense]).toEqual([12000, 125, 60]);
    expect([s('elder_treant').maxHp, s('elder_treant').attack]).toEqual([7000, 145]);
    // roles stay readable: the body blocker is the tankiest common, the Wraith fragile but hard-hitting
    expect(s('corrupted_treant').maxHp).toBeGreaterThan(s('corrupted_wolf').maxHp * 2);
    expect(s('mist_wraith').maxHp).toBeLessThan(s('corrupted_wolf').maxHp);
    expect(s('mist_wraith').attack).toBeGreaterThan(s('corrupted_wolf').attack);
    expect(s('forest_spirit').defenseIgnore).toBe(0.2);
    expect(s('corrupted_treant').bodyBlock).toBeTrue();
    expect(MONSTERS['elder_treant'].rank).toBe('BOSS');
    expect(MONSTERS['fallen_forest_guardian'].rank).toBe('FINAL_BOSS');
  });

  it('extra 2 — visuals are separate from gameplay: every new monster has a mock VisualDefinition and no art clips', () => {
    for (const m of Object.values(STAGE4_10_MONSTERS)) {
      expect(VISUALS[m.visual!]).withContext(m.id).toBeDefined();
      expect(Object.keys(m.animation.clips).length).toBe(0);
    }
    // mock FX live on the skill as optional presentation data — effects never read them
    for (const sk of Object.values(STAGE4_10_SKILLS)) expect(sk.effects.length).toBeGreaterThan(0);
  });

  it('extra 3 — every referenced skill / status / summon exists', () => {
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

  it('extra 4 — Stages 4–10 have 3 waves; boss waves hold only the boss', () => {
    for (const st of STAGES.slice(3)) {
      const w = wavesOf(st);
      expect(w.length).withContext(`F${st.floor}`).toBe(3);
      for (const sp of w.flatMap(x => x.spawns)) expect(MONSTERS[sp.monsterId]).withContext(sp.monsterId).toBeDefined();
    }
    expect(wavesOf(STAGES[6])[2].spawns.map(s => s.monsterId)).toEqual(['elder_treant']);
    expect(wavesOf(STAGES[9])[2].spawns.map(s => s.monsterId)).toEqual(['fallen_forest_guardian']);
  });

  it('extra 5 — Stages 1–10 are playable back to back (a near-max Patch 1 team with tactics clears every stage)', () => {
    for (const stage of STAGES) expect(clearsWithTactics(stage, 'G', 10)).withContext(`F${stage.floor}`).toBeTrue();
  });
});

// ------------------------------------------------------------------ statuses

describe('Stage 4–10 statuses', () => {
  it('extra 6 — Poison Cloud aims at the hero cluster and poisons every hero it hits', () => {
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

  it('extra 7 — ROOT stops a hero walking but it may still attack', () => {
    const b = battle([H('jin', 5, 1, TOUGH)], [mon('goblin_guard', 5, 1)]);
    const jin = b.hero('jin');
    const guard = b.monsters('goblin_guard')[0];
    b.status(jin, 'root', guard, 3);
    const c0 = jin.pos.c;
    b.run(2);
    expect(jin.pos.c).toBe(c0);
    expect(hasFlag(jin, 'root')).toBeTrue();
  });

  it('extra 8 — Nightmare stuns the highest-ATK hero for 3 s (no actions)', () => {
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

  it('extra 9 — a stun on a casting monster does not cancel the cast (only a dedicated interrupt does)', () => {
    const b = battle([H('lumina', 5, 0, TOUGH)], [mon('goblin_shaman', 3, 1), mon('goblin_guard', 0, 0)]);
    b.freeze('heroes');
    const sh = b.monsters('goblin_shaman')[0];
    b.cast(sh, 'healing_ritual');
    b.status(sh, 'stun', b.hero('lumina'), 1);
    b.run(0.5);
    expect(sh.casting?.def.id).toBe('healing_ritual');
  });

  it('extra 10 — Corrupted Wolf: every 3rd successful bite on the same target applies BLEED (counter resets on a new target)', () => {
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

  it('extra 11 — BLEED ticks 15% of the source ATK per second for 5 s', () => {
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

  it('extra 12 — DARK FOG: ranged basic ×0.75, ranged skills ×0.85, melee and healing unaffected', () => {
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

  it('extra 13 — SOUL LINK: 70% of the shaman\'s damage goes to the linked treant; the link ends when the treant dies', () => {
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

  it('extra 14 — SOUL LINK transfer never crits, never chains and triggers no on-hit', () => {
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

  it('extra 15 — UNTARGETABLE (Mist Form): not selectable, projectiles pass, Focus stays but is temporarily invalid', () => {
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

  it('extra 16 — an untargetable unit takes no DoT damage', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('mist_wraith', 3, 1)]);
    b.freeze('all');
    const w = b.monsters('mist_wraith')[0];
    b.status(w, 'poison', b.hero('lumina'));
    b.status(w, 'untargetable', w, 5);
    const hp = w.hp;
    b.run(2);
    expect(w.hp).toBe(hp);
  });

  it('extra 17 — Forest Spirit ignores 20% of the target DEF', () => {
    const a = { id: 1, atk: 100, buffs: [], defenseIgnore: 0.2 };
    const res = DamageResolver.resolve({ attacker: a, target: { def: 100, buffs: [] }, damageType: 'MAGIC', sourceId: 'x' });
    expect(res.amount).toBe(Math.round(100 * (100 / (100 + 80))));
  });

  it('extra 18 — LOWEST_EFFECTIVE_DEF picks the softest hero; CLASS_PRIORITY picks healer > mage > archer', () => {
    const t = (id: number, def: number, cls: any, c: number) => ({ id, pos: { r: 1, c }, hp: 100, maxHp: 100, line: 'front' as const, def, cls });
    const heroes = [t(1, 80, 'tank', 5), t(2, 10, 'mage', 2), t(3, 30, 'healer', 1)];
    expect(selectTarget({ from: { r: 1, c: 10 }, candidates: heroes, attackRange: 6, cfg: { strategy: 'LOWEST_EFFECTIVE_DEF', targetLockDuration: 1 } })!.id).toBe(2);
    expect(selectTarget({ from: { r: 1, c: 10 }, candidates: heroes, attackRange: 1, cfg: { strategy: 'CLASS_PRIORITY', classPriority: ['healer', 'mage', 'archer'], targetLockDuration: 1 } })!.id).toBe(3);
  });
});

// ------------------------------------------------------------------ monsters

describe('Stage 4–10 monsters', () => {
  it('extra 19 — Shadow Panther leaps behind a back-row healer onto a free cell (never overlapping)', () => {
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

  it('extra 20 — Healing Ritual: skipped while allies are healthy, cast when 2 allies < 70%, heals 20% max HP', () => {
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

  it('extra 21 — two Goblin Shamans do not synchronise their first cast (initialDelayRandom ±1 s)', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('goblin_shaman', 4, 0), mon('goblin_shaman', 4, 2)], { seed: 11 });
    const cds = b.monsters('goblin_shaman').map(s => s.castSkills[0].cd);
    const base = MONSTER_SKILLS['healing_ritual'].cooldown * 0.5;
    for (const cd of cds) expect(Math.abs(cd + DT - base)).toBeLessThanOrEqual(1.01);
    expect(cds[0]).not.toBeCloseTo(cds[1], 3);
  });

  it('extra 22 — default first cast = cooldown × 0.5 (Magic Mushroom)', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('magic_mushroom', 4, 1)]);
    expect(b.monsters('magic_mushroom')[0].castSkills[0].cd + DT).toBeCloseTo(MONSTER_SKILLS['poison_cloud'].cooldown * 0.5, 5);
  });

  it('extra 23 — Corrupted Treant body-blocks hero movement (paths go around its cell)', () => {
    const b = battle([H('jin', 0, 1, TOUGH)], [mon('corrupted_treant', 0, 1)]);
    const t = b.monsters('corrupted_treant')[0];
    const jin = b.hero('jin');
    const blocked = (b.e as any).bodyBlocked(jin);
    expect(blocked(t.pos)).toBeTrue();
    const g = new Grid(Infinity);
    const step = nextStep(g, { r: 1, c: t.pos.c - 1 }, c => c.c === t.pos.c + 1 && c.r === 1, blocked);
    expect(step).not.toEqual(t.pos);
  });

  it('extra 24 — Dark Heal prefers a boss / elite ally below 60%, else the lowest HP% ally', () => {
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
  it('extra 25 — Elder Treant ignores stun and knockback; BROKEN (boss-valid) still lands', () => {
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

  it('extra 26 — Elder Treant at 50%: ANCIENT RAGE (attack speed ×1.15, Call cooldown 12 → 10) enables Thorn Pulse', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    b.freeze('all');
    const t = b.monsters('elder_treant')[0];
    expect(t.castSkills!.some(c => c.def.id === 'thorn_pulse')).toBeFalse();
    b.dmg(t, Math.ceil(t.maxHp * 0.51));
    expect(b.of('bossPhase').map(p => p.phase)).toEqual(['ancient_rage']);
    expect(modifier(t, 'attackSpeedMultiplier')).toBeCloseTo(1.15, 5);
    expect((b.e as any).monsterAI.cooldownOf(t, MONSTER_SKILLS['call_of_the_forest'])).toBe(10);
    expect(t.castSkills!.some(c => c.def.id === 'thorn_pulse')).toBeTrue();
  });

  it('final pass — Thorn Pulse: every 8 s, not interruptible, moderate damage to every hero (no one-shot)', () => {
    const tp = MONSTER_SKILLS['thorn_pulse'];
    expect([tp.cooldown, tp.interruptible, tp.target.type]).toEqual([8, false, 'ALL_HEROES']);
    const b = battle([H('aurel', 0, 1), H('lumina', 4, 1), H('sylvie', 4, 0)], [mon('elder_treant', 1, 1)]);
    b.freeze('all');
    const t = b.monsters('elder_treant')[0];
    b.cast(t, 'thorn_pulse');
    expect(b.of('castStart').at(-1)!.interruptible).toBeFalse();
    b.until(() => !t.casting, 3);
    for (const id of ['aurel', 'lumina', 'sylvie']) {
      const h = b.hero(id);
      expect(h.hp).withContext(id).toBeLessThan(h.maxHp);
      expect(h.hp / h.maxHp).withContext(id).toBeGreaterThan(0.4); // moderate, even at Lv1 with no gear
    }
    // an interrupt attempt does nothing
    b.cast(t, 'thorn_pulse');
    (b.e as any).tryInterrupt(b.hero('sylvie'), t);
    expect(t.casting).withContext('still casting after an interrupt attempt').toBeTruthy();
  });

  it('extra 27 — Call of the Forest summons 1 Forest Spirit + 1 Magic Mushroom, never more than 2 alive', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    b.freeze('all');
    const t = b.monsters('elder_treant')[0];
    b.cast(t, 'call_of_the_forest');
    b.until(() => !t.casting, 4);
    expect(b.monsters('forest_spirit').length).toBe(1);
    expect(b.monsters('magic_mushroom').length).toBe(1);
    const cond = MONSTER_SKILLS['call_of_the_forest'].conditions;
    expect(cond.every(c => (b.e as any).monsterAI.conditionHolds(t, MONSTER_SKILLS['call_of_the_forest'], c))).toBeFalse();
    b.kill(b.monsters('forest_spirit')[0]);
    (b.e as any).summon(t, 'call_of_the_forest', [{ id: 'forest_spirit', count: 2 }], 2);
    expect(b.monsters('forest_spirit').filter(u => u.alive).length).toBe(1);
  });

  it('final pass — F8 synergy: wolves bleed, the Mist Wraith hunts the bleeding hero, Mist Strike +20 % vs bleed', () => {
    expect(MONSTERS['corrupted_wolf'].attack.onHitEveryN).toEqual({ n: 3, status: 'bleed' });
    expect(MONSTERS['mist_wraith'].ai.targeting.preferStatus).toBe('bleed');
    const strike = MONSTER_SKILLS['mist_form'].effects.find(e => e.type === 'DAMAGE') as { bonusVsStatus?: { status: string; mul: number } };
    expect(strike.bonusVsStatus).toEqual({ status: 'bleed', mul: 1.2 });
    // targeting: a bleeding front-row hero beats a lower-HP back-row hero
    const h = (id: number, line: 'front' | 'back', hp: number, bleeding: boolean) => ({
      id, pos: { r: 1, c: 2 }, hp, maxHp: 100, line, buffs: bleeding ? [{ def: { id: 'bleed' } }] : [],
    });
    const cfg = MONSTERS['mist_wraith'].ai.targeting;
    const pick = TARGET_STRATEGIES.LOWEST_HP_PCT({ from: { r: 1, c: 12 }, candidates: [h(1, 'front', 90, true), h(2, 'back', 30, false)], attackRange: 1.3, cfg });
    expect(pick!.id).toBe(1);
    const none = TARGET_STRATEGIES.LOWEST_HP_PCT({ from: { r: 1, c: 12 }, candidates: [h(1, 'front', 90, false), h(2, 'back', 30, false)], attackRange: 1.3, cfg });
    expect(none!.id).toBe(2);
    // damage: the same strike deals 1.2× to a bleeding hero
    const hit = (bleeding: boolean) => {
      const b = battle([H('lumina', 4, 1, TOUGH), H('aurel', 0, 1, TOUGH)], [mon('mist_wraith', 1, 1)]);
      b.freeze('all');
      const w = b.monsters('mist_wraith')[0];
      const l = b.hero('lumina');
      if (bleeding) b.status(l, 'bleed', w, 60);
      const before = l.hp;
      (b.e as any).activateMonsterSkill(w, MONSTER_SKILLS['mist_form'], l.id);
      return { dealt: before - l.hp, bonus: b.e.metrics.bonusHits['mist_form'] ?? 0 };
    };
    const plain = hit(false);
    const marked = hit(true);
    expect(plain.bonus).toBe(0);
    expect(marked.bonus).toBe(1);
    expect(marked.dealt / plain.dealt).toBeGreaterThan(1.15);
    expect(marked.dealt / plain.dealt).toBeLessThan(1.25);
  });

  it('final pass — F6 transition floor: one Goblin Shaman per wave; F7 lighter openers; F8 opens with a hunting wraith', () => {
    const waves = (f: number) => wavesOf(STAGES[f - 1]);
    for (const w of waves(6)) expect(w.spawns.filter(sp => sp.monsterId === 'goblin_shaman').length).toBe(1);
    expect(waves(7)[0].spawns.length).toBe(4);
    expect(waves(8)[0].spawns.map(sp => sp.monsterId)).toContain('mist_wraith');
    expect(STAGES[7].monsterTuning).toEqual({ hp: 1.1 });
  });

  it('extra 28 — phases are never skipped: a huge hit stops at the next threshold', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('all');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.dmg(g, g.maxHp * 5);
    expect(g.alive).toBeTrue();
    expect(pct(g)).toBeCloseTo(0.7, 2);
    expect(b.of('bossPhase').length).toBe(1);
  });

  it('extra 29 — Guardian 70%: sealed (untargetable) with 2 Mist Wraiths, Dark Pulse every 3 s, seal ends when they die', () => {
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

  it('extra 30 — Guardian is immune to taunt, root and knockback (a stun still lands)', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    g.buffs = [];
    for (const s of ['taunted', 'root']) b.status(g, s, b.hero('aurel'));
    expect(g.buffs.length).toBe(0);
    b.status(g, 'stun', b.hero('aurel'), 0.8);
    expect(hasFlag(g, 'stun')).toBeTrue();
    const c0 = g.pos.c;
    (b.e as any).skillHost().knockback(b.hero('aurel'), g, 1);
    expect(g.pos.c).toBe(c0);
  });

  it('extra 31 — Guardian 40%: the ritual shaman casts Sacrifice 2 s after spawning (5 s); success heals the boss 20% and ATK ×1.2', () => {
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

  it('extra 32 — an interrupted Sacrifice gives nothing and is never cast again', () => {
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

  it('extra 33 — Sacrifice ATK bonus never stacks', () => {
    const g = { buffs: [] as any[] };
    expect(applyBuff(g, STATUS_EFFECTS['guardian_empowered'], 1)).toBe('applied');
    expect(applyBuff(g, STATUS_EFFECTS['guardian_empowered'], 2)).toBe('ignored');
    expect(modifier(g, 'attackMultiplier')).toBeCloseTo(1.2, 5);
  });

  it('extra 34 — Guardian 15%: enrage (atk speed ×1.4, damage ×1.3), cooldowns ×0.7, Forest Oblivion unlocked (first cast after 2 s)', () => {
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
    expect(MONSTER_SKILLS['forest_oblivion'].castTime).toBe(6.75);
  });

  it('extra 35 — Forest Oblivion is not interruptible: an interrupt without break power is refused', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.cast(g, 'forest_oblivion');
    (b.e as any).tryInterrupt(b.hero('aurel'), g);
    expect(g.casting?.def.id).toBe('forest_oblivion');
    expect(b.of('immune').length).toBe(1);
  });

  it('extra 36 — Break Gauge: 60 + 40 fills 100 → cast cancelled, BROKEN 3 s (×1.25 damage taken, no actions), full cooldown', () => {
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

  it('extra 37 — the Break Gauge resets with the next cast', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.cast(g, 'forest_oblivion');
    (b.e as any).tryInterrupt(b.hero('aurel'), g, 60);
    b.until(() => !g.casting, 7);
    b.cast(g, 'forest_oblivion');
    expect(g.casting!.breakDamage).toBe(0);
  });

  it('extra 38 — Forest Oblivion lands: 210% ATK (encounter pass) on every hero + healing received −50% for 6 s', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('lumina', 4, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.cast(g, 'forest_oblivion');
    const spy = spyOn(DamageResolver, 'resolve').and.callThrough();
    b.until(() => b.of('skillActivated').some(s => s.skill === 'forest_oblivion'), 7);
    const calls = spy.calls.allArgs().filter(a => a[0].sourceId === 'forest_oblivion');
    expect(calls.length).toBe(2);
    expect(calls[0][0].multiplier).toBe(2.1);
    const lum = b.hero('lumina');
    expect(buffRemaining(lum, 'healing_reduction')).toBeGreaterThan(5.5);
    lum.hp = 100;
    (b.e as any).heal(lum, 100);
    expect(lum.hp).toBe(150);
  });

  it('extra 39 — a fallen boss takes its summons with it', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    b.freeze('all');
    const t = b.monsters('elder_treant')[0];
    (b.e as any).summon(t, 'call_of_the_forest', [{ id: 'forest_spirit', count: 2 }], 3);
    t.monster!.phaseIndex = 99; // (phases would stop a one-shot at 50%)
    b.kill(t);
    expect(b.monsters('forest_spirit').every(s => !s.alive)).toBeTrue();
  });

  it('extra 40 — hero interrupt AI treats a breakable cast as a target (Tank / Sylvie go for Forest Oblivion)', () => {
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

// ------------------------------------------------------------------ the spec's REQUIRED TESTS (1–38)

/** a developed team (power profile) played by the TACTICAL bot clears `stage` in at least one of `seeds` tries */
function clearsWithTactics(stage: StageDef, profile: string, level: number, seeds = 4): boolean {
  const state = newGameState();
  const heroes = state.heroes.map(h => applyProfile(h, POWER_PROFILES[profile], level));
  const allies = teamToUnits(tacticalFormation(heroes, state.team, stage), heroes);
  for (let seed = 1; seed <= seeds; seed++) {
    const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed, autoUlt: true });
    const bot = new TacticalBot();
    while (!e.result && e.time < 400) {
      bot.tick(e);
      e.step(0.05);
      e.drainEvents();
    }
    if (e.result === 'win') return true;
  }
  return false;
}

const stageOfWave = (floor: number, wave: number): { enemies: EnemyPlacement[]; tuning?: StageDef["monsterTuning"]; level: number } => {
  const st = STAGES[floor - 1];
  const w = wavesOf(st)[wave];
  return { enemies: w.spawns.map(s => mon(s.monsterId, s.formationSlot.depth, s.formationSlot.lane)), tuning: st.monsterTuning, level: st.recommendedLevel ?? 1 };
};

describe('Stage 4–10 required tests', () => {
  it('1. Poison applies and expires correctly', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('magic_mushroom', 4, 1)]);
    b.freeze('all');
    const a = b.hero('aurel');
    const m = b.monsters('magic_mushroom')[0];
    b.status(a, 'poison', m);
    expect(buffRemaining(a, 'poison')).toBeCloseTo(4, 5);
    const t0 = b.e.time;
    b.run(4.1);
    const ticks = b.of('damage').filter(d => d.dst === a.id && d.poison && d.t > t0);
    expect(ticks.length).toBe(8);
    expect(ticks.reduce((s, d) => s + d.amount, 0)).toBeCloseTo(m.atk * 0.25 * 4, -1);
    expect(hasStatus(a, 'poison')).toBeFalse();
    expect(b.of('buffEnd').some(x => x.dst === a.id && x.buff === 'poison')).toBeTrue();
  });

  it('2. Mushroom Poison Cloud can be interrupted', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('jin', 0, 0, TOUGH)], [mon('magic_mushroom', 2, 1)]);
    b.freeze('heroes');
    const m = b.monsters('magic_mushroom')[0];
    b.cast(m, 'poison_cloud', b.hero('aurel'));
    (b.e as any).tryInterrupt(b.hero('aurel'), m);
    expect(m.casting).toBeNull();
    expect(b.of('CAST_INTERRUPTED').some(x => x.skill === 'poison_cloud')).toBeTrue();
    b.run(2);
    expect(hasStatus(b.hero('aurel'), 'poison')).toBeFalse();
  });

  it('3. Forest Spirit ignores 20% DEF correctly', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('forest_spirit', 4, 1)]);
    const s = b.monsters('forest_spirit')[0];
    const a = b.hero('aurel');
    const res = DamageResolver.resolve({ attacker: s, target: a, multiplier: 1, damageType: 'MAGIC', sourceId: 'x' });
    expect(res.amount).toBe(Math.max(1, Math.round(s.atk * (100 / (100 + a.def * 0.8)))));
  });

  it('4. Panther attacks the Back Row', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('jin', 0, 0, TOUGH), H('lumina', 4, 1, TOUGH), H('sylvie', 4, 2, TOUGH)], [mon('shadow_panther', 0, 1)]);
    b.freeze('heroes');
    const p = b.monsters('shadow_panther')[0];
    b.run(6);
    const hitIds = new Set(b.of('damage').filter(d => !d.poison && b.e.units.find(u => u.id === d.dst)?.side === 'ally').map(d => d.dst));
    expect(hitIds.has(b.hero('lumina').id)).toBeTrue();
    expect(hitIds.has(b.hero('aurel').id)).toBeFalse();
    expect(p.monster!.currentTargetId).toBe(b.hero('lumina').id);
  });

  it('5. Panther Leap does not overlap units', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('lumina', 4, 1, TOUGH), H('corvin', 5, 1, TOUGH), H('velma', 5, 0, TOUGH), H('sylvie', 5, 2, TOUGH)],
      [mon('shadow_panther', 0, 1)]);
    b.freeze('heroes');
    const p = b.monsters('shadow_panther')[0];
    expect(b.until(() => b.of('skillActivated').some(s => s.skill === 'shadow_leap'), 15)).toBeTrue();
    expect(b.e.units.filter(u => u.alive && u !== p && u.pos.r === p.pos.r && u.pos.c === p.pos.c).length).toBe(0);
  });

  it('6. Goblin Shaman heals only when needed', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('goblin_shaman', 4, 1), mon('goblin_guard', 0, 0), mon('goblin_guard', 0, 2)]);
    b.freeze('heroes');
    const sh = b.monsters('goblin_shaman')[0];
    const [g1] = b.monsters('goblin_guard');
    g1.hp = Math.round(g1.maxHp * 0.6); // one ally hurt is not enough
    b.run(10);
    expect(b.of('castStart').some(c => c.src === sh.id)).toBeFalse();
    b.monsters('goblin_guard')[1].hp = Math.round(g1.maxHp * 0.6);
    expect(b.until(() => b.of('castStart').some(c => c.src === sh.id), 3)).toBeTrue();
  });

  it('7. Healing Ritual can be interrupted', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('goblin_shaman', 1, 1), mon('goblin_guard', 0, 0)]);
    b.freeze('heroes');
    const sh = b.monsters('goblin_shaman')[0];
    const g = b.monsters('goblin_guard')[0];
    g.hp = Math.round(g.maxHp * 0.3);
    const hp = g.hp;
    b.cast(sh, 'healing_ritual');
    (b.e as any).tryInterrupt(b.hero('aurel'), sh);
    b.run(3.5);
    expect(b.of('CAST_INTERRUPTED').some(x => x.skill === 'healing_ritual')).toBeTrue();
    expect(g.hp).toBeLessThanOrEqual(hp);
  });

  it('8. Elder Treant Root Slam cannot be interrupted', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 0, 1)]);
    b.freeze('heroes');
    const t = b.monsters('elder_treant')[0];
    b.cast(t, 'root_slam', b.hero('aurel'));
    (b.e as any).tryInterrupt(b.hero('aurel'), t, 0);
    expect(t.casting?.def.id).toBe('root_slam');
    expect(b.of('immune').length).toBe(1);
  });

  it('9. Entangling Roots can be interrupted', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('lumina', 4, 1, TOUGH)], [mon('elder_treant', 0, 1)]);
    b.freeze('heroes');
    const t = b.monsters('elder_treant')[0];
    b.cast(t, 'entangling_roots', b.hero('lumina'));
    (b.e as any).tryInterrupt(b.hero('aurel'), t);
    expect(t.casting).toBeNull();
    b.run(2.5);
    expect(hasStatus(b.hero('lumina'), 'root')).toBeFalse();
  });

  it('10. Call of the Forest summons the correct units', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    b.freeze('all');
    const t = b.monsters('elder_treant')[0];
    b.cast(t, 'call_of_the_forest');
    b.until(() => !t.casting, 4);
    expect(b.monsters('forest_spirit').length).toBe(1);
    expect(b.monsters('magic_mushroom').length).toBe(1);
    expect(b.of('summon').every(s => s.src === t.id)).toBeTrue();
  });

  it('11. Elder Treant Phase 2 triggers once', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('elder_treant', 1, 1)]);
    b.freeze('all');
    const t = b.monsters('elder_treant')[0];
    b.dmg(t, Math.ceil(t.maxHp * 0.55));
    b.dmg(t, 50);
    (b.e as any).heal(t, t.maxHp); // back above 50% …
    b.dmg(t, Math.ceil(t.maxHp * 0.6)); // … and below again
    expect(b.of('bossPhase').filter(p => p.src === t.id).length).toBe(1);
    expect(modifier(t, 'attackSpeedMultiplier')).toBeCloseTo(1.15, 5);
  });

  it('12. Corrupted Wolf applies Bleed every third successful hit', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('corrupted_wolf', 0, 1)]);
    b.freeze('heroes');
    const a = b.hero('aurel');
    const bites = () => b.of('damage').filter(d => d.dst === a.id && !d.poison).length;
    const bleeds = () => b.of('buff').filter(x => x.dst === a.id && x.buff === 'bleed').length;
    b.until(() => bites() === 2, 20);
    expect(bleeds()).toBe(0);
    b.until(() => bites() === 3, 5);
    expect(bleeds()).toBe(1);
    b.until(() => bites() === 5, 8);
    expect(bleeds()).toBe(1);
    b.until(() => bites() === 6, 5);
    expect(bleeds()).toBe(2);
  });

  it('13. Wraith becomes truly Untargetable', () => {
    const b = battle([H('sylvie', 4, 1, TOUGH), H('jin', 0, 1, TOUGH)], [mon('mist_wraith', 1, 1)]);
    b.freeze('heroes');
    const w = b.monsters('mist_wraith')[0];
    const sy = b.hero('sylvie');
    // an arrow already flying at it
    (b.e as any).skillHost().shoot(sy, w, 'attack', false, () => undefined);
    (b.e as any).fireProjectile(b.hero('jin'), w, { id: 'x', projectileId: 'spirit_bolt', damageMultiplier: 1 });
    b.cast(w, 'mist_form', sy);
    const hp = w.hp;
    expect(b.e.isValidTarget(sy, w)).toBeFalse();
    expect((b.e as any).hit(sy, w, 1, { sourceId: 'x' })).toBeFalse();
    // AoE from heroes only sees valid foes
    expect(b.e.skills['h'].foes(sy).includes(w)).toBeFalse();
    b.run(1);
    expect(w.hp).toBe(hp);
    b.until(() => !hasFlag(w, 'untargetable'), 2);
    expect(b.e.isValidTarget(sy, w)).toBeTrue();
  });

  it('14. Focus Target safely handles an Untargetable Wraith', () => {
    const b = battle([H('sylvie', 4, 1, TOUGH), H('aurel', 0, 1, TOUGH)], [mon('mist_wraith', 1, 1), mon('goblin_guard', 0, 0)]);
    const w = b.monsters('mist_wraith')[0];
    b.e.setFocus(w.id);
    b.status(w, 'untargetable', w, 1.5);
    b.run(0.6);
    expect(b.e.focusTargetId).toBe(w.id); // kept, just temporarily invalid
    expect(b.e.units.filter(u => u.side === 'ally').every(h => h.targetId !== w.id)).toBeTrue();
    b.run(1.2);
    expect(hasFlag(w, 'untargetable')).toBeFalse();
    expect(b.e.focusTargetId).toBe(w.id);
  });

  it('15. Corrupted Treant physically blocks melee movement', () => {
    // Jin must reach the shaman in lane 1 behind the treant; he may go around, never through its cell
    const b = battle([H('jin', 0, 1, TOUGH)], [mon('corrupted_treant', 0, 1), mon('dark_shaman', 3, 1)]);
    const t = b.monsters('corrupted_treant')[0];
    const jin = b.hero('jin');
    t.monster!.state = 'DEAD'; // a statue: keep it in place
    b.e.setFocus(b.monsters('dark_shaman')[0].id);
    let through = false;
    for (let i = 0; i < 160; i++) {
      b.step();
      if (jin.pos.r === t.pos.r && jin.pos.c === t.pos.c) through = true;
    }
    expect(through).toBeFalse();
  });

  it('16. Dark Shaman damage transfer is exactly 70%', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('corrupted_treant', 0, 1), mon('dark_shaman', 4, 1)]);
    b.freeze('all');
    const t = b.monsters('corrupted_treant')[0];
    const s = b.monsters('dark_shaman')[0];
    applyBuff(s, STATUS_EFFECTS['soul_link'], t.id);
    const s0 = s.hp, t0 = t.hp;
    b.dmg(s, 100);
    expect([s0 - s.hp, t0 - t.hp]).toEqual([30, 70]);
  });

  it('17. Soul Link ends when the protector dies', () => {
    const b = battle([H('lumina', 5, 1, TOUGH)], [mon('corrupted_treant', 0, 1), mon('dark_shaman', 4, 1)]);
    b.freeze('all');
    const t = b.monsters('corrupted_treant')[0];
    const s = b.monsters('dark_shaman')[0];
    applyBuff(s, STATUS_EFFECTS['soul_link'], t.id);
    b.kill(t);
    expect(hasStatus(s, 'soul_link')).toBeFalse();
  });

  it('18. Mist Witch Nightmare selects the highest-ATK Hero', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('velma', 4, 0, TOUGH), H('lumina', 4, 1, TOUGH)], [mon('mist_witch', 3, 1)]);
    const w = b.monsters('mist_witch')[0];
    expect((b.e as any).monsterAI.aimTarget(w, MONSTER_SKILLS['nightmare']).heroId).toBe('velma');
  });

  it('19. Dark Fog reduces ranged damage only', () => {
    const b = battle([H('sylvie', 4, 1, TOUGH), H('jin', 0, 1, TOUGH), H('lumina', 4, 2, TOUGH)], [mon('goblin_guard', 0, 1)]);
    b.freeze('all');
    const g = b.monsters('goblin_guard')[0];
    for (const h of b.e.units.filter(u => u.side === 'ally')) b.status(h, 'dark_fog', g);
    const spy = spyOn(DamageResolver, 'resolve').and.callThrough();
    (b.e as any).hit(b.hero('sylvie'), g, 1, { sourceId: 'x', slot: 'attack' });
    (b.e as any).hit(b.hero('sylvie'), g, 1, { sourceId: 'x', slot: 'skill2' });
    (b.e as any).hit(b.hero('jin'), g, 1, { sourceId: 'x', slot: 'skill' });
    expect(spy.calls.allArgs().map(a => +a[0].multiplier!.toFixed(3))).toEqual([0.75, 0.85, 1]);
    const lum = b.hero('lumina');
    lum.hp = 100;
    (b.e as any).heal(lum, 50);
    expect(lum.hp).toBe(150);
  });

  it('20. Stage 9 Wave 3 remains technically beatable', () => {
    const w3 = stageOfWave(9, 2);
    // with the floor's expected development (profile D, Lv9)
    const stage: StageDef = { floor: 9, mode: 'eliminate', timeLimit: 140, monsterTuning: w3.tuning, enemies: w3.enemies };
    expect(clearsWithTactics(stage, 'E', 9)).toBeTrue();
  });

  it('21. Final Boss Phase 2 triggers exactly once', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('all');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.dmg(g, Math.ceil(g.maxHp * 0.35));
    for (const w of b.monsters('mist_wraith')) b.kill(w);
    b.step();
    (b.e as any).heal(g, g.maxHp);
    b.dmg(g, Math.ceil(g.maxHp * 0.35));
    expect(b.of('bossPhase').filter(p => p.phase === 'dark_mist_dominion').length).toBe(1);
    expect(b.monsters('mist_wraith').length).toBe(2);
  });

  it('22. Boss stays Untargetable until both Wraiths die', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('all');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.dmg(g, Math.ceil(g.maxHp * 0.31));
    const [w1, w2] = b.monsters('mist_wraith');
    b.run(20);
    expect(hasFlag(g, 'untargetable')).toBeTrue(); // no time limit
    b.kill(w1);
    b.run(1);
    expect(hasFlag(g, 'untargetable')).toBeTrue();
    b.kill(w2);
    b.step();
    expect(hasFlag(g, 'untargetable')).toBeFalse();
  });

  it('23. Dark Pulse stops when the phase shield ends', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.dmg(g, Math.ceil(g.maxHp * 0.31));
    b.monsters('mist_wraith').forEach(w => b.status(w, 'stun', g, 99));
    b.run(6.2);
    const pulses = b.of('pulse').length;
    expect(pulses).toBe(2);
    b.monsters('mist_wraith').forEach(w => b.kill(w));
    b.run(9);
    expect(b.of('pulse').length).toBe(pulses);
  });

  const toSacrifice = () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    g.monster!.phaseIndex = 1; // (past the seal phase)
    b.dmg(g, Math.ceil(g.maxHp * 0.61));
    return { b, g, sh: b.monsters('dark_shaman_ritual')[0] };
  };

  it('24. Stage 10 Dark Shaman uses Sacrifice once', () => {
    const { b, sh } = toSacrifice();
    b.until(() => sh.casting?.def.id === 'sacrifice', 4);
    (b.e as any).tryInterrupt(b.hero('aurel'), sh);
    b.run(20);
    expect(b.of('castStart').filter(c => c.src === sh.id && c.label === 'SACRIFICE').length).toBe(1);
  });

  it('25. Sacrifice can be interrupted', () => {
    const { b, g, sh } = toSacrifice();
    b.until(() => sh.casting?.def.id === 'sacrifice', 4);
    (b.e as any).tryInterrupt(b.hero('aurel'), sh);
    expect(b.of('CAST_INTERRUPTED').some(x => x.skill === 'sacrifice')).toBeTrue();
    b.run(6);
    expect(hasStatus(g, 'guardian_empowered')).toBeFalse();
    expect(sh.alive).toBeTrue();
  });

  it('26. Successful Sacrifice heals exactly 20% Boss Max HP', () => {
    const { b, g, sh } = toSacrifice();
    b.until(() => sh.casting?.def.id === 'sacrifice', 4);
    b.until(() => sh.casting!.left < 0.2, 6);
    g.hp = Math.round(g.maxHp * 0.3);
    const hp = g.hp;
    const heal = () => b.of('heal').filter(h => h.dst === g.id && h.src === sh.id);
    b.until(() => heal().length > 0, 1);
    expect(heal()[0].amount).toBe(Math.round(g.maxHp * 0.2));
    expect(g.hp - hp).toBeGreaterThanOrEqual(Math.round(g.maxHp * 0.2) - 200); // (the boss may have been hit meanwhile)
    expect(sh.alive).toBeFalse();
  });

  it('27. Phase 4 triggers at <= 15%', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('all');
    const g = b.monsters('fallen_forest_guardian')[0];
    g.monster!.phaseIndex = 2;
    g.hp = Math.ceil(g.maxHp * 0.16);
    b.dmg(g, 1);
    expect(b.of('bossPhase').length).toBe(0);
    b.dmg(g, g.hp - Math.floor(g.maxHp * 0.15));
    expect(b.of('bossPhase').map(p => p.phase)).toEqual(['enrage']);
    expect(g.castSkills.some(c => c.def.id === 'forest_oblivion')).toBeTrue();
  });

  const oblivion = (heroes: UnitSpec[] = [H('aurel', 0, 1, TOUGH), H('sylvie', 4, 1, TOUGH)]) => {
    const b = battle(heroes, [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    g.castSkills.push({ def: MONSTER_SKILLS['forest_oblivion'], cd: 0 });
    b.cast(g, 'forest_oblivion');
    return { b, g };
  };

  it('28. Forest Oblivion displays the Break Gauge', () => {
    const { b, g } = oblivion();
    const start = b.of('castStart').find(c => c.src === g.id)!;
    expect(start.breakRequired).toBe(100);
    expect(start.interruptible).toBeFalse();
    (b.e as any).tryInterrupt(b.hero('sylvie'), g, 40);
    const ev = b.of('breakGauge').at(-1)!;
    expect([ev.value, ev.max]).toEqual([40, 100]);
    expect(g.casting!.breakDamage).toBe(40);
  });

  it('29. Break contributions use the correct values', () => {
    const bp = (id: string, slot: SkillSlot) => (kitOf(id, HERO_BY_ID[id].cls)[slot].effects.find(e => 'breakPower' in e) as any)?.breakPower;
    expect(bp('aurel', 'skill2')).toBe(60);
    expect(bp('aurel', 'ult')).toBe(70);
    expect(bp('sylvie', 'skill2')).toBe(40);
    expect(bp('sylvie', 'ult')).toBe(60);
    // through the real skill: Tank Skill 2 on the casting boss
    const { b, g } = oblivion();
    const a = b.hero('aurel');
    b.put(a, g.pos.c - 1, g.pos.r);
    b.unfreeze();
    b.use(a, 'skill2', g);
    b.freeze('heroes');
    b.until(() => b.of('breakGauge').length > 0, 2);
    expect(b.of('breakGauge')[0].value).toBe(60);
  });

  it('30. Break >= 100 cancels Forest Oblivion', () => {
    const { b, g } = oblivion();
    (b.e as any).tryInterrupt(b.hero('aurel'), g, 70);
    (b.e as any).tryInterrupt(b.hero('sylvie'), g, 40);
    expect(g.casting).toBeNull();
    expect(b.of('broken').length).toBe(1);
    b.run(7);
    expect(b.of('skillActivated').some(s => s.skill === 'forest_oblivion')).toBeFalse();
  });

  it('31. Broken state lasts exactly 3 sec', () => {
    const { b, g } = oblivion();
    (b.e as any).tryInterrupt(b.hero('aurel'), g, 100);
    const t0 = b.e.time;
    b.until(() => !hasFlag(g, 'broken'), 5);
    expect(b.e.time - t0).toBeCloseTo(3, 1);
  });

  it('32. Boss takes ×1.25 damage while Broken', () => {
    const { b, g } = oblivion();
    const a = b.hero('aurel');
    const before = DamageResolver.resolve({ attacker: a, target: g, multiplier: 1, damageType: 'PHYSICAL', sourceId: 'x' }).amount;
    (b.e as any).tryInterrupt(a, g, 100);
    const during = DamageResolver.resolve({ attacker: a, target: g, multiplier: 1, damageType: 'PHYSICAL', sourceId: 'x' }).amount;
    expect(during / before).toBeCloseTo(1.25, 1);
  });

  it('33. Failed Forest Oblivion deals the correct AoE damage', () => {
    const { b, g } = oblivion([H('aurel', 0, 1, TOUGH), H('lumina', 4, 1, TOUGH), H('sylvie', 4, 2, TOUGH)]);
    b.until(() => b.of('skillActivated').some(s => s.skill === 'forest_oblivion'), 7);
    const t = b.of('skillActivated').find(s => s.skill === 'forest_oblivion')!.t;
    for (const h of b.e.units.filter(u => u.side === 'ally')) {
      const expected = DamageResolver.resolve({ attacker: g, target: h, multiplier: 2.1, damageType: 'PHYSICAL', sourceId: 'x' }).amount;
      const got = b.of('damage').find(d => d.dst === h.id && Math.abs(d.t - t) < 1e-6)!;
      expect(got.amount + got.blocked).withContext(h.name).toBe(expected);
    }
  });

  it('34. Healing reduction expires correctly', () => {
    const { b } = oblivion([H('aurel', 0, 1, TOUGH), H('lumina', 4, 1, TOUGH)]);
    b.until(() => b.of('skillActivated').some(s => s.skill === 'forest_oblivion'), 7);
    const lum = b.hero('lumina');
    expect(modifier(lum, 'healingReceivedMultiplier')).toBe(0.5);
    b.run(6.1);
    expect(hasStatus(lum, 'healing_reduction')).toBeFalse();
    lum.hp = 100;
    (b.e as any).heal(lum, 100);
    expect(lum.hp).toBe(200);
  });

  it('35. Hero death / revive keeps working during Boss phases', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('jin', 0, 0)], [mon('fallen_forest_guardian', 1, 1)]);
    b.freeze('heroes');
    const g = b.monsters('fallen_forest_guardian')[0];
    b.dmg(g, Math.ceil(g.maxHp * 0.31)); // sealed phase
    const jin = b.hero('jin');
    b.kill(jin);
    expect(jin.life).toBe('DEAD_VISIBLE');
    const r = b.e.reviveHero({ unitId: jin.id, sourceId: 'test', reviveHpPercent: 0.4 });
    expect(r.ok).toBeTrue();
    b.until(() => jin.life === 'ALIVE', 2);
    expect(jin.alive).toBeTrue();
    expect(hasFlag(g, 'untargetable')).toBeTrue(); // phase untouched
    b.run(3.2);
    expect(b.of('damage').some(d => d.dst === jin.id)).toBeTrue(); // Dark Pulse hits the revived hero too
  });

  const twoWaves = () => {
    const w1 = stageOfWave(4, 0).enemies;
    return battle([H('aurel', 0, 1, TOUGH), H('jin', 0, 0), H('sylvie', 4, 1, TOUGH)], w1, { rounds: [stageOfWave(4, 1).enemies] });
  };

  it('36. Dead Heroes remain hidden between Waves', () => {
    const b = twoWaves();
    const jin = b.hero('jin');
    b.kill(jin);
    for (const m of b.e.units.filter(u => u.side === 'enemy' && u.alive)) b.kill(m);
    b.until(() => b.e.waveIndex === 1, 15);
    expect(jin.life).toBe('DEAD_HIDDEN');
    expect(jin.visible).toBeFalse();
    b.run(2);
    expect(jin.life).toBe('DEAD_HIDDEN');
  });

  it('37. Buff / cooldown / Ultimate Gauge persist across Waves', () => {
    const b = twoWaves();
    const a = b.hero('aurel');
    a.mana = 42;
    a.cd2 = 20;
    applyBuff(a, STATUS_EFFECTS['blood_rage'], a.id, { duration: 30 });
    for (const m of b.e.units.filter(u => u.side === 'enemy' && u.alive)) b.kill(m);
    const t0 = b.e.time;
    b.until(() => b.e.waveIndex === 1, 15);
    const dt = b.e.time - t0;
    expect(a.mana).toBe(42); // no gauge during transitions
    expect(a.cd2).toBeCloseTo(20 - dt, 0);
    expect(buffRemaining(a, 'blood_rage')).toBeCloseTo(30 - dt, 0);
  });

  it('38. Stage 1 through Stage 10 can be played continuously without final art assets', () => {
    for (const stage of STAGES) {
      for (const w of wavesOf(stage)) {
        for (const sp of w.spawns) {
          const m = MONSTERS[sp.monsterId];
          if (m.animation.sheet) continue;
          expect(VISUALS[m.visual!]?.kind).withContext(sp.monsterId).toBe('mock');
        }
      }
      expect(clearsWithTactics(stage, 'G', 10)).withContext(`F${stage.floor}`).toBeTrue();
    }
  });
});
