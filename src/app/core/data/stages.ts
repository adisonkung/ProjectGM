import { StageDef } from '../models/stage';

/**
 * Tower Stages 1–10 — Forest Arc (claude/eldervane-monster-spec-s1-10.md §3, 2026-11-05).
 * Wave compositions = the spec's PROPOSED table (not locked). Floor level / time limit / `monsterTuning` /
 * background kept from the previous tower so progression and rewards are unchanged — difficulty is PROVISIONAL
 * until a balance pass (`npm run balance`). The previous floors are in legacy-tower-stages.ts (test fixture only).
 *
 * Enemy positions are enemy-side coordinates: r = depth 0 (front, next to the middle zone) … 5 (back), c = lane 0–2.
 * Melee at depth 0–1, archers / casters at depth 3, wraiths at depth 2, bosses at depth 1 centre lane.
 * Enemy waves: `enemies` = wave 1, `rounds` = waves 2–3. Time limits count combat only.
 */
type Spawn = { enemy: string; r: number; c: number };
const at = (enemy: string, r: number, ...lanes: number[]): Spawn[] => lanes.map(c => ({ enemy, r, c }));

export const STAGES: StageDef[] = [
  // S1 Forest Entrance — basic combat, formation, targeting (Forest Slime = existing art, smaller)
  { floor: 1, recommendedLevel: 1, name: 'Forest Entrance', background: 'forest-1', mode: 'eliminate', timeLimit: 90,
    enemies: at('forest_slime', 0, 0, 2),
    rounds: [
      [...at('forest_goblin', 0, 0, 2), ...at('forest_slime', 1, 1)],
      [...at('forest_goblin', 0, 0, 2), ...at('forest_slime', 1, 0, 2)],
    ] },
  // S2 Goblin Trail — ranged threat and Focus Target
  { floor: 2, recommendedLevel: 1, name: 'Goblin Trail', background: 'forest-1', mode: 'eliminate', timeLimit: 100,
    enemies: at('forest_goblin', 0, 0, 2),
    rounds: [
      [...at('forest_goblin', 0, 0, 2), ...at('goblin_archer', 3, 1)],
      [...at('forest_wolf', 0, 1), ...at('forest_goblin', 0, 0), ...at('goblin_archer', 3, 0, 2)],
    ] },
  // S3 Alpha Territory — first Interrupt lesson (Alpha Wolf first appears here: spec LOCKED)
  { floor: 3, recommendedLevel: 2, name: 'Alpha Territory', background: 'forest-1', mode: 'eliminate', timeLimit: 110,
    enemies: at('forest_wolf', 0, 0, 2),
    rounds: [
      [...at('forest_wolf', 0, 0, 2), ...at('goblin_archer', 3, 1)],
      // Alpha centred just behind its pack — the Howl (2 s, interruptible) is the lesson
      [...at('forest_wolf', 0, 0, 2), ...at('alpha_wolf', 1, 1)],
    ] },
  // S4 Fungal Grove — slower, sturdier enemies
  { floor: 4, recommendedLevel: 3, name: 'Fungal Grove', background: 'twilight-1', mode: 'eliminate', timeLimit: 110,
    enemies: [...at('mushroom_creature', 0, 0, 2), ...at('forest_slime', 1, 1)],
    rounds: [
      at('mushroom_creature', 0, 0, 1, 2),
      [...at('mushroom_creature', 0, 0, 2), ...at('goblin_archer', 3, 0, 2)],
    ] },
  // S5 Thornwood — defensive silhouettes
  { floor: 5, recommendedLevel: 5, monsterTuning: { hp: 1.2, atk: 1.1, def: 1.1 }, name: 'Thornwood', background: 'twilight-1', mode: 'eliminate', timeLimit: 110,
    enemies: at('thorn_slime', 0, 0, 2),
    rounds: [
      [...at('thorn_slime', 0, 0, 2), ...at('forest_wolf', 1, 0, 2)],
      [...at('thorn_slime', 0, 0, 2), ...at('mushroom_creature', 1, 0, 2)],
    ] },
  // S6 Mist Border — flying harassment; Young Treant introduces the family before S7
  { floor: 6, recommendedLevel: 6, monsterTuning: { hp: 1.12, atk: 1.05, def: 1.05 }, name: 'Mist Border', background: 'twilight-1', mode: 'eliminate', timeLimit: 120,
    enemies: [...at('mist_bat', 0, 0, 2), ...at('forest_wolf', 1, 0, 2)],
    rounds: [
      [...at('mist_bat', 0, 0, 1, 2), ...at('goblin_archer', 3, 1)],
      [...at('young_treant', 0, 1), ...at('mist_bat', 1, 0, 2), ...at('goblin_archer', 3, 1)],
    ] },
  // S7 Ancient Grove — first boss check: Elder Treant (Tank / Summoner); its adds come from Call of the Forest
  { floor: 7, recommendedLevel: 8, monsterTuning: { hp: 1.3, atk: 1.12, def: 1.12 }, name: 'Ancient Grove', background: 'twilight-1', mode: 'eliminate', timeLimit: 150,
    enemies: [...at('young_treant', 0, 1), ...at('forest_slime', 0, 0, 2)],
    rounds: [
      [...at('young_treant', 0, 1), ...at('mist_bat', 1, 0, 2)],
      at('elder_treant', 1, 1),
    ] },
  // S8 Twilight Forest — evasive attacker, cast interruption under pressure
  { floor: 8, recommendedLevel: 8, monsterTuning: { hp: 1.25, atk: 1.15, def: 1.1 }, name: 'Twilight Forest', background: 'misty-1', mode: 'eliminate', timeLimit: 120,
    enemies: [...at('corrupted_wolf', 0, 0, 2), ...at('mist_bat', 1, 1)],
    rounds: [
      [...at('young_treant', 0, 1), ...at('mist_wraith', 2, 1)],
      [...at('corrupted_wolf', 0, 0, 2), ...at('mist_wraith', 2, 1), ...at('dark_shaman', 3, 1)],
    ] },
  // S9 Dark Misty Forest — combined support / control (Witch controls space, Shaman empowers / weakens)
  { floor: 9, recommendedLevel: 10, monsterTuning: { hp: 1.3, atk: 1.18, def: 1.18 }, name: 'Dark Misty Forest', background: 'misty-1', mode: 'eliminate', timeLimit: 140,
    enemies: [...at('corrupted_treant', 0, 1), ...at('corrupted_wolf', 0, 0, 2)],
    rounds: [
      [...at('corrupted_wolf', 0, 0, 2), ...at('mist_wraith', 2, 1), ...at('dark_shaman', 3, 1)],
      [...at('corrupted_treant', 0, 1), ...at('mist_wraith', 2, 0), ...at('mist_witch', 3, 2)],
    ] },
  // S10 Dark Mist Gate — Forest Arc boss: Forest Oblivion, fixed anchor (never moves), protected / exposed core + Break
  { floor: 10, recommendedLevel: 10, monsterTuning: { hp: 1.4, atk: 1.22, def: 1.25 }, name: 'Dark Mist Gate', background: 'misty-1', mode: 'eliminate', timeLimit: 210,
    enemies: [...at('corrupted_treant', 0, 1), ...at('corrupted_wolf', 0, 0, 2), ...at('corrupted_wolf', 1, 1), ...at('mist_wraith', 2, 1)],
    rounds: [
      [...at('corrupted_treant', 0, 1), ...at('corrupted_wolf', 0, 0, 2), ...at('mist_wraith', 2, 1),
        ...at('dark_shaman', 3, 0), ...at('mist_witch', 3, 2)],
      at('forest_oblivion', 1, 1),
    ] },
];
