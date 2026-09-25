import { WaveTransitionMode } from './types';

/**
 * Per-stage battle rules — every transition behaviour is data, never `if (stageId == 1)`.
 * Distances are in logical grid columns / cells, times in battle seconds.
 */
export interface StageBattleRules {
  waveTransitionMode: WaveTransitionMode;
  /** columns the formation origin moves forward per Advance (3–5) */
  advanceDistance: number;
  /** party march speed during Advance (columns / s) */
  advanceSpeed: number;
  /** short "WAVE N CLEARED" beat before the transition (0.5–1.0 s) */
  waveClearPause: number;
  /** target time for a normal regroup; heroes walk fast enough to arrive in about this long */
  regroupDuration: number;
  /** hard cap — one stuck hero never blocks the next wave */
  maxRegroupDuration: number;
  /** a hero is "ready" within this distance of its anchor (cells) */
  regroupTolerance: number;
  /** WAVE_START of later waves: enemies walk in from beyond the right edge during this time */
  waveStartDuration: number;
  /** WAVE_START of the first wave (optional countdown; 0 = straight into combat) */
  firstWaveStartDuration: number;
  /** later waves spawn this many columns right of their anchors and walk in */
  enemyEntryDistance: number;
  autoHealBetweenWaves: boolean;
  /** 0–1 of max HP healed at each wave clear when autoHealBetweenWaves */
  betweenWaveHealPercent: number;
  cooldownRunsDuringTransition: boolean;
  buffTimersRunDuringTransition: boolean;
  ultimateGaugeGenerationDuringTransition: boolean;
  hideDeadHeroesBetweenWaves: boolean;
  allowRevive: boolean;
  /** successful limited revives (hero ultimate resurrections) per stage — shared by the whole party */
  partyReviveLimit: number;
  reviveHpDefaultPercent: number;
  /** REVIVING (visible, untargetable) before the unit is ALIVE again */
  reviveInvulnerabilityDuration: number;
  /** search radius (cells) around the anchor when it is occupied */
  reviveSearchRadius: number;
}

/** Normal story stages: continuous side-scrolling progression */
export const STORY_RULES: StageBattleRules = {
  waveTransitionMode: WaveTransitionMode.ADVANCE_AND_REGROUP,
  advanceDistance: 4,
  advanceSpeed: 2,
  waveClearPause: 0.75,
  regroupDuration: 2,
  maxRegroupDuration: 3,
  regroupTolerance: 0.4,
  waveStartDuration: 1,
  firstWaveStartDuration: 0,
  enemyEntryDistance: 6,
  autoHealBetweenWaves: false,
  betweenWaveHealPercent: 0,
  cooldownRunsDuringTransition: true,
  buffTimersRunDuringTransition: true,
  ultimateGaugeGenerationDuringTransition: false,
  hideDeadHeroesBetweenWaves: true,
  allowRevive: true,
  partyReviveLimit: 1,
  reviveHpDefaultPercent: 0.3,
  reviveInvulnerabilityDuration: 0.75,
  reviveSearchRadius: 1,
};

/** Arena / fixed room / boss room: reform in place */
export const ARENA_RULES: StageBattleRules = { ...STORY_RULES, waveTransitionMode: WaveTransitionMode.REGROUP_ONLY, advanceDistance: 0 };

/** Defense / survival: hold the line, reinforcements arrive */
export const DEFENSE_RULES: StageBattleRules = { ...STORY_RULES, waveTransitionMode: WaveTransitionMode.HOLD_POSITION, advanceDistance: 0, waveClearPause: 0.5 };

export const RULE_PRESETS = { story: STORY_RULES, arena: ARENA_RULES, defense: DEFENSE_RULES } as const;
export type RulePreset = keyof typeof RULE_PRESETS;

/** Stage rules = preset (by win condition unless given) + per-stage overrides */
export function resolveRules(stage: { mode: 'eliminate' | 'survive'; rulePreset?: RulePreset; rules?: Partial<StageBattleRules> }): StageBattleRules {
  const base = RULE_PRESETS[stage.rulePreset ?? (stage.mode === 'survive' ? 'defense' : 'story')];
  return { ...base, ...(stage.rules ?? {}) };
}
