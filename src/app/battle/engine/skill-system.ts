import { kitOf } from '../../core/data/hero-skills';
import { SKILL_RANK_LIMITS } from '../../core/data/skill-ranks';
import type { FieldDefinition, StatusModifiers } from '../../core/models/combat';

/** per-application status options from a ranked skill (DoT / HoT potency, overridden modifiers) */
export interface StatusApplyOptions {
  potency?: number;
  modifiers?: Partial<StatusModifiers>;
}
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { animEvents, animTiming, SkillKind } from '../../core/data/sprites';
import {
  AreaPattern, DamageKind, HeroKit, INTERRUPT_PRIORITY_RANK, InterruptPriority, SkillDefinition, SkillEffect, SkillSlot, SkillUseMode, TargetRule,
} from '../../core/models/combat';
import { Cell } from '../../core/models/unit';
import { frontCell, GROUND_SHAPES, groundCell, resolveArea } from './area';
import type { BattleEvent, BattleUnit } from './battle-engine';
import { effectiveAttack } from './damage-resolver';
import { distance } from './grid';
import { fieldAnchor } from './fields';

/** What the skill system needs from the battle (implemented by BattleEngine — the skill system never runs AI loops itself) */
export interface SkillHost {
  readonly time: number;
  rng(): number;
  emit(e: BattleEvent): void;
  /** living, valid opponents on the battlefield (current wave) */
  foes(u: BattleUnit): BattleUnit[];
  /** living allies on the battlefield (self included) */
  allies(u: BattleUnit): BattleUnit[];
  /** dead allies that could be revived (visible corpses first) */
  deadAllies(u: BattleUnit): BattleUnit[];
  focus(u: BattleUnit): BattleUnit | null;
  /** run `fn` after `delay` s unless `u` dies first */
  later(delay: number, u: BattleUnit, fn: () => void): void;
  createField(u: BattleUnit, center: Cell, definition: FieldDefinition, pulse: () => void): void;
  /** arrival-based projectile: `onArrive` runs when it lands (even if the shooter died meanwhile) */
  shoot(u: BattleUnit, t: BattleUnit, slot: SkillSlot, sky: boolean, onArrive: () => void): void;
  /** one hit through DamageResolver (+ dodge); false = missed / target gone */
  hit(src: BattleUnit, dst: BattleUnit, mul: number, o: { crit?: boolean; damageType?: DamageKind; sourceId: string; slot?: SkillSlot }): boolean;
  heal(dst: BattleUnit, amount: number, src: BattleUnit): void;
  applyStatus(dst: BattleUnit, statusId: string, src: BattleUnit, duration?: number, opts?: StatusApplyOptions): void;
  /** dedicated interrupt: cancels an interruptible cast (emits CAST_INTERRUPTED / immune); `breakPower` fills a Break Gauge */
  interrupt(src: BattleUnit, dst: BattleUnit, breakPower?: number): void;
  /** break-only hit: fills the Break Gauge of a breakable cast, never cancels an interruptible one */
  breakCast(src: BattleUnit, dst: BattleUnit, breakPower: number): void;
  /** does the unit hold a guard: a shield or a damage-reducing status? */
  guarded(u: BattleUnit): boolean;
  knockback(src: BattleUnit, dst: BattleUnit, cells: number): void;
  shield(src: BattleUnit, dst: BattleUnit, amount: number, duration: number): void;
  /** remove up to `count` debuffs from `dst` (newest first); returns how many were removed */
  cleanse(src: BattleUnit, dst: BattleUnit, count: number): number;
  revive(src: BattleUnit, dead: BattleUnit, hpPct: number): boolean;
  /** would `revive` succeed right now (stage running, revives allowed, still dead, party limit left)? */
  canRevive?(dead: BattleUnit): boolean;
  /** a free cell next to `at`, away from `from` (null = nobody can land there) */
  freeCellNear(at: Cell, from: Cell): Cell | null;
  /** teleport / dash the unit to a cell (dash = fast visible slide, teleport = instant) */
  relocate(u: BattleUnit, cell: Cell, how: 'blink' | 'dash'): void;
  canLand(cell: Cell): boolean;
  /** +3 gauge for a basic action that landed */
  basicGauge(u: BattleUnit): void;
  /** may `u` leave its position to get an interrupt into range of caster `f`? (leash, frontline duty, safety) */
  chaseAllowed?(u: BattleUnit, f: BattleUnit): boolean;
  /** metrics hook: a skill / ultimate was used */
  onSkillUse?(u: BattleUnit, slot: SkillSlot, s: SkillDefinition, target: BattleUnit): void;
  /** unit lookup (cast targets) */
  unitById?(id: number): BattleUnit | undefined;
  /** AI only: may this hero blink behind `t` now? (assassin post-dive safety — player orders ignore it) */
  blinkAllowed?(u: BattleUnit, s: SkillDefinition, t: BattleUnit): boolean;
  /** a blink / deep teleport started (`lock` = the skill's animation lock) */
  onDive?(u: BattleUnit, t: BattleUnit, lock: number): void;
}

const hpPct = (u: BattleUnit) => (u.maxHp > 0 ? u.hp / u.maxHp : 0);

/** a cast that interrupt skills can stop: interruptible, or breakable through its Break Gauge (Forest Oblivion) */
export const canStopCast = (d: { interruptible: boolean }): boolean =>
  d.interruptible || ((d as { breakRequired?: number }).breakRequired ?? 0) > 0;
export const breakRequiredOf = (d: object): number => (d as { breakRequired?: number }).breakRequired ?? 0;
/** how important stopping this cast is (legacy enemy casts = MEDIUM) */
export const priorityOf = (d: object): InterruptPriority => (d as { interruptPriority?: InterruptPriority }).interruptPriority ?? 'MEDIUM';
export const rankOf = (p: InterruptPriority) => INTERRUPT_PRIORITY_RANK[p];
/** an interrupt commitment is trusted this long (a missed / cancelled attempt frees the cast again) */
export const COMMIT_WINDOW = 1.5;

