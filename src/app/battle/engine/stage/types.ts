/**
 * Stage / Wave / Combat Transition — shared vocabulary.
 *
 *   Stage          = full mission (one StageDef)
 *   Wave           = one enemy encounter inside a Stage ("Wave 2/3", never "Stage 2/3")
 *   Battle Session = runtime from Stage Start until Stage Clear / Failure (one BattleEngine)
 *   Formation      = a team's tactical deployment layout (FormationRuntime)
 *   Formation Anchor = the preferred (home) world position of a unit — used at battle start,
 *                    regroup and revive; NOT a movement restriction during combat
 *   Advance Phase  = the party moves forward after a Wave is cleared
 *   Regroup Phase  = the party reorganises around its (moved) formation anchors
 *
 * Pure TypeScript — no Angular imports (used by the game, `npm run sim` and the specs).
 */

export enum BattlePhase {
  PREPARATION = 'PREPARATION',
  WAVE_START = 'WAVE_START',
  COMBAT = 'COMBAT',
  WAVE_CLEAR = 'WAVE_CLEAR',
  ADVANCING = 'ADVANCING',
  REGROUPING = 'REGROUPING',
  NEXT_WAVE_READY = 'NEXT_WAVE_READY',
  STAGE_CLEAR = 'STAGE_CLEAR',
  STAGE_FAILED = 'STAGE_FAILED',
}

/** How the session moves between two Waves */
export enum WaveTransitionMode {
  /** story stages: move forward, reform, next wave (side-scrolling) */
  ADVANCE_AND_REGROUP = 'ADVANCE_AND_REGROUP',
  /** arenas / fixed rooms: reform in place */
  REGROUP_ONLY = 'REGROUP_ONLY',
  /** defense / survival: stay where you are, next enemies arrive */
  HOLD_POSITION = 'HOLD_POSITION',
}

/**
 * Logical life state of a combat unit — separate from its battlefield visual presence.
 *   ALIVE         fighting (or marching / regrouping)
 *   DEAD_VISIBLE  died during the current Wave; corpse may still be displayed
 *   DEAD_HIDDEN   still dead, no longer rendered / on the battlefield (later Waves)
 *   REVIVING      a resurrection is materialising (visible, untargetable, cannot act)
 * DOWNED is reserved for a future bleed-out mechanic (not produced yet).
 */
export type LifeState = 'ALIVE' | 'DOWNED' | 'DEAD_VISIBLE' | 'DEAD_HIDDEN' | 'REVIVING';

/** What a unit is doing right now (debug / UI; the life state is the source of truth for death) */
export type CombatActivity = 'IDLE' | 'COMBAT' | 'ADVANCING' | 'REGROUPING' | 'ENTERING' | 'DEAD' | 'REVIVING' | 'VICTORY';

/** Where a revived unit re-enters the battlefield */
export type ReviveSpawnMode =
  /** DEAD_VISIBLE → at its corpse · DEAD_HIDDEN → near its CURRENT formation anchor */
  | 'AUTO'
  | 'IN_PLACE'
  | 'FORMATION_ANCHOR';

/** What happens to the ultimate gauge on revive */
export type ReviveGaugePolicy = 'PRESERVE' | 'RESET_TO_ZERO' | 'SET_PERCENT';

/** Generic resurrection request — any source (skill, ultimate, item, shrine, event, stage mechanic, token) */
export interface ReviveHeroCommand {
  /** battle unit id of the dead unit */
  unitId: number;
  /** 0–1 of max HP (default: the stage rules' reviveHpDefaultPercent) */
  reviveHpPercent?: number;
  /** battle unit id of the caster (omit for items / events) */
  sourceUnitId?: number;
  /** free-form id of the source, e.g. 'skill:lumina-ult', 'item:phoenix-feather', 'shrine' */
  sourceId: string;
  spawnMode?: ReviveSpawnMode;
  gaugePolicy?: ReviveGaugePolicy;
  /** SET_PERCENT: 0–1 of max gauge */
  gaugePercent?: number;
  /** counts toward the party's per-stage revive limit (hero ultimate resurrections) */
  countsTowardLimit?: boolean;
}

export type ReviveRejectReason = 'not-found' | 'not-dead' | 'revive-disabled' | 'stage-over' | 'limit-reached';
export type ReviveResult = { ok: true; hidden: boolean } | { ok: false; reason: ReviveRejectReason };

/** Stage resolution — the meta-game (injury / permadeath / recovery) decides what death means */
export interface StageResult {
  stageId: string;
  cleared: boolean;
  outcome: 'win' | 'lose' | 'timeout';
  /** hero uids (roster ids) */
  survivingHeroIds: number[];
  deadHeroIds: number[];
  /** revived at least once during the stage (may be dead again at the end) */
  revivedHeroIds: number[];
  /** total damage taken by the player team (after shields) */
  damageTaken: number;
  wavesCleared: number;
  totalWaves: number;
  /** battle time in seconds (fighting + transitions) */
  battleDuration: number;
}

/** Stage-flow events (UI / audio / camera / quests / analytics subscribe instead of being hard-coded) */
export type StageEvent =
  | { type: 'PHASE_CHANGED'; phase: BattlePhase; prev: BattlePhase }
  | { type: 'STAGE_STARTED'; stageId: string; totalWaves: number }
  | { type: 'WAVE_STARTED'; wave: number; totalWaves: number }
  | { type: 'WAVE_CLEARED'; wave: number; totalWaves: number; final: boolean }
  | { type: 'ADVANCE_STARTED'; from: number; to: number; duration: number }
  | { type: 'ADVANCE_COMPLETED'; origin: number }
  | { type: 'REGROUP_STARTED'; heroes: number[] }
  | { type: 'HERO_REGROUP_READY'; unit: number }
  | { type: 'REGROUP_COMPLETED'; timedOut: boolean; notReady: number[] }
  | { type: 'HERO_DIED'; unit: number; wave: number }
  | { type: 'HERO_HIDDEN_AFTER_DEATH'; unit: number }
  | { type: 'HERO_REVIVE_STARTED'; unit: number; sourceId: string; src?: number; fromHidden: boolean }
  | { type: 'HERO_REVIVED'; unit: number; hp: number }
  /** emitted once per dead hero at stage resolution — permanent consequences are the meta-game's job */
  | { type: 'HERO_DIED_IN_STAGE'; unit: number; heroUid?: number }
  | { type: 'STAGE_CLEARED'; result: StageResult }
  | { type: 'STAGE_FAILED'; result: StageResult };

export type StageEventType = StageEvent['type'];
