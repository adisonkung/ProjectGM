import { computed, inject, Injectable } from '@angular/core';
import { FARM_BY_ID } from '../data/economy';
import { RewardBreakdown } from '../models/economy';
import { completeFarmRun, completeTowerRun, dailyBonusLeft, ensureDaily, HeroExpResult, isUnlocked, RunOutcome } from '../rules/rewards';
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

  /** tower: clear EXP (+ first clear) on a win; fallen heroes keep the tower's injury rule */
  completeTower(floor: number, run: RunOutcome, fallenUids: number[]): RunReward {
    const r = completeTowerRun(this.save.state(), floor, run);
    this.save.update(() => r.state);
    if (fallenUids.length) this.roster.applyInjuries(fallenUids);
    return { breakdown: r.breakdown, exp: r.exp };
  }

  /** farm dungeon: daily bonus / repeat reward, EXP, items, rating — deaths are EVENT_KO (no injuries) */
  completeFarm(farmId: string, run: RunOutcome, now = new Date(), rng = Math.random): RunReward {
    const def = FARM_BY_ID[farmId];
    const r = completeFarmRun(this.save.state(), def, run, rng, now);
    this.save.update(() => r.state);
    return { breakdown: r.breakdown, exp: r.exp, rating: r.rating };
  }
}