/**
 * hit i (0-based) of a multi-hit skill: `repeat.weights[i]` scales its DAMAGE multipliers, effects with `onHits` run only
 * on those hits (e.g. Severing Chain: interrupt + Open Wound on throw 3)
 */
export function repeatHit(s: SkillDefinition, i: number): SkillDefinition {
  const w = s.repeat?.weights?.[i];
  const gated = s.effects.some(e => e.onHits);
  if (w == null && !gated) return s;
  const effects = gated ? s.effects.filter(e => !e.onHits || e.onHits.includes(i)) : s.effects;
  if (w == null) return { ...s, effects };
  return { ...s, effects: effects.map(e => (e.type === 'DAMAGE' ? { ...e, primary: e.primary * w, ...(e.secondary != null ? { secondary: e.secondary * w } : {}) } : e)) };
}

/** interrupt / break power a skill brings (0 = none) */
export function interruptPowerOf(s: SkillDefinition, u?: BattleUnit, slot?: SkillSlot): { interrupts: boolean; breakPower: number } {
  let interrupts = false;
  let breakPower = 0;
  for (const e of s.effects) {
    if ((e.type === 'DAMAGE' && e.interrupt) || e.type === 'INTERRUPT') {
      interrupts = true;
      breakPower = Math.max(breakPower, breakPowerOf(e.breakPower, u, slot));
    }
  }
  return { interrupts, breakPower };
}

/** a skill's Break power incl. progression (skill rank + gear) — only Break-capable skills get the bonus */
export function breakPowerOf(base: number | undefined, u?: BattleUnit, slot?: SkillSlot): number {
  if (!base) return 0;
  const bonus = u?.mods && slot && slot !== 'attack' ? u.mods.breakBonus[slot] : 0;
  // final Break = base (incl. skill rank) + gear — one skill never reaches the 100 a single Oblivion break needs
  return Math.min(base + bonus, SKILL_RANK_LIMITS.maxSingleBreak);
}

/** progression multiplier of a skill slot (rank power); basic attacks = 1 */
const rankPower = (u: BattleUnit, slot: SkillSlot) => (slot !== 'attack' && u.mods ? u.mods.skillPower[slot] : 1);
const CRIT_CHANCE = 0.1;
/** minimum skill lock so a skill never gets clipped by the next basic attack */
const SKILL_LOCK = 0.4;

export type SkillPick = { slot: SkillSlot; skill: SkillDefinition; target: BattleUnit; tier: string };

/**
 * SkillSystem — targeting, AI conditions and effect execution for every hero skill (and class-kit enemies).
 * All numbers come from SkillDefinitions (core/data/hero-skills.ts); nothing here names a hero.
 */
export class SkillSystem {
  /** allies the last applyEffects healed, shielded or selected for revival (support-only impact recipients) */
  private supported: BattleUnit[] = [];
  /** the last applyEffects launched a travelling wave (it emits its own impacts per collision) */
  private travelled = false;

  constructor(private readonly h: SkillHost) {}

  kit(u: BattleUnit): HeroKit {
    return u.kit ?? kitOf(u.heroId, u.cls);
  }

  rangeOf(u: BattleUnit, s: SkillDefinition): number {
    if (s.range != null) return s.range;
    return s.target === 'LOWEST_HP_ALLY' ? Infinity : u.range;
  }

  // ------------------------------------------------------------------ targeting

  /** Resolve one target rule (null = nobody fits); `current` = the Target Resolver's pick */
  private resolveRule(u: BattleUnit, s: SkillDefinition, rule: TargetRule, current: BattleUnit | null): BattleUnit | null {
    const range = this.rangeOf(u, s);
    const foes = this.h.foes(u);
    const inRange = (t: BattleUnit) => distance(t.pos, u.pos) <= range;
    const blink = s.movement?.type === 'BLINK_BEHIND';
    const landable = (t: BattleUnit) => !blink || distance(t.pos, u.pos) <= 1 || !!this.h.freeCellNear(t.pos, u.pos);
    const byHp = (a: BattleUnit, b: BattleUnit) => hpPct(a) - hpPct(b) || distance(a.pos, u.pos) - distance(b.pos, u.pos) || a.id - b.id;
    switch (rule) {
      case 'SELF':
        return u;
      case 'CURRENT':
        return current && current.alive && inRange(current) ? current : null;
      case 'NEAREST_ENEMY':
        return foes.filter(inRange).sort((a, b) => distance(a.pos, u.pos) - distance(b.pos, u.pos) || a.id - b.id)[0] ?? null;
      case 'CASTING_INTERRUPTIBLE':
        return this.stoppableCasts(u, s, inRange)[0] ?? null;
      case 'CLUSTER': {
        const min = s.ai?.minTargets ?? 2;
        const score = (t: BattleUnit) => s.ai?.countArea ? this.areaUnits(u, s, t, 'ENEMY', s.ai.countArea).length : foes.filter(f => distance(f.pos, t.pos) <= 1).length;
        const best = foes.filter(inRange).sort((a, b) => score(b) - score(a) || Number(b === current) - Number(a === current) || a.id - b.id)[0];
        return best && score(best) >= min ? best : null;
      }
      case 'FOCUS_OR_LOWEST_HP': {
        const focus = this.h.focus(u);
        if (focus && inRange(focus) && landable(focus)) return focus;
        return foes.filter(t => inRange(t) && landable(t)).sort(byHp)[0] ?? null;
      }
      case 'FARTHEST_BACKROW':
        return (
          foes
            .filter(t => t.line === 'back' && inRange(t) && landable(t))
            .sort((a, b) => distance(b.pos, u.pos) - distance(a.pos, u.pos) || a.id - b.id)[0] ?? null
        );
      case 'LOWEST_HP_ENEMY':
        return foes.filter(t => inRange(t) && landable(t)).sort(byHp)[0] ?? null;
      case 'LOWEST_HP_ALLY':
        return this.h.allies(u).filter(inRange).sort(byHp)[0] ?? null;
      case 'FOCUS': {
        const focus = this.h.focus(u);
        return focus && focus.alive && inRange(focus) && landable(focus) ? focus : null;
      }
      case 'MARKED':
        if (!s.markStatus) return null;
        return foes.filter(t => inRange(t) && t.buffs.some(b => b.def.id === s.markStatus)).sort(byHp)[0] ?? null;
    }
  }

