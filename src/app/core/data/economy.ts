/**
 * Patch 1 economy configuration (spec: claude/patch1-hero-level-spec.md) — every number here is tuning data,
 * never read directly by combat code. Level curve, breakthroughs, items, tower EXP, farm dungeons, daily bonus.
 */
import { BreakthroughDefinition, FarmDungeonDefinition, HeroLevelDefinition, ItemDefinition, RewardBundle } from '../models/economy';
import { EnemyPlacement, StageDef, WaveDefinition } from '../models/stage';

/** EXP for level → level + 1 (Lv1→2 … Lv9→10) — total 27,600 (rebalance spec: claude/patch1-rebalance-spec.md) */
export const EXP_TO_NEXT = [200, 400, 750, 1250, 2000, 3000, 4500, 6500, 9000];

/** breakthroughs: Lv5→6 (I), Lv8→9 (II), Lv9→10 (III, the Patch 1 milestone) */
export const BREAKTHROUGHS: BreakthroughDefinition[] = [
  { id: 'bt_1', tier: 1, fromLevel: 5, toLevel: 6, requiredItems: [{ itemId: 'bt_stone_1', count: 4 }], unlockFlags: ['SKILL_RANK_CAP_3'] },
  { id: 'bt_2', tier: 2, fromLevel: 8, toLevel: 9, requiredItems: [{ itemId: 'bt_stone_2', count: 6 }], unlockFlags: ['GEAR_TIER_UP'] },
  { id: 'bt_3', tier: 3, fromLevel: 9, toLevel: 10, requiredItems: [{ itemId: 'bt_stone_3', count: 8 }], unlockFlags: ['PATCH1_TALENT_SLOT'] },
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
 * Tower battle-clear EXP per floor (every participating hero) + first-clear bonus (a first clear pays both).
 * Repeat clears ≈ 50–60 % of the same band's post-daily Training EXP per minute (Training stays the farming place).
 * First clears ≈ 10–20 % of the EXP inside their band: F1–3 → Lv2, F1–5 stays below Lv3 (never Lv5),
 * F6–8 useful bonus, F9–10 pay rare breakthrough stones rather than big EXP. Final Level System pass.
 */
export const TOWER_REWARDS: Record<number, { clear: RewardBundle; firstClear: RewardBundle }> = {
  1: { clear: { heroExp: 10 }, firstClear: { heroExp: 40 } },
  2: { clear: { heroExp: 11 }, firstClear: { heroExp: 50 } },
  3: { clear: { heroExp: 10 }, firstClear: { heroExp: 80 } },
  4: { clear: { heroExp: 17 }, firstClear: { heroExp: 120 } },
  5: { clear: { heroExp: 20 }, firstClear: { heroExp: 160 } },
  6: { clear: { heroExp: 40 }, firstClear: { heroExp: 300, items: [{ itemId: 'bt_stone_1', count: 1 }] } },
  7: { clear: { heroExp: 45 }, firstClear: { heroExp: 450, items: [{ itemId: 'bt_stone_1', count: 1 }] } },
  8: { clear: { heroExp: 45 }, firstClear: { heroExp: 550, items: [{ itemId: 'bt_stone_2', count: 2 }] } },
  9: { clear: { heroExp: 70 }, firstClear: { heroExp: 600, items: [{ itemId: 'bt_stone_3', count: 2 }] } },
  10: { clear: { heroExp: 125 }, firstClear: { heroExp: 800, items: [{ itemId: 'bt_stone_3', count: 3 }] } },
};

// ------------------------------------------------------------------ farm dungeon encounters

const row = (enemy: string, depth: number, lanes: number[]): EnemyPlacement[] => lanes.map(c => ({ enemy, r: depth, c }));
const spawnsOf = (list: EnemyPlacement[]) => list.map(p => ({ monsterId: p.enemy, formationSlot: { depth: p.r, lane: p.c } }));
/** a wave = opening group + reinforcement groups that walk in whenever ≤ `at` of the wave's enemies still stand */
const wave = (main: EnemyPlacement[], ...reinforcements: EnemyPlacement[][]): WaveDefinition => ({
  spawns: spawnsOf(main),
  reinforcements: reinforcements.map(g => ({ whenAliveAtMost: REINFORCE_AT, spawns: spawnsOf(g) })),
});
const REINFORCE_AT = 2;
const farmStage = (id: string, name: string, waves: WaveDefinition[], background: string): StageDef => ({
  floor: 0, id, name, mode: 'eliminate', timeLimit: 300, background, monsterTuning: { hp: 1.4 },
  enemies: waves[0].spawns.map(sp => ({ enemy: sp.monsterId, r: sp.formationSlot.depth, c: sp.formationSlot.lane })), rounds: [], waveDefs: waves,
});

/**
 * Training Ground: 2 / 2 / 3 / 3 / 4 waves. Each wave is a sustained fight — an opening group plus reinforcements
 * walking in as the line thins (no heal between waves, attrition carries over), no boss mechanics, HP +40 %.
 * Target active clear: I 60–90 s · II 75–105 · III 90–120 · IV 105–150 · V 120–180.
 */
const TRAINING_STAGES: StageDef[] = [
  farmStage('training_1', 'Training Ground I', [
    wave(row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1])),
      row('goblin_fighter', 0, [0, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2]))),
  ], 'forest-1'),
  farmStage('training_2', 'Training Ground II', [
    wave(row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 2]).concat(row('forest_wolf', 1, [0, 1, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 1, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [0, 1, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1])),
      row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2]), row('forest_slime', 0, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
  ], 'forest-1'),
  farmStage('training_3', 'Training Ground III', [
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 2]).concat(row('magic_mushroom', 1, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('goblin_guard', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2]))),
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [0, 2])),
      row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
  ], 'twilight-1'),
  farmStage('training_4', 'Training Ground IV', [
    wave(row('corrupted_treant', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('corrupted_wolf', 0, [0, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_archer', 3, [1]))),
    wave(row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('forest_spirit', 3, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('magic_mushroom', 1, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
      row('corrupted_treant', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_archer', 3, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('corrupted_wolf', 0, [0, 2]).concat(row('corrupted_treant', 0, [1]), row('forest_spirit', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_archer', 3, [1]))),
  ], 'misty-1'),
  farmStage('training_5', 'Training Ground V', [
    wave(row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('forest_spirit', 3, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('mist_wraith', 2, [1]).concat(row('goblin_fighter', 0, [0, 1, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]))),
    wave(row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('magic_mushroom', 1, [1])),
      row('corrupted_wolf', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2]))),
    wave(row('goblin_guard', 0, [1]).concat(row('corrupted_treant', 0, [0, 2]), row('forest_spirit', 3, [0, 2])),
      row('corrupted_wolf', 0, [0, 1, 2]),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]))),
  ], 'misty-1'),
];

