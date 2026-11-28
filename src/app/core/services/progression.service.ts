import { computed, inject, Injectable } from '@angular/core';
import { FARM_BY_ID } from '../data/economy';
import { RewardBreakdown } from '../models/economy';
import { completeFarmRun, completeTowerRun, dailyBonusLeft, ensureDaily, HeroExpResult, isUnlocked, RunOutcome, sweepableRuns, sweepFarm, SweepRun } from '../rules/rewards';
import { RosterService } from './roster.service';
import { SaveService } from './save.service';

/** result of a tower / farm run for the result screen */
export interface RunReward {
  breakdown: RewardBreakdown | null;
  exp: HeroExpResult[];
  rating?: number;
}

/** Patch 1 run completion: tower clear EXP, Training Ground / Ascension Trial rewards, daily bonus */
@Injectable({ providedIn: 'root' })
export class ProgressionService {
  private readonly save = inject(SaveService);
  private readonly roster = inject(RosterService);

  readonly cleared = computed(() => this.save.state().cleared);
  readonly inventory = computed(() => this.save.state().inventory);

  /** daily bonus clears left today (the day rolls over at local midnight) */
  bonusLeft(pool: string, now = new Date()): number {
    return dailyBonusLeft(ensureDaily(this.save.state().daily, now), pool);
  }

  unlocked(farmId: string): boolean {
    const d = FARM_BY_ID[farmId];
    return !!d && isUnlocked(d, this.save.state().cleared);
  }

  /** tower: clear EXP (+ first clear) on a win — heroes that fell have no lasting penalty (injury system removed) */
  completeTower(floor: number, run: RunOutcome): RunReward {
    const r = completeTowerRun(this.save.state(), floor, run);
    this.save.update(() => r.state);
    return { breakdown: r.breakdown, exp: r.exp };
  }

  /** farm dungeon: daily bonus / repeat reward, EXP, items, rating */
  completeFarm(farmId: string, run: RunOutcome, now = new Date(), rng = Math.random): RunReward {
    const def = FARM_BY_ID[farmId];
    const r = completeFarmRun(this.save.state(), def, run, rng, now);
    this.save.update(() => r.state);
    return { breakdown: r.breakdown, exp: r.exp, rating: r.rating };
  }

  /** daily-bonus runs this tier can sweep right now (0 = locked, not 3★ yet, or today's runs used) */
  sweepable(farmId: string, now = new Date()): number {
    const def = FARM_BY_ID[farmId];
    return def ? sweepableRuns(this.save.state(), def, now) : 0;
  }

  /** sweep `count` of today's bonus runs — each one a full clear with its own rolls; returns the per-run results */
  sweepFarm(farmId: string, count: number, now = new Date(), rng = Math.random): SweepRun[] {
    const def = FARM_BY_ID[farmId];
    if (!def) return [];
    const r = sweepFarm(this.save.state(), def, count, rng, now);
    if (r.runs.length) this.save.update(() => r.state);
    return r.runs;
  }
}
