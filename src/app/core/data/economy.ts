/**
 * Patch 1 economy configuration (spec: claude/patch1-hero-level-spec.md) — every number here is tuning data,
 * never read directly by combat code. Level curve, breakthroughs, items, tower EXP, farm dungeons, daily bonus.
 */
import { BreakthroughDefinition, FarmDungeonDefinition, HeroLevelDefinition, ItemDefinition, RewardBundle } from '../models/economy';
import { EquipmentDropTable, Rarity } from '../models/equipment';
import { ChallengeRule, EnemyPlacement, EnemySpawn, StageDef, WaveDefinition } from '../models/stage';
import { ASCENSION_BOSSES, DUNGEON_ROLE_MAP, DUNGEON_MONSTERS, variantId } from './monsters-dungeon';

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
  enhancement_ore: { id: 'enhancement_ore', name: 'Enhancement Ore', kind: 'MATERIAL' },
  equip_frag_basic: { id: 'equip_frag_basic', name: 'Basic Equipment Fragment', kind: 'EQUIPMENT_FRAGMENT' },
  equip_frag_rare: { id: 'equip_frag_rare', name: 'Rare Equipment Fragment', kind: 'EQUIPMENT_FRAGMENT' },
  equip_frag_elite: { id: 'equip_frag_elite', name: 'Elite Equipment Fragment', kind: 'EQUIPMENT_FRAGMENT' },
  equip_frag_epic: { id: 'equip_frag_epic', name: 'Epic Equipment Fragment', kind: 'EQUIPMENT_FRAGMENT' },
  exp_potion_s: { id: 'exp_potion_s', name: 'Small Training Potion', kind: 'EXP_POTION', exp: 50 },
  exp_potion_m: { id: 'exp_potion_m', name: 'Medium Training Potion', kind: 'EXP_POTION', exp: 150 },
  exp_potion_l: { id: 'exp_potion_l', name: 'Large Training Potion', kind: 'EXP_POTION', exp: 500 },
  bt_stone_1: { id: 'bt_stone_1', name: 'Breakthrough Stone I', kind: 'BREAKTHROUGH_STONE', fragmentId: 'bt_fragment_1' },
  bt_stone_2: { id: 'bt_stone_2', name: 'Breakthrough Stone II', kind: 'BREAKTHROUGH_STONE', fragmentId: 'bt_fragment_2' },
  bt_stone_3: { id: 'bt_stone_3', name: 'Breakthrough Stone III', kind: 'BREAKTHROUGH_STONE', fragmentId: 'bt_fragment_3' },
  bt_fragment_1: { id: 'bt_fragment_1', name: 'Breakthrough Fragment I', kind: 'BREAKTHROUGH_FRAGMENT', combinesInto: 'bt_stone_1', fragmentsPerItem: 10 },
  bt_fragment_2: { id: 'bt_fragment_2', name: 'Breakthrough Fragment II', kind: 'BREAKTHROUGH_FRAGMENT', combinesInto: 'bt_stone_2', fragmentsPerItem: 10 },
  bt_fragment_3: { id: 'bt_fragment_3', name: 'Breakthrough Fragment III', kind: 'BREAKTHROUGH_FRAGMENT', combinesInto: 'bt_stone_3', fragmentsPerItem: 10 },
  // Skill Upgrade (claude/patch1-skill-upgrade-spec.md): tomes I–III, 10 fragments = 1 tome
  skill_tome_1: { id: 'skill_tome_1', name: 'Skill Tome I', kind: 'SKILL_TOME', fragmentId: 'skill_tome_frag_1' },
  skill_tome_2: { id: 'skill_tome_2', name: 'Skill Tome II', kind: 'SKILL_TOME', fragmentId: 'skill_tome_frag_2' },
  skill_tome_3: { id: 'skill_tome_3', name: 'Skill Tome III', kind: 'SKILL_TOME', fragmentId: 'skill_tome_frag_3' },
  skill_tome_frag_1: { id: 'skill_tome_frag_1', name: 'Skill Tome Fragment I', kind: 'SKILL_TOME_FRAGMENT', combinesInto: 'skill_tome_1', fragmentsPerItem: 10 },
  skill_tome_frag_2: { id: 'skill_tome_frag_2', name: 'Skill Tome Fragment II', kind: 'SKILL_TOME_FRAGMENT', combinesInto: 'skill_tome_2', fragmentsPerItem: 10 },
  skill_tome_frag_3: { id: 'skill_tome_frag_3', name: 'Skill Tome Fragment III', kind: 'SKILL_TOME_FRAGMENT', combinesInto: 'skill_tome_3', fragmentsPerItem: 10 },
  // Star development (core/data/stars.ts): usable for any hero's star-up after the hero's own Memory
  universal_memory: { id: 'universal_memory', name: 'Universal Memory', kind: 'HERO_MEMORY' },
};