  /** primary rule, then the fallbacks in order */
  pickTarget(u: BattleUnit, s: SkillDefinition, current: BattleUnit | null, rules = [s.target, ...(s.fallback ?? [])]): BattleUnit | null {
    for (const r of rules) {
      const t = this.resolveRule(u, s, r, current);
      if (t) return t;
    }
    return null;
  }

  /** units the first DAMAGE / HEAL area would affect — AI counting (minTargets, healing needs) */
  private areaUnits(u: BattleUnit, s: SkillDefinition, t: BattleUnit, team: 'ENEMY' | 'ALLY', area?: AreaPattern): BattleUnit[] {
    const e = s.effects.find(x => x.type === (team === 'ENEMY' ? 'DAMAGE' : 'HEAL')) as
      | Extract<SkillEffect, { type: 'DAMAGE' | 'HEAL' }>
      | undefined;
    const pattern = area ?? (e && e.area !== 'PRIMARY' ? e.area : 'SINGLE');
    const center = s.ai?.countCenter ?? (e && 'center' in e ? e.center : undefined) ?? 'TARGET';
    const candidates = team === 'ENEMY' ? this.h.foes(u) : this.h.allies(u);
    return resolveArea({ pattern, caster: u, primary: t, center, candidates });
  }

  // ------------------------------------------------------------------ AI

  /** heal-need check of a HEAL / EMERGENCY skill: allies (in its area or range) below the thresholds */
  private healNeed(u: BattleUnit, s: SkillDefinition, target: BattleUnit): { emergency: boolean; wanted: boolean } {
    const ai = s.ai!;
    let pool =
      ai.countArea || (target === u && s.effects.some(e => e.type === 'HEAL' && e.area !== 'PRIMARY' && e.area !== 'ALL_ALLIES'))
        ? this.areaUnits(u, s, target, 'ALLY', ai.countArea)
        : s.target === 'LOWEST_HP_ALLY'
          ? [target]
          : this.h.allies(u);
    const field = s.effects.find((e): e is Extract<SkillEffect, { type: 'FIELD' }> => e.type === 'FIELD' && e.field.aura?.team === 'ALLY');
    if (field) {
      const anchor = { ...u, pos: fieldAnchor(u.side, field.field, target.pos) };
      pool = resolveArea({ pattern: field.field.area, caster: anchor, primary: anchor, candidates: pool });
    }
    const emergency = ai.emergencyHpBelow != null && pool.some(a => hpPct(a) < ai.emergencyHpBelow!);
    const below = ai.allyHpBelow != null ? pool.filter(a => hpPct(a) < ai.allyHpBelow!).length : 0;
    return { emergency, wanted: emergency || below >= (ai.alliesBelowCount ?? 1) };
  }

  // ------------------------------------------------------------------ use modes / interrupt reservation

  /** the AI use mode of a slot for this hero (player / tactical override → skill default → AUTO) */
  mode(u: BattleUnit, slot: SkillSlot): SkillUseMode {
    return u.skillModes?.[slot] ?? this.kit(u)[slot].useMode ?? 'AUTO';
  }

  /** a cast already guaranteed to be stopped by committed interrupts / break (other heroes keep theirs) */
  guaranteed(f: BattleUnit): boolean {
    const c = f.casting;
    if (!c) return true;
    const live = (c.commits ?? []).filter(x => x.until >= this.h.time);
    const need = breakRequiredOf(c.def);
    if (c.def.interruptible) return live.length > 0;
    if (need > 0) return c.breakDamage + live.reduce((a, x) => a + x.breakPower, 0) >= need - 1e-9;
    return true;
  }

  /**
   * Casts this hero's interrupt skill could still usefully hit: stoppable, not yet guaranteed, priority ≥ the hero's
   * minimum, breakable only with break power — highest priority first (Focus first among equals), then least time left.
   */
  stoppableCasts(u: BattleUnit, s: SkillDefinition, inRange: (f: BattleUnit) => boolean): BattleUnit[] {
    const focus = this.h.focus(u);
    const min = rankOf(u.interruptMinPriority ?? 'LOW');
    const { breakPower } = interruptPowerOf(s, u, this.slotOf(u, s));
    return this.h.foes(u)
      .filter(f => {
        const c = f.casting;
        if (!c || !canStopCast(c.def) || !inRange(f) || this.guaranteed(f)) return false;
        if (!c.def.interruptible && breakPower <= 0) return false;
        return rankOf(priorityOf(c.def)) >= min;
      })
      .sort((a, b) =>
        this.urgency(b) - this.urgency(a) ||
        Number(b === focus) - Number(a === focus) || a.casting!.left - b.casting!.left);
  }

  /**
   * How urgent stopping this cast is right now (encounter spec §7): its priority rank, +1 when the situation makes it
   * worse — a disabling hit (stun) aimed at a hero below 50 % HP, a heal aimed at an enemy below 35 %, a damage link
   * while the hero side has burst ready (an ult at full gauge). Read from the cast's data, nothing monster-specific.
   */
  urgency(f: BattleUnit): number {
    const c = f.casting!;
    const def = c.def as { effects?: { type: string; status?: string; pct?: number }[] };
    const base = rankOf(priorityOf(c.def));
    const tgt = c.target != null ? this.h.unitById?.(c.target) : undefined;
    const fx = def.effects ?? [];
    if (tgt && tgt.side !== f.side && hpPct(tgt) < 0.5 && fx.some(e => e.type === 'APPLY_STATUS' && e.status === 'stun')) return base + 1;
    if (tgt && tgt.side === f.side && hpPct(tgt) < 0.35 && fx.some(e => e.type === 'HEAL_PCT')) return base + 1;
    if (fx.some(e => e.type === 'SOUL_LINK') && this.h.foes(f).some(h => h.mana >= h.maxMana)) return base + 1;
    return base;
  }

