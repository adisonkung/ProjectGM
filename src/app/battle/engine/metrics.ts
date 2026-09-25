/**
 * Battle simulation metrics — tell whether a loss came from decisions (interrupts, focus, positioning, ult timing)
 * or from raw stats. Filled by the BattleEngine; read by `npm run balance` and tests.
 */
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

  get focusUptime(): number {
    return this.focusHeroTime > 0 ? this.focusOnTargetHeroTime / this.focusHeroTime : 0;
  }

  get avgAnchorDistance(): number {
    return this.anchorSamples > 0 ? this.anchorDistanceSum / this.anchorSamples : 0;
  }
}