/** EXP potions in the order "use max" spends them (largest first — no EXP wasted past the cap is handled by the rules) */
export const EXP_POTIONS = ['exp_potion_l', 'exp_potion_m', 'exp_potion_s'];

/** daily bonus pools (reset at the local day change; entry is never blocked) */
export const DAILY_BONUS = { TRAINING: 3, ASCENSION: 2, HUNT: 3, SKILL: 2 } as Record<string, number>;

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
  1: { clear: { heroExp: 10 }, firstClear: { heroExp: 40, items: [{ itemId: 'universal_memory', count: 10 }] } },
  2: { clear: { heroExp: 11 }, firstClear: { heroExp: 50, items: [{ itemId: 'universal_memory', count: 10 }] } },
  3: { clear: { heroExp: 10 }, firstClear: { heroExp: 80, items: [{ itemId: 'universal_memory', count: 15 }] } },
  4: { clear: { heroExp: 17 }, firstClear: { heroExp: 120, items: [{ itemId: 'universal_memory', count: 15 }] } },
  5: { clear: { heroExp: 20 }, firstClear: { heroExp: 160, items: [{ itemId: 'universal_memory', count: 20 }] } },
  6: { clear: { heroExp: 40 }, firstClear: { heroExp: 300, items: [{ itemId: 'universal_memory', count: 20 }, { itemId: 'bt_stone_1', count: 1 }] } },
  7: { clear: { heroExp: 45 }, firstClear: { heroExp: 450, items: [{ itemId: 'universal_memory', count: 25 }, { itemId: 'bt_stone_1', count: 1 }] } },
  8: { clear: { heroExp: 45 }, firstClear: { heroExp: 550, items: [{ itemId: 'universal_memory', count: 30 }, { itemId: 'bt_stone_2', count: 2 }] } },
  9: { clear: { heroExp: 70 }, firstClear: { heroExp: 600, items: [{ itemId: 'universal_memory', count: 35 }, { itemId: 'bt_stone_3', count: 2 }] } },
  10: { clear: { heroExp: 125 }, firstClear: { heroExp: 800, items: [{ itemId: 'universal_memory', count: 50 }, { itemId: 'bt_stone_3', count: 3 }] } },
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
/** BOSS DUEL 3★: no death and the guardian down within this many seconds (well before its enrage) */
const ASCENSION_TARGET_TIME = [75, 80, 100];

const stageOf = (list: StageDef[], id: string) => list.find(s => s.id === id)!;

/**
 * Special-dungeon rosters (claude/special-dungeon-monsters.md): each dungeon has its own monsters. The authored
 * waves above keep their structure and pacing; every monster in them becomes the dungeon's role variant
 * (`DUNGEON_ROLE_MAP` → `<dungeon monster>@<old monster>`, same HP / DEF / DPS as the monster it replaces).
 */
