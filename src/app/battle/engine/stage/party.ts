import { Side } from '../../../core/models/unit';
import { LifeState } from './types';

/** The minimum a unit needs for the party / life queries (BattleUnit satisfies it) */
export interface LifeUnit {
  id: number;
  side: Side;
  life: LifeState;
  visible: boolean;
}

/**
 * Teams, not "hero vs monster": every unit belongs to a team (Side today; more teams later for
 * PvP / allied NPCs / summons). Two units are hostile when their teams differ.
 */
export const PLAYER_TEAM: Side = 'ally';
export const isHostile = (a: { side: Side }, b: { side: Side }) => a.side !== b.side;
/** the player's own units (heroes / later summons) — use this instead of comparing with the literal 'ally' */
export const isPlayerUnit = (u: { side: Side }) => u.side === PLAYER_TEAM;
/** the opposing team of a side (two teams today; PvP / multi-team later) */
export const foeSideOf = (side: Side): Side => (side === PLAYER_TEAM ? 'enemy' : PLAYER_TEAM);

export const isDead = (u: LifeUnit) => u.life === 'DEAD_VISIBLE' || u.life === 'DEAD_HIDDEN';
/** fighting or about to (a REVIVING unit keeps the stage from failing) */
export const isCombatCapable = (u: LifeUnit) => u.life === 'ALIVE' || u.life === 'REVIVING';

/** Party queries — never treat the original party array as if everyone were active */
export const getAllPartyHeroes = <T extends LifeUnit>(units: readonly T[], team: Side = PLAYER_TEAM): T[] => units.filter(u => u.side === team);
export const getAliveHeroes = <T extends LifeUnit>(units: readonly T[], team: Side = PLAYER_TEAM): T[] =>
  getAllPartyHeroes(units, team).filter(u => u.life === 'ALIVE');
export const getDeadVisibleHeroes = <T extends LifeUnit>(units: readonly T[], team: Side = PLAYER_TEAM): T[] =>
  getAllPartyHeroes(units, team).filter(u => u.life === 'DEAD_VISIBLE');
export const getDeadHiddenHeroes = <T extends LifeUnit>(units: readonly T[], team: Side = PLAYER_TEAM): T[] =>
  getAllPartyHeroes(units, team).filter(u => u.life === 'DEAD_HIDDEN');
/** heroes physically present and participating (ALIVE or REVIVING); DEAD_HIDDEN never counts */
export const getActiveBattlefieldHeroes = <T extends LifeUnit>(units: readonly T[], team: Side = PLAYER_TEAM): T[] =>
  getAllPartyHeroes(units, team).filter(u => isCombatCapable(u) && u.visible);
