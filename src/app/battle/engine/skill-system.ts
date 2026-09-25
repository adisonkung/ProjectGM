import { kitOf } from '../../core/data/hero-skills';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { animTiming, SkillKind } from '../../core/data/sprites';
import { AreaPattern, DamageKind, HeroKit, SkillDefinition, SkillEffect, SkillSlot, TargetRule } from '../../core/models/combat';
import { Cell } from '../../core/models/unit';
import { resolveArea } from './area';
import type { BattleEvent, BattleUnit } from './battle-engine';
import { effectiveAttack } from './damage-resolver';
import { distance } from './grid';

/** What the skill system needs from the battle (implemented by BattleEngine — the skill system never runs AI loops itself) */
export interface SkillHost {
  readonly time: number;
  rng(): number;
  emit(e: BattleEvent): void;
  /** living, valid opponents on the battlefield (current wave) */
  foes(u: BattleUnit): BattleUnit[];
  /** the next wave of the stage contains an enemy with an interruptible cast (save interrupts for it) */
  castersNextWave(u: BattleUnit): boolean;
  /** living allies on the battlefield (self included) */
  allies(u: BattleUnit): BattleUnit[];
  /** dead allies that could be revived (visible corpses first) */
  deadAllies(u: BattleUnit): BattleUnit[];
  focus(u: BattleUnit): BattleUnit | null;
  /** run `fn` after `delay` s unless `u` dies first */
  later(delay: number, u: BattleUnit, fn: () => void): void;
  /** arrival-based projectile: `onArrive` runs when it lands (even if the shooter died meanwhile) */
  shoot(u: BattleUnit, t: BattleUnit, slot: SkillSlot, sky: boolean, onArrive: () => void): void;
  /** one hit through DamageResolver (+ dodge); false = missed / target gone */
  hit(src: BattleUnit, dst: BattleUnit, mul: number, o: { crit?: boolean; damageType?: DamageKind; sourceId: string; slot?: SkillSlot }): boolean;
  heal(dst: BattleUnit, amount: number, src: BattleUnit): void;
  applyStatus(dst: BattleUnit, statusId: string, src: BattleUnit, duration?: number): void;
  /** dedicated interrupt: cancels an interruptible cast (emits CAST_INTERRUPTED / immune); `breakPower` fills a Break Gauge */
  interrupt(src: BattleUnit, dst: BattleUnit, breakPower?: number): void;
  knockback(src: BattleUnit, dst: BattleUnit, cells: number): void;
  shield(src: BattleUnit, dst: BattleUnit, amount: number, duration: number): void;
  revive(src: BattleUnit, dead: BattleUnit, hpPct: number): boolean;
  /** a free cell next to `at`, away from `from` (null = nobody can land there) */
  freeCellNear(at: Cell, from: Cell): Cell | null;
  /** teleport / dash the unit to a cell (dash = fast visible slide, teleport = instant) */
  relocate(u: BattleUnit, cell: Cell, how: 'blink' | 'dash'): void;
  canLand(cell: Cell): boolean;
  /** +3 gauge for a basic action that landed */
  basicGauge(u: BattleUnit): void;
}

const hpPct = (u: BattleUnit) => (u.maxHp > 0 ? u.hp / u.maxHp : 0);

/** a cast that interrupt skills can stop: interruptible, or breakable through its Break Gauge (Forest Oblivion) */
export const canStopCast = (d: { interruptible: boolean }): boolean =>
  d.interruptible || ((d as { breakRequired?: number }).breakRequired ?? 0) > 0;
const CRIT_CHANCE = 0.1;
/** minimum skill lock so a skill never gets clipped by the next basic attack */
const SKILL_LOCK = 0.4;

export type SkillPick = { slot: SkillSlot; skill: SkillDefinition; target: BattleUnit; tier: string };

/**
 * SkillSystem — targeting, AI conditions and effect execution for every hero skill (and class-kit enemies).
 * All numbers come from SkillDefinitions (core/data/hero-skills.ts); nothing here names a hero.
 */
export class SkillSystem {
  constructor(private readonly h: SkillHost) {}

