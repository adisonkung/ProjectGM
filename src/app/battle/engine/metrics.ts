/**
 * Battle simulation metrics — tell whether a loss came from decisions (interrupts, focus, positioning, ult timing)
 * or from raw stats. Filled by the BattleEngine; read by `npm run balance` and tests.
 */
/** one enemy skill's exposure: cast attempts and how they ended */
export interface CastStat {
  started: number;
  completed: number;
  interrupted: number;
  broken: number;
  /** cancelled by death / phase change / battle end */
  cancelled: number;
}

/** a boss phase entered at `at` (battle time) */
export interface PhaseEntry {
  index: number;
  id: string;
  at: number;
}

/** per-hero power snapshot (damage / healing done, skills / ults used, deaths / revives) */
export interface UnitStat {
  dealt: number;
  healed: number;
  skills: number;
  ults: number;
  deaths: number;
  revives: number;
}

export class BattleMetrics {
  damageDealt = 0;
  damageTaken = 0;
  healing = 0;
  deaths = 0;
  revives = 0;
  /** enemy casts that interrupt skills could stop (interruptible or breakable) */
  interruptOpportunities = 0;
  /** interrupt effects that hit a stoppable cast */
  interruptAttempts = 0;
  /** casts actually stopped (interrupt or break) */
  interruptSuccesses = 0;
  /** enemy casts with priority HIGH / CRITICAL that completed */
  criticalCastsCompleted = 0;
  /** RESERVE skills / ults spent while a stoppable cast was up · spent for another reserve reason (shield / revive / emergency) */
  reservedSkillHits = 0;
  reservedSkillMisses = 0;
  /** seconds a Focus Target was set · hero-seconds spent hitting it / hero-seconds while set */
  focusTime = 0;
  focusOnTargetHeroTime = 0;
  focusHeroTime = 0;
  /** a ranged hero stepped into a hostile melee threat zone while moving for the Focus Target (goal ≈ 0) */
  unsafeFocusChaseCount = 0;
  /** hero distance from its formation anchor (sum / samples) */
  anchorDistanceSum = 0;
  anchorSamples = 0;
  /** ranged heroes that died inside a hostile melee threat zone */
  rangedDeathsInThreat = 0;
  /** highest boss phase entered (0 = none) */
  bossPhaseReached = 0;
  /** Forest Oblivion style breakable casts: broken / landed */
  breakSuccess = 0;
  breakFailure = 0;

  // ------------------------------------------------ mechanic exposure (did the mechanics get the time to happen?)
  /** enemy (data-driven monster) casts per skill id */
  skillStats: Record<string, CastStat> = {};
  /** statuses applied per status id (Ancient Protection, BROKEN, …) */
  statusApplied: Record<string, number> = {};
  /** damage effects that got their bonusVsStatus multiplier, per skill id */
  bonusHits: Record<string, number> = {};
  /** skills with a bonusVsStatus: activations / how many were aimed at a unit carrying that status */
  skillAims: Record<string, { total: number; marked: number }> = {};
  /** seconds a boss spent under each status (Ancient Rage uptime …) */
  bossStatusTime: Record<string, number> = {};
  /** first boss of the stage: spawn / death time, phases entered, end of its sealed (Mist Wraith) phase */
  bossSpawnedAt: number | null = null;
  bossDiedAt: number | null = null;
  bossPhases: PhaseEntry[] = [];
  sealBrokenAt: number | null = null;

  /** per ally unit id */
  byUnit: Record<number, UnitStat> = {};

  unit(id: number): UnitStat {
    return (this.byUnit[id] ??= { dealt: 0, healed: 0, skills: 0, ults: 0, deaths: 0, revives: 0 });
  }

  cast(id: string, what: keyof CastStat): void {
    const s = (this.skillStats[id] ??= { started: 0, completed: 0, interrupted: 0, broken: 0, cancelled: 0 });
    s[what]++;
  }

  /** boss lifetime so far (`now` = battle time when the boss is still alive); null = no boss spawned */
  bossLifetime(now: number): number | null {
    return this.bossSpawnedAt == null ? null : (this.bossDiedAt ?? now) - this.bossSpawnedAt;
  }

  /** seconds spent in each boss phase: [phase 1 (before the first threshold), phase 2, …] */
  phaseDurations(now: number): number[] {
    if (this.bossSpawnedAt == null) return [];
    const end = this.bossDiedAt ?? now;
    const marks = [this.bossSpawnedAt, ...this.bossPhases.map(p => p.at), end];
    return marks.slice(1).map((t, i) => Math.max(0, t - marks[i]));
  }

  get focusUptime(): number {
    return this.focusHeroTime > 0 ? this.focusOnTargetHeroTime / this.focusHeroTime : 0;
  }

  get avgAnchorDistance(): number {
    return this.anchorSamples > 0 ? this.anchorDistanceSum / this.anchorSamples : 0;
  }
}
