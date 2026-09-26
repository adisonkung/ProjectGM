/**
 * Patch 1 economy configuration (spec: claude/patch1-hero-level-spec.md) — every number here is tuning data,
 * never read directly by combat code. Level curve, breakthroughs, items, tower EXP, farm dungeons, daily bonus.
 */
import { BreakthroughDefinition, FarmDungeonDefinition, HeroLevelDefinition, ItemDefinition, RewardBundle } from '../models/economy';
import { EnemyPlacement, StageDef } from '../models/stage';

/** EXP for level → level + 1 (Lv1→2 … Lv9→10) — total 9,360 */
export const EXP_TO_NEXT = [100, 180, 300, 480, 750, 1100, 1550, 2100, 2800];

/** breakthroughs: Lv5→6 (I), Lv8→9 (II), Lv9→10 (III, the Patch 1 milestone) */
export const BREAKTHROUGHS: BreakthroughDefinition[] = [
  { id: 'bt_1', tier: 1, fromLevel: 5, toLevel: 6, requiredItems: [{ itemId: 'bt_stone_1', count: 3 }], unlockFlags: ['SKILL_RANK_CAP_3'] },
  { id: 'bt_2', tier: 2, fromLevel: 8, toLevel: 9, requiredItems: [{ itemId: 'bt_stone_2', count: 4 }], unlockFlags: ['GEAR_TIER_UP'] },
  { id: 'bt_3', tier: 3, fromLevel: 9, toLevel: 10, requiredItems: [{ itemId: 'bt_stone_3', count: 5 }], unlockFlags: ['PATCH1_TALENT_SLOT'] },
];

export const HERO_LEVELS: HeroLevelDefinition[] = Array.from({ length: 10 }, (_, i) => {
  const level = i + 1;
  const bt = BREAKTHROUGHS.find(b => b.fromLevel === level);
  return { level, expToNextLevel: EXP_TO_NEXT[i] ?? 0, breakthroughRequired: !!bt, breakthroughDefinitionId: bt?.id };
});

/** Lv10 policy (Patch 1): heroes at the cap stop gaining EXP — no invisible Lv11 progress */
export const EXP_AT_CAP_POLICY = 'STOP' as const;

export const ITEMS: Record<string, ItemDefinition> = {
  exp_potion_s: { id: 'exp_potion_s', name: 'Small Training Potion', kind: 'EXP_POTION', exp: 50 },
  exp_potion_m: { id: 'exp_potion_m', name: 'Medium Training Potion', kind: 'EXP_POTION', exp: 150 },
  exp_potion_l: { id: 'exp_potion_l', name: 'Large Training Potion', kind: 'EXP_POTION', exp: 500 },
  bt_stone_1: { id: 'bt_stone_1', name: 'Breakthrough Stone I', kind: 'BREAKTHROUGH_STONE', fragmentId: 'bt_fragment_1' },
  bt_stone_2: { id: 'bt_stone_2', name: 'Breakthrough Stone II', kind: 'BREAKTHROUGH_STONE', fragmentId: 'bt_fragment_2' },
  bt_stone_3: { id: 'bt_stone_3', name: 'Breakthrough Stone III', kind: 'BREAKTHROUGH_STONE', fragmentId: 'bt_fragment_3' },
  bt_fragment_1: { id: 'bt_fragment_1', name: 'Breakthrough Fragment I', kind: 'BREAKTHROUGH_FRAGMENT', combinesInto: 'bt_stone_1', fragmentsPerItem: 10 },
  bt_fragment_2: { id: 'bt_fragment_2', name: 'Breakthrough Fragment II', kind: 'BREAKTHROUGH_FRAGMENT', combinesInto: 'bt_stone_2', fragmentsPerItem: 10 },
  bt_fragment_3: { id: 'bt_fragment_3', name: 'Breakthrough Fragment III', kind: 'BREAKTHROUGH_FRAGMENT', combinesInto: 'bt_stone_3', fragmentsPerItem: 10 },
};

/** EXP potions in the order "use max" spends them (largest first — no EXP wasted past the cap is handled by the rules) */
export const EXP_POTIONS = ['exp_potion_l', 'exp_potion_m', 'exp_potion_s'];

/** daily bonus pools (reset at the local day change; entry is never blocked) */
export const DAILY_BONUS = { TRAINING: 3, ASCENSION: 2 } as Record<string, number>;

/** reserve heroes in Training Slots get this share of Training battle EXP (no potions) */
export const TRAINING_SLOTS = { count: 2, expShare: 0.35 };

