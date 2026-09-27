import { Cell } from '../../../core/models/unit';
import { EnemySpawn, StageDef, stageIdOf, StageModeRules, WaveDefinition, wavesOf } from '../../../core/models/stage';
import type { BattleEvent, BattleUnit } from '../battle-engine';
import { BOARD_COLS, distance, Grid, LANES, zoneOf } from '../grid';
import { FormationRuntime } from './formation';
import { getActiveBattlefieldHeroes, getAllPartyHeroes, isCombatCapable, isDead, PLAYER_TEAM } from './party';
import { StageBattleRules } from './rules';
import { BattlePhase, ModeScore, ReviveHeroCommand, ReviveResult, StageResult, WaveTransitionMode } from './types';

/** What the stage flow needs from the combat engine (the engine implements it; the flow never touches AI) */
export interface StageHost {
  readonly units: BattleUnit[];
  readonly grid: Grid;
  /** seconds actually spent in COMBAT (time limits) */
  readonly fightTime: number;
  emit(e: BattleEvent): void;
  /** spawn one hostile unit at an encounter-local cell (engine may relocate it if the cell is taken) */
  spawnEnemy(monsterId: string, cell: Cell): BattleUnit | null;
  /** one tick of real combat: timers + AI + pending actions + projectiles */
  combatStep(dt: number): void;
  /** timers only (cooldowns / statuses) — used during transitions */
  tickTimers(u: BattleUnit, dt: number, cooldowns: boolean, statuses: boolean): void;
  /** finish in-flight animation actions (hits that land after the last enemy died, heals …) */
  runPending(): void;
  /** drop everything in flight (pending hits, projectiles, casts, focus) */
  quiesce(reason: 'advance' | 'end'): void;
  heal(u: BattleUnit, amount: number): void;
  /** special modes: put a status on a unit (boss enrage) */
  applyStageStatus(u: BattleUnit, status: string): void;
  /** monster definition tags of a unit (treasure carriers …) */
  tagsOf(u: BattleUnit): string[];
  /** monster definition id of a unit */
  definitionOf(u: BattleUnit): string | undefined;
}

/** tag that marks a treasure carrier (TREASURE mode) */
export const TREASURE_TAG = 'treasure';

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Stage / Wave / Combat Transition state machine (one Battle Session).
 *
 *   PREPARATION → WAVE_START → COMBAT → WAVE_CLEAR ─ final? → STAGE_CLEAR
 *                     ↑                     │ no: hide dead
 *                     │                     ↓
 *               NEXT_WAVE_READY ← REGROUPING ← ADVANCING (by WaveTransitionMode)
 *   any phase: no combat-capable hero left → STAGE_FAILED
 *
 * Coordinates: units have a continuous world position (x = column, y = lane). The combat grid is local to the
 * current encounter; encounter-local column = world x − formation.originPosition. Advancing moves the origin
 * (and so every anchor, the enemy spawn zone and the camera) forward — nothing is bound to stage-start coordinates.
 * Nothing in here knows about a specific stage, wave number or monster.
 */
export class StageFlow {
  phase = BattlePhase.PREPARATION;
  /** 0-based index of the current wave */
  waveIndex = 0;
  readonly totalWaves: number;
  readonly stageId: string;
  readonly waves: WaveDefinition[];
  /** player formation — its origin is also the encounter origin */
  readonly formation = new FormationRuntime(PLAYER_TEAM, 0);
  readonly enemyFormation = new FormationRuntime('enemy', 0);
  /** world x the camera looks at (left edge of the encounter window); follows the formation origin */
  cameraX = 0;
  /** seconds spent in the current phase */
  phaseTime = 0;
  outcome: 'win' | 'lose' | 'timeout' | null = null;
  stageResult: StageResult | null = null;
  wavesCleared = 0;
  /** total damage taken by the player team */
  damageTaken = 0;

  private advance = { from: 0, to: 0, duration: 0 };
  private regroupSpeed = new Map<number, number>();
  private regroupReady = new Set<number>();
  private entering: { id: number; fromX: number; toX: number }[] = [];
  private revivedUnits = new Set<number>();
  /** successful revives that count toward rules.partyReviveLimit this stage */
  limitedRevives = 0;
  /** special stage mode (STORY when the stage has none) */
  readonly special: StageModeRules;
  /** special-mode counters (see ModeScore) */
  readonly score: ModeScore;
  failReason: string | null = null;
  /** SURVIVAL: next horde group index and the combat time it is due */
  private hordeIndex = 0;
  private nextHordeAt = 0;
  /** combat time each enemy unit spawned at (KILL_BEFORE rules) */
  private spawnedAt = new Map<number, number>();