/**
 * Ascension Trial: 4 waves (reinforced), the last one an elite guard of the stones, HP +40 %.
 * I = introduction (75–105 s) · II = a real challenge without tower-wall caster stacks (90–135 s) ·
 * III = the hardest farm (120–180 s).
 */
const ASCENSION_STAGES: StageDef[] = [
  farmStage('ascension_1', 'Ascension Trial I', [
    wave(row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1]))),
    wave(row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_shaman', 4, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2]))),
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2]))),
    wave(row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 1, 2]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
  ], 'twilight-1'),
  farmStage('ascension_2', 'Ascension Trial II', [
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('goblin_fighter', 0, [0, 2]).concat(row('forest_wolf', 1, [0, 1, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2]))),
    wave(row('goblin_guard', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('magic_mushroom', 1, [1]), row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('shadow_panther', 1, [1]).concat(row('goblin_fighter', 0, [0, 1, 2]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2]))),
    wave(row('goblin_guard', 0, [0, 2]).concat(row('alpha_wolf', 1, [1]), row('goblin_shaman', 4, [1]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2]))),
  ], 'twilight-1'),
  farmStage('ascension_3', 'Ascension Trial III', [
    wave(row('corrupted_treant', 0, [1]).concat(row('corrupted_wolf', 0, [0, 2]), row('forest_spirit', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('dark_shaman', 4, [1])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]))),
    wave(row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('mist_wraith', 2, [1]), row('forest_spirit', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('mist_witch', 4, [1])),
      row('corrupted_wolf', 0, [0, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]))),
    wave(row('goblin_guard', 0, [0, 2]).concat(row('goblin_fighter', 0, [1]), row('magic_mushroom', 1, [1]), row('goblin_archer', 3, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('corrupted_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('corrupted_treant', 0, [1]).concat(row('corrupted_wolf', 0, [0, 2]), row('dark_shaman', 4, [0]), row('mist_witch', 4, [2])),
      row('mist_wraith', 2, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]))),
  ], 'misty-1'),
];

