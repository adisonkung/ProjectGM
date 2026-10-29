import { inBasicAttackRange } from './melee-contact';
import { unitDistance } from './footprint';
import { attackEventName, attackWindupOf, clipDuration, MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { AttackDefinition, isBossRank, MonsterDefinition, MonsterSkillDefinition, SkillCondition } from '../../core/models/monster';
import { Cell } from '../../core/models/unit';
import type { BattleEvent, BattleUnit } from './battle-engine';
import { resolveArea } from './area';
import { attackSpeedReduction, buffRemaining, effectiveMoveSpeed, hasFlag, hasStatus, tauntSource } from './buffs';
import { effectiveAttack } from './damage-resolver';
import { BOARD_COLS, distance } from './grid';
import { selectTarget } from './targeting';

/** One shared state machine for every data-driven monster */
export type MonsterState = 'SPAWNING' | 'IDLE' | 'SEARCHING' | 'MOVING' | 'ATTACKING' | 'CASTING' | 'HURT' | 'RECOVERING' | 'DEAD';

/**
 * Mutable per-battle state of one monster (the static MonsterDefinition is never touched).
 * HP / position / casting / skill cooldowns live on the BattleUnit, shared with the hero systems —
 * `monsterSnapshot()` returns the full combined view.
 */
export interface MonsterCombatState {
  monsterId: number;
  definitionId: string;
  state: MonsterState;
  /** seconds spent in the current state */
  stateTime: number;
  currentTargetId: number | null;
  /** no voluntary target switch before this battle time */
  targetLockUntil: number;
  thinkTimer: number;
  attackCooldownRemaining: number;
  /** remaining time of the attack animation (ATTACKING) */
  attackTimer: number;
  /** bumps on every attack start / cancel — a scheduled hit with an old token is ignored */
  attackToken: number;
  currentSkillId: string | null;
  castTimer: number;
  hurtTimer: number;
  recoverTimer: number;
  /** battle time of the last hit reaction (anti stun-lock) */
  lastHitReactionAt: number;
  isDead: boolean;
  isTargetable: boolean;
  facingDirection: 1 | -1;
  animationState: 'idle' | 'move' | 'attack' | 'cast' | 'hurt' | 'death';
  /** RANGED_HOLD: currently closing in to preferredRange (hysteresis against jitter) */
  approaching: boolean;
  retreatSteps: number;
  /** attack.onHitEveryN: consecutive successful hits on `targetId` */
  hitStreak: { targetId: number | null; count: number };
  /** boss phases: index of the next phase to enter (phases are entered in order, once each) */
  phaseIndex: number;
  /** boss phase modifiers of skill cooldowns (effective = override ?? base × scale) */
  cooldownScale: number;
  cooldownOverride: Record<string, number>;
  /** active seal (Dark Mist Dominion): untargetable until these adds die; pulses meanwhile */
  seal: { adds: number[]; pulseEvery: number; pulseAtkPct: number; pulseName: string; timer: number } | null;
  /** SUMMON skills: ids of the units each skill summoned (maxActive counts the living ones) */
  summons: Record<string, number[]>;
  /** combat seconds since spawn (FLEE timing) · FLEE: running for the edge */
  aliveTime: number;
  fleeing: boolean;
  /** `ai.dormant` ambusher still asleep (wakes on a hero within wakeRange or on the first hit) */
  dormant: boolean;
  /** `ai.holdArena`: the spawn cell (set on the first think) and when (aliveTime) it left that ground, 0 = home */
  home?: Cell;
  awayTime: number;
}

/** What the controller may ask of the battle (implemented by BattleEngine) */
export interface CombatContext {
  readonly time: number;
  unit(id: number): BattleUnit | undefined;
  /** alive, targetable opponents currently on the battlefield */
  opponentsOf(u: BattleUnit): BattleUnit[];
  /** alive allies (self included) */
  alliesOf(u: BattleUnit): BattleUnit[];
  isValidTarget(u: BattleUnit, t: BattleUnit): boolean;
  /** one grid step toward `target` stopping when `goal` holds; false = no step possible */
  stepToward(u: BattleUnit, target: Cell, goal: (c: Cell) => boolean): boolean;
  /** one grid step away from `threat` that keeps `keep` within `range`; false = no good step */
  stepAway(u: BattleUnit, threat: Cell, keep: Cell, range: number): boolean;
  /** run `fn` after `delay` seconds unless `u` dies first */
  later(delay: number, u: BattleUnit, fn: () => void): void;
  meleeHit(u: BattleUnit, t: BattleUnit, attack: AttackDefinition): void;
  fireProjectile(u: BattleUnit, t: BattleUnit, attack: AttackDefinition): void;
  /** generic cast system: CAST_STARTED … SKILL_ACTIVATED / CAST_INTERRUPTED (`target` = aimed unit) */
  startCast(u: BattleUnit, skill: MonsterSkillDefinition, target: BattleUnit | null): void;
  updateCast(u: BattleUnit, dt: number): void;
  emit(e: BattleEvent): void;
  /** FLEE: the unit left the battlefield (not a kill) */
  escape(u: BattleUnit): void;
}

export const tagsOf = (u: BattleUnit): string[] => (u.monster ? (MONSTERS[u.monster.definitionId]?.tags ?? []) : []);

/** boss / final boss / elite monster (or a legacy boss / elite token) */
export const isBigMonster = (u: BattleUnit, defs: Record<string, MonsterDefinition> = MONSTERS): boolean => {
  const r = u.monster ? defs[u.monster.definitionId]?.rank : undefined;
  return r ? isBossRank(r) || r === 'ELITE' : !!u.boss || !!u.elite;
};

export class MonsterController {
  constructor(
    private readonly ctx: CombatContext,
    private readonly defs: Record<string, MonsterDefinition> = MONSTERS,
    private readonly skills: Record<string, MonsterSkillDefinition> = MONSTER_SKILLS,
  ) {}

  static createState(id: number, def: MonsterDefinition): MonsterCombatState {
    return {
      monsterId: id,
      definitionId: def.id,
      state: 'SPAWNING',
      stateTime: 0,
      currentTargetId: null,
      targetLockUntil: 0,
      thinkTimer: 0,
      attackCooldownRemaining: 0,
      attackTimer: 0,
      attackToken: 0,
      currentSkillId: null,
      castTimer: 0,
      hurtTimer: 0,
      recoverTimer: 0,
      lastHitReactionAt: -Infinity,
      isDead: false,
      isTargetable: true,
      facingDirection: -1,
      animationState: 'idle',
      approaching: false,
      retreatSteps: 0,
      hitStreak: { targetId: null, count: 0 },
      phaseIndex: 0,
      cooldownScale: 1,
      cooldownOverride: {},
      seal: null,
      summons: {},
      aliveTime: 0,
      fleeing: false,
      dormant: !!def.ai.dormant,
      awayTime: 0,
    };
  }

  def(u: BattleUnit): MonsterDefinition {
    return this.defs[u.monster!.definitionId];
  }

  // ------------------------------------------------------------------ main loop

  update(u: BattleUnit, dt: number): void {
    const s = u.monster!;
    if (!u.alive) return this.markDead(u);
    const def = this.def(u);
    s.stateTime += dt;
    s.aliveTime += dt;
    s.attackCooldownRemaining = Math.max(0, s.attackCooldownRemaining - dt * attackSpeedReduction(u));
    // skill cooldowns (u.castSkills) and u.moveCd are counted down by the engine's shared status tick
    s.thinkTimer -= dt;

    // STUN / BROKEN (statuses) / external stagger (castLock): no actions; cancels a swing in progress.
    // A stun does NOT cancel a cast — only a dedicated interrupt (or a Break) does.
    const stunned = hasFlag(u, 'stun');
    const broken = hasFlag(u, 'broken');
    if ((stunned || broken || u.castLock > 0) && !u.casting) {
      if (u.castLock > 0) u.castLock -= dt;
      if (s.state === 'ATTACKING') s.attackToken++;
      if (s.state !== 'HURT') this.setState(s, 'HURT', 'hurt');
      const held = u.buffs.filter(b => b.def.flags?.includes('stun') || b.def.flags?.includes('broken')).map(b => b.remaining);
      s.hurtTimer = Math.max(s.hurtTimer, u.castLock, ...held, dt);
      return;
    }

    // target validation every tick: a dead / untargetable / departed target is dropped at once
    if (s.currentTargetId != null) {
      const t = this.ctx.unit(s.currentTargetId);
      if (!t || !this.ctx.isValidTarget(u, t)) {
        s.currentTargetId = null;
        u.targetId = null;
        if (s.state === 'IDLE' || s.state === 'MOVING') this.setState(s, 'SEARCHING', 'idle');
      }
    }

    switch (s.state) {
      case 'DEAD':
        return;
      case 'SPAWNING':
        if (s.stateTime >= (def.ai.spawnDuration ?? 0)) this.setState(s, 'SEARCHING', 'idle');
        return;
      case 'HURT':
        if ((s.hurtTimer -= dt) <= 0) this.setState(s, 'SEARCHING', 'idle');
        return;
      case 'RECOVERING':
        if ((s.recoverTimer -= dt) <= 0) this.setState(s, 'SEARCHING', 'idle');
        return;
      case 'ATTACKING':
        if ((s.attackTimer -= dt) <= 0) {
          this.setState(s, 'RECOVERING', 'idle');
          s.recoverTimer = def.stats.attackRecovery;
        }
        return;
      case 'CASTING':
        this.ctx.updateCast(u, dt);
        s.castTimer = u.casting ? Math.max(0, u.casting.left) : 0;
        return;
      default:
        this.think(u, s, def);
    }
  }

  /** IDLE / SEARCHING / MOVING: skills → target → position → attack */
  private think(u: BattleUnit, s: MonsterCombatState, def: MonsterDefinition): void {
    if (s.dormant) {
      const near = this.ctx.opponentsOf(u).some(t => unitDistance(t, u) <= def.ai.dormant!.wakeRange);
      if (!near && u.hp >= u.maxHp) return this.setState(s, 'IDLE', 'idle');
      s.dormant = false;
      this.ctx.emit({ type: 'animEvent', src: u.id, event: 'FX_START', name: 'WAKE' });
    }
    if (def.ai.movement === 'FLEE') return this.flee(u, s, def);
    if (this.trySkill(u, s, def)) return;
    const arena = def.ai.holdArena;
    if (arena) {
      s.home ??= { ...u.pos };
      const away = distance(u.pos, s.home) > arena.leash;
      if (!away) s.awayTime = 0;
      else if (!s.awayTime) s.awayTime = s.aliveTime; // left its ground at this moment
      // thrown off its ground by a skill: fight there a moment, then walk home
      if (away && s.aliveTime - s.awayTime >= arena.returnAfter) {
        const home = s.home;
        return this.move(u, s, home, c => distance(c, home) <= arena.leash);
      }
    }
    const t = this.resolveTarget(u, s, def);
    if (!t) {
      this.setState(s, 'SEARCHING', 'idle');
      return;
    }
    if (t.pos.c !== u.pos.c) s.facingDirection = t.pos.c < u.pos.c ? -1 : 1;
    const st = def.stats;
    const d = unitDistance(u, t);

    if (def.ai.movement === 'RANGED_HOLD') {
      const tol = st.rangeTolerance ?? 0.5;
      // out of range → close in to preferredRange (keep closing until there: no in/out flicker at the edge)
      if (d > st.attackRange || (s.approaching && d > st.preferredRange + tol)) {
        if (!this.mayChase(u, s, def, t, st.attackRange)) return this.setState(s, 'IDLE', 'idle');
        s.approaching = true;
        return this.move(u, s, t.pos, c => unitDistance({ ...u, pos: c }, t) <= st.preferredRange + tol && this.onGround(s, def, c));
      }
      s.approaching = false;
      if (s.attackCooldownRemaining <= 0) return this.startAttack(u, s, def, t);
      // too close while reloading: at most `maxRetreatSteps` small steps back per target
      const min = st.minComfortableRange ?? 0;
      if (d < min && s.retreatSteps < (def.ai.maxRetreatSteps ?? 0) && u.moveCd <= 0 && !hasFlag(u, 'root')) {
        if (this.ctx.stepAway(u, t.pos, t.pos, st.attackRange)) {
          s.retreatSteps++;
          u.moveCd = 1 / effectiveMoveSpeed(u);
          this.setState(s, 'MOVING', 'move');
          return;
        }
      }
      this.setState(s, 'IDLE', 'idle');
      return;
    }

    // MELEE_CHASE
    if (d <= st.attackRange) {
      if (def.attack.delivery === 'MELEE' && !inBasicAttackRange(u, t, st.attackRange)) {
        this.setState(s, hasFlag(u, 'root') ? 'IDLE' : 'MOVING', hasFlag(u, 'root') ? 'idle' : 'move');
        return;
      }
      if (s.attackCooldownRemaining <= 0) return this.startAttack(u, s, def, t);
      this.setState(s, 'IDLE', 'idle');
      return;
    }
    if (!this.mayChase(u, s, def, t, st.attackRange)) return this.setState(s, 'IDLE', 'idle');
    this.move(u, s, t.pos, c => unitDistance({ ...u, pos: c }, t) <= st.attackRange && this.onGround(s, def, c));
  }

  /** `holdArena`: a cell the boss may stand on */
  private onGround(s: MonsterCombatState, def: MonsterDefinition, c: Cell): boolean {
    const a = def.ai.holdArena;
    return !a || !s.home || distance(c, s.home) <= a.leash;
  }

  /** `holdArena`: only step toward a target it can reach without leaving its ground */
  private mayChase(u: BattleUnit, s: MonsterCombatState, def: MonsterDefinition, t: BattleUnit, range: number): boolean {
    const a = def.ai.holdArena;
    if (!a || !s.home) return true;
    if (distance(u.pos, s.home) > a.leash) return false; // off its ground (after a pounce): no chasing further out
    return unitDistance(t, { ...u, pos: s.home }) <= a.leash + range;
  }

  /**
   * FLEE (treasure carrier): stands still until `flee.after` s of combat (or the first hit), then runs along its lane
   * for the last column of the board; standing on it = escaped. Never attacks, never casts.
   */
  private flee(u: BattleUnit, s: MonsterCombatState, def: MonsterDefinition): void {
    const f = def.ai.flee ?? { after: 0, onHit: true };
    const guardsGone = () =>
      f.guardsAtMost != null && this.ctx.alliesOf(u).filter(a => a !== u && this.defs[a.monster?.definitionId ?? '']?.ai.movement !== 'FLEE').length <= f.guardsAtMost;
    if (!s.fleeing && (s.aliveTime >= f.after || (f.onHit && u.hp < u.maxHp) || guardsGone())) s.fleeing = true;
    if (!s.fleeing) return this.setState(s, 'IDLE', 'idle');
    // escape skills (Smoke Pouch) while running
    if (def.skills.length && this.trySkill(u, s, def)) return;
    const edge = BOARD_COLS - 1;
    if (u.pos.c >= edge) {
      this.ctx.escape(u);
      return;
    }
    s.facingDirection = 1;
    this.move(u, s, { r: u.pos.r, c: edge }, c => c.c >= edge);
  }

  private move(u: BattleUnit, s: MonsterCombatState, to: Cell, goal: (c: Cell) => boolean): void {
    // ROOT: cannot move (attacks / casts still allowed)
    if (hasFlag(u, 'root')) return this.setState(s, 'IDLE', 'idle');
    this.setState(s, 'MOVING', 'move');
    if (u.moveCd > 0) return;
    if (this.ctx.stepToward(u, to, goal)) u.moveCd = 1 / effectiveMoveSpeed(u);
  }

  // ------------------------------------------------------------------ targeting

  private resolveTarget(u: BattleUnit, s: MonsterCombatState, def: MonsterDefinition): BattleUnit | null {
    const cur = s.currentTargetId != null ? (this.ctx.unit(s.currentTargetId) ?? null) : null;
    const valid = !!cur && this.ctx.isValidTarget(u, cur);
    if (cur && !valid) {
      // target died / became untargetable / left the battlefield → search again right now
      s.currentTargetId = null;
      u.targetId = null;
      this.setState(s, 'SEARCHING', 'idle');
    }
    // TAUNTED: the taunting tank overrides every strategy while it stays a valid target
    const taunter = tauntSource(u);
    const forced = taunter != null ? this.ctx.unit(taunter) : undefined;
    if (forced && this.ctx.isValidTarget(u, forced)) {
      if (forced.id !== s.currentTargetId) {
        s.currentTargetId = forced.id;
        s.retreatSteps = 0;
        s.approaching = false;
      }
      s.targetLockUntil = this.ctx.time;
      u.targetId = forced.id;
      return forced;
    }
    if (valid && (s.thinkTimer > 0 || this.ctx.time < s.targetLockUntil)) return cur;
    s.thinkTimer = def.stats.targetThinkInterval;
    const pick = selectTarget({
      from: u.pos,
      candidates: this.ctx.opponentsOf(u),
      attackRange: def.stats.attackRange,
      cfg: def.ai.targeting,
      current: valid ? cur : null,
    }) as BattleUnit | null;
    if (!pick) return null;
    if (pick.id !== s.currentTargetId) {
      s.currentTargetId = pick.id;
      s.targetLockUntil = this.ctx.time + def.ai.targeting.targetLockDuration;
      s.retreatSteps = 0;
      s.approaching = false;
    }
    u.targetId = pick.id;
    return pick;
  }

  // ------------------------------------------------------------------ attack pipeline

  private startAttack(u: BattleUnit, s: MonsterCombatState, def: MonsterDefinition, t: BattleUnit): void {
    const token = ++s.attackToken;
    const windup = attackWindupOf(def);
    this.setState(s, 'ATTACKING', 'attack');
    s.attackCooldownRemaining = def.stats.attackCooldown;
    s.attackTimer = Math.max(clipDuration(def.animation, def.attack.clip), windup + 0.01);
    this.ctx.emit({ type: 'attack', src: u.id, dst: t.id });
    // nothing happens now — the hit / projectile waits for the animation event
    this.ctx.later(windup, u, () => this.onAttackEvent(u, token, t.id));
  }

  /** The attack animation reached its semantic event (DAMAGE / PROJECTILE_SPAWN) */
  private onAttackEvent(u: BattleUnit, token: number, targetId: number): void {
    const s = u.monster!;
    if (!u.alive || s.attackToken !== token || s.state !== 'ATTACKING') return;
    const def = this.def(u);
    const a = def.attack;
    this.ctx.emit({ type: 'animEvent', src: u.id, event: a.event, name: attackEventName(def) });
    const t = this.ctx.unit(targetId);
    if (!t || !this.ctx.isValidTarget(u, t)) return;
    if (a.delivery === 'PROJECTILE') {
      this.ctx.fireProjectile(u, t, a);
      return;
    }
    // small tolerance so a tiny step during the swing doesn't whiff
    if (!inBasicAttackRange(u, t, def.stats.attackRange, a.hitTolerance)) {
      this.ctx.emit({ type: 'miss', src: u.id, dst: t.id });
      return;
    }
    this.ctx.meleeHit(u, t, a);
  }

  // ------------------------------------------------------------------ skills

  private trySkill(u: BattleUnit, s: MonsterCombatState, def: MonsterDefinition): boolean {
    if (u.casting) return false;
    // phase-unlocked skills (e.g. Forest Oblivion) are only in castSkills once their phase started
    const order = def.ai.skillPriority ?? def.skills;
    const ids = [...order, ...u.castSkills.map(c => c.def.id).filter(id => !order.includes(id))];
    for (const id of ids) {
      const skill = this.skills[id];
      const cs = u.castSkills.find(c => c.def.id === id);
      if (!skill || !cs || cs.cd > 0) continue;
      if (!skill.conditions.every(c => this.conditionHolds(u, skill, c))) continue;
      const aim = this.aimTarget(u, skill);
      if (aim === null) continue;
      s.currentSkillId = id;
      s.castTimer = skill.castTime;
      if (aim !== u && aim.pos.c !== u.pos.c) s.facingDirection = aim.pos.c < u.pos.c ? -1 : 1;
      this.setState(s, 'CASTING', 'cast');
      this.ctx.startCast(u, skill, aim === u ? null : aim);
      return true;
    }
    return false;
  }

  /** effective cooldown of a skill for this unit (boss phases may override / scale it) */
  cooldownOf(u: BattleUnit, skill: { id: string; cooldown: number }): number {
    const s = u.monster;
    if (!s) return skill.cooldown;
    return s.cooldownOverride[skill.id] ?? skill.cooldown * s.cooldownScale;
  }

  private conditionHolds(u: BattleUnit, skill: MonsterSkillDefinition, c: SkillCondition): boolean {
    const allies = () => this.ctx.alliesOf(u);
    const pct = (a: BattleUnit) => (a.maxHp > 0 ? a.hp / a.maxHp : 0);
    switch (c.type) {
      case 'ALLY_TAG_ALIVE':
        return allies().filter(a => a !== u && tagsOf(a).includes(c.tag)).length >= c.min;
      case 'ALLY_DEFINITION_ALIVE':
        return allies().filter(a => a !== u && a.monster?.definitionId === c.monsterId).length >= c.min;
      case 'TARGETS_NEED_BUFF':
        return this.skillTargets(u, skill).some(t => buffRemaining(t, c.buffId) < c.refreshBelow);
      case 'ENEMY_WITHIN':
        return this.ctx.opponentsOf(u).some(t => unitDistance(t, u) <= c.range);
      case 'ALLIES_BELOW':
        return allies().filter(a => pct(a) < c.pct).length >= c.count;
      case 'ELITE_ALLY_BELOW':
        return allies().some(a => isBigMonster(a, this.defs) && pct(a) < c.pct);
      case 'ANY_ALLY_BELOW':
        return allies().some(a => pct(a) < c.pct);
      case 'ANY_OF':
        return c.of.some(x => this.conditionHolds(u, skill, x));
      case 'SUMMON_SLOTS_FREE': {
        const eff = skill.effects.find(e => e.type === 'SUMMON');
        if (!eff || eff.type !== 'SUMMON') return false;
        return this.liveSummons(u, skill.id).length < eff.maxActive;
      }
      case 'SELF_LACKS_STATUS':
        return !hasStatus(u, c.status);
      case 'SELF_BELOW':
        return pct(u) < c.pct;
      case 'HEROES_NEED_STATUS':
        return this.ctx.opponentsOf(u).some(h => buffRemaining(h, c.status) <= c.refreshBelow);
    }
  }

  /** living units summoned by `skillId` of this monster */
  liveSummons(u: BattleUnit, skillId: string): BattleUnit[] {
    const ids = u.monster?.summons[skillId] ?? [];
    return ids.map(id => this.ctx.unit(id)).filter((x): x is BattleUnit => !!x && x.alive);
  }

  /**
   * The unit a skill is aimed at when the cast starts: `u` itself for self / team-wide skills,
   * null = no valid aim (the skill is skipped for now).
   */
  aimTarget(u: BattleUnit, skill: MonsterSkillDefinition): BattleUnit | null {
    const sel = skill.target;
    const range = skill.range ?? Infinity;
    const heroes = this.ctx.opponentsOf(u).filter(h => unitDistance(h, u) <= range);
    const pct = (a: BattleUnit) => (a.maxHp > 0 ? a.hp / a.maxHp : 0);
    const near = (a: BattleUnit, b: BattleUnit) => unitDistance(a, u) - unitDistance(b, u) || a.id - b.id;
    const current = () => {
      const t = u.monster?.currentTargetId != null ? this.ctx.unit(u.monster.currentTargetId) : undefined;
      return t && this.ctx.isValidTarget(u, t) && unitDistance(t, u) <= range ? t : null;
    };
    switch (sel.type) {
      case 'SELF':
      case 'ALLIES_WITH_TAG':
      case 'ALL_ALLIES':
      case 'ALL_HEROES':
        return u;
      case 'CURRENT_TARGET':
        return current() ?? [...heroes].sort(near)[0] ?? null;
      case 'LOWEST_HP_ALLY': {
        const hurt = this.ctx.alliesOf(u).filter(a => a.hp < a.maxHp);
        const big = sel.priorityBelow != null ? hurt.filter(a => isBigMonster(a, this.defs) && pct(a) < sel.priorityBelow!) : [];
        const pool = big.length ? big : hurt;
        return [...pool].sort((a, b) => pct(a) - pct(b) || a.id - b.id)[0] ?? null;
      }
      case 'ALLY_DEFINITION_HIGHEST_HP':
        return this.ctx.alliesOf(u).filter(a => a !== u && a.monster?.definitionId === sel.monsterId).sort((a, b) => b.hp - a.hp || a.id - b.id)[0] ?? null;
      case 'HERO_CLUSTER': {
        const all = this.ctx.opponentsOf(u);
        const score = (h: BattleUnit) => resolveArea({ pattern: sel.area, caster: u, primary: h, center: 'TARGET', candidates: all }).length;
        const best = [...heroes].sort((a, b) => score(b) - score(a) || near(a, b))[0];
        if (best && score(best) >= sel.min) return best;
        return current() ?? best ?? null;
      }
      case 'HERO_PRIORITY': {
        const rank = (h: BattleUnit) => {
          const i = sel.classes.indexOf(h.cls);
          return i < 0 ? sel.classes.length : i;
        };
        const back = heroes.filter(h => h.line === 'back');
        const pool = back.length ? back : heroes; // backRowOnly: back row first, then anyone in range
        return [...pool].sort((a, b) => rank(a) - rank(b) || pct(a) - pct(b) || near(a, b))[0] ?? null;
      }
      case 'HIGHEST_ATK_HERO':
        return [...heroes].sort((a, b) => effectiveAttack(b) - effectiveAttack(a) || near(a, b))[0] ?? null;
    }
  }

  /**
   * Units a team-wide skill applies to (evaluated at activation, so units that died during the cast are skipped).
   * Aimed skills return their aim (`aimed`, re-validated by the engine).
   */
  skillTargets(u: BattleUnit, skill: MonsterSkillDefinition, aimed: BattleUnit | null = null): BattleUnit[] {
    const sel = skill.target;
    switch (sel.type) {
      case 'SELF':
        return u.alive ? [u] : [];
      case 'ALLIES_WITH_TAG':
        return this.ctx.alliesOf(u).filter(a => tagsOf(a).includes(sel.tag) && (sel.includeSelf || a !== u));
      case 'ALL_ALLIES':
        return this.ctx.alliesOf(u);
      case 'ALL_HEROES':
        return this.ctx.opponentsOf(u);
      default:
        return aimed && aimed.alive ? [aimed] : [];
    }
  }

  /** Called by the cast system when a cast ends */
  onCastEnd(u: BattleUnit, result: 'completed' | 'interrupted' | 'cancelled'): void {
    delete u.actionFacing;
    const s = u.monster!;
    const skill = s.currentSkillId ? this.skills[s.currentSkillId] : undefined;
    s.currentSkillId = null;
    s.castTimer = 0;
    if (result === 'cancelled' || !u.alive) return;
    this.setState(s, 'RECOVERING', result === 'interrupted' ? 'hurt' : 'idle');
    s.recoverTimer = result === 'interrupted' ? (skill?.interruptRecovery ?? 0.6) : (skill?.recovery ?? 0.3);
  }

  // ------------------------------------------------------------------ reactions

  /**
   * A hit landed. Plays a hit reaction only while idle/moving and not more often than
   * minHitReactionInterval (rapid multi-hits can't stun-lock). Never interrupts ATTACKING or CASTING.
   */
  onHit(u: BattleUnit): boolean {
    const s = u.monster!;
    if (!u.alive) return false;
    if (s.state !== 'IDLE' && s.state !== 'SEARCHING' && s.state !== 'MOVING') return false;
    const st = this.def(u).stats;
    if (this.ctx.time - s.lastHitReactionAt < st.minHitReactionInterval) return false;
    s.lastHitReactionAt = this.ctx.time;
    s.hurtTimer = st.hitReactionDuration;
    this.setState(s, 'HURT', 'hurt');
    return true;
  }

  markDead(u: BattleUnit): void {
    const s = u.monster!;
    if (s.state === 'DEAD') return;
    s.state = 'DEAD';
    s.stateTime = 0;
    s.isDead = true;
    s.isTargetable = false;
    s.currentTargetId = null;
    s.attackToken++; // cancels a pending hit
    s.currentSkillId = null;
    s.castTimer = 0;
    s.animationState = 'death';
    u.targetId = null;
  }

  private setState(s: MonsterCombatState, state: MonsterState, anim: MonsterCombatState['animationState']): void {
    if (s.state !== state) s.stateTime = 0;
    s.state = state;
    s.animationState = anim;
  }
}

/** Full MonsterCombatState-style view (for debug overlay and tests) */
export function monsterSnapshot(u: BattleUnit) {
  const s = u.monster;
  if (!s) return null;
  return {
    ...s,
    currentHp: u.hp,
    maxHp: u.maxHp,
    position: { ...u.pos },
    skillCooldowns: Object.fromEntries(u.castSkills.map(c => [c.def.id, Math.max(0, c.cd)])),
    castTimer: u.casting ? Math.max(0, u.casting.left) : 0,
  };
}