  /** register an interrupt / break commitment on every stoppable cast this use will hit */
  /** which kit slot a skill definition belongs to (for progression modifiers) */
  slotOf(u: BattleUnit, s: SkillDefinition): SkillSlot | undefined {
    const kit = this.kit(u);
    return (['skill', 'skill2', 'ult'] as const).find(k => kit[k].id === s.id);
  }

  private commit(u: BattleUnit, s: SkillDefinition, target: BattleUnit): void {
    const { interrupts, breakPower } = interruptPowerOf(s, u, this.slotOf(u, s));
    if (!interrupts) return;
    const foes = this.h.foes(u);
    const hit = new Set<BattleUnit>();
    for (const e of s.effects) {
      if (e.type === 'DAMAGE' && e.interrupt) {
        const area = e.area === 'ALL_ENEMIES' ? foes : resolveArea({ pattern: e.area, caster: u, primary: target, center: e.center, candidates: foes });
        area.forEach(f => hit.add(f));
      } else if (e.type === 'INTERRUPT') {
        resolveArea({ pattern: e.area, caster: u, primary: target, center: e.center, candidates: foes }).forEach(f => hit.add(f));
      }
    }
    for (const f of hit) {
      if (!f.casting || !canStopCast(f.casting.def)) continue;
      (f.casting.commits ??= []).push({ by: u.id, breakPower, until: this.h.time + COMMIT_WINDOW });
    }
  }

  /** interrupt opportunity only (reaction: not gated by the basic-attack timer) */
  chooseInterrupt(u: BattleUnit, current: BattleUnit | null): SkillPick | null {
    const kit = this.kit(u);
    for (const slot of ['skill2', 'skill'] as const) {
      const s = kit[slot];
      if (s.ai?.tier !== 'INTERRUPT' || (slot === 'skill2' ? u.cd2 : u.cd1) > 0 || this.mode(u, slot) === 'MANUAL') continue;
      const t = this.pickTarget(u, s, current, [s.target]);
      if (t) return { slot, skill: s, target: t, tier: 'INTERRUPT' };
    }
    return null;
  }

  /**
   * Choose the skill to use now (cooldown ready, target found, AI conditions met), honouring each slot's use mode:
   * MANUAL never · RESERVE only emergencies and interrupts / breaks of important casts · CONDITIONAL no damage fallback
   * for interrupt skills · AUTO everything. Tier order: EMERGENCY → INTERRUPT → HEAL → HIGH_VALUE → NORMAL (null = basic).
   */
  chooseSkill(u: BattleUnit, current: BattleUnit | null): SkillPick | null {
    const kit = this.kit(u);
    const ready = (['skill2', 'skill'] as const)
      .filter(k => (k === 'skill2' ? u.cd2 : u.cd1) <= 0 && this.mode(u, k) !== 'MANUAL')
      .map(k => ({ slot: k, skill: kit[k], mode: this.mode(u, k) }));
    if (!ready.length) return null;

    // 1. emergency survival (heals whose emergency threshold is hit) — allowed in every mode
    for (const r of ready) {
      if (!r.skill.ai?.emergencyHpBelow) continue;
      const t = this.pickTarget(u, r.skill, current);
      if (t && this.healNeed(u, r.skill, t).emergency) return { slot: r.slot, skill: r.skill, target: t, tier: 'EMERGENCY' };
    }
    // 2. interrupt opportunity (only the interrupt rule itself — a caster in range)
    for (const r of ready) {
      if (r.skill.ai?.tier !== 'INTERRUPT') continue;
      const t = this.pickTarget(u, r.skill, current, [r.skill.target]);
      if (t) return { slot: r.slot, skill: r.skill, target: t, tier: 'INTERRUPT' };
    }
    // 3. healing · 4. high-value (multi-target) · 5. normal use (skill 2 first)
    for (const tier of ['HEAL', 'HIGH_VALUE', 'NORMAL'] as const) {
      for (const r of ready) {
        if (r.mode === 'RESERVE') continue;
        const ai = r.skill.ai ?? { tier: 'NORMAL' as const };
        const matches = ai.tier === tier || (tier === 'NORMAL' && ai.tier === 'INTERRUPT' && r.mode === 'AUTO');
        if (!matches) continue;
        if (tier === 'HEAL') {
          const t = this.pickTarget(u, r.skill, current);
          if (t && this.healNeed(u, r.skill, t).wanted) return { slot: r.slot, skill: r.skill, target: t, tier };
          continue;
        }
        const rules = ai.tier === 'INTERRUPT' ? (r.skill.fallback ?? []) : undefined;
        const t = this.pickTarget(u, r.skill, current, rules);
        if (!t) continue;
        if (r.skill.movement?.type === 'BLINK_BEHIND' && this.h.blinkAllowed && !this.h.blinkAllowed(u, r.skill, t)) continue;
        if (ai.minTargets && this.areaUnits(u, r.skill, t, 'ENEMY', ai.countArea).length < ai.minTargets) continue;
        return { slot: r.slot, skill: r.skill, target: t, tier };
      }
    }
    return null;
  }

  /** range of the unit's ready interrupt skill (movement goal while chasing a caster) */
  interruptReach(u: BattleUnit): number {
    const kit = this.kit(u);
    const s = [kit.skill2, kit.skill].find(x => x.ai?.tier === 'INTERRUPT');
    return s ? this.rangeOf(u, s) : u.range;
  }

  /**
   * An interrupt skill is ready and an interruptible caster is just out of its range (≤ 3 cells more):
   * the hero should walk into range instead of doing something else.
   */
  interruptChase(u: BattleUnit): BattleUnit | null {
    const kit = this.kit(u);
    for (const slot of ['skill2', 'skill'] as const) {
      const s = kit[slot];
      if (s.ai?.tier !== 'INTERRUPT' || (slot === 'skill2' ? u.cd2 : u.cd1) > 0.5) continue;
      const range = this.rangeOf(u, s);
      if (this.mode(u, slot) === 'MANUAL') continue;
      const c = this.stoppableCasts(u, s, f => distance(f.pos, u.pos) > range && distance(f.pos, u.pos) <= range + 3 && (this.h.chaseAllowed?.(u, f) ?? true))[0];
      if (c) return c;
    }
    return null;
  }