const reskin = (s: StageDef, dungeon: keyof typeof DUNGEON_ROLE_MAP): StageDef => {
  const map = DUNGEON_ROLE_MAP[dungeon];
  const swap = (id: string) => (map[id] ? variantId(map[id].to, id) : id);
  const spawns = (l: EnemySpawn[]) => l.map(sp => ({ ...sp, monsterId: swap(sp.monsterId) }));
  const waves = s.waveDefs!.map(w => ({ spawns: spawns(w.spawns), reinforcements: w.reinforcements?.map(r => ({ ...r, spawns: spawns(r.spawns) })) }));
  return { ...s, waveDefs: waves, enemies: s.enemies.map(e => ({ ...e, enemy: swap(e.enemy) })) };
};

// ------------------------------------------------------------------ special modes (Phase 3): each farm type plays differently

/**
 * TRAINING → SURVIVAL: hold out `time` s where you stand. The first group is the old opener; the old waves'
 * reinforcements and later openers become the horde (one group every `every` s while fewer than `maxAlive` stand).
 * Stars: 1★ survive · 2★ at `killStars[0]` kills · 3★ at `killStars[1]` kills with no hero death. Rewards are unchanged (EXP on a win, never per kill).
 */
const toSurvival = (s: StageDef, time: number, every: number, maxAlive: number, killStars: [number, number]): StageDef => {
  const waves = s.waveDefs!;
  const groups: EnemySpawn[][] = waves.flatMap((w, i) => [...(i > 0 ? [w.spawns] : []), ...(w.reinforcements ?? []).map(r => r.spawns)]);
  return {
    ...s, mode: 'survive', rulePreset: 'defense', timeLimit: time, rounds: [], waveDefs: [{ spawns: waves[0].spawns }],
    special: { kind: 'SURVIVAL', horde: { every, maxAlive, groups }, killStars, goal: `อยู่รอด ${time} วินาที · ศัตรูไหลมาไม่หยุด` },
  };
};

/**
 * ASCENSION → BOSS DUEL: one guardian in an arena (no march). It enrages (duel_enrage: ATK ×1.6, speed ×1.3) after
 * `enrageAt` s of combat — a soft time limit; the hard limit is `timeLimit`. 3★ = no death and before the enrage.
 */
const bossDuel = (id: string, name: string, bossId: string, enrageAt: number, timeLimit: number, background: string): StageDef => ({
  floor: 0, id, name, mode: 'eliminate', rulePreset: 'arena', timeLimit, background,
  enemies: [{ enemy: bossId, r: 1, c: 1 }], rounds: [], waveDefs: [{ spawns: [{ monsterId: bossId, formationSlot: { depth: 1, lane: 1 } }] }],
  special: { kind: 'BOSS_DUEL', enrage: { at: enrageAt, status: 'duel_enrage' }, goal: `ล้มผู้พิทักษ์ก่อนมันคลั่ง (${enrageAt} วิ)` },
});

/**
 * HUNT → TREASURE CHASE: the old Hunt waves + one treasure carrier in each of the first three waves. Carriers never
 * attack; they run for the far edge when hit or after 8 s — only carriers you kill roll equipment.
 */
const TREASURE_LANES = [1, 0, 2];
/** the carrier takes the front slot of its lane (reachable by melee heroes); the guard standing there steps back */
const withCarrier = (w: WaveDefinition, carrier: string, lane: number): WaveDefinition => {
  const taken = new Set(w.spawns.map(sp => `${sp.formationSlot.depth},${sp.formationSlot.lane}`));
  const spawns = w.spawns.map(sp => {
    if (sp.formationSlot.depth !== 0 || sp.formationSlot.lane !== lane) return sp;
    const depth = [1, 2, 3, 4, 5].find(d => !taken.has(`${d},${lane}`)) ?? 1;
    taken.add(`${depth},${lane}`);
    return { ...sp, formationSlot: { depth, lane } };
  });
  return { ...w, spawns: [{ monsterId: carrier, formationSlot: { depth: 0, lane } }, ...spawns] };
};
const toTreasure = (s: StageDef, carrier: string): StageDef => {
  const waves = s.waveDefs!.map((w, i) => (i < 3 ? withCarrier(w, carrier, TREASURE_LANES[i]) : w));
  return { ...s, waveDefs: waves, special: { kind: 'TREASURE', goal: 'ล่าโคโบลด์ขนทอง 3 ตัวก่อนมันหนี — ตัวที่จับได้เท่านั้นที่ดรอปอุปกรณ์' } };
};