  constructor(
    private readonly host: StageHost,
    private readonly stage: StageDef,
    readonly rules: StageBattleRules,
  ) {
    this.waves = wavesOf(stage);
    this.totalWaves = Math.max(1, this.waves.length);
    this.stageId = stageIdOf(stage);
    this.special = stage.special ?? { kind: 'STORY', goal: '' };
    this.nextHordeAt = this.special.horde?.every ?? Infinity;
    const castRule = this.special.challenge?.find(r => r.type === 'CAST_LIMIT');
    this.score = {
      kind: this.special.kind, kills: 0, carriersKilled: 0, carriersTotal: 0, escaped: 0,
      strikes: 0, maxStrikes: castRule?.type === 'CAST_LIMIT' ? castRule.max : 0, enraged: false,
    };
  }

  // ------------------------------------------------------------------ setup

  /** the player team was added: remember each hero's formation slot (depth × lane of its team slot) */
  assignPlayer(u: BattleUnit, depth: number, lane: number): void {
    this.formation.assign(u.id, depth, lane, u.pos);
  }

  /** spawn a wave's enemies at their formation slots; `entry` = walk in from beyond the right edge */
  spawnWave(index: number, entry: boolean): BattleUnit[] {
    const wave = this.waves[index];
    if (!wave) return [];
    this.reinforcementsSent = 0;
    this.enemyFormation.clear();
    this.enemyFormation.originPosition = this.formation.originPosition;
    this.entering = [];
    const out: BattleUnit[] = [];
    for (const sp of wave.spawns) {
      const u = this.host.spawnEnemy(sp.monsterId, { r: sp.formationSlot.depth, c: sp.formationSlot.lane });
      if (!u) continue;
      u.wave = index;
      this.noteSpawn(u);
      const slot = this.enemyFormation.assign(u.id, sp.formationSlot.depth, sp.formationSlot.lane, u.pos, sp.offset);
      const ax = this.enemyFormation.originPosition + slot.localOffset.x;
      u.y = slot.localOffset.y;
      u.x = ax;
      if (entry) {
        u.x = ax + this.rules.enemyEntryDistance;
        u.activity = 'ENTERING';
        this.entering.push({ id: u.id, fromX: u.x, toX: ax });
      }
      out.push(u);
    }
    return out;
  }

  // ------------------------------------------------------------------ tick

  update(dt: number): void {
    if (this.outcome) return;
    if (this.phase === BattlePhase.PREPARATION) this.startStage();
    this.phaseTime += dt;
    this.tickRevives(dt);

    switch (this.phase) {
      case BattlePhase.WAVE_START:
        this.tickTransitionTimers(dt);
        this.updateEntering();
        if (this.phaseTime >= this.waveStartDuration()) this.startCombat();
        break;
      case BattlePhase.COMBAT:
        this.host.combatStep(dt);
        this.evaluate();
        break;
      case BattlePhase.WAVE_CLEAR:
        // purely finishing: in-flight animation hits may still land; nobody starts a new action
        this.host.runPending();
        this.tickTransitionTimers(dt);
        if (this.phaseTime >= this.rules.waveClearPause) this.leaveWave();
        break;
      case BattlePhase.ADVANCING:
        this.tickTransitionTimers(dt);
        this.updateAdvance();
        break;
      case BattlePhase.REGROUPING:
        this.tickTransitionTimers(dt);
        this.updateRegroup(dt);
        break;
    }
    if (!this.outcome && this.phase !== BattlePhase.COMBAT) this.checkWipe();
  }

  private setPhase(p: BattlePhase): void {
    if (p === this.phase) return;
    const prev = this.phase;
    this.phase = p;
    this.phaseTime = 0;
    this.host.emit({ type: 'PHASE_CHANGED', phase: p, prev });
  }

  private startStage(): void {
    this.host.emit({ type: 'STAGE_STARTED', stageId: this.stageId, totalWaves: this.totalWaves });
    this.beginWave();
  }