  kit(u: BattleUnit): HeroKit {
    return kitOf(u.heroId, u.cls);
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
      case 'CASTING_INTERRUPTIBLE': {
        const focus = this.h.focus(u);
        return (
          foes
            .filter(f => f.casting && canStopCast(f.casting.def) && inRange(f))
            .sort((a, b) => Number(b === focus) - Number(a === focus) || a.casting!.left - b.casting!.left)[0] ?? null
        );
      }
      case 'CLUSTER': {
        const min = s.ai?.minTargets ?? 2;
        const score = (t: BattleUnit) => foes.filter(f => distance(f.pos, t.pos) <= 1).length;
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
    const pool =
      ai.countArea || (target === u && s.effects.some(e => e.type === 'HEAL' && e.area !== 'PRIMARY' && e.area !== 'ALL_ALLIES'))
        ? this.areaUnits(u, s, target, 'ALLY', ai.countArea)
        : s.target === 'LOWEST_HP_ALLY'
          ? [target]
          : this.h.allies(u);
    const emergency = ai.emergencyHpBelow != null && pool.some(a => hpPct(a) < ai.emergencyHpBelow!);
    const below = ai.allyHpBelow != null ? pool.filter(a => hpPct(a) < ai.allyHpBelow!).length : 0;
    return { emergency, wanted: emergency || below >= (ai.alliesBelowCount ?? 1) };
  }

  /** interrupt opportunity only (reaction: not gated by the basic-attack timer) */
  chooseInterrupt(u: BattleUnit, current: BattleUnit | null): SkillPick | null {
    const kit = this.kit(u);
    for (const slot of ['skill2', 'skill'] as const) {
      const s = kit[slot];
      if (s.ai?.tier !== 'INTERRUPT' || (slot === 'skill2' ? u.cd2 : u.cd1) > 0) continue;
      const t = this.pickTarget(u, s, current, [s.target]);
      if (t) return { slot, skill: s, target: t, tier: 'INTERRUPT' };
    }
    return null;
  }

  /**
   * Choose the skill to use now (cooldown ready, target found, AI conditions met).
   * Tier order: EMERGENCY (survival) → INTERRUPT → HEAL → HIGH_VALUE → NORMAL. null = basic action.
   */
  chooseSkill(u: BattleUnit, current: BattleUnit | null): SkillPick | null {
    const kit = this.kit(u);
    const ready = (['skill2', 'skill'] as const).filter(k => (k === 'skill2' ? u.cd2 : u.cd1) <= 0).map(k => ({ slot: k, skill: kit[k] }));
    if (!ready.length) return null;

    // 1. emergency survival (heals whose emergency threshold is hit)
    for (const r of ready) {
      if (!r.skill.ai?.emergencyHpBelow) continue;
      const t = this.pickTarget(u, r.skill, current);
      if (t && this.healNeed(u, r.skill, t).emergency) return { ...r, target: t, tier: 'EMERGENCY' };
    }
    // 2. interrupt opportunity (only the interrupt rule itself — a caster in range)
    for (const r of ready) {
      if (r.skill.ai?.tier !== 'INTERRUPT') continue;
      const t = this.pickTarget(u, r.skill, current, [r.skill.target]);
      if (t) return { ...r, target: t, tier: 'INTERRUPT' };
    }
    // 3. healing
    for (const r of ready) {
      if (r.skill.ai?.tier !== 'HEAL') continue;
      const t = this.pickTarget(u, r.skill, current);
      if (t && this.healNeed(u, r.skill, t).wanted) return { ...r, target: t, tier: 'HEAL' };
    }
    // 4. high-value conditions (multi-target) · 5. normal use (skill 2 first)
    for (const tier of ['HIGH_VALUE', 'NORMAL'] as const) {
      for (const r of ready) {
        const ai = r.skill.ai ?? { tier: 'NORMAL' as const };
        const matches = ai.tier === tier || (tier === 'NORMAL' && ai.tier === 'INTERRUPT');
        if (!matches) continue;
        if (ai.tier === 'INTERRUPT' && ai.holdForInterrupt != null && this.castThreat(u, ai.holdForInterrupt)) continue;
        const rules = ai.tier === 'INTERRUPT' ? (r.skill.fallback ?? []) : undefined;
        const t = this.pickTarget(u, r.skill, current, rules);
        if (!t) continue;
        if (ai.minTargets && this.areaUnits(u, r.skill, t, 'ENEMY', ai.countArea).length < ai.minTargets) continue;
        return { ...r, target: t, tier };
      }
    }
    return null;
  }

  /** an enemy owns an interruptible cast that is ready now or within `within` s (keep interrupts for it) */
  castThreat(u: BattleUnit, within: number): boolean {
    return (
      this.h.castersNextWave(u) ||
      this.h.foes(u).some(f => (f.casting && canStopCast(f.casting.def)) || f.castSkills.some(cs => canStopCast(cs.def) && cs.cd <= within))
    );
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
      const c = this.h.foes(u)
        .filter(f => f.casting && canStopCast(f.casting.def) && distance(f.pos, u.pos) > range && distance(f.pos, u.pos) <= range + 3)
        .sort((a, b) => distance(a.pos, u.pos) - distance(b.pos, u.pos))[0];
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
    const heals = s.effects.some(e => e.type === 'HEAL' || e.type === 'REVIVE');
    if (!heals && !foes.length) return null;
    if (manual || !heals || !ai) return t;
    const revivable = ai.whenAllyDead && s.effects.some(e => e.type === 'REVIVE') && this.h.deadAllies(u).length > 0;
    return revivable || this.healNeed(u, s, t).wanted ? t : null;
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
    if (slot === 'skill') u.cd1 = s.cooldown ?? 0;
    else if (slot === 'skill2') u.cd2 = s.cooldown ?? 0;
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
    if (target !== u && target.side !== u.side) u.targetId = target.id;

    const mv = s.movement;
    if (mv?.type === 'CHARGE' && distance(u.pos, target.pos) > 1) {
      const cell = this.h.freeCellNear(target.pos, { r: target.pos.r, c: target.pos.c + Math.sign(target.pos.c - u.pos.c) * 3 }) ??
        this.h.freeCellNear(target.pos, target.pos);
      if (cell) this.h.relocate(u, cell, 'dash');
    }
    if (mv?.type === 'BLINK_BEHIND') {
      this.h.later(tm.move, u, () => {
        if (!target.alive) return;
        const cell = this.h.freeCellNear(target.pos, u.pos);
        if (cell) this.h.relocate(u, cell, 'blink');
      });
    }

    const land = (primary: BattleUnit, at: Cell, skill = s) => {
      if (slot !== 'attack') this.h.emit({ type: 'impact', src: u.id, dst: primary.alive ? primary.id : undefined, kind: kind as SkillKind });
      this.applyEffects(u, skill, slot, primary, at);
      if (mv?.type === 'DASH_THROUGH') this.dashThrough(u, primary, at);
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
      this.h.emit({ type: 'animEvent', src: u.id, event: delivery === 'INSTANT' ? 'DAMAGE' : 'PROJECTILE_SPAWN', name: `${s.id.toUpperCase()}_${delivery === 'INSTANT' ? 'HIT' : 'SPAWN'}` });
      const shots = s.repeat?.count ?? 1;
      for (let i = 0; i < shots; i++) {
        this.h.later(i * (s.repeat?.gap ?? 0), u, () => {
          // later shots are cancelled when the target already died (no automatic retarget yet)
          if (i > 0 && !target.alive) return;
          if (target.side !== u.side && target !== u && !target.alive && delivery !== 'INSTANT') return;
          const at = { ...target.pos };
          if (delivery === 'INSTANT' || target === u) land(target, at);
          else this.h.shoot(u, target, slot, delivery === 'SKY', () => land(target, target.alive ? { ...target.pos } : at));
        });
      }
    });
  }