/** SKILL TRIAL → CHALLENGE: the trial room (regroup in place) + fail rules on the lesson of the tier */
const toChallenge = (s: StageDef, rules: ChallengeRule[], goal: string): StageDef => ({
  ...s, rulePreset: 'arena', special: { kind: 'CHALLENGE', challenge: rules, goal },
});

const trainingDef = (n: number, unlockFloor: number, levels: [number, number], exp: number, potion: string, count: number): FarmDungeonDefinition => ({
  id: `training_${n}`, type: 'TRAINING', name: `Training ${['I', 'II', 'III', 'IV', 'V'][n - 1]}`, unlockFloor, recommendedLevel: levels,
  baseRewards: { heroExp: exp, items: [{ itemId: potion, count }] },
  dailyBonusPool: 'TRAINING', dailyBonusMultiplier: 1.5, repeatRewardMultiplier: 0.55, deathRule: 'EVENT_KO', targetTime: TRAINING_TARGET_TIME[n - 1],
  stage: toSurvival(reskin(stageOf(TRAINING_STAGES, `training_${n}`), 'training'), ...SURVIVAL_TUNING[n - 1]),
});

/** SURVIVAL per Training tier: [seconds, group every s, max alive, kills for 2★ / 3★] */
const SURVIVAL_TUNING: [number, number, number, [number, number]][] = [
  [75, 5, 7, [60, 68]],
  [85, 5, 7, [72, 82]],
  [95, 5, 8, [75, 85]],
  [110, 6, 8, [68, 78]],
  [120, 6, 9, [72, 82]],
];

const ascensionDef = (n: number, unlockFloor: number, levels: [number, number]): FarmDungeonDefinition => ({
  id: `ascension_${n}`, type: 'ASCENSION', name: `Ascension ${['I', 'II', 'III'][n - 1]}`, unlockFloor, recommendedLevel: levels,
  // today's guardian (weekday rotation) — read when a page / battle asks for the stage
  get stage() {
    return ascensionDuel(n, ascensionBossFor());
  },
  baseRewards: { items: [{ itemId: `bt_stone_${n}`, count: 1 }], bonusDrops: [{ chance: 0.2, items: [{ itemId: `bt_stone_${n}`, count: 1 }] }] },
  // Universal Memory = scarce milestone currency: first clears only, never from repeat runs
  firstClearBonus: { items: [{ itemId: `bt_stone_${n}`, count: 1 }, { itemId: 'universal_memory', count: 20 + 10 * n }] },
  dailyBonusPool: 'ASCENSION', dailyBonusMultiplier: 1.5, repeatRewardMultiplier: 0.6, deathRule: 'EVENT_KO', targetTime: ASCENSION_TARGET_TIME[n - 1],
} as FarmDungeonDefinition);

/**
 * Ascension = the Sky Shrine guardians, one per weekday (user decision): Mon–Tue Brass Shishi · Wed–Thu Moonblade
 * Ronin · Fri–Sun Astral Seraph. Tier I–III = that guardian's stat step (`<boss>@<tier>`), enrage / hard limit per tier.
 */