  private waveStartDuration(): number {
    return this.waveIndex === 0 ? this.rules.firstWaveStartDuration : this.rules.waveStartDuration;
  }

  private beginWave(): void {
    this.setPhase(BattlePhase.WAVE_START);
    this.host.emit({ type: 'WAVE_STARTED', wave: this.waveIndex, totalWaves: this.totalWaves });
    for (const h of getActiveBattlefieldHeroes(this.host.units)) if (h.life === 'ALIVE') h.activity = 'IDLE';
    if (this.waveStartDuration() <= 0) this.startCombat();
  }

  private startCombat(): void {
    for (const e of this.entering) {
      const u = this.unit(e.id);
      if (u) {
        u.x = e.toX;
        u.activity = 'COMBAT';
      }
    }
    this.entering = [];
    for (const u of this.host.units) if (u.life === 'ALIVE') u.activity = 'COMBAT';
    this.setPhase(BattlePhase.COMBAT);
  }

  private updateEntering(): void {
    const d = this.waveStartDuration();
    const t = d > 0 ? smooth(clamp(this.phaseTime / d, 0, 1)) : 1;
    for (const e of this.entering) {
      const u = this.unit(e.id);
      if (u) u.x = e.fromX + (e.toX - e.fromX) * t;
    }
  }

  /**
   * cooldowns / statuses keep running during transitions (per rules); the ultimate gauge does not grow.
   * Only the player team: a newly spawned wave starts its own timers when its combat begins.
   */
  private tickTransitionTimers(dt: number): void {
    for (const u of this.host.units) {
      if (u.life !== 'ALIVE' || u.side !== PLAYER_TEAM) continue;
      this.host.tickTimers(u, dt, this.rules.cooldownRunsDuringTransition, this.rules.buffTimersRunDuringTransition);
    }
  }

  // ------------------------------------------------------------------ wave clear / end

  /** after every combat tick (all events of the tick resolved first — no update-order dependent results) */
  private evaluate(): void {
    if (this.checkWipe()) return;
    if (this.checkSpecial()) return;
    if (this.stage.mode === 'survive') {
      if (this.host.fightTime >= this.stage.timeLimit) this.onWaveCleared();
      return;
    }
    this.checkReinforcements();
    if (this.requiredHostilesAlive() === 0 && !this.pendingReinforcements()) return this.onWaveCleared();
    if (this.host.fightTime >= this.stage.timeLimit) this.finish('timeout');
  }

  /** reinforcement groups of the current wave already sent */
  private reinforcementsSent = 0;

  private pendingReinforcements(): number {
    return (this.waves[this.waveIndex]?.reinforcements?.length ?? 0) - this.reinforcementsSent;
  }

  /** send the next reinforcement group(s) whose trigger is met — they walk in from beyond the enemy zone */
  private checkReinforcements(): void {
    const groups = this.waves[this.waveIndex]?.reinforcements ?? [];
    while (this.reinforcementsSent < groups.length && this.requiredHostilesAlive() <= groups[this.reinforcementsSent].whenAliveAtMost) {
      const g = groups[this.reinforcementsSent++];
      for (const sp of g.spawns) {
        const u = this.host.spawnEnemy(sp.monsterId, { r: sp.formationSlot.depth, c: sp.formationSlot.lane });
        if (!u) continue;
        u.wave = this.waveIndex;
        u.y = u.pos.r;
        u.x = this.formation.originPosition + u.pos.c + this.rules.enemyEntryDistance / 2;
        this.noteSpawn(u);
      }
    }
  }

  // ------------------------------------------------------------------ special modes

  private noteSpawn(u: BattleUnit): void {
    this.spawnedAt.set(u.id, this.host.fightTime);
    if (this.host.tagsOf(u).includes(TREASURE_TAG)) this.score.carriersTotal++;
  }

  /** spawn a group mid-combat: walks in from beyond the enemy zone (like reinforcements) */
  private spawnGroup(spawns: EnemySpawn[]): void {
    for (const sp of spawns) {
      const u = this.host.spawnEnemy(sp.monsterId, { r: sp.formationSlot.depth, c: sp.formationSlot.lane });
      if (!u) continue;
      u.wave = this.waveIndex;
      u.y = u.pos.r;
      u.x = this.formation.originPosition + u.pos.c + this.rules.enemyEntryDistance / 2;
      this.noteSpawn(u);
    }
  }