/** 3★ clear-time targets (s) — the middle of the spec's duration windows */
const TRAINING_TARGET_TIME = [90, 105, 120, 150, 180];
const ASCENSION_TARGET_TIME = [105, 135, 180];

const stageOf = (list: StageDef[], id: string) => list.find(s => s.id === id)!;

const trainingDef = (n: number, unlockFloor: number, levels: [number, number], exp: number, potion: string, count: number): FarmDungeonDefinition => ({
  id: `training_${n}`, type: 'TRAINING', name: `Training ${['I', 'II', 'III', 'IV', 'V'][n - 1]}`, unlockFloor, recommendedLevel: levels,
  baseRewards: { heroExp: exp, items: [{ itemId: potion, count }] },
  dailyBonusPool: 'TRAINING', dailyBonusMultiplier: 1.5, repeatRewardMultiplier: 0.55, deathRule: 'EVENT_KO', targetTime: TRAINING_TARGET_TIME[n - 1],
  stage: stageOf(TRAINING_STAGES, `training_${n}`),
});

const ascensionDef = (n: number, unlockFloor: number, levels: [number, number]): FarmDungeonDefinition => ({
  id: `ascension_${n}`, type: 'ASCENSION', name: `Ascension ${['I', 'II', 'III'][n - 1]}`, unlockFloor, recommendedLevel: levels,
  baseRewards: { items: [{ itemId: `bt_stone_${n}`, count: 1 }], bonusDrops: [{ chance: 0.2, items: [{ itemId: `bt_stone_${n}`, count: 1 }] }] },
  firstClearBonus: { items: [{ itemId: `bt_stone_${n}`, count: 1 }] },
  dailyBonusPool: 'ASCENSION', dailyBonusMultiplier: 1.5, repeatRewardMultiplier: 0.6, deathRule: 'EVENT_KO', targetTime: ASCENSION_TARGET_TIME[n - 1],
  stage: stageOf(ASCENSION_STAGES, `ascension_${n}`),
});

export const FARM_DUNGEONS: FarmDungeonDefinition[] = [
  trainingDef(1, 0, [1, 2], 60, 'exp_potion_s', 1),
  trainingDef(2, 3, [3, 4], 100, 'exp_potion_s', 2),
  trainingDef(3, 5, [5, 6], 160, 'exp_potion_m', 1),
  trainingDef(4, 7, [7, 8], 240, 'exp_potion_m', 2),
  trainingDef(5, 8, [8, 9], 320, 'exp_potion_l', 1),
  ascensionDef(1, 5, [5, 6]),
  ascensionDef(2, 7, [7, 8]),
  ascensionDef(3, 8, [8, 9]),
];

export const FARM_BY_ID: Record<string, FarmDungeonDefinition> = Object.fromEntries(FARM_DUNGEONS.map(d => [d.id, d]));