export const ASCENSION_SCHEDULE: Record<number, (typeof ASCENSION_BOSSES)[number]> = {
  1: 'brass_shishi', 2: 'brass_shishi', 3: 'moonblade_ronin', 4: 'moonblade_ronin', 5: 'astral_seraph', 6: 'astral_seraph', 0: 'astral_seraph',
};
export const ASCENSION_DAY_LABEL: Record<string, string> = { brass_shishi: 'จ.–อ.', moonblade_ronin: 'พ.–พฤ.', astral_seraph: 'ศ.–อา.' };
/** the guardian on duty for a local date (default: now) */
export const ascensionBossFor = (date: Date = new Date()): (typeof ASCENSION_BOSSES)[number] => ASCENSION_SCHEDULE[date.getDay()];
const ASCENSION_LIMITS: [number, number][] = [[90, 180], [110, 210], [130, 240]];
const ASCENSION_BG = ['twilight-1', 'twilight-1', 'misty-1'];
export function ascensionDuel(tier: number, boss: (typeof ASCENSION_BOSSES)[number]): StageDef {
  const [enrageAt, limit] = ASCENSION_LIMITS[tier - 1];
  const name = `Ascension ${['I', 'II', 'III'][tier - 1]} · ${DUNGEON_MONSTERS[boss].name}`;
  return bossDuel(`ascension_${tier}`, name, `${boss}@${tier}`, enrageAt, limit, ASCENSION_BG[tier - 1]);
}
export const ASCENSION_WAVE_STAGES = ASCENSION_STAGES;


// ------------------------------------------------------------------ Equipment Hunt (Equipment spec §22–34)

/**
 * Equipment Hunt I–V: the repeatable gear farm. Real combat with reinforced waves (like Training) and a themed last
 * wave: I goblins / wolves · II poison + packs · III casters + healing (utility gear) · IV bleed + heavy melee
 * (defensive gear) · V mist casters + wraith + treant (endgame). Target active clear: I 75–105 s · II 90–120 ·
 * III 105–150 · IV 120–180 · V 150–210. Unlock F3 / F4 / F5 / F7 / F8 (Hunt III = Floor 7 prep, IV = F8, V = F9–10).
 */
