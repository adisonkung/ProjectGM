import { DamageType } from '../../core/models/monster';
import { attackModifier, Buffable, modifier } from './buffs';

/** The fields of a combatant the resolver needs (BattleUnit satisfies this) */
export interface DamageActor extends Buffable {
  id: number;
  atk: number;
  /** fraction of the target's DEF ignored (Forest Spirit 0.2) */
  defenseIgnore?: number;
}

export interface DamageTaker extends Buffable {
  def: number;
  magicDefense?: number;
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

/** baseAttack × runtime attack modifiers (e.g. Alpha Howl) — base attack is never modified */
export const effectiveAttack = (a: DamageActor): number => a.atk * attackModifier(a);

/** random variance of hero damage: ±10% */
export const DAMAGE_VARIANCE = 0.1;
export const CRIT_CHANCE = 0.1;
export const CRIT_MULTIPLIER = 1.5;

/**
 * Centralized damage formula (every hit of every unit goes through here).
 *   raw = (baseDamage ?? effectiveAttack × multiplier) × outgoing damage mods (Blood Rage) × variance (±10%) × crit (×1.5)
 *         × incoming damage-taken mods (Taunt guard ×0.60)
 *   mitigation = 100 / (100 + defense × (1 − attacker.defenseIgnore))   (PHYSICAL: def · MAGIC: magicDefense ?? def · TRUE: none)
 *   final = max(1, round(raw × mitigation))
 */
export const DamageResolver = {
  resolve(req: DamageRequest): DamageResult {
    let raw = req.baseDamage ?? effectiveAttack(req.attacker) * (req.multiplier ?? 1) * modifier(req.attacker, 'damageMultiplier');
    if (req.variance != null) raw *= 1 - DAMAGE_VARIANCE + req.variance * 2 * DAMAGE_VARIANCE;
    const crit = !!req.crit;
    if (crit) raw *= req.critMultiplier ?? CRIT_MULTIPLIER;
    raw *= modifier(req.target, 'damageTakenMultiplier');
    const defense =
      req.damageType === 'TRUE' ? 0 : req.damageType === 'MAGIC' ? (req.target.magicDefense ?? req.target.def) : req.target.def;
    const mitigation = 100 / (100 + defense * (1 - (req.attacker.defenseIgnore ?? 0)));
    return { amount: Math.max(1, Math.round(raw * mitigation)), crit, damageType: req.damageType, sourceId: req.sourceId };
  },
};