  /** healer: the ally a Heal Bolt would go to now (lowest HP% below the kit threshold, in range) */
  healBoltTarget(u: BattleUnit): BattleUnit | null {
    const hb = this.kit(u).healBolt;
    if (!hb) return null;
    return (
      this.h.allies(u)
        .filter(a => hpPct(a) < hb.allyHpBelow && distance(a.pos, u.pos) <= u.range)
        .sort((a, b) => hpPct(a) - hpPct(b) || a.id - b.id)[0] ?? null
    );
  }

  /**
   * Ultimate: pick a target and check it is usable now.
   * `manual` (player tap) only needs a valid target; AUTO / enemies also check the AI conditions.
   */
  chooseUltimate(u: BattleUnit, current: BattleUnit | null, manual: boolean): BattleUnit | null {
    const s = this.kit(u).ult;
    const ai = s.ai;
    const foes = this.h.foes(u);
    if (ai?.enemyWithin != null && !foes.some(f => distance(f.pos, u.pos) <= ai.enemyWithin!)) return null;
    const t = this.pickTarget(u, s, current);
    if (!t) return null;
    const heals = s.effects.some(e => e.type === 'HEAL' || e.type === 'REVIVE' ||
      (e.type === 'FIELD' && e.field.aura?.team === 'ALLY'));
    if (!heals && !foes.length) return null;
    if (!manual && s.movement?.type === 'BLINK_BEHIND' && this.h.blinkAllowed && !this.h.blinkAllowed(u, s, t)) return null;
    if (manual || !heals || !ai) return t;
    const revivable = ai.whenAllyDead && s.effects.some(e => e.type === 'REVIVE') && this.h.deadAllies(u).length > 0;
    return revivable || this.healNeed(u, s, t).wanted ? t : null;
  }

  /**
   * RESERVE ultimates wait for their moment (derived from the ult's effects, nothing hero-specific):
   * interrupt / break ults → an important (≥ HIGH) cast in reach that isn't covered yet, or ≥ 2 stoppable casts ·
   * shields → a big unstoppable AoE about to land or the party below 45% · revives / heals → a revivable death or
   * ≥ 2 allies under 35% · pure damage ults → like AUTO.
   */
  reserveUltReady(u: BattleUnit): boolean {
    const s = this.kit(u).ult;
    const { interrupts } = interruptPowerOf(s);
    const shields = s.effects.some(e => e.type === 'SHIELD');
    const revives = s.effects.some(e => e.type === 'REVIVE' || e.type === 'HEAL');
    if (!interrupts && !shields && !revives) return true;
    const foes = this.h.foes(u);
    if (interrupts) {
      const r = this.ultReach(u);
      const casts = this.stoppableCasts(u, s, f => distance(f.pos, u.pos) <= r);
      if (casts.some(f => rankOf(priorityOf(f.casting!.def)) >= rankOf('HIGH')) || casts.length >= 2) return true;
    }
    if (shields) {
      const allies = this.h.allies(u);
      const avg = allies.reduce((a, x) => a + hpPct(x), 0) / Math.max(1, allies.length);
      const bigHit = foes.some(f => {
        const d = f.casting?.def as { effects?: { type: string; area?: string }[] } | undefined;
        const aoe = d?.effects?.some(e => e.type === 'DAMAGE' && (e.area === 'ALL_ENEMIES' || e.area === 'FRONT_ARC'));
        return !!aoe && f.casting!.left <= 1.5 && !this.guaranteed(f);
      });
      if (bigHit || avg < 0.45) return true;
    }
    if (revives) {
      if (this.h.deadAllies(u).length > 0) return true;
      if (this.h.allies(u).filter(a => hpPct(a) < 0.35).length >= 2) return true;
    }
    return false;
  }

  /** how far an ultimate's interrupt reaches from the caster */
  private ultReach(u: BattleUnit): number {
    const s = this.kit(u).ult;
    if (s.range === Infinity) return Infinity;
    for (const e of s.effects) {
      const area = e.type === 'INTERRUPT' || (e.type === 'DAMAGE' && e.interrupt) ? e.area : null;
      if (area === 'ALL_ENEMIES') return Infinity;
      if (area === 'RADIUS_3') return 3;
      if (area === 'RADIUS_2') return 2;
    }
    return this.rangeOf(u, s);
  }

  // ------------------------------------------------------------------ execution

  /**
   * Basic action: the kit's attack, or — for healers while an ally is below healBolt.allyHpBelow — a Heal Bolt
   * on the lowest HP% ally in range. Either way it is one normal action (one +3 gauge when it lands).
   */
  basic(u: BattleUnit, enemy: BattleUnit | null): boolean {
    const kit = this.kit(u);
    if (kit.healBolt) {
      const hurt = this.healBoltTarget(u);
      if (hurt) {
        u.intent = 'heal';
        const bolt: SkillDefinition = {
          ...kit.attack, id: 'heal_bolt', name: 'ฮีลโบลต์', label: 'Heal Bolt', target: 'LOWEST_HP_ALLY',
          effects: [{ type: 'HEAL', area: 'PRIMARY', atk: kit.healBolt.atk }],
        };
        this.use(u, 'attack', bolt, hurt);
        return true;
      }
    }
    if (!enemy || distance(enemy.pos, u.pos) > u.range) return false;
    this.use(u, 'attack', kit.attack, enemy);
    return true;
  }