const HUNT_STAGES: StageDef[] = [
  farmStage('hunt_1', 'Equipment Hunt I', [
    wave(row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1])),
      row('goblin_fighter', 0, [0, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2]))),
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2]))),
  ], 'forest-1'),
  farmStage('hunt_2', 'Equipment Hunt II', [
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('magic_mushroom', 1, [0, 2]).concat(row('goblin_fighter', 0, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2]))),
    wave(row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('magic_mushroom', 1, [1]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
  ], 'twilight-1'),
  farmStage('hunt_3', 'Equipment Hunt III', [
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1]), row('goblin_archer', 4, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2]))),
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_shaman', 4, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 1, 2]))),
    wave(row('forest_wolf', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('goblin_fighter', 0, [0, 2]).concat(row('forest_wolf', 1, [0, 1, 2])),
      row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2]))),
    wave(row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_shaman', 4, [1]), row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
  ], 'twilight-1'),
  farmStage('hunt_4', 'Equipment Hunt IV', [
    wave(row('corrupted_wolf', 0, [0, 2]).concat(row('goblin_fighter', 0, [1]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_archer', 3, [1]))),
    wave(row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('forest_spirit', 3, [0, 2])),
      row('corrupted_wolf', 0, [0, 2]).concat(row('goblin_fighter', 1, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2]))),
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('corrupted_wolf', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [1])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]))),
    wave(row('corrupted_treant', 0, [1]).concat(row('corrupted_wolf', 0, [0, 2]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
  ], 'misty-1'),
  farmStage('hunt_5', 'Equipment Hunt V', [
    wave(row('corrupted_treant', 0, [1]).concat(row('corrupted_wolf', 0, [0, 2]), row('forest_spirit', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
      row('corrupted_wolf', 0, [0, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2]))),
    wave(row('corrupted_wolf', 0, [0, 2]).concat(row('forest_wolf', 0, [1]), row('dark_shaman', 4, [1])),
      row('corrupted_treant', 0, [1]).concat(row('goblin_fighter', 0, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [0, 2])),
      row('corrupted_wolf', 0, [0, 1, 2]),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('goblin_guard', 0, [0, 2]).concat(row('forest_wolf', 0, [1]), row('mist_witch', 4, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [0, 2])),
      row('corrupted_wolf', 0, [0, 1, 2]),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('goblin_fighter', 0, [0, 2])),
      row('corrupted_treant', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_archer', 3, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2]))),
    wave(row('corrupted_treant', 0, [1]).concat(row('corrupted_wolf', 0, [0, 2]), row('mist_wraith', 2, [1]), row('forest_spirit', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [1])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('corrupted_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]))),
  ], 'misty-1'),
];

const HUNT_TARGET_TIME = [105, 120, 150, 180, 210];

/** Hunt reward per clear (BASE: daily bonus ×1.5, repeat ×0.6 — drop chance unchanged) */
interface HuntTier { n: number; unlockFloor: number; levels: [number, number]; ore: number; gold: number; frags: [string, number][]; drops: EquipmentDropTable; first: Rarity }
const HUNT_TIERS: HuntTier[] = [
  { n: 1, unlockFloor: 3, levels: [3, 4], ore: 8, gold: 100, frags: [['equip_frag_basic', 3]], drops: { itemChance: 0.6, rarityWeights: { COMMON: 65, UNCOMMON: 35 } }, first: 'UNCOMMON' },
  { n: 2, unlockFloor: 4, levels: [4, 5], ore: 12, gold: 160, frags: [['equip_frag_basic', 4], ['equip_frag_rare', 1]], drops: { itemChance: 0.6, rarityWeights: { UNCOMMON: 75, RARE: 25 } }, first: 'UNCOMMON' },
  { n: 3, unlockFloor: 5, levels: [5, 7], ore: 16, gold: 260, frags: [['equip_frag_rare', 5]], drops: { itemChance: 0.55, rarityWeights: { UNCOMMON: 25, RARE: 65, ELITE: 10 } }, first: 'RARE' },
  { n: 4, unlockFloor: 7, levels: [7, 8], ore: 22, gold: 390, frags: [['equip_frag_rare', 2], ['equip_frag_elite', 5]], drops: { itemChance: 0.5, rarityWeights: { RARE: 50, ELITE: 45, EPIC: 5 } }, first: 'RARE' },
  { n: 5, unlockFloor: 8, levels: [8, 10], ore: 30, gold: 580, frags: [['equip_frag_elite', 3], ['equip_frag_epic', 5]], drops: { itemChance: 0.5, rarityWeights: { ELITE: 70, EPIC: 30 } }, first: 'ELITE' },
];

const huntDef = (t: HuntTier): FarmDungeonDefinition => ({
  id: `hunt_${t.n}`, type: 'EQUIPMENT', name: `Hunt ${['I', 'II', 'III', 'IV', 'V'][t.n - 1]}`, unlockFloor: t.unlockFloor, recommendedLevel: t.levels,
  baseRewards: { gold: t.gold, items: [{ itemId: 'enhancement_ore', count: t.ore }, ...t.frags.map(([itemId, count]) => ({ itemId, count }))] },
  firstClearBonus: { items: [{ itemId: 'enhancement_ore', count: 20 }] },
  dailyBonusPool: 'HUNT', dailyBonusMultiplier: 1.5, repeatRewardMultiplier: 0.6, deathRule: 'EVENT_KO', targetTime: HUNT_TARGET_TIME[t.n - 1],
  equipmentDrops: t.drops, firstClearItem: t.first,
  stage: toTreasure(reskin(stageOf(HUNT_STAGES, `hunt_${t.n}`), 'hunt'), 'coin_kobold'),
});

/** TREASURE: each carrier caught rolls the tier's drop table at itemChance × this (≈ the old one roll per clear) */
export const CARRIER_DROP_SCALE = 0.5;


// ------------------------------------------------------------------ Skill Trial (Skill Upgrade spec)

/**
 * Skill Trial I–IV: the Skill Tome farm. Each teaches one tactical skill: I interrupts (Poison Cloud / Alpha Howl) ·
 * II support healers (Goblin Shaman Healing Ritual every wave) · III several casts at once (shaman + mushrooms + howl) ·
 * IV Break coordination (Trial Warden: WARDEN SEAL breakable only, 100 Break = two breakers). Reinforced waves, HP +40 %.
 * Target active clear: I 75–105 s · II 90–120 · III 105–150 · IV 120–180. Unlock F4 / F6 / F7 / F8.
 */
const TRIAL_STAGES: StageDef[] = [
  farmStage('trial_1', 'Skill Trial I', [
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 2]).concat(row('magic_mushroom', 1, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [1]))),
    wave(row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2]), row('goblin_archer', 3, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_wolf', 1, [1]))),
    wave(row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2]), row('magic_mushroom', 1, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2]))),
  ], 'twilight-1'),
  farmStage('trial_2', 'Skill Trial II', [
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_shaman', 4, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1]))),
    wave(row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_shaman', 4, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1]))),
    wave(row('goblin_guard', 0, [0, 2]).concat(row('goblin_fighter', 0, [1]), row('goblin_shaman', 4, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1]))),
  ], 'twilight-1'),
  farmStage('trial_3', 'Skill Trial III', [
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [0, 2]), row('goblin_shaman', 4, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2]))),
    wave(row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2]), row('magic_mushroom', 1, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_shaman', 4, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
      row('corrupted_wolf', 0, [0, 2]).concat(row('goblin_fighter', 1, [1]))),
    wave(row('goblin_guard', 0, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_shaman', 4, [0, 2]), row('magic_mushroom', 1, [1])),
      row('alpha_wolf', 1, [1]).concat(row('forest_wolf', 0, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 1, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1]))),
    wave(row('goblin_guard', 0, [0, 2]).concat(row('goblin_fighter', 0, [1]), row('goblin_shaman', 4, [1]), row('magic_mushroom', 1, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('corrupted_wolf', 0, [0, 2]).concat(row('goblin_fighter', 1, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1]))),
  ], 'misty-1'),
  farmStage('trial_4', 'Skill Trial IV', [
    wave(row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_shaman', 4, [1]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_slime', 1, [0, 2])),
      row('corrupted_wolf', 0, [0, 2]).concat(row('goblin_fighter', 1, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1]))),
    wave(row('trial_warden', 1, [1]).concat(row('goblin_fighter', 0, [0, 2]), row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('magic_mushroom', 1, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2]))),
    wave(row('corrupted_treant', 0, [1]).concat(row('forest_wolf', 0, [0, 2]), row('goblin_shaman', 4, [1])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_slime', 0, [0, 1, 2]).concat(row('goblin_fighter', 1, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1])),
      row('corrupted_wolf', 0, [0, 2]).concat(row('goblin_fighter', 1, [1]))),
    wave(row('trial_warden', 1, [1]).concat(row('goblin_guard', 0, [0, 2]), row('goblin_shaman', 4, [1])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('forest_spirit', 3, [1])),
      row('corrupted_wolf', 0, [0, 1, 2]),
      row('goblin_fighter', 0, [0, 1, 2]).concat(row('goblin_archer', 3, [0, 2])),
      row('forest_wolf', 0, [0, 1, 2]).concat(row('forest_slime', 1, [1]))),
  ], 'misty-1'),
];