  /** SURVIVAL horde · BOSS_DUEL enrage · CHALLENGE fail rules — true when the stage just ended */
  private checkSpecial(): boolean {
    const sp = this.special;
    const t = this.host.fightTime;
    // SURVIVAL: the next group walks in on schedule, but never above the alive cap (a slow team is not buried)
    if (sp.horde && sp.horde.groups.length) {
      const alive = this.host.units.filter(u => u.side !== PLAYER_TEAM && isCombatCapable(u)).length;
      if (t >= this.nextHordeAt && alive < sp.horde.maxAlive) {
        this.spawnGroup(sp.horde.groups[this.hordeIndex++ % sp.horde.groups.length]);
        this.nextHordeAt = t + sp.horde.every;
      }
    }
    // BOSS_DUEL: soft time limit — the boss enrages instead of the run timing out
    if (sp.enrage && !this.score.enraged && t >= sp.enrage.at) {
      const bosses = this.host.units.filter(u => u.side !== PLAYER_TEAM && isCombatCapable(u) && (u.boss || u.elite));
      if (bosses.length) {
        this.score.enraged = true;
        for (const b of bosses) this.host.applyStageStatus(b, sp.enrage.status);
        this.host.emit({ type: 'BOSS_ENRAGED', units: bosses.map(b => b.id) });
      }
    }
    for (const rule of sp.challenge ?? []) {
      if (rule.type === 'CAST_LIMIT' && this.score.strikes > rule.max) return this.fail(rule.label), true;
      if (rule.type === 'KILL_BEFORE') {
        const late = this.host.units.some(
          u => u.side !== PLAYER_TEAM && isCombatCapable(u) && (this.host.definitionOf(u) ?? '').split('@')[0] === rule.monsterId &&
            t - (this.spawnedAt.get(u.id) ?? t) >= rule.seconds,
        );
        if (late) return this.fail(rule.label), true;
      }
    }
    return false;
  }

  private fail(reason: string): void {
    this.failReason = reason;
    this.finish('lose');
  }

  /** an enemy cast completed (CHALLENGE: CAST_LIMIT strikes) */
  onEnemyCastCompleted(skillId: string): void {
    const rule = this.special.challenge?.find(r => r.type === 'CAST_LIMIT');
    if (rule?.type !== 'CAST_LIMIT' || this.outcome) return;
    if (rule.skills && !rule.skills.includes(skillId)) return;
    this.score.strikes++;
    this.host.emit({ type: 'CHALLENGE_STRIKE', strikes: this.score.strikes, max: rule.max, skill: skillId });
  }

  /** a treasure carrier reached the edge: gone for good (not a kill, never required for the wave) */
  onEscaped(u: BattleUnit): void {
    this.score.escaped++;
    u.required = false;
    this.hide(u);
    u.alive = false;
    u.activity = 'DEAD';
    this.host.emit({ type: 'TREASURE_ESCAPED', unit: u.id, escaped: this.score.escaped, total: this.score.carriersTotal });
  }

  /** stage fails only when no combat-capable hero remains (one death never fails it) */
  private checkWipe(): boolean {
    if (this.outcome) return true;
    if (getAllPartyHeroes(this.host.units).some(isCombatCapable)) return false;
    this.finish('lose');
    return true;
  }

  /** required enemies of the current wave still standing (corpses / disposable summons / scenery don't count) */
  requiredHostilesAlive(): number {
    return this.host.units.filter(
      u => u.side !== PLAYER_TEAM && u.required && u.wave === this.waveIndex && isCombatCapable(u),
    ).length;
  }

  private onWaveCleared(): void {
    if (this.phase !== BattlePhase.COMBAT) return; // fires once per wave
    this.wavesCleared++;
    const final = this.waveIndex + 1 >= this.totalWaves;
    this.setPhase(BattlePhase.WAVE_CLEAR);
    this.host.emit({ type: 'WAVE_CLEARED', wave: this.waveIndex, totalWaves: this.totalWaves, final });
    // stop targeting / chasing; no new normal attacks (the AI simply isn't run outside COMBAT)
    for (const u of this.host.units) {
      u.targetId = null;
      if (u.life === 'ALIVE') u.activity = 'IDLE';
    }
    if (this.rules.autoHealBetweenWaves && !final) {
      for (const h of getActiveBattlefieldHeroes(this.host.units)) this.host.heal(h, h.maxHp * this.rules.betweenWaveHealPercent);
    }
    if (final) this.finish('win');
  }

