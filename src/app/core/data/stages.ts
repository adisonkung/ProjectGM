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
  { floor: 1, name: 'Normal Forest — Forest Entrance', background: 'forest-1', mode: 'eliminate', timeLimit: 90, enemies: [
    { enemy: 'forest_slime', r: 0, c: 0 }, { enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 0, c: 2 },
  ], rounds: [
    [{ enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 1 }, { enemy: 'goblin_fighter', r: 0, c: 2 }],
    [{ enemy: 'forest_slime', r: 0, c: 0 }, { enemy: 'forest_slime', r: 0, c: 1 }, { enemy: 'forest_slime', r: 0, c: 2 },
      { enemy: 'goblin_fighter', r: 1, c: 0 }, { enemy: 'goblin_fighter', r: 1, c: 2 }],
  ] },
  // Stage 2 teaches frontline vs backline, projectiles, target priority (archers hunt the lowest HP%) → Focus Target
  { floor: 2, name: "Normal Forest — Hunter's Path", background: 'forest-1', mode: 'eliminate', timeLimit: 100, enemies: [
    { enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 2 }, { enemy: 'goblin_archer', r: 3, c: 1 },
  ], rounds: [
    [{ enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 2 },
      { enemy: 'goblin_archer', r: 3, c: 0 }, { enemy: 'goblin_archer', r: 3, c: 2 }],
    [{ enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 1 }, { enemy: 'goblin_fighter', r: 0, c: 2 },
      { enemy: 'goblin_archer', r: 3, c: 0 }, { enemy: 'goblin_archer', r: 3, c: 2 }],
  ] },
  // Stage 3 teaches fast melee pressure, the first elite, cast bars and Interrupt (Alpha Howl)
  { floor: 3, name: 'Normal Forest — Wolf Territory', background: 'forest-1', mode: 'eliminate', timeLimit: 110, enemies: [
    { enemy: 'forest_wolf', r: 0, c: 0 }, { enemy: 'forest_wolf', r: 0, c: 1 }, { enemy: 'forest_wolf', r: 0, c: 2 },
  ], rounds: [
    [{ enemy: 'forest_wolf', r: 0, c: 0 }, { enemy: 'forest_wolf', r: 0, c: 1 }, { enemy: 'forest_wolf', r: 0, c: 2 },
      { enemy: 'forest_wolf', r: 1, c: 0 }, { enemy: 'forest_wolf', r: 1, c: 2 }],
    // Alpha centred just behind the pack (first Howl no sooner than 2 s: MONSTER_SKILLS.alpha_howl.firstCastDelay)
    [{ enemy: 'forest_wolf', r: 0, c: 0 }, { enemy: 'forest_wolf', r: 0, c: 2 }, { enemy: 'alpha_wolf', r: 1, c: 1 },
      { enemy: 'forest_wolf', r: 1, c: 0 }, { enemy: 'forest_wolf', r: 1, c: 2 }],
  ] },

  // ---- Stage 4–10 (core/data/monsters-stage4-10.ts) — mock visuals until art exists.
  // Monster definitions keep the design stats; `monsterScale` (HP & ATK) is the per-stage difficulty knob, tuned with
  // `npm run balance` against the 5★ Lv1 starter team (see claude/hero-monster-reference.md for the latest numbers).
  // Every stage adds ONE new problem; boss waves hold only the boss (its adds come from its own skills / phases).

  // Stage 4 teaches spreading out vs clustered AoE: Poison Cloud seeks the densest hero group (interruptible 1.5 s cast)
  { floor: 4, name: 'Enchanted Grove — Spore Hollow', background: 'forest-1', monsterScale: 3.2, mode: 'eliminate', timeLimit: 110, enemies: [
    { enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 2 }, { enemy: 'magic_mushroom', r: 2, c: 1 },
  ], rounds: [
    [{ enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 2 },
      { enemy: 'magic_mushroom', r: 2, c: 0 }, { enemy: 'magic_mushroom', r: 2, c: 2 }],
    [{ enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 2 },
      { enemy: 'magic_mushroom', r: 2, c: 0 }, { enemy: 'magic_mushroom', r: 2, c: 1 }, { enemy: 'magic_mushroom', r: 2, c: 2 }],
  ] },
  // Stage 5 teaches protecting the backline: Forest Spirits pierce armour, Shadow Panthers leap onto healers / mages
  { floor: 5, name: 'Enchanted Grove — Moonlit Thicket', background: 'forest-1', monsterScale: 3.4, mode: 'eliminate', timeLimit: 110, enemies: [
    { enemy: 'forest_wolf', r: 0, c: 0 }, { enemy: 'forest_wolf', r: 0, c: 2 },
    { enemy: 'forest_spirit', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 2 },
  ], rounds: [
    [{ enemy: 'goblin_fighter', r: 0, c: 0 }, { enemy: 'goblin_fighter', r: 0, c: 2 },
      { enemy: 'shadow_panther', r: 1, c: 1 }, { enemy: 'forest_spirit', r: 4, c: 1 }],
    [{ enemy: 'goblin_fighter', r: 0, c: 1 }, { enemy: 'shadow_panther', r: 1, c: 0 }, { enemy: 'shadow_panther', r: 1, c: 2 },
      { enemy: 'forest_spirit', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 2 }],
  ] },
  // Stage 6 teaches Focus / Interrupt on a healer behind a sturdy wall (Goblin Guards + Healing Ritual)
  { floor: 6, name: 'Goblin Warcamp', background: 'twilight-1', monsterScale: 3.1, mode: 'eliminate', timeLimit: 120, enemies: [
    { enemy: 'goblin_guard', r: 0, c: 0 }, { enemy: 'goblin_guard', r: 0, c: 2 }, { enemy: 'goblin_archer', r: 3, c: 1 },
  ], rounds: [
    [{ enemy: 'goblin_guard', r: 0, c: 0 }, { enemy: 'goblin_guard', r: 0, c: 2 }, { enemy: 'goblin_fighter', r: 1, c: 1 },
      { enemy: 'goblin_shaman', r: 4, c: 1 }],
    [{ enemy: 'goblin_guard', r: 0, c: 0 }, { enemy: 'goblin_guard', r: 0, c: 1 }, { enemy: 'goblin_guard', r: 0, c: 2 },
      { enemy: 'goblin_archer', r: 3, c: 1 }, { enemy: 'goblin_shaman', r: 4, c: 0 }, { enemy: 'goblin_shaman', r: 4, c: 2 }],
  ] },
  // Stage 7 — first boss: Elder Treant (roots on the backline, summons, enrages at 50%)
  { floor: 7, name: "Elder's Hollow — Elder Treant", background: 'twilight-1', monsterScale: 2.9, mode: 'eliminate', timeLimit: 150, enemies: [
    { enemy: 'goblin_guard', r: 0, c: 0 }, { enemy: 'goblin_guard', r: 0, c: 2 },
    { enemy: 'magic_mushroom', r: 2, c: 1 }, { enemy: 'forest_spirit', r: 4, c: 1 },
  ], rounds: [
    [{ enemy: 'goblin_fighter', r: 0, c: 1 }, { enemy: 'shadow_panther', r: 1, c: 1 },
      { enemy: 'forest_spirit', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 2 }, { enemy: 'magic_mushroom', r: 2, c: 1 }],
    [{ enemy: 'elder_treant', r: 1, c: 1 }],
  ] },
  // Stage 8 teaches sustained pressure (Bleed on every 3rd bite) and an untargetable backline hunter (Mist Wraith)
  { floor: 8, name: 'Corrupted Woods', background: 'misty-1', monsterScale: 3.0, mode: 'eliminate', timeLimit: 120, enemies: [
    { enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
  ], rounds: [
    [{ enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
      { enemy: 'mist_wraith', r: 2, c: 0 }, { enemy: 'mist_wraith', r: 2, c: 2 }],
    [{ enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
      { enemy: 'mist_wraith', r: 2, c: 0 }, { enemy: 'mist_wraith', r: 2, c: 2 }, { enemy: 'forest_spirit', r: 4, c: 1 }],
  ] },
  // Stage 9 teaches target priority under control: body-blocking Treants, Soul Link + Dark Heal, Nightmare stun, Dark Fog
  { floor: 9, name: 'Veil of Mist', background: 'misty-1', monsterScale: 3.0, mode: 'eliminate', timeLimit: 140, enemies: [
    { enemy: 'corrupted_treant', r: 0, c: 0 }, { enemy: 'corrupted_treant', r: 0, c: 2 }, { enemy: 'dark_shaman', r: 4, c: 1 },
  ], rounds: [
    [{ enemy: 'corrupted_treant', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 1, c: 0 }, { enemy: 'corrupted_wolf', r: 1, c: 2 },
      { enemy: 'mist_witch', r: 4, c: 1 }],
    [{ enemy: 'corrupted_treant', r: 0, c: 0 }, { enemy: 'corrupted_treant', r: 0, c: 2 }, { enemy: 'mist_wraith', r: 2, c: 1 },
      { enemy: 'dark_shaman', r: 4, c: 0 }, { enemy: 'mist_witch', r: 4, c: 2 }],
  ] },
  // Stage 10 — final boss: The Fallen Forest Guardian (seal + wraiths 70%, Sacrifice 40%, enrage + Forest Oblivion 15%)
  { floor: 10, name: 'Heart of the Dark Forest — Fallen Forest Guardian', background: 'misty-1', monsterScale: 3.0, mode: 'eliminate', timeLimit: 210, enemies: [
    { enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_treant', r: 0, c: 1 }, { enemy: 'corrupted_wolf', r: 0, c: 2 },
    { enemy: 'dark_shaman', r: 4, c: 1 },
  ], rounds: [
    [{ enemy: 'corrupted_wolf', r: 0, c: 0 }, { enemy: 'corrupted_wolf', r: 0, c: 2 }, { enemy: 'shadow_panther', r: 1, c: 1 },
      { enemy: 'mist_witch', r: 4, c: 0 }, { enemy: 'forest_spirit', r: 4, c: 2 }],
    [{ enemy: 'fallen_forest_guardian', r: 1, c: 1 }],
  ] },
];