  /** run a skill's effects in order (primary may have died: areas centre on its last cell) */
  applyEffects(u: BattleUnit, s: SkillDefinition, slot: SkillSlot, primary: BattleUnit, at: Cell): void {
    const ghost = { ...primary, pos: at } as BattleUnit;
    const focusOf = (p: BattleUnit) => (p.alive || p === u ? p : ghost);
    let hits: BattleUnit[] = [];
    for (const e of s.effects) {
      switch (e.type) {
        case 'DAMAGE': {
          const foes = this.h.foes(u);
          const p = focusOf(primary);
          const targets = e.area === 'ALL_ENEMIES' ? foes : resolveArea({ pattern: e.area, caster: u, primary: p, center: e.center, candidates: foes });
          hits = [];
          for (const f of targets) {
            if (e.interrupt && f.casting) this.h.interrupt(u, f, e.breakPower);
            let mul = f === primary ? e.primary : (e.secondary ?? (e.area === 'SINGLE' ? 0 : e.primary));
            if (mul <= 0) continue;
            if (e.executeBonus && hpPct(f) <= e.executeBonus.hpBelow) mul *= e.executeBonus.mul;
            const crit = !!e.guaranteedCrit || this.h.rng() < CRIT_CHANCE;
            if (this.h.hit(u, f, mul, { crit, damageType: e.damageType, sourceId: s.id, slot })) hits.push(f);
          }
          if (slot === 'attack' && hits.length) this.h.basicGauge(u);
          break;
        }
        case 'HEAL': {
          const allies = this.h.allies(u);
          const targets =
            e.area === 'PRIMARY' ? (primary.alive && primary.side === u.side ? [primary] : [])
              : resolveArea({ pattern: e.area, caster: u, primary: u, center: e.center ?? 'SELF', candidates: allies });
          for (const a of targets) this.h.heal(a, effectiveAttack(u) * e.atk + a.maxHp * (e.maxHpPct ?? 0), u);
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
            targets = resolveArea({ pattern: e.area ?? 'SINGLE', caster: u, primary: focusOf(primary), center: e.center, candidates: pool });
          }
          for (const t of targets) this.h.applyStatus(t, e.status, u, e.duration);
          break;
        }
        case 'INTERRUPT': {
          const foes = this.h.foes(u);
          for (const f of resolveArea({ pattern: e.area, caster: u, primary: focusOf(primary), center: e.center, candidates: foes })) {
            if (f.casting) this.h.interrupt(u, f, e.breakPower);
          }
          break;
        }
        case 'KNOCKBACK':
          if (primary.alive && primary !== u) this.h.knockback(u, primary, e.cells);
          break;
        case 'SHIELD':
          for (const a of this.h.allies(u)) {
            this.h.shield(u, a, Math.round(u.maxHp * (a === u ? e.selfPct : e.allyPct)), e.duration);
          }
          break;
        case 'REVIVE': {
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