  /** leave the cleared wave: hide the dead, then transition according to the stage rules */
  private leaveWave(): void {
    this.hideDead();
    this.host.quiesce('advance');
    // heroes leave the combat grid; they get a cell again when the next wave starts
    for (const h of getAllPartyHeroes(this.host.units)) this.host.grid.remove(h.id, h.pos);
    const mode = this.rules.waveTransitionMode;
    if (mode === WaveTransitionMode.ADVANCE_AND_REGROUP && this.rules.advanceDistance > 0) this.startAdvance();
    else if (mode === WaveTransitionMode.HOLD_POSITION) this.readyNextWave();
    else this.startRegroup();
  }

  /** DEAD_VISIBLE → DEAD_HIDDEN (renderer / collision / hitbox / selection off — logical data kept) */
  private hideDead(): void {
    for (const u of this.host.units) {
      if (u.life !== 'DEAD_VISIBLE') continue;
      const hero = u.side === PLAYER_TEAM;
      if (hero && !this.rules.hideDeadHeroesBetweenWaves) continue; // corpse stays behind in the world
      this.hide(u);
      if (hero) this.host.emit({ type: 'HERO_HIDDEN_AFTER_DEATH', unit: u.id });
    }
  }

  private hide(u: BattleUnit): void {
    u.life = 'DEAD_HIDDEN';
    u.visible = false;
    u.targetable = false;
    this.host.grid.remove(u.id, u.pos);
  }

  private finish(outcome: 'win' | 'lose' | 'timeout'): void {
    if (this.outcome) return;
    this.outcome = outcome;
    this.setPhase(outcome === 'win' ? BattlePhase.STAGE_CLEAR : BattlePhase.STAGE_FAILED);
    this.host.quiesce('end');
    for (const u of this.host.units) {
      if (u.side === PLAYER_TEAM && u.life === 'ALIVE') u.activity = outcome === 'win' ? 'VICTORY' : 'IDLE';
      u.targetId = null;
    }
    const result = this.buildResult();
    this.stageResult = result;
    for (const h of getAllPartyHeroes(this.host.units).filter(isDead)) {
      this.host.emit({ type: 'HERO_DIED_IN_STAGE', unit: h.id, heroUid: h.heroUid });
    }
    this.host.emit(outcome === 'win' ? { type: 'STAGE_CLEARED', result } : { type: 'STAGE_FAILED', result });
  }

  private buildResult(): StageResult {
    const party = getAllPartyHeroes(this.host.units);
    const idOf = (u: BattleUnit) => u.heroUid ?? u.id;
    return {
      stageId: this.stageId,
      cleared: this.outcome === 'win',
      outcome: this.outcome!,
      survivingHeroIds: party.filter(isCombatCapable).map(idOf),
      deadHeroIds: party.filter(isDead).map(idOf),
      revivedHeroIds: party.filter(u => this.revivedUnits.has(u.id)).map(idOf),
      damageTaken: Math.round(this.damageTaken),
      wavesCleared: this.wavesCleared,
      totalWaves: this.totalWaves,
      battleDuration: 0, // filled by the engine (it owns the clock)
      ...(this.special.kind !== 'STORY' ? { mode: { ...this.score } } : {}),
      ...(this.failReason ? { failReason: this.failReason } : {}),
    };
  }

  // ------------------------------------------------------------------ advance / regroup

  private startAdvance(): void {
    const from = this.formation.originPosition;
    const to = from + this.rules.advanceDistance;
    const duration = this.rules.advanceDistance / Math.max(0.1, this.rules.advanceSpeed);
    this.advance = { from, to, duration };
    this.setPhase(BattlePhase.ADVANCING);
    for (const h of getActiveBattlefieldHeroes(this.host.units)) {
      h.targetId = null;
      if (h.life === 'ALIVE') h.activity = 'ADVANCING';
    }
    this.host.emit({ type: 'ADVANCE_STARTED', from, to, duration });
  }

