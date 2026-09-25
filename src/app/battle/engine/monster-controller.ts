import { attackEventName, attackWindupOf, clipDuration, MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { AttackDefinition, MonsterDefinition, MonsterSkillDefinition, SkillCondition } from '../../core/models/monster';
import { Cell } from '../../core/models/unit';
import type { BattleEvent, BattleUnit } from './battle-engine';
import { buffRemaining } from './buffs';
import { distance } from './grid';
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
  /** generic cast system: CAST_STARTED … SKILL_ACTIVATED / CAST_INTERRUPTED */
  startCast(u: BattleUnit, skill: MonsterSkillDefinition): void;
  updateCast(u: BattleUnit, dt: number): void;
  emit(e: BattleEvent): void;
}

export const tagsOf = (u: BattleUnit): string[] => (u.monster ? (MONSTERS[u.monster.definitionId]?.tags ?? []) : []);

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
    s.attackCooldownRemaining = Math.max(0, s.attackCooldownRemaining - dt);
    // skill cooldowns (u.castSkills) and u.moveCd are counted down by the engine's shared status tick
    s.thinkTimer -= dt;

    // external stagger (a hero's stun / knock-back sets castLock): cancels a swing in progress
    if (u.castLock > 0 && !u.casting) {
      u.castLock -= dt;
      if (s.state === 'ATTACKING') s.attackToken++;
      if (s.state !== 'HURT') this.setState(s, 'HURT', 'hurt');
      s.hurtTimer = Math.max(s.hurtTimer, u.castLock);
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
    if (this.trySkill(u, s, def)) return;
    const t = this.resolveTarget(u, s, def);
    if (!t) {
      this.setState(s, 'SEARCHING', 'idle');
      return;
    }
    if (t.pos.c !== u.pos.c) s.facingDirection = t.pos.c < u.pos.c ? -1 : 1;
    const st = def.stats;
    const d = distance(u.pos, t.pos);

    if (def.ai.movement === 'RANGED_HOLD') {
      const tol = st.rangeTolerance ?? 0.5;
      // out of range → close in to preferredRange (keep closing until there: no in/out flicker at the edge)
      if (d > st.attackRange || (s.approaching && d > st.preferredRange + tol)) {
        s.approaching = true;
        return this.move(u, s, t.pos, c => distance(c, t.pos) <= st.preferredRange + tol);
      }
      s.approaching = false;
      if (s.attackCooldownRemaining <= 0) return this.startAttack(u, s, def, t);
      // too close while reloading: at most `maxRetreatSteps` small steps back per target
      const min = st.minComfortableRange ?? 0;
      if (d < min && s.retreatSteps < (def.ai.maxRetreatSteps ?? 0) && u.moveCd <= 0) {
        if (this.ctx.stepAway(u, t.pos, t.pos, st.attackRange)) {
          s.retreatSteps++;
          u.moveCd = 1 / st.moveSpeed;
          this.setState(s, 'MOVING', 'move');
          return;
        }
      }
      this.setState(s, 'IDLE', 'idle');
      return;
    }

    // MELEE_CHASE
    if (d <= st.attackRange) {
      if (s.attackCooldownRemaining <= 0) return this.startAttack(u, s, def, t);
      this.setState(s, 'IDLE', 'idle');
      return;
    }
    this.move(u, s, t.pos, c => distance(c, t.pos) <= st.attackRange);
  }

  private move(u: BattleUnit, s: MonsterCombatState, to: Cell, goal: (c: Cell) => boolean): void {
    this.setState(s, 'MOVING', 'move');
    if (u.moveCd > 0) return;
    if (this.ctx.stepToward(u, to, goal)) u.moveCd = 1 / this.def(u).stats.moveSpeed;
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
    if (distance(u.pos, t.pos) > def.stats.attackRange + a.hitTolerance) {
      this.ctx.emit({ type: 'miss', src: u.id, dst: t.id });
      return;
    }
    this.ctx.meleeHit(u, t, a);
  }

  // ------------------------------------------------------------------ skills

  private trySkill(u: BattleUnit, s: MonsterCombatState, def: MonsterDefinition): boolean {
    for (const id of def.ai.skillPriority ?? def.skills) {
      const skill = this.skills[id];
      const cs = u.castSkills.find(c => c.def.id === id);
      if (!skill || !cs || cs.cd > 0 || u.casting) continue;
      if (!skill.conditions.every(c => this.conditionHolds(u, skill, c))) continue;
      s.currentSkillId = id;
      s.castTimer = skill.castTime;
      this.setState(s, 'CASTING', 'cast');
      this.ctx.startCast(u, skill);
      return true;
    }
    return false;
  }

  private conditionHolds(u: BattleUnit, skill: MonsterSkillDefinition, c: SkillCondition): boolean {
    switch (c.type) {
      case 'ALLY_TAG_ALIVE':
        return this.ctx.alliesOf(u).filter(a => a !== u && tagsOf(a).includes(c.tag)).length >= c.min;
      case 'TARGETS_NEED_BUFF':
        return this.skillTargets(u, skill).some(t => buffRemaining(t, c.buffId) < c.refreshBelow);
      case 'ENEMY_WITHIN':
        return this.ctx.opponentsOf(u).some(t => distance(t.pos, u.pos) <= c.range);
    }
  }

  /** Units a skill applies to (evaluated at activation, so wolves that died during the cast are skipped) */
  skillTargets(u: BattleUnit, skill: MonsterSkillDefinition): BattleUnit[] {
    const sel = skill.target;
    switch (sel.type) {
      case 'SELF':
        return u.alive ? [u] : [];
      case 'ALLIES_WITH_TAG':
        return this.ctx.alliesOf(u).filter(a => tagsOf(a).includes(sel.tag) && (sel.includeSelf || a !== u));
    }
  }

  /** Called by the cast system when a cast ends */
  onCastEnd(u: BattleUnit, result: 'completed' | 'interrupted' | 'cancelled'): void {
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