  /** start a skill: cooldown, animation lock, movement and the hit (or projectile) at the animation's hit frame */
  use(u: BattleUnit, slot: SkillSlot, s: SkillDefinition, target: BattleUnit): void {
    this.commit(u, s, target);
    this.h.onSkillUse?.(u, slot, s, target);
    // skill rank + gear cooldown reduction
    if (slot === 'skill' || slot === 'skill2') {
      // ranked cooldown × gear CDR, never below the authored cooldown × (1 − total CDR cap)
      const authored = kitOf(u.heroId, u.cls)[slot].cooldown ?? s.cooldown ?? 0;
      const cd = Math.max((s.cooldown ?? 0) * (u.mods?.cooldown[slot] ?? 1), authored * (1 - SKILL_RANK_LIMITS.maxTotalCdr));
      if (slot === 'skill') u.cd1 = cd;
      else u.cd2 = cd;
    }
    const kind = slot as 'attack' | SkillKind;
    const tm = animTiming(u.sprite, kind);
    if (slot === 'attack') {
      // basic attack: stand still during the wind-up only
      this.h.emit({ type: 'attack', src: u.id, dst: target.id });
      u.castLock = Math.max(u.castLock, tm.hit);
    } else {
      this.h.emit({ type: 'cast', src: u.id, skill: s.name, kind: kind as SkillKind, dst: target.id });
      u.castLock = Math.max(u.castLock, tm.total, SKILL_LOCK);
    }
    // semantic clip events (sheets that author `events`): presentation only — DAMAGE stays on tm.hit below and
    // IMPACT fires where the hit really lands (land); a dead caster drops the rest (later). Events before the hit
    // are queued now, the ones at / after it once the hit is queued (same-time order: DAMAGE → IMPACT → RECOVERY…)
    const clipEvents = slot === 'attack' ? [] : animEvents(u.sprite, kind).filter(ev => ev.event !== 'DAMAGE' && ev.event !== 'IMPACT');
    const queueClip = (before: boolean) => {
      for (const ev of clipEvents.filter(x => (x.t < tm.hit) === before))
        this.h.later(ev.t, u, () =>
          this.h.emit({ type: 'animEvent', src: u.id, event: ev.event, name: `${s.id.toUpperCase()}_${ev.event}${ev.index ? '_' + (ev.index + 1) : ''}`, kind: kind as SkillKind, index: ev.index, dst: target.alive ? target.id : undefined }));
    };
    queueClip(true);
    if (target !== u && target.side !== u.side) u.targetId = target.id;

    const mv = s.movement;
    if (mv?.type === 'CHARGE' && distance(u.pos, target.pos) > 1) {
      const cell = this.h.freeCellNear(target.pos, { r: target.pos.r, c: target.pos.c + Math.sign(target.pos.c - u.pos.c) * 3 }) ??
        this.h.freeCellNear(target.pos, target.pos);
      if (cell) this.h.relocate(u, cell, 'dash');
    }
    if (mv?.type === 'BLINK_BEHIND') {
      this.h.onDive?.(u, target, Math.max(tm.total, SKILL_LOCK));
      this.h.later(tm.move, u, () => {
        if (!target.alive) return;
        const cell = this.h.freeCellNear(target.pos, u.pos);
        if (cell) this.h.relocate(u, cell, 'blink');
      });
    }

    const authoredImpact = slot !== 'attack' && animEvents(u.sprite, kind).some(e => e.event === 'IMPACT');
    const land = (primary: BattleUnit, at: Cell, skill = s, index = 0) => {
      const dst = primary.alive ? primary.id : undefined;
      const hits = this.applyEffects(u, skill, slot, primary, at);
      connected[index] = hits.includes(primary);
      // a support-only hit has no damaged units: its impact lists the actual affected allies
      const shown = hits.length ? hits : this.supported;
      // a travelling wave reports its own impacts per collision — none at the release
      if (slot !== 'attack' && !this.travelled) {
        // contact presentation after the effects resolved: which units this hit really damaged (impact FX per target)
        if (authoredImpact) this.h.emit({ type: 'animEvent', src: u.id, event: 'IMPACT', name: `${s.id.toUpperCase()}_IMPACT`, kind: kind as SkillKind, index });
        this.h.emit({ type: 'impact', src: u.id, dst, kind: kind as SkillKind, index, hits: shown.map(f => f.id) });
      }
      if (mv?.type === 'DASH_THROUGH') this.dashThrough(u, primary, at);
    };
    // multi-hit: the clip's DAMAGE events place the hits (else `repeat.gap`); `weights` split the multipliers
    const shots = s.repeat?.count ?? 1;
    const clipHits = shots > 1 && tm.hits.length === shots;
    const offsetOf = (i: number) => (clipHits ? tm.hits[i] - tm.hits[0] : i * (s.repeat?.gap ?? 0));
    // combo: the last hit is stronger when every earlier hit damaged the primary target
    const connected: boolean[] = [];
    const combo = s.repeat?.comboBonus ?? 0;
    const weighted = (i: number) => {
      const r = repeatHit(s, i);
      if (!combo || i !== shots - 1 || i === 0 || connected.slice(0, i).some(c => !c) || connected.length < i) return r;
      return { ...r, effects: r.effects.map(e => (e.type === 'DAMAGE' ? { ...e, primary: e.primary * (1 + combo) } : e)) };
    };

    this.h.later(tm.hit, u, () => {
      const delivery = s.delivery ?? 'INSTANT';
      // sky rain over every enemy (Heavenly Arrow Rain): one falling volley per enemy, each lands on its own target
      if (delivery === 'SKY' && s.effects.some(e => e.type === 'DAMAGE' && e.area === 'ALL_ENEMIES')) {
        const single: SkillDefinition = {
          ...s, effects: s.effects.map(e => (e.type === 'DAMAGE' && e.area === 'ALL_ENEMIES' ? { ...e, area: 'SINGLE' as const } : e)),
        };
        this.h.foes(u).forEach((f, i) =>
          this.h.later(i * 0.06, u, () => f.alive && this.h.shoot(u, f, slot, true, () => land(f, { ...f.pos }, single))),
        );
        return;
      }
      const evName = delivery === 'INSTANT' ? 'DAMAGE' : 'PROJECTILE_SPAWN';
      if (!clipHits) this.h.emit({ type: 'animEvent', src: u.id, event: evName, name: `${s.id.toUpperCase()}_${delivery === 'INSTANT' ? 'HIT' : 'SPAWN'}` });
      let last = { ...target.pos };
      for (let i = 0; i < shots; i++) {
        this.h.later(offsetOf(i), u, () => {
          // later shots are cancelled when the target already died (no automatic retarget yet) — unless the skill keeps
          // striking the spot (multi-hit area finisher)
          const keep = !!s.repeat?.keepAfterKill && delivery === 'INSTANT';
          if (i > 0 && !target.alive && !keep) return;
          if (target.side !== u.side && target !== u && !target.alive && delivery !== 'INSTANT') return;
          if (clipHits) this.h.emit({ type: 'animEvent', src: u.id, event: evName, name: `${s.id.toUpperCase()}_HIT_${i + 1}`, kind: kind as SkillKind, index: i });
          if (target.alive) last = { ...target.pos };
          const at = { ...last };
          if (delivery === 'INSTANT' || target === u) land(target, at, weighted(i), i);
          else this.h.shoot(u, target, slot, delivery === 'SKY', () => land(target, target.alive ? { ...target.pos } : at, weighted(i), i));
        });
      }
    });
    queueClip(false);
  }