  private updateAdvance(): void {
    const { from, to, duration } = this.advance;
    const t = clamp(this.phaseTime / duration, 0, 1);
    const origin = from + (to - from) * smooth(t);
    const delta = origin - this.formation.originPosition;
    this.formation.originPosition = origin;
    this.cameraX = origin;
    // living heroes march with the party (no teleport); DEAD_HIDDEN heroes stay behind (they aren't in the world)
    for (const h of getActiveBattlefieldHeroes(this.host.units)) h.x += delta;
    if (t >= 1) {
      this.host.emit({ type: 'ADVANCE_COMPLETED', origin });
      this.startRegroup();
    }
  }

  private startRegroup(): void {
    this.setPhase(BattlePhase.REGROUPING);
    this.regroupSpeed.clear();
    this.regroupReady.clear();
    const heroes = getActiveBattlefieldHeroes(this.host.units);
    for (const h of heroes) {
      h.targetId = null;
      if (h.life === 'ALIVE') h.activity = 'REGROUPING';
    }
    this.host.emit({ type: 'REGROUP_STARTED', heroes: heroes.map(h => h.id) });
    this.updateRegroup(0);
  }

  /** walk (never teleport) toward the current anchors; ready within tolerance; capped by maxRegroupDuration */
  private updateRegroup(dt: number): void {
    const heroes = getActiveBattlefieldHeroes(this.host.units);
    for (const h of heroes) {
      const a = this.formation.anchorOf(h.id);
      if (!a) continue;
      const d = Math.hypot(a.x - h.x, a.y - h.y);
      if (!this.regroupSpeed.has(h.id)) {
        // fast enough to arrive in about regroupDuration, never slower than the unit's own pace
        this.regroupSpeed.set(h.id, h.moveSpeed > 0 ? Math.max(h.moveSpeed, d / this.rules.regroupDuration) : 0);
      }
      const step = Math.min(d, this.regroupSpeed.get(h.id)! * dt);
      if (d > 1e-6 && step > 0) {
        h.x += ((a.x - h.x) / d) * step;
        h.y += ((a.y - h.y) / d) * step;
      }
      if (!this.regroupReady.has(h.id) && Math.hypot(a.x - h.x, a.y - h.y) <= this.rules.regroupTolerance) {
        this.regroupReady.add(h.id);
        this.host.emit({ type: 'HERO_REGROUP_READY', unit: h.id });
      }
    }
    // readiness ignores dead heroes: only the living (and reviving) must reach their anchors
    const notReady = heroes.filter(h => !this.regroupReady.has(h.id)).map(h => h.id);
    const timedOut = this.phaseTime >= this.rules.maxRegroupDuration;
    if (!notReady.length || timedOut) {
      this.host.emit({ type: 'REGROUP_COMPLETED', timedOut: notReady.length > 0, notReady });
      this.readyNextWave();
    }
  }

  private readyNextWave(): void {
    this.setPhase(BattlePhase.NEXT_WAVE_READY);
    this.waveIndex++;
    this.spawnWave(this.waveIndex, true);
    // living heroes take the combat cell under their current world position
    for (const h of getActiveBattlefieldHeroes(this.host.units)) this.placeOnGrid(h, this.cellAt(h.x, h.y));
    this.beginWave();
  }

  // ------------------------------------------------------------------ death / revive

  /** HP reached 0: death lifecycle (engine already cancelled casts / removed it from the grid) */
  onDeath(u: BattleUnit): void {
    if (u.side !== PLAYER_TEAM) {
      this.score.kills++;
      if (this.host.tagsOf(u).includes(TREASURE_TAG)) this.score.carriersKilled++;
    }
    u.hp = 0;
    u.alive = false;
    u.targetable = false;
    u.activity = 'DEAD';
    u.targetId = null;
    u.castLock = 0;
    u.ultQueued = false;
    u.reviveTimer = 0;
    u.diedOnWave = this.waveIndex;
    clearTemporaryStatus(u);
    if (u.side === PLAYER_TEAM) this.formation.vacate(u.id);
    // died inside a wave → corpse visible until the wave ends · died during a transition → straight to hidden
    const inWave = this.phase === BattlePhase.WAVE_START || this.phase === BattlePhase.COMBAT || this.phase === BattlePhase.WAVE_CLEAR;
    u.life = 'DEAD_VISIBLE';
    if (u.side === PLAYER_TEAM) this.host.emit({ type: 'HERO_DIED', unit: u.id, wave: this.waveIndex });
    if (!inWave && (u.side !== PLAYER_TEAM || this.rules.hideDeadHeroesBetweenWaves)) {
      this.hide(u);
      if (u.side === PLAYER_TEAM) this.host.emit({ type: 'HERO_HIDDEN_AFTER_DEATH', unit: u.id });
    }
  }