/** future catch-up (NOT enabled in Patch 1 — EXP potions cover it): +bonus Training EXP when ≥ levelsBehind below the best hero */
export const CATCH_UP = { enabled: false, levelsBehind: 3, trainingExpBonus: 0.25 };

/**
 * Tower battle-clear EXP per floor (every participating hero) + first-clear bonus.
 * Repeat tower clears are ~half as efficient as Training of the same band (Training = the farming place).
 * First clears of Floor 1–10 together ≈ 3,800 EXP (≈ Lv7) — never enough for Lv10 by themselves.
 */
export const TOWER_REWARDS: Record<number, { clear: RewardBundle; firstClear: RewardBundle }> = {
  1: { clear: { heroExp: 30 }, firstClear: { heroExp: 60 } },
  2: { clear: { heroExp: 35 }, firstClear: { heroExp: 80 } },
  3: { clear: { heroExp: 45 }, firstClear: { heroExp: 120 } },
  4: { clear: { heroExp: 60 }, firstClear: { heroExp: 180 } },
  5: { clear: { heroExp: 75 }, firstClear: { heroExp: 240 } },
  6: { clear: { heroExp: 90 }, firstClear: { heroExp: 300 } },
  7: { clear: { heroExp: 110 }, firstClear: { heroExp: 450 } },
  8: { clear: { heroExp: 140 }, firstClear: { heroExp: 600 } },
  9: { clear: { heroExp: 170 }, firstClear: { heroExp: 800 } },
  10: { clear: { heroExp: 220 }, firstClear: { heroExp: 1000 } },
};

// ------------------------------------------------------------------ farm dungeon encounters

const row = (enemy: string, depth: number, lanes: number[]): EnemyPlacement[] => lanes.map(c => ({ enemy, r: depth, c }));
const farmStage = (id: string, name: string, waves: EnemyPlacement[][], timeLimit: number, background: string): StageDef => ({
  floor: 0, id, name, mode: 'eliminate', timeLimit, background, enemies: waves[0], rounds: waves.slice(1),
});

/**
 * Training Ground: 6–8 continuous waves of 4–5 enemies (a DPS / survival check, no boss mechanics), HP +40 % so an
 * active clear lasts ~1.5–3 min. Mechanically easier than the tower of the same band.
 */
const training = (id: string, name: string, bg: string, waves: EnemyPlacement[][]): StageDef =>
  ({ ...farmStage(id, name, waves, 240, bg), monsterTuning: { hp: 1.4 } });
const TRAINING_STAGES: StageDef[] = [
  training('training_1', 'Training Ground I', 'forest-1', [
    row('forest_slime', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
    row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1])),
    row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
    row('goblin_fighter', 0, [0, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
    row('forest_slime', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
    row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1])),
    row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
    row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
  ]),
  training('training_2', 'Training Ground II', 'forest-1', [
    row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [0, 2])),
    row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
    row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
    row('goblin_fighter', 0, [0, 2]).concat(row('forest_wolf', 1, [0, 1, 2])),
    row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [0, 2])),
    row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
    row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
    row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 1, 2])),
  ]),
  training('training_3', 'Training Ground III', 'twilight-1', [
    row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [0, 2])),
    row('magic_mushroom', 1, [0, 2]).concat(row('goblin_fighter', 0, [0, 1, 2])),
    row('goblin_guard', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('goblin_archer', 3, [0, 2])),
    row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [0, 2])),
    row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1]), row('goblin_archer', 3, [0])),
    row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('forest_spirit', 3, [0, 2])),
  ]),
  training('training_4', 'Training Ground IV', 'misty-1', [
    row('corrupted_wolf', 0, [0, 2]).concat(row('forest_wolf', 0, [1]), row('forest_spirit', 3, [0, 2])),
    row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('forest_spirit', 3, [0, 2])),
    row('corrupted_wolf', 0, [0, 2]).concat(row('goblin_fighter', 1, [1]), row('goblin_archer', 3, [0, 2])),
    row('forest_wolf', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [0, 2])),
    row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_archer', 3, [0, 2])),
    row('corrupted_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [0, 2])),
  ]),
  training('training_5', 'Training Ground V', 'misty-1', [
    row('corrupted_treant', 0, [1]).concat(row('corrupted_wolf', 0, [0, 2]), row('forest_spirit', 3, [0, 2])),
    row('corrupted_wolf', 0, [0, 1, 2]).concat(row('mist_wraith', 2, [1])),
    row('goblin_guard', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [0, 2])),
    row('corrupted_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
    row('corrupted_treant', 0, [1]).concat(row('corrupted_wolf', 0, [0, 2]), row('mist_wraith', 2, [0, 2])),
    row('goblin_guard', 0, [0, 1, 2]).concat(row('corrupted_wolf', 1, [0, 2])),
  ]),
];