const TRIAL_TARGET_TIME = [90, 105, 128, 150];

/** Skill Trial reward per clear (BASE: daily bonus ×1.5 for 2 runs, repeat ×0.6); fractional tomes → fragments */
interface TrialTier { n: number; unlockFloor: number; levels: [number, number]; gold: number; tomes: [string, number][]; bonus: string; first: [string, number][] }
/** chance of +1 tome of the Trial's main tier per clear (× the bonus / repeat multiplier like every item) */
export const TRIAL_BONUS_CHANCE = 0.08;

export const TRIAL_TIERS: TrialTier[] = [
  { n: 1, unlockFloor: 4, levels: [3, 5], gold: 120, tomes: [['skill_tome_1', 0.2]], bonus: 'skill_tome_1', first: [['skill_tome_1', 2]] },
  { n: 2, unlockFloor: 6, levels: [6, 7], gold: 180, tomes: [['skill_tome_1', 0.22], ['skill_tome_2', 0.08]], bonus: 'skill_tome_1', first: [['skill_tome_2', 1]] },
  { n: 3, unlockFloor: 7, levels: [7, 8], gold: 260, tomes: [['skill_tome_1', 0.1], ['skill_tome_2', 0.28]], bonus: 'skill_tome_2', first: [['skill_tome_2', 2]] },
  { n: 4, unlockFloor: 8, levels: [8, 10], gold: 330, tomes: [['skill_tome_2', 0.15], ['skill_tome_3', 0.22]], bonus: 'skill_tome_3', first: [['skill_tome_3', 1]] },
];