  /**
   * Generic resurrection (skills, ultimates, items, shrines, events …).
   * DEAD_VISIBLE → REVIVING at the corpse (AUTO) · DEAD_HIDDEN → REVIVING near the CURRENT formation anchor
   * (never the old death location); REVIVING (visible, untargetable) for reviveInvulnerabilityDuration → ALIVE.
   * The same unit object comes back — no duplicate entity can be created.
   */
  revive(cmd: ReviveHeroCommand): ReviveResult {
    const u = this.unit(cmd.unitId);
    if (!u) return { ok: false, reason: 'not-found' };
    if (this.outcome) return { ok: false, reason: 'stage-over' };
    if (!this.rules.allowRevive) return { ok: false, reason: 'revive-disabled' };
    if (!isDead(u)) return { ok: false, reason: 'not-dead' };
    if (cmd.countsTowardLimit && this.limitedRevives >= this.rules.partyReviveLimit) return { ok: false, reason: 'limit-reached' };
    if (cmd.countsTowardLimit) this.limitedRevives++;

    const fromHidden = u.life === 'DEAD_HIDDEN';
    const mode = cmd.spawnMode ?? 'AUTO';
    const atAnchor = mode === 'FORMATION_ANCHOR' || (mode === 'AUTO' && fromHidden);
    const anchor = this.formationOf(u).anchorOf(u.id);
    const want = atAnchor && anchor ? anchor : { x: u.x, y: u.y };

    if (this.gridActive()) {
      const cell = this.findReviveCell(this.cellAt(want.x, want.y));
      this.placeOnGrid(u, cell);
      u.x = this.formation.originPosition + cell.c;
      u.y = cell.r;
    } else {
      const p = this.freeSpotNear(want.x, want.y, u.id);
      u.x = p.x;
      u.y = p.y;
    }

    const pct = clamp(cmd.reviveHpPercent ?? this.rules.reviveHpDefaultPercent, 0.01, 1);
    u.hp = Math.max(1, Math.round(u.maxHp * pct));
    const gauge = cmd.gaugePolicy ?? 'PRESERVE';
    if (gauge === 'RESET_TO_ZERO') u.mana = 0;
    else if (gauge === 'SET_PERCENT') u.mana = Math.round(u.maxMana * clamp(cmd.gaugePercent ?? 0, 0, 1));
    u.life = 'REVIVING';
    u.activity = 'REVIVING';
    u.alive = false;
    u.visible = true;
    u.targetable = false;
    u.targetId = null;
    u.castLock = 0;
    u.reviveTimer = this.rules.reviveInvulnerabilityDuration;
    u.revivedCount++;
    this.revivedUnits.add(u.id);
    this.formationOf(u).occupy(u.id);
    this.host.emit({ type: 'HERO_REVIVE_STARTED', unit: u.id, sourceId: cmd.sourceId, src: cmd.sourceUnitId, fromHidden });
    this.host.emit({ type: 'revive', src: cmd.sourceUnitId ?? u.id, dst: u.id, amount: u.hp });
    if (u.reviveTimer <= 0) this.completeRevive(u);
    return { ok: true, hidden: fromHidden };
  }

  private tickRevives(dt: number): void {
    for (const u of this.host.units) {
      if (u.life !== 'REVIVING') continue;
      u.reviveTimer -= dt;
      if (u.reviveTimer <= 0) this.completeRevive(u);
    }
  }

  private completeRevive(u: BattleUnit): void {
    u.reviveTimer = 0;
    u.life = 'ALIVE';
    u.alive = true;
    u.targetable = true;
    u.activity =
      this.phase === BattlePhase.COMBAT ? 'COMBAT'
        : this.phase === BattlePhase.ADVANCING ? 'ADVANCING'
          : this.phase === BattlePhase.REGROUPING ? 'REGROUPING' : 'IDLE';
    this.host.emit({ type: 'HERO_REVIVED', unit: u.id, hp: u.hp });
  }

  // ------------------------------------------------------------------ positions

