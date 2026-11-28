import '../../../testing/legacy-roster';
import { DAILY_BONUS, FARM_BY_ID } from '../data/economy';
import { newGameState } from '../data/starter';
import { GameState } from '../models/game-state';
import { completeFarmRun, sweepableRuns, sweepFarm } from './rewards';

const DAY = new Date(2026, 10, 29, 12);
const three = (id: string, o: Partial<GameState> = {}): GameState =>
  ({ ...newGameState(), cleared: 10, farm: { [id]: { clears: 4, firstClearDone: true, bestRating: 3 } }, ...o });

describe('sweep (daily-bonus runs of a 3★ tier)', () => {
  it('needs the tier unlocked and cleared with 3★', () => {
    const def = FARM_BY_ID['training_1'];
    expect(sweepableRuns({ ...newGameState(), cleared: 10 }, def, DAY)).toBe(0);
    expect(sweepableRuns(three('training_1', { farm: { training_1: { clears: 3, firstClearDone: true, bestRating: 2 } } }), def, DAY)).toBe(0);
    expect(sweepableRuns(three('training_5', { cleared: 0 }), FARM_BY_ID['training_5'], DAY)).toBe(0);
    expect(sweepableRuns(three('training_1'), def, DAY)).toBe(DAILY_BONUS['TRAINING']);
    // the 3★ is per tier: another tier of the same pool is not sweepable
    expect(sweepableRuns(three('training_1'), FARM_BY_ID['training_2'], DAY)).toBe(0);
  });

  it('only takes today\'s bonus runs — never repeat runs', () => {
    const def = FARM_BY_ID['hunt_2'];
    const s0 = three('hunt_2', { daily: { day: '2026-11-29', used: { HUNT: 1 } } });
    const r = sweepFarm(s0, def, 99, () => 0.5, DAY);
    expect(r.runs.length).toBe(DAILY_BONUS['HUNT'] - 1);
    expect(r.runs.every(x => x.breakdown.kind === 'DAILY_BONUS')).toBeTrue();
    expect(sweepableRuns(r.state, def, DAY)).toBe(0);
    expect(sweepFarm(r.state, def, 1, () => 0.5, DAY).runs.length).toBe(0);
  });

  it('each run equals a real perfect clear (same rewards, carry, rolls)', () => {
    const def = FARM_BY_ID['ascension_1'];
    const s0 = three('ascension_1');
    const seq = (seed: number) => { let x = seed; return () => (x = (x * 9301 + 0.49297) % 1); };
    const swept = sweepFarm(s0, def, 2, seq(0.31), DAY);
    let manual = s0;
    const rng = seq(0.31);
    for (let i = 0; i < 2; i++) manual = completeFarmRun(manual, def, { win: true, deaths: 0, time: 0, participants: manual.team.map(t => t.uid) }, rng, DAY).state;
    expect(swept.state.inventory).toEqual(manual.inventory);
    expect(swept.state.rewardCarry).toEqual(manual.rewardCarry);
    expect(swept.state.daily).toEqual(manual.daily);
    expect(swept.state.farm['ascension_1'].bestRating).toBe(3);
  });

  it('reports whole items per run and marks lucky bonus drops', () => {
    const def = FARM_BY_ID['ascension_2'];
    // rng 0 = every bonus drop hits
    const r = sweepFarm(three('ascension_2'), def, 2, () => 0, DAY);
    expect(r.runs.length).toBe(2);
    expect(r.runs[0].lucky).toEqual(['bt_stone_2']);
    const got = r.runs.reduce((n, x) => n + (x.gained['bt_stone_2'] ?? 0), 0);
    expect(got).toBe(r.state.inventory['bt_stone_2'] ?? 0);
  });

  it('Hunt sweeps roll equipment like 3 carriers caught', () => {
    const def = FARM_BY_ID['hunt_1'];
    const r = sweepFarm(three('hunt_1'), def, 1, () => 0, DAY);
    expect(r.runs[0].breakdown.equipment?.length).toBe(3);
  });
});
