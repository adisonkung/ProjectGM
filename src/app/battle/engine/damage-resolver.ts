import { DamageType } from '../../core/models/monster';
import { attackModifier, Buffable } from './buffs';

/** The fields of a combatant the resolver needs (BattleUnit satisfies this) */
export interface DamageActor extends Buffable {
  id: number;
  atk: number;
  /** legacy rage multiplier (berserk / blood rage) */
  rageMul: number;
}

export interface DamageTaker {
  def: number;
  magicDefense?: number;
  /** > 0 = taunting: takes 50% damage */
  taunt: number;
}

export interface DamageRequest {
  attacker: DamageActor;
  target: DamageTaker;
  /** fixed pre-mitigation damage (e.g. a projectile's snapshot) — otherwise effectiveAttack × multiplier */
  baseDamage?: number;
  multiplier?: number;
  damageType: DamageType;
  /** attack / skill / projectile id — for logs and future on-hit rules */
  sourceId: string;
  /** hero attacks roll ±10% variance: pass an rng value in [0,1) — monsters pass nothing (deterministic) */
  variance?: number;
  crit?: boolean;
  critMultiplier?: number;
}

export interface DamageResult {
  /** final damage before shields */
  amount: number;
  crit: boolean;
  damageType: DamageType;
  sourceId: string;
}

/** baseAttack × runtime modifiers (buffs, rage) — base attack is never modified */
export const effectiveAttack = (a: DamageActor): number => a.atk * a.rageMul * attackModifier(a);

/**
 * Centralized damage formula.
 *   raw = (baseDamage ?? effectiveAttack × multiplier) × variance × crit × taunt
 *   mitigation = 100 / (100 + defense)       (PHYSICAL: def · MAGIC: magicDefense ?? def · TRUE: none)
 *   final = max(1, round(raw × mitigation))
 */
export const DamageResolver = {
  resolve(req: DamageRequest): DamageResult {
    let raw = req.baseDamage ?? effectiveAttack(req.attacker) * (req.multiplier ?? 1);
    if (req.variance != null) raw *= 0.9 + req.variance * 0.2;
    const crit = !!req.crit;
    if (crit) raw *= req.critMultiplier ?? 1.5;
    if (req.target.taunt > 0) raw *= 0.5;
    const defense =
      req.damageType === 'TRUE' ? 0 : req.damageType === 'MAGIC' ? (req.target.magicDefense ?? req.target.def) : req.target.def;
    const mitigation = 100 / (100 + defense);
    return { amount: Math.max(1, Math.round(raw * mitigation)), crit, damageType: req.damageType, sourceId: req.sourceId };
  },
};
