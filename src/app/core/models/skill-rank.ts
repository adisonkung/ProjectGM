/**
 * Patch 1 Skill Upgrade model (spec: claude/patch1-skill-upgrade-spec.md).
 * SkillDefinition (core/data/hero-skills.ts) stays the rank-1 truth and is never mutated: a hero's ranks
 * (OwnedHero.skillRanks = HeroSkillProgression) pick a SkillRankDefinition whose effects are applied to a COPY
 * of the skill when the battle unit is built (core/rules/skill-ranks.ts rankedKit).
 */
import { StatusModifiers } from './combat';
import { ItemStack } from './economy';
import { SkillKind } from './progression';

/**
 * One change a rank makes, always the TOTAL at that rank versus rank 1 (never stacked on the previous rank):
 *   DAMAGE mul       every DAMAGE coefficient of the skill × mul (primary / secondary)
 *   HEAL mul         every HEAL coefficient × mul (ATK part and max-HP part)
 *   SHIELD add       SHIELD selfPct / allyPct + add (absolute, 0.02 = +2 % of the caster's max HP)
 *   BREAK value      Break power of the skill's interrupt effects (absolute; gear adds on top, capped < 100)
 *   COOLDOWN value   cooldown in seconds (absolute; rank CDR ≤ 10 %)
 *   STATUS_DURATION  duration of an applied status (absolute seconds, CC caps apply)
 *   STATUS_POTENCY   DoT / HoT magnitude multiplier (final ATK × potency)
 *   STATUS_MODIFIER  modifiers of an applied status (e.g. taunt_guard damageTakenMultiplier 0.55 = 45 % DR)
 *   EXECUTE          executeBonus threshold / multiplier
 *   REVIVE_HP        revive HP fraction (the party revive limit is untouched)
 */
export type SkillUpgradeEffect =
  | { type: 'DAMAGE'; mul: number }
  | { type: 'HEAL'; mul: number }
  | { type: 'SHIELD'; add: number }
  | { type: 'BREAK'; value: number }
  | { type: 'COOLDOWN'; value: number }
  | { type: 'STATUS_DURATION'; status: string; value: number }
  | { type: 'STATUS_POTENCY'; status: string; mul: number }
  | { type: 'STATUS_MODIFIER'; status: string; modifiers: Partial<StatusModifiers> }
  | { type: 'EXECUTE'; hpBelow: number; mul: number }
  | { type: 'REVIVE_HP'; value: number };

/** a skill at one rank: its effects (totals vs rank 1) and what it costs to REACH this rank from rank − 1 */
export interface SkillRankDefinition {
  skillId: string;
  rank: number;
  upgradeEffects: SkillUpgradeEffect[];
  /** rank 1 = free (owned) */
  requiredMaterials: ItemStack[];
  requiredGold: number;
  requiredHeroLevel: number;
  requiredBreakthroughTier: number;
}

/** how important a skill slot is for a hero (simulation profiles S0–S5 upgrade critical first) */
export type SkillPriority = 'critical' | 'important' | 'secondary';

/** per hero: which slot is critical / important / secondary */
export type HeroSkillPriority = Record<SkillPriority, SkillKind>;

export type SkillUpgradeError = 'MAX_RANK' | 'RANK_CAP' | 'NEED_LEVEL' | 'NEED_BREAKTHROUGH' | 'NEED_MATERIALS' | 'NEED_GOLD' | 'NO_HERO';

/** what the UI shows for one skill slot */
export interface SkillRankView {
  slot: SkillKind;
  skillId: string;
  name: string;
  rank: number;
  maxRank: number;
  /** exact numbers of the current rank / the next one (null at max) */
  current: string[];
  next: string[] | null;
  /** lines that change (current → next) */
  changes: string[];
  cost: SkillRankDefinition | null;
  /** first blocker for the next rank, null = can upgrade */
  blocked: SkillUpgradeError | null;
}