const trialDef = (t: TrialTier): FarmDungeonDefinition => ({
  id: `trial_${t.n}`, type: 'SKILL', name: `Skill Trial ${['I', 'II', 'III', 'IV'][t.n - 1]}`, unlockFloor: t.unlockFloor, recommendedLevel: t.levels,
  baseRewards: {
    gold: t.gold, items: t.tomes.map(([itemId, count]) => ({ itemId, count })),
    bonusDrops: [{ chance: TRIAL_BONUS_CHANCE, items: [{ itemId: t.bonus, count: 1 }] }],
  },
  firstClearBonus: { items: t.first.map(([itemId, count]) => ({ itemId, count })) },
  dailyBonusPool: 'SKILL', dailyBonusMultiplier: 1.5, repeatRewardMultiplier: 0.6, deathRule: 'EVENT_KO', targetTime: TRIAL_TARGET_TIME[t.n - 1],
  stage: toChallenge(reskin(stageOf(TRIAL_STAGES, `trial_${t.n}`), 'trial'), ...TRIAL_RULES[t.n - 1]),
});

/** CHALLENGE rules per Skill Trial tier (the tier's lesson) */
const TRIAL_RULES: [ChallengeRule[], string][] = [
  [[{ type: 'CAST_LIMIT', max: 3, skills: ['rune_bolt'], label: 'RUNE BOLT สำเร็จเกิน 3 ครั้ง' }], 'ตัดร่าย! ห้ามปล่อยให้ภูตรูนหัวหน้ายิง RUNE BOLT สำเร็จเกิน 3 ครั้ง'],
  [[{ type: 'KILL_BEFORE', monsterId: 'grimoire_familiar', seconds: 30, label: 'ตำราเวทรอดเกิน 30 วินาที' }], 'ล่าตำรา! ตำราเวทมีชีวิตทุกเล่มต้องล้มภายใน 30 วินาทีหลังโผล่'],
  [[{ type: 'CAST_LIMIT', max: 5, skills: ['page_barrier', 'rune_bolt'], label: 'PAGE BARRIER / RUNE BOLT สำเร็จเกิน 5 ครั้ง' }], 'ร่ายซ้อน! ห้ามปล่อยให้ PAGE BARRIER / RUNE BOLT สำเร็จรวมเกิน 5 ครั้ง'],
  [[{ type: 'CAST_LIMIT', max: 1, skills: ['arcane_seal'], label: 'ARCANE SEAL สำเร็จ 2 ครั้ง' }], 'Break! ห้ามปล่อยให้ผู้คุมสอบร่าย ARCANE SEAL สำเร็จเกิน 1 ครั้ง'],
];

export const FARM_DUNGEONS: FarmDungeonDefinition[] = [
  trainingDef(1, 0, [1, 2], 60, 'exp_potion_s', 1),
  trainingDef(2, 3, [3, 4], 100, 'exp_potion_s', 2),
  trainingDef(3, 5, [5, 6], 160, 'exp_potion_m', 1),
  trainingDef(4, 7, [7, 8], 240, 'exp_potion_m', 2),
  trainingDef(5, 8, [8, 9], 320, 'exp_potion_l', 1),
  ascensionDef(1, 5, [5, 6]),
  ascensionDef(2, 7, [7, 8]),
  ascensionDef(3, 8, [8, 9]),
  ...HUNT_TIERS.map(huntDef),
  ...TRIAL_TIERS.map(trialDef),
];

export const FARM_BY_ID: Record<string, FarmDungeonDefinition> = Object.fromEntries(FARM_DUNGEONS.map(d => [d.id, d]));