/** Ascension Trial: 4 waves ending in an elite / mini-boss wave guarding the stones (~2–4 min), HP +40 % */
const ascension = (id: string, name: string, bg: string, waves: EnemyPlacement[][]): StageDef =>
  ({ ...farmStage(id, name, waves, 300, bg), monsterTuning: { hp: 1.4 } });
const ASCENSION_STAGES: StageDef[] = [
  ascension('ascension_1', 'Ascension Trial I', 'twilight-1', [
    row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [0, 2])),
    row('goblin_guard', 0, [0, 2]).concat(row('goblin_shaman', 3, [1]), row('goblin_archer', 3, [0, 2])),
    row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [0, 2])),
    row('forest_wolf', 0, [0, 2]).concat(row('alpha_wolf', 1, [1]), row('forest_wolf', 1, [0, 2])),
  ]),
  ascension('ascension_2', 'Ascension Trial II', 'twilight-1', [
    row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_shaman', 3, [1]), row('goblin_archer', 3, [0, 2])),
    row('shadow_panther', 1, [1]).concat(row('magic_mushroom', 1, [0, 2]), row('forest_spirit', 3, [0, 2])),
    row('goblin_guard', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('goblin_shaman', 3, [1])),
    row('goblin_guard', 0, [0, 2]).concat(row('goblin_shaman', 3, [0, 2]), row('shadow_panther', 1, [1])),
  ]),
  ascension('ascension_3', 'Ascension Trial III', 'misty-1', [
    row('corrupted_wolf', 0, [0, 1, 2]).concat(row('dark_shaman', 4, [1])),
    row('corrupted_treant', 0, [1]).concat(row('corrupted_wolf', 0, [0, 2]), row('mist_witch', 4, [0])),
    row('goblin_guard', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [0, 2])),
    row('corrupted_treant', 0, [1]).concat(row('corrupted_wolf', 0, [0, 2]), row('dark_shaman', 4, [0]), row('mist_witch', 4, [2])),
  ]),
];

const stageOf = (list: StageDef[], id: string) => list.find(s => s.id === id)!;

const trainingDef = (n: number, unlockFloor: number, levels: [number, number], exp: number, potion: string, count: number): FarmDungeonDefinition => ({
  id: `training_${n}`, type: 'TRAINING', name: `Training ${['I', 'II', 'III', 'IV', 'V'][n - 1]}`, unlockFloor, recommendedLevel: levels,
  baseRewards: { heroExp: exp, items: [{ itemId: potion, count }] },
  dailyBonusPool: 'TRAINING', dailyBonusMultiplier: 2, repeatRewardMultiplier: 0.7, deathRule: 'EVENT_KO', targetTime: 150,
  stage: stageOf(TRAINING_STAGES, `training_${n}`),
});

const ascensionDef = (n: number, unlockFloor: number, levels: [number, number]): FarmDungeonDefinition => ({
  id: `ascension_${n}`, type: 'ASCENSION', name: `Ascension ${['I', 'II', 'III'][n - 1]}`, unlockFloor, recommendedLevel: levels,
  baseRewards: { items: [{ itemId: `bt_stone_${n}`, count: 1 }], bonusDrops: [{ chance: 0.2, items: [{ itemId: `bt_stone_${n}`, count: 1 }] }] },
  firstClearBonus: { items: [{ itemId: `bt_stone_${n}`, count: 1 }] },
  dailyBonusPool: 'ASCENSION', dailyBonusMultiplier: 2, repeatRewardMultiplier: 0.7, deathRule: 'EVENT_KO', targetTime: 180,
  stage: stageOf(ASCENSION_STAGES, `ascension_${n}`),
});

export const FARM_DUNGEONS: FarmDungeonDefinition[] = [
  trainingDef(1, 0, [1, 2], 70, 'exp_potion_s', 1),
  trainingDef(2, 3, [3, 4], 120, 'exp_potion_s', 2),
  trainingDef(3, 5, [5, 6], 200, 'exp_potion_m', 1),
  trainingDef(4, 7, [7, 8], 320, 'exp_potion_m', 2),
  trainingDef(5, 9, [9, 10], 480, 'exp_potion_l', 1),
  ascensionDef(1, 5, [5, 6]),
  ascensionDef(2, 7, [7, 8]),
  ascensionDef(3, 9, [9, 10]),
];

export const FARM_BY_ID: Record<string, FarmDungeonDefinition> = Object.fromEntries(FARM_DUNGEONS.map(d => [d.id, d]));
