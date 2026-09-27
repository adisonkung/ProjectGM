import { StageDef } from '../models/stage';

/**
 * ตำแหน่งศัตรูเป็นพิกัดในฝั่งศัตรู (ลึก 6 x 3 เลน)
 * r = ความลึก: 0 คือหน้าสุด (ติดเส้นกลาง), 5 คือหลังสุด · c = เลน 0 (บน) - 2 (ล่าง)
 * ด่านกำจัดมี 3 เวฟ: enemies = เวฟ 1, rounds = เวฟ 2-3 (เวฟสุดท้ายหนักสุด/มีบอส)
 * เวลาจำกัดนับเฉพาะช่วงต่อสู้ (ไม่นับช่วงเดินไปเวฟถัดไป)
 */
export const STAGES: StageDef[] = [
  // ---- Normal Forest (data-driven monsters, core/data/monsters.ts) — encounter data lives here, not in the monsters
  // Stage 1 teaches basic combat: targeting, movement, attack, damage, death, formation contact (no casts)
  { floor: 1, recommendedLevel: 1, name: 'Normal Forest — Forest Entrance', background: 'forest-1', mode: 'eliminate', timeLimit: 90, enemies: [
    { enemy: 'forest_slime', r: 0, c: 0 }, { enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 0, c: 2 },
  ], rounds: [
    [{ enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 1 }, { enemy: 'goblin_fighter', r: 0, c: 2 }],
    [{ enemy: 'forest_slime', r: 0, c: 0 }, { enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 0, c: 2 },
      { enemy: 'goblin_fighter', r: 1, c: 0 }, { enemy: 'goblin_fighter', r: 1, c: 2 }],
  ] },
  // Stage 2 teaches frontline vs backline, projectiles, target priority (archers hunt the lowest HP%) → Focus Target
  { floor: 2, recommendedLevel: 1, name: "Normal Forest — Hunter's Path", background: 'forest-1', mode: 'eliminate', timeLimit: 100, enemies: [
    { enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 2 }, { enemy: 'goblin_archer', r: 3, c: 1 },
  ], rounds: [
    [{ enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 2 },
      { enemy: 'goblin_archer', r: 3, c: 0 }, { enemy: 'goblin_archer', r: 3, c: 2 }],
    [{ enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 1 }, { enemy: 'goblin_fighter', r: 0, c: 2 },
      { enemy: 'goblin_archer', r: 3, c: 0 }, { enemy: 'goblin_archer', r: 3, c: 2 }],
  ] },
  // Stage 3 teaches fast melee pressure, the first elite, cast bars and Interrupt (Alpha Howl)
  { floor: 3, recommendedLevel: 2, name: 'Normal Forest — Wolf Territory', background: 'forest-1', mode: 'eliminate', timeLimit: 110, enemies: [
    { enemy: 'forest_wolf', r: 0, c: 0 }, { enemy: 'forest_wolf', r: 0, c: 1 }, { enemy: 'forest_wolf', r: 0, c: 2 },
  ], rounds: [
    [{ enemy: 'forest_wolf', r: 0, c: 0 }, { enemy: 'forest_wolf', r: 0, c: 1 }, { enemy: 'forest_wolf', r: 0, c: 2 },
      { enemy: 'forest_wolf', r: 1, c: 0 }, { enemy: 'forest_wolf', r: 1, c: 2 }],
    // Alpha centred just behind the pack (first Howl no sooner than 2 s: MONSTER_SKILLS.alpha_howl.firstCastDelay)
    [{ enemy: 'forest_wolf', r: 0, c: 0 }, { enemy: 'forest_wolf', r: 0, c: 2 }, { enemy: 'alpha_wolf', r: 1, c: 1 },
      { enemy: 'forest_wolf', r: 1, c: 0 }, { enemy: 'forest_wolf', r: 1, c: 2 }],
  ] },

  // ---- Stage 4–10 (core/data/monsters-stage4-10.ts) — mock visuals until art exists.
  // Monster definitions keep their authored stats — difficulty comes from composition, casts, phases and decisions.
  // Only small `monsterTuning` is allowed (clamped by the engine). `recommendedLevel` drives `npm run balance`.
  // Every stage adds ONE new problem; boss waves hold only the boss (its adds come from its own skills / phases).

  // Stage 4 — Enchanted Grove: poison + magic AoE (mushrooms midline, spirits backline) — punishes a tightly stacked party
  { floor: 4, recommendedLevel: 3, name: 'Enchanted Grove', background: 'twilight-1', mode: 'eliminate', timeLimit: 110, enemies: [
    { enemy: 'magic_mushroom', r: 2, c: 0 }, { enemy: 'magic_mushroom', r: 2, c: 2 },
    { enemy: 'forest_spirit', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 2 },
  ], rounds: [
    [{ enemy: 'magic_mushroom', r: 2, c: 0 }, { enemy: 'magic_mushroom', r: 2, c: 2 },
      { enemy: 'forest_spirit', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 1 }, { enemy: 'forest_spirit', r: 4, c: 2 }],
    [{ enemy: 'magic_mushroom', r: 2, c: 0 }, { enemy: 'magic_mushroom', r: 2, c: 1 }, { enemy: 'magic_mushroom', r: 2, c: 2 },
      { enemy: 'forest_spirit', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 1 }, { enemy: 'forest_spirit', r: 4, c: 2 }],
  ] },
  // Stage 5 — Twilight Hunters: backline dive + formation (Shadow Panthers leap onto healers / mages / archers)
  { floor: 5, recommendedLevel: 5, monsterTuning: { hp: 1.2, atk: 1.1, def: 1.1 }, name: 'Twilight Hunters', background: 'twilight-1', mode: 'eliminate', timeLimit: 110, enemies: [
    { enemy: 'shadow_panther', r: 0, c: 1 },
    { enemy: 'forest_spirit', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 1 }, { enemy: 'forest_spirit', r: 4, c: 2 },
  ], rounds: [
    [{ enemy: 'shadow_panther', r: 0, c: 0 }, { enemy: 'shadow_panther', r: 0, c: 2 },
      { enemy: 'magic_mushroom', r: 2, c: 0 }, { enemy: 'magic_mushroom', r: 2, c: 2 }],
    [{ enemy: 'shadow_panther', r: 0, c: 0 }, { enemy: 'shadow_panther', r: 0, c: 2 },
      { enemy: 'magic_mushroom', r: 2, c: 0 }, { enemy: 'magic_mushroom', r: 2, c: 2 },
      { enemy: 'forest_spirit', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 2 }],
  ] },
  // Stage 6 — Corrupted Tribe: enemy healing + priority target (Goblin Guards shield the Shaman; Focus / Interrupt it)
  { floor: 6, recommendedLevel: 6, monsterTuning: { hp: 1.12, atk: 1.05, def: 1.05 }, name: 'Corrupted Tribe', background: 'twilight-1', mode: 'eliminate', timeLimit: 120, enemies: [
    { enemy: 'goblin_guard', r: 0, c: 0 }, { enemy: 'goblin_guard', r: 0, c: 2 }, { enemy: 'goblin_shaman', r: 4, c: 1 },
    { enemy: 'goblin_archer', r: 3, c: 0 }, { enemy: 'goblin_archer', r: 3, c: 2 },
  ], rounds: [
    // final Level pass: F6 is the last transition floor, not a wall — one shaman per wave (no double Healing Ritual)
    [{ enemy: 'goblin_guard', r: 0, c: 0 }, { enemy: 'goblin_guard', r: 0, c: 1 }, { enemy: 'goblin_guard', r: 0, c: 2 },
      { enemy: 'goblin_shaman', r: 4, c: 1 }, { enemy: 'goblin_archer', r: 3, c: 0 }, { enemy: 'goblin_archer', r: 3, c: 2 }],
    [{ enemy: 'goblin_guard', r: 0, c: 0 }, { enemy: 'goblin_guard', r: 0, c: 2 },
      { enemy: 'goblin_shaman', r: 4, c: 1 },
      { enemy: 'goblin_archer', r: 3, c: 0 }, { enemy: 'goblin_archer', r: 3, c: 2 }],
  ] },
  // Stage 7 — Guardian of Twilight: first boss (Root Slam: survive · Entangling Roots: situational · Call of the Forest: interrupt)
  { floor: 7, recommendedLevel: 8, monsterTuning: { hp: 1.3, atk: 1.12, def: 1.12 }, name: 'Guardian of Twilight', background: 'twilight-1', mode: 'eliminate', timeLimit: 150, enemies: [
    // lighter opening waves (final Level pass): the boss is the exam, not the attrition before it
    { enemy: 'magic_mushroom', r: 2, c: 0 }, { enemy: 'magic_mushroom', r: 2, c: 2 },
    { enemy: 'forest_spirit', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 2 },
  ], rounds: [
    [{ enemy: 'magic_mushroom', r: 2, c: 0 }, { enemy: 'magic_mushroom', r: 2, c: 2 },
      { enemy: 'forest_spirit', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 1 }, { enemy: 'forest_spirit', r: 4, c: 2 }],
    // no starting adds: the boss summons them
    [{ enemy: 'elder_treant', r: 1, c: 1 }],
  ] },
  // Stage 8 — Into the Mist: untargetable hunters, body blocking, bleed attrition
  { floor: 8, recommendedLevel: 8, monsterTuning: { hp: 1.25, atk: 1.15, def: 1.1 }, name: 'Into the Mist', background: 'misty-1', mode: 'eliminate', timeLimit: 120, enemies: [
    { enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
    { enemy: 'corrupted_wolf', r: 1, c: 1 },
    // wolves open wounds, the wraith hunts the bleeding hero (final Level pass: wolf → bleed → wraith synergy)
    { enemy: 'mist_wraith', r: 2, c: 1 },
  ], rounds: [
    [{ enemy: 'corrupted_treant', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
      { enemy: 'mist_wraith', r: 2, c: 0 }, { enemy: 'mist_wraith', r: 2, c: 2 }],
    [{ enemy: 'corrupted_treant', r: 0, c: 0 }, { enemy: 'corrupted_treant', r: 0, c: 2 },
      { enemy: 'corrupted_wolf', r: 1, c: 0 }, { enemy: 'corrupted_wolf', r: 1, c: 1 }, { enemy: 'corrupted_wolf', r: 1, c: 2 },
      { enemy: 'mist_wraith', r: 2, c: 0 }, { enemy: 'mist_wraith', r: 2, c: 2 }, { enemy: 'mist_witch', r: 3, c: 1 }],
  ] },
  // Stage 9 — Death Mist: target-priority puzzle (Treant blocks · Shaman heals / links · Witch controls · Wolves press · Wraith hunts)
  { floor: 9, recommendedLevel: 10, monsterTuning: { hp: 1.3, atk: 1.18, def: 1.18 }, name: 'Death Mist', background: 'misty-1', mode: 'eliminate', timeLimit: 140, enemies: [
    // encounter pass (claude/patch1-encounter-rebalance-f9-f10-spec.md): tactical resource management — more stoppable
    // casts than interrupts every wave (Dark Heal / Nightmare HIGH, Soul Link, Dark Fog unstoppable), casters at depth 3
    { enemy: 'corrupted_treant', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
    { enemy: 'corrupted_wolf', r: 1, c: 1 }, { enemy: 'dark_shaman', r: 3, c: 0 }, { enemy: 'mist_witch', r: 3, c: 2 },
  ], rounds: [
    [{ enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
      { enemy: 'mist_witch', r: 3, c: 0 }, { enemy: 'dark_shaman', r: 3, c: 1 }, { enemy: 'dark_shaman', r: 3, c: 2 }],
    [{ enemy: 'corrupted_treant', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
      { enemy: 'mist_wraith', r: 2, c: 1 }, { enemy: 'dark_shaman', r: 3, c: 0 }, { enemy: 'mist_witch', r: 3, c: 1 }, { enemy: 'mist_witch', r: 3, c: 2 }],
    [{ enemy: 'corrupted_treant', r: 0, c: 0 }, { enemy: 'corrupted_treant', r: 0, c: 2 }, { enemy: 'corrupted_wolf', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 1, c: 1 },
      { enemy: 'mist_wraith', r: 2, c: 0 }, { enemy: 'mist_wraith', r: 2, c: 2 }, { enemy: 'dark_shaman', r: 3, c: 1 }, { enemy: 'mist_witch', r: 3, c: 0 }, { enemy: 'mist_witch', r: 3, c: 2 }],
  ] },
  // Stage 10 — Heart of the Dark Forest: the full system exam (seal + wraiths 70%, Sacrifice 40%, enrage + Forest Oblivion 15%)
  { floor: 10, recommendedLevel: 10, monsterTuning: { hp: 1.4, atk: 1.22, def: 1.25 }, name: 'Heart of the Dark Forest', background: 'misty-1', mode: 'eliminate', timeLimit: 210, enemies: [
    { enemy: 'corrupted_treant', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
    // encounter pass (claude/patch1-encounter-rebalance-f9-f10-spec.md): one Wraith — wave 1 = bleed / survival pressure
    { enemy: 'corrupted_wolf', r: 1, c: 1 }, { enemy: 'mist_wraith', r: 2, c: 1 },
  ], rounds: [
    // wave 2 = caster priority + backline threat (the second Wraith moved here)
    [{ enemy: 'corrupted_treant', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
      { enemy: 'mist_wraith', r: 2, c: 1 }, { enemy: 'dark_shaman', r: 4, c: 0 }, { enemy: 'mist_witch', r: 4, c: 2 }],
    // the boss alone: its phases create the adds
    [{ enemy: 'fallen_forest_guardian', r: 1, c: 1 }],
  ] },
];