  /** run a skill's effects in order (primary may have died: areas centre on its last cell) */
  applyEffects(u: BattleUnit, s: SkillDefinition, slot: SkillSlot, primary: BattleUnit, at: Cell, areaOrigin?: Cell): BattleUnit[] {
    const caster = areaOrigin ? { ...u, pos: areaOrigin } : u;
    const conditional = s.effects.some(e => e.type === 'APPLY_STATUS' && e.when);
    const before = new Map(conditional ? [u, primary, ...this.h.foes(u), ...this.h.allies(u)].map(t => [t.id, new Set(t.buffs.map(b => b.def.id))]) : []);
    const ghost = { ...primary, pos: at } as BattleUnit;
    const focusOf = (p: BattleUnit) => (p.alive || p === u ? p : ghost);
    let hits: BattleUnit[] = [];
    const damaged = new Set<BattleUnit>();
    this.supported = [];
    this.travelled = false;
    for (const e of s.effects) {
      switch (e.type) {
        case 'FIELD': {
          // A targeted ally must survive anticipation; do not redirect the cast onto another ally or a corpse.
          if (s.target === 'LOWEST_HP_ALLY' && !primary.alive) break;
          // Home-zone fields keep their anchor even if the caster crosses the board mid-cast.
          const center = fieldAnchor(u.side, e.field, at);
          const origin = { ...u.pos };
          // Never retain the aimed unit: even when it moves / dies, the field keeps this cell.
          const anchor = { ...primary, pos: center, alive: false };
          const pulse: SkillDefinition = { ...s, effects: e.field.effects.map(effect =>
            effect.type === 'DAMAGE' || effect.to === 'AREA'
              ? { ...effect, area: e.field.area, center: 'TARGET' } : effect),
          };
          this.h.createField(u, center, e.field, () => this.applyEffects(u, pulse, slot, anchor, center, origin));
          break;
        }
        case 'DAMAGE': {
          const foes = this.h.foes(u);
          const p = focusOf(primary);
          const shape = GROUND_SHAPES[e.area];
          if (e.travel && shape) {
            // travelling wave (Kael Ashen Rupture): cells resolve in order as the wave reaches them, exactly once per unit
            const origin = { ...u.pos };
            const dir = frontCell(u, p, foes).c - origin.c || 1;
            const struck = new Set<BattleUnit>();
            for (const [dc, dr, main] of [...shape].sort((x, y) => x[0] - y[0])) {
              const cell = { r: origin.r + dr, c: origin.c + dc * dir };
              this.h.later(Math.max(0, (dc - 0.5) / e.travel), u, () => {
                const now: BattleUnit[] = [];
                for (const f of this.h.foes(u)) {
                  if (struck.has(f) || f.pos.r !== cell.r || f.pos.c !== cell.c) continue;
                  struck.add(f);
                  let mul = (main ? e.primary : e.secondary ?? e.primary) * rankPower(u, slot);
                  if (e.executeBonus && hpPct(f) <= e.executeBonus.hpBelow) mul *= e.executeBonus.mul;
                  if (e.bonusVsGuard && this.h.guarded(f)) mul *= e.bonusVsGuard;
                  if (e.interrupt && f.casting) this.h.interrupt(u, f, breakPowerOf(e.breakPower, u, slot));
                  else if (e.breakPower && f.casting) this.h.breakCast(u, f, breakPowerOf(e.breakPower, u, slot));
                  const crit = !!e.guaranteedCrit || this.h.rng() < (u.mods?.critChance ?? CRIT_CHANCE);
                  if (this.h.hit(u, f, mul, { crit, damageType: e.damageType, sourceId: s.id, slot })) now.push(f);
                }
                if (now.length && slot !== 'attack') this.h.emit({ type: 'impact', src: u.id, dst: now[0].id, kind: slot as SkillKind, index: dc - 1, hits: now.map(f => f.id) });
              });
            }
            hits = [];
            this.travelled = true;
            break;
          }
          const targets = e.area === 'ALL_ENEMIES' ? foes : resolveArea({ pattern: e.area, caster, primary: p, center: e.center, candidates: foes });
          hits = [];
          for (const [k, f] of targets.entries()) {
            // the pierced units further down the line: hit when the blade gets there (own impact event, index k)
            if (k > 0 && e.pierceDelays?.length && f !== primary) {
              const delay = e.pierceDelays[Math.min(k - 1, e.pierceDelays.length - 1)];
              const mul = (e.secondary ?? e.primary) * rankPower(u, slot);
              this.h.later(delay, u, () => {
                if (!f.alive) return;
                if (e.interrupt && f.casting) this.h.interrupt(u, f, breakPowerOf(e.breakPower, u, slot));
                const crit = !!e.guaranteedCrit || this.h.rng() < (u.mods?.critChance ?? CRIT_CHANCE);
                const ok = this.h.hit(u, f, mul, { crit, damageType: e.damageType, sourceId: s.id, slot });
                if (slot !== 'attack') this.h.emit({ type: 'impact', src: u.id, dst: f.id, kind: slot as SkillKind, index: k, hits: ok ? [f.id] : [] });
              });
              continue;
            }
            if (e.interrupt && f.casting) this.h.interrupt(u, f, breakPowerOf(e.breakPower, u, slot));
            else if (e.breakPower && f.casting) this.h.breakCast(u, f, breakPowerOf(e.breakPower, u, slot));
            // ground-targeted areas: everyone in the front cell takes the primary multiplier (no unit is "the" target)
            const g = groundCell(e.area, u, p, foes, f);
            const main = GROUND_SHAPES[e.area] ? g === true : f === primary;
            let mul = main ? e.primary : (e.secondary ?? (e.area === 'SINGLE' ? 0 : e.primary));
            if (mul <= 0) continue;
            mul *= rankPower(u, slot);
            if (e.executeBonus && hpPct(f) <= e.executeBonus.hpBelow) mul *= e.executeBonus.mul;
            if (e.bonusVsGuard && this.h.guarded(f)) mul *= e.bonusVsGuard;
            const crit = !!e.guaranteedCrit || this.h.rng() < (u.mods?.critChance ?? CRIT_CHANCE);
            if (this.h.hit(u, f, mul, { crit, damageType: e.damageType, sourceId: s.id, slot })) (hits.push(f), damaged.add(f));
          }
          if (slot === 'attack' && hits.length) this.h.basicGauge(u);
          break;
        }
        case 'HEAL': {
          const allies = this.h.allies(u);
          const targets =
            e.area === 'PRIMARY' ? (primary.alive && primary.side === u.side ? [primary] : [])
              : resolveArea({
                pattern: e.area, caster, primary: e.center === 'TARGET' && primary.alive && primary.side === u.side ? primary : u,
                center: e.center ?? 'SELF', candidates: allies,
              }).filter(a => !(e.skipPrimary && a === primary));
          const boost = rankPower(u, slot) * (u.mods?.healing ?? 1);
          for (const a of targets) if (!this.supported.includes(a)) this.supported.push(a);
          for (const a of targets) this.h.heal(a, (effectiveAttack(u) * e.atk + a.maxHp * (e.maxHpPct ?? 0)) * boost, u);
          if (slot === 'attack' && targets.length) this.h.basicGauge(u);
          break;
        }
        case 'APPLY_STATUS': {
          if (e.minHits != null && hits.length < e.minHits) break;
          let targets: BattleUnit[] = [];
          if (e.to === 'SELF') targets = [u];
          else if (e.to === 'HIT') targets = hits.filter(f => f.alive);
          else if (e.to === 'PRIMARY') targets = primary.alive ? [primary] : [];
          else {
            const pool = e.team === 'ALLY' ? this.h.allies(u) : this.h.foes(u);
            targets = resolveArea({ pattern: e.area ?? 'SINGLE', caster, primary: focusOf(primary), center: e.center, candidates: pool });
          }
          const opts = e.potency != null || e.modifiers ? { potency: e.potency, modifiers: e.modifiers } : undefined;
          for (const t of targets) {
            if (e.when && (before.get(t.id)?.has(e.when.status) ?? false) !== e.when.present) continue;
            this.h.applyStatus(t, e.status, u, e.duration, opts);
          }
          break;
        }
        case 'INTERRUPT': {
          const foes = this.h.foes(u);
          for (const f of resolveArea({ pattern: e.area, caster, primary: focusOf(primary), center: e.center, candidates: foes })) {
            if (f.casting) this.h.interrupt(u, f, breakPowerOf(e.breakPower, u, slot));
          }
          break;
        }
        case 'KNOCKBACK':
          if (primary.alive && primary !== u) this.h.knockback(u, primary, e.cells);
          break;
        case 'CLEANSE': {
          const targets = e.to === 'PRIMARY' ? (primary.alive && primary.side === u.side ? [primary] : []) : this.h.allies(u);
          for (const a of targets) this.h.cleanse(u, a, e.count ?? Infinity);
          break;
        }
        case 'SHIELD':
          for (const a of e.to === 'PRIMARY' ? (primary.alive && primary.side === u.side ? [primary] : []) : this.h.allies(u)) {
            const amount = Math.round(u.maxHp * (a === u ? e.selfPct : e.allyPct) * rankPower(u, slot) * (u.mods?.shieldPower ?? 1));
            this.h.shield(u, a, amount, e.duration);
            if (amount > 0 && !this.supported.includes(a)) this.supported.push(a);
          }
          break;
        case 'REVIVE': {
          if (e.delay) {
            // REVIVE_TARGET slot: pick now (runtime rule = the host's dead-ally order), revive after the cue
            const picks = this.h.deadAllies(u).filter(d => this.h.canRevive?.(d) ?? true).slice(0, e.count);
            for (const d of picks) if (!this.supported.includes(d)) this.supported.push(d);
            if (picks.length) this.h.later(e.delay, u, () => picks.forEach(d => this.h.revive(u, d, e.hpPct)));
            break;
          }
          let n = 0;
          for (const d of this.h.deadAllies(u)) {
            if (n >= e.count) break;
            if (this.h.revive(u, d, e.hpPct)) n++;
            else break; // limit reached — the heal part already happened
          }
          break;
        }
      }
    }
    return [...damaged];
  }

  /** Ghost Dash: pass through the primary target and land behind it (nearest valid cell otherwise) */
  private dashThrough(u: BattleUnit, primary: BattleUnit, at: Cell): void {
    if (!u.alive) return;
    const dir = Math.sign(at.c - u.pos.c) || 1;
    const behind = { r: at.r, c: at.c + dir };
    const cell = this.h.canLand(behind) ? behind : this.h.freeCellNear(at, u.pos);
    if (cell) this.h.relocate(u, cell, 'dash');
    if (primary.alive) u.targetId = primary.id;
  }

  /** status definition lookup (throws on typos in data) */
  static status(id: string) {
    const d = STATUS_EFFECTS[id];
    if (!d) throw new Error(`Unknown status effect: ${id}`);
    return d;
  }
}