  /** units stand on the combat grid from WAVE_START until they leave the cleared wave */
  gridActive(): boolean {
    return this.phase === BattlePhase.PREPARATION || this.phase === BattlePhase.WAVE_START || this.phase === BattlePhase.COMBAT || this.phase === BattlePhase.WAVE_CLEAR;
  }

  /** encounter-local cell under a world position (clamped to the board) */
  cellAt(x: number, y: number): Cell {
    return {
      r: clamp(Math.round(y), 0, LANES - 1),
      c: clamp(Math.round(x - this.formation.originPosition), 0, BOARD_COLS - 1),
    };
  }

  private placeOnGrid(u: BattleUnit, cell: Cell): void {
    this.host.grid.remove(u.id, u.pos);
    u.pos = cell;
    this.host.grid.place(u.id, cell);
  }

  /**
   * Safe re-entry cell: inside the battlefield, not on another unit, not inside the enemy formation zone —
   * nearest to the wanted cell within reviveSearchRadius (widening if needed). Never fails: falls back to the
   * wanted cell (stacking is allowed in combat).
   */
  private findReviveCell(want: Cell): Cell {
    const maxR = Math.max(this.rules.reviveSearchRadius, 3);
    for (let r = 0; r <= maxR; r++) {
      const ring: Cell[] = [];
      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue;
          const c = { r: want.r + dr, c: want.c + dc };
          if (Grid.inBounds(c) && this.host.grid.isFree(c) && zoneOf(c) !== 'enemy') ring.push(c);
        }
      }
      // prefer staying in the same lane, then further from the enemy
      ring.sort((a, b) => Math.abs(a.r - want.r) - Math.abs(b.r - want.r) || a.c - b.c);
      if (ring.length) return ring[0];
    }
    return want;
  }

  /** transitions (no grid): nudge off other units standing on the spot */
  private freeSpotNear(x: number, y: number, self: number): { x: number; y: number } {
    const others = this.host.units.filter(o => o.id !== self && o.visible && isCombatCapable(o));
    const offsets = [[0, 0], [-1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [-2, 0], [1, 0]];
    for (const [dx, dy] of offsets) {
      const p = { x: x + dx, y: clamp(y + dy, 0, LANES - 1) };
      if (others.every(o => Math.hypot(o.x - p.x, o.y - p.y) >= 0.5)) return p;
    }
    return { x, y };
  }

  private formationOf(u: BattleUnit): FormationRuntime {
    return u.side === PLAYER_TEAM ? this.formation : this.enemyFormation;
  }

  private unit(id: number): BattleUnit | undefined {
    return this.host.units.find(u => u.id === id);
  }

  // ------------------------------------------------------------------ debug

  /** debug overlay lines (phase, wave, origin, per-hero life / slot / anchor distance) */
  debugInfo(): { header: string; heroes: { id: number; lines: string[] }[] } {
    const header = `${this.phase} · wave ${this.waveIndex + 1}/${this.totalWaves} · origin ${this.formation.originPosition.toFixed(2)}`;
    const heroes = getAllPartyHeroes(this.host.units).map(h => {
      const s = this.formation.slotOf(h.id);
      const a = this.formation.anchorOf(h.id);
      const d = a ? Math.hypot(a.x - h.x, a.y - h.y) : 0;
      const t = h.targetId != null ? this.unit(h.targetId)?.name ?? '-' : '-';
      return {
        id: h.id,
        lines: [
          `${h.name} · ${h.life}${h.life === 'REVIVING' ? ` ${h.reviveTimer.toFixed(2)}s` : ''} · ${h.activity}`,
          `${s?.slotId ?? '-'} · anchor ${a ? `${a.x.toFixed(1)},${a.y.toFixed(1)}` : '-'} · d ${d.toFixed(2)}`,
          `HP ${Math.ceil(h.hp)}/${h.maxHp} · ULT ${Math.round((h.mana / Math.max(1, h.maxMana)) * 100)}% · → ${t}`,
        ],
      };
    });
    return { header, heroes };
  }

  /** distance helper for specs */
  static cellDistance = distance;
}

/** On death: temporary combat buffs / debuffs go (persistent effects that declare persistThroughDeath stay) */
export function clearTemporaryStatus(u: BattleUnit): void {
  u.buffs = u.buffs.filter(b => b.def.persistThroughDeath === true && b.def.removeOnDeath !== true);
  u.shield = 0;
  u.shieldTime = 0;
}
