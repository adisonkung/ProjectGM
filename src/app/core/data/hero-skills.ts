import { HeroDefinition, HeroKit, SkillDefinition } from '../models/combat';
import { HeroClass } from '../models/hero';

/**
 * Hero combat kits — the ONLY place hero skill numbers live (balance here, not in the engine).
 * Current prototype balance: 5★ Level 1 (see claude/hero-monster-reference.md in the project).
 *
 * Class kits are the defaults (also used by the 1–4★ heroes and the old token enemies of floors 4–10);
 * a 5★ hero may replace skills with its own (Ragnar, Nox, Corvin) or only rename them (Morgan).
 * Tiers the hero AI walks: EMERGENCY → INTERRUPT → HEAL → HIGH_VALUE → NORMAL → basic action.
 */

// ------------------------------------------------------------------ shared basic actions

const meleeAttack: SkillDefinition = {
  id: 'melee_attack', name: 'โจมตี', label: 'Attack', slot: 'attack', target: 'CURRENT',
  effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 1 }],
};
const arrowAttack: SkillDefinition = {
  id: 'arrow_attack', name: 'ยิงธนู', label: 'Arrow', slot: 'attack', target: 'CURRENT', delivery: 'PROJECTILE',
  effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 1 }],
};
const magicBolt: SkillDefinition = {
  id: 'magic_bolt', name: 'ลูกเวท', label: 'Magic Bolt', slot: 'attack', target: 'CURRENT', delivery: 'PROJECTILE',
  effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 1, damageType: 'MAGIC' }],
};

// ------------------------------------------------------------------ TANK (Aurel · Morgan share mechanics)

const tank: HeroKit = {
  attack: meleeAttack,
  skill: {
    id: 'provoke', name: 'ยั่วยุ', label: 'Taunt / Provoke', slot: 'skill', cooldown: 6, target: 'CURRENT',
    effects: [
      { type: 'DAMAGE', area: 'SINGLE', primary: 1 },
      // RADIUS_2 around the tank: enemies must hit the tank for 3 s · tank takes ×0.60 damage meanwhile
      { type: 'APPLY_STATUS', status: 'taunted', to: 'AREA', area: 'RADIUS_2', center: 'SELF', team: 'ENEMY' },
      { type: 'APPLY_STATUS', status: 'taunt_guard', to: 'SELF' },
    ],
    ai: { tier: 'NORMAL' },
  },
  skill2: {
    id: 'shield_charge', name: 'พุ่งชนโล่', label: 'Shield Charge', slot: 'skill2', cooldown: 12, range: 2,
    target: 'CASTING_INTERRUPTIBLE', fallback: ['CURRENT'], movement: { type: 'CHARGE' },
    // interrupt → damage → knockback → stun
    effects: [
      { type: 'DAMAGE', area: 'SINGLE', primary: 1.5, interrupt: true, breakPower: 60 },
      { type: 'KNOCKBACK', cells: 1 },
      { type: 'APPLY_STATUS', status: 'stun', to: 'PRIMARY', duration: 0.8 },
    ],
    ai: { tier: 'INTERRUPT' },
  },
  ult: {
    id: 'holy_fortress', name: 'ป้อมปราการศักดิ์สิทธิ์', label: 'Holy Fortress', slot: 'ult', target: 'SELF',
    effects: [
      { type: 'INTERRUPT', area: 'RADIUS_2', center: 'SELF', breakPower: 70 },
      { type: 'SHIELD', selfPct: 0.3, allyPct: 0.15, duration: 6 },
      { type: 'APPLY_STATUS', status: 'taunted', to: 'AREA', area: 'RADIUS_2', center: 'SELF', team: 'ENEMY' },
      { type: 'APPLY_STATUS', status: 'taunt_guard', to: 'SELF' },
    ],
    ai: { tier: 'NORMAL', enemyWithin: 2 },
  },
};

// ------------------------------------------------------------------ FIGHTER — Jin (class default)

const fighter: HeroKit = {
  attack: meleeAttack,
  skill: {
    id: 'spinning_sword', name: 'ดาบหมุนวน', label: 'Spinning Sword', slot: 'skill', cooldown: 5, target: 'CURRENT',
    effects: [{ type: 'DAMAGE', area: 'ADJACENT_8', center: 'SELF', primary: 1.7, secondary: 1 }],
    ai: { tier: 'HIGH_VALUE', minTargets: 2 },
  },
  skill2: {
    id: 'piercing_thrust', name: 'แทงทะลวง', label: 'Piercing Thrust', slot: 'skill2', cooldown: 10, target: 'CURRENT',
    effects: [{ type: 'DAMAGE', area: 'LINE_2', primary: 1.8, secondary: 1.2 }],
    ai: { tier: 'NORMAL' },
  },
  ult: {
    id: 'dragon_execution', name: 'ดาบมังกรประหาร', label: 'Dragon Execution', slot: 'ult', range: 2, target: 'NEAREST_ENEMY',
    effects: [{ type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 2.8, secondary: 1.4 }],
    ai: { tier: 'NORMAL' },
  },
};

// ------------------------------------------------------------------ ASSASSIN — Shade (class default)

const assassin: HeroKit = {
  attack: meleeAttack,
  skill: {
    id: 'shadow_assault', name: 'จู่โจมเงา', label: 'Shadow Assault', slot: 'skill', cooldown: 6, range: Infinity,
    target: 'FOCUS_OR_LOWEST_HP', movement: { type: 'BLINK_BEHIND' },
    effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 1.9 }],
    ai: { tier: 'NORMAL' },
  },
  skill2: {
    id: 'poison_smoke', name: 'ควันพิษ', label: 'Poison Smoke', slot: 'skill2', cooldown: 12, target: 'CURRENT',
    effects: [
      { type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 1.1, secondary: 1.1 },
      { type: 'APPLY_STATUS', status: 'poison', to: 'HIT' },
    ],
    ai: { tier: 'NORMAL' },
  },
  ult: {
    // automatic execution of the weakest enemy — ignores the player's focus
    id: 'shadow_execution', name: 'ประหารเงามายา', label: 'Shadow Execution', slot: 'ult', range: 4, target: 'LOWEST_HP_ENEMY',
    movement: { type: 'BLINK_BEHIND' },
    effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 3, guaranteedCrit: true }],
    ai: { tier: 'NORMAL' },
  },
};

// ------------------------------------------------------------------ ARCHER — Sylvie

const archer: HeroKit = {
  attack: arrowAttack,
  skill: {
    id: 'rapid_shot', name: 'ยิงรัว', label: 'Rapid Shot', slot: 'skill', cooldown: 6, target: 'CURRENT',
    delivery: 'PROJECTILE', repeat: { count: 4, gap: 0.1 },
    effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 0.7 }],
    ai: { tier: 'NORMAL' },
  },
  skill2: {
    // 1. interruptible caster in range · 2. a cluster (≥ 2 hit) · 3. current target
    id: 'arrow_rain', name: 'ห่าธนู', label: 'Arrow Rain', slot: 'skill2', cooldown: 11,
    target: 'CASTING_INTERRUPTIBLE', fallback: ['CLUSTER', 'CURRENT'], delivery: 'SKY',
    effects: [{ type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 1.2, secondary: 1.2, interrupt: true, breakPower: 40 }],
    ai: { tier: 'INTERRUPT' },
  },
  ult: {
    id: 'heavenly_arrow_rain', name: 'ฝนธนูสวรรค์', label: 'Heavenly Arrow Rain', slot: 'ult', range: Infinity,
    target: 'NEAREST_ENEMY', delivery: 'SKY',
    effects: [{ type: 'DAMAGE', area: 'ALL_ENEMIES', primary: 1.3, secondary: 1.3, interrupt: true, breakPower: 60 }],
    ai: { tier: 'NORMAL' },
  },
};

// ------------------------------------------------------------------ MAGE — Velma (class default)

const mage: HeroKit = {
  attack: magicBolt,
  skill: {
    id: 'soul_curse', name: 'ตราสาปวิญญาณ', label: 'Soul Curse', slot: 'skill', cooldown: 7, target: 'CLUSTER',
    effects: [{ type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 1.6, secondary: 1.6, damageType: 'MAGIC' }],
    ai: { tier: 'HIGH_VALUE', minTargets: 2 },
  },
  skill2: {
    // ROOT, not an interrupt (Tank and Sylvie are the early-game interrupters)
    id: 'bone_hand', name: 'มือกระดูก', label: 'Bone Hand', slot: 'skill2', cooldown: 14, target: 'CURRENT',
    effects: [
      { type: 'DAMAGE', area: 'SINGLE', primary: 1.9, damageType: 'MAGIC' },
      { type: 'APPLY_STATUS', status: 'root', to: 'PRIMARY', duration: 1.5 },
    ],
    ai: { tier: 'NORMAL' },
  },
  ult: {
    id: 'soul_beam', name: 'ลำแสงวิญญาณ', label: 'Soul Beam', slot: 'ult', target: 'CLUSTER', fallback: ['CURRENT'], delivery: 'PROJECTILE',
    effects: [{ type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 2.5, secondary: 1.4, damageType: 'MAGIC' }],
    ai: { tier: 'NORMAL' },
  },
};

// ------------------------------------------------------------------ HEALER — Lumina (class default)

const resurrection = (id: string, name: string, label: string): SkillDefinition => ({
  id, name, label, slot: 'ult', target: 'SELF',
  effects: [
    { type: 'HEAL', area: 'ALL_ALLIES', atk: 1.5, maxHpPct: 0.15 },
    { type: 'REVIVE', hpPct: 0.4, count: 1 },
  ],
  ai: { tier: 'HEAL', allyHpBelow: 0.5, alliesBelowCount: 2, emergencyHpBelow: 0.35, whenAllyDead: true },
});

const healer: HeroKit = {
  attack: { ...magicBolt, id: 'light_bolt', name: 'ลูกแสง', label: 'Light Bolt' },
  // normal action becomes Heal Bolt (130% ATK, lowest HP% ally) while an ally is below 60%
  healBolt: { allyHpBelow: 0.6, atk: 1.3 },
  skill: {
    id: 'prayer', name: 'บทสวดภาวนา', label: 'Prayer', slot: 'skill', cooldown: 8, target: 'SELF',
    effects: [{ type: 'HEAL', area: 'RADIUS_3', center: 'SELF', atk: 1, maxHpPct: 0.08 }],
    ai: { tier: 'HEAL', allyHpBelow: 0.8, countArea: 'RADIUS_3' },
  },
  skill2: {
    id: 'holy_blessing', name: 'พรศักดิ์สิทธิ์', label: 'Holy Blessing', slot: 'skill2', cooldown: 15, target: 'LOWEST_HP_ALLY',
    effects: [{ type: 'HEAL', area: 'PRIMARY', atk: 2.2, maxHpPct: 0.1 }],
    ai: { tier: 'HEAL', allyHpBelow: 0.65, emergencyHpBelow: 0.35 },
  },
  ult: resurrection('holy_resurrection', 'คืนชีพศักดิ์สิทธิ์', 'Holy Resurrection'),
};

export const CLASS_KITS: Record<HeroClass, HeroKit> = { tank, fighter, assassin, archer, mage, healer };

// ------------------------------------------------------------------ heroes with their own kit

export const HERO_DEFINITIONS: Record<string, HeroDefinition> = {
  // User 2026-10-20: Phantom Executioner. Phase A numbers/timing are provisional, no new class or starter grant.
  vaelric: {
    id: 'vaelric', cls: 'assassin', identity: 'Melee Burst · Dash-through · Curse Mark · Delayed Execution',
    kit: {
      attack: { ...meleeAttack, name: 'ชักดาบเงาคำสาป', label: 'Phantom Draw' },
      skill: {
        ...assassin.skill, name: 'ก้าวข้ามเงา', label: 'Phantom Crossing', target: 'NEAREST_ENEMY', range: 2,
        movement: { type: 'DASH_PATH', distance: 3, duration: 0.3 },
        repeat: { count: 3, gap: 0.05, weights: [1 / 3, 1 / 3, 1 / 3], keepAfterKill: true },
        effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 2.2 }],
      },
      skill2: {
        ...assassin.skill2, name: 'บทส่งวิญญาณกลวง', label: 'Hollow Requiem', range: 2, action: { type: 'STATIONARY', interruptible: true },
        repeat: { count: 3, gap: 0.25, weights: [0.25, 0.25, 0.5], keepAfterKill: true },
        effects: [
          { type: 'DAMAGE', area: 'FRONT_RECT_2X3', center: 'SELF', primary: 2, secondary: 1.2 },
          { type: 'APPLY_STATUS', status: 'curse_mark', to: 'HIT', onHits: [2] },
        ],
      },
      ult: {
        ...assassin.ult, name: 'พิธีศพพันคมดาบ', label: 'Funeral of a Thousand Cuts', range: 3, movement: undefined,
        repeat: undefined, action: { type: 'STATIONARY', interruptible: true, lockedTarget: true,
          retreat: { event: 'VANISH_START', cells: 1 }, faceAway: { event: 'REAPPEAR_START', index: 1 } },
        effects: [
          // Workbook leaves balance TBD: retain existing total coefficients and ADJACENT_8 geometry.
          { type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 3, secondary: 1.5,
            executeBonus: { hpBelow: 0.3, mul: 1.3 } },
        ],
      },
    },
  },
  // Elira Dawnmere — user-approved Phase A plan, 2026-10-17. Provisional R1 values, not final balance.
  elira: {
    id: 'elira', cls: 'healer', identity: 'Team Healing · Targeted Shield · Targeted Sanctuary',
    kit: {
      attack: healer.attack,
      skill: {
        ...healer.skill, name: 'พรแห่งแสงอุ่น', label: 'Hearthlight Blessing',
        target: 'LOWEST_HP_ALLY', range: Infinity, delivery: 'INSTANT',
        effects: [{ type: 'HEAL', area: 'PRIMARY', atk: 2.2, maxHpPct: 0.1 }],
        ai: { tier: 'HEAL', allyHpBelow: 0.8, emergencyHpBelow: 0.35 },
      },
      skill2: {
        ...healer.skill2, name: 'ม่านพิทักษ์ศักดิ์สิทธิ์', label: 'Sanctuary Veil',
        range: Infinity, delivery: 'INSTANT',
        effects: [{ type: 'SHIELD', to: 'PRIMARY', selfPct: 0.15, allyPct: 0.15, duration: 4 }],
        ai: { tier: 'HEAL', allyHpBelow: 0.75, emergencyHpBelow: 0.35 },
      },
      ult: {
        ...healer.ult, name: 'เขตพิทักษ์แสงอุ่น', label: 'Hearthlight Sanctuary', delivery: 'INSTANT',
        target: 'LOWEST_HP_ALLY', range: Infinity,
        effects: [{ type: 'FIELD', field: {
          area: 'RECT_6X3_CENTERED', duration: 6, interval: 1, effects: [],
          aura: { team: 'ALLY', modifiers: { damageTakenMultiplier: 0.8 } },
        } }],
        ai: { tier: 'HEAL', allyHpBelow: 0.75, emergencyHpBelow: 0.35 },
      },
    },
  },
  // Sylvara Windwhisper — The Emerald Huntress (user 2026-10-17). Phase A values, not final balance.
  sylvara: {
    id: 'sylvara', cls: 'archer', identity: 'Ranged DPS · Precision Shot · Root Setup · Five-wave Arrow Rain',
    kit: {
      attack: archer.attack,
      skill: {
        ...archer.skill, name: 'ศรมรกตทะลวง', label: 'Emerald Piercer',
        target: 'FOCUS_OR_LOWEST_HP', delivery: 'PROJECTILE', repeat: undefined,
        effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 2.2, damageType: 'PHYSICAL' }],
        ai: { tier: 'NORMAL' },
      },
      skill2: {
        ...archer.skill2, name: 'พันธนาการพฤกษา', label: 'Verdant Snare',
        target: 'CLUSTER', fallback: ['CURRENT'], delivery: 'PROJECTILE',
        effects: [
          { type: 'DAMAGE', area: 'SQUARE_2', primary: 0.8, secondary: 0.8, damageType: 'PHYSICAL' },
          { type: 'APPLY_STATUS', status: 'root', to: 'HIT', duration: 2 },
        ],
        ai: { tier: 'HIGH_VALUE', minTargets: 1, countArea: 'SQUARE_2' },
      },
      ult: {
        ...archer.ult, name: 'ฝนศรมรกต', label: 'Emerald Skyfall',
        target: 'CLUSTER', fallback: ['NEAREST_ENEMY'], delivery: 'INSTANT',
        // One visual ascent, then activation and five independent area pulses; no launch burst.
        effects: [{ type: 'FIELD', field: {
          area: 'RECT_3X2', duration: 5, interval: 1,
          effects: [{ type: 'DAMAGE', area: 'RECT_3X2', primary: 0.6, secondary: 0.6, damageType: 'PHYSICAL' }],
        } }],
        ai: { tier: 'HIGH_VALUE', minTargets: 1, countArea: 'RECT_3X2' },
      },
    },
  },
  // Mirelle Frostglass — The Winter Scholar (user 2026-10-17): Phase A provisional gameplay.
  // Mage ids/rank tables retained. No skill clips or final VFX timing until individual user review.
  mirelle: {
    id: 'mirelle', cls: 'mage', identity: 'Control DPS · Chill Setup · Slow · Root Conversion · Area Denial',
    kit: {
      ...mage,
      skill: {
        ...mage.skill, name: 'เข็มเหมันต์', label: 'Frost Needle', target: 'CURRENT', delivery: 'PROJECTILE',
        effects: [
          { type: 'DAMAGE', area: 'SINGLE', primary: 1.2, damageType: 'MAGIC' },
          { type: 'APPLY_STATUS', status: 'slow', to: 'HIT', duration: 2,
            when: { status: 'chill', present: false } },
          { type: 'APPLY_STATUS', status: 'slow', to: 'HIT', duration: 2,
            when: { status: 'chill', present: true }, modifiers: { moveSpeedMultiplier: 0.55 } },
        ],
        ai: { tier: 'NORMAL' },
      },
      skill2: {
        ...mage.skill2, name: 'พันธนาการแก้วเยือกแข็ง', label: 'Glassbind',
        target: 'CLUSTER', fallback: ['CURRENT'],
        effects: [
          { type: 'DAMAGE', area: 'SQUARE_2', primary: 0.8, secondary: 0.8, damageType: 'MAGIC' },
          { type: 'APPLY_STATUS', status: 'root', to: 'HIT', duration: 1,
            when: { status: 'chill', present: true } },
          { type: 'APPLY_STATUS', status: 'chill', to: 'HIT', duration: 4 },
        ],
        ai: { tier: 'HIGH_VALUE', minTargets: 1, countArea: 'SQUARE_2' },
      },
      ult: {
        ...mage.ult, name: 'อาณาเขตแก้วเหมันต์', label: 'Winterglass Field', delivery: 'INSTANT',
        effects: [{ type: 'FIELD', field: {
          area: 'ADJACENT_8', duration: 6, interval: 1,
          effects: [
            { type: 'DAMAGE', area: 'ADJACENT_8', primary: 0.15, secondary: 0.15, damageType: 'MAGIC' },
            { type: 'APPLY_STATUS', status: 'slow', to: 'AREA', area: 'ADJACENT_8', duration: 1.1 },
            { type: 'APPLY_STATUS', status: 'frost_fatigue', to: 'AREA', area: 'ADJACENT_8', duration: 1.1 },
          ],
        } }],
        ai: { tier: 'HIGH_VALUE', minTargets: 1, countArea: 'ADJACENT_8' },
      },
    },
  },
  // 2026-10 remodel: per-hero kits of the shipped roster (the old roster lives only in src/testing/legacy-roster.ts)
  // เยว่เจิ้ง (Iron Mountain Bastion, 3★ Tank, remodel #2): Tank baseline numbers (ids / rank tables unchanged) —
  // only the names follow the character · Stone Guardian Lion / Mountain Seal Qi visuals come with the skill art
  yuezheng: {
    id: 'yuezheng', cls: 'tank', identity: 'Tank · Taunt · Shield Ram Interrupt · Mountain Seal Zone',
    kit: {
      ...tank,
      skill: { ...tank.skill, name: 'กำแพงเหล็กยั่วยุ', label: 'Iron Wall Taunt' },
      skill2: { ...tank.skill2, name: 'โล่พยัคฆ์ทลายประตู', label: 'Tiger Gate Ram' },
      ult: { ...tank.ult, name: 'ป้อมผนึกภูผา', label: 'Mountain Seal Bastion' },
    },
  },
  // โม่เย่ (Mo Ye — Shadow Orchid Blade, 3★ Assassin, remodel #3): Shadow / Crimson Petal Qi · class ids + numbers
  // (rank tables apply) arranged to her skills until the skill sheets arrive: S1 Orchid Sever = the class S1 damage
  // as two quick cuts on her current target (no blink) · S2 Phantom Step = the reposition: blink behind the focus /
  // weakest + one strike · Ult Thousand Petal Execution = the class execution (blink to the weakest, guaranteed crit)
  // split into a flurry + the final hit (55 %)
  moye: {
    id: 'moye', cls: 'assassin', identity: 'Assassin · Single-target Burst · Phantom Reposition · Execution Finisher',
    kit: {
      ...assassin,
      skill: {
        ...assassin.skill, name: 'ฟันกล้วยไม้', label: 'Orchid Sever', target: 'CURRENT', range: 1, movement: undefined,
        repeat: { count: 2, gap: 0.18, weights: [0.45, 0.55] },
      },
      skill2: {
        ...assassin.skill2, name: 'ก้าวเงามายา', label: 'Phantom Step', target: 'FOCUS_OR_LOWEST_HP', range: Infinity,
        movement: { type: 'BLINK_BEHIND' }, effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 2.0 }],
      },
      ult: {
        ...assassin.ult, name: 'ประหารพันกลีบ', label: 'Thousand Petal Execution',
        // Timeline Sync Sheet: 3 slashes + the final descending execution (T032 / T048 / T064 / T104), final hit heaviest
        repeat: { count: 4, gap: 0.16, weights: [0.15, 0.15, 0.2, 0.5] },
      },
    },
  },
  // ถังซวิ่น (Tang Xun — Whispering Blade, 3★ ranged hidden-weapon specialist, remodel #4): Wind / Jade · Whispering
  // Blade Qi · throwing knives (no bow) · Archer class ids + cooldowns (rank tables apply), effects arranged to his
  // skills until the skill sheets arrive: S1 Piercing Fang = knife through a 1×3 line, first target hardest ·
  // S2 Severing Chain = the anti-cast throw (interrupt + break; the 3-throw chain arrives with its sheet) ·
  // Ult Heaven-Snaring Blade Array = focused on the focus / weakest target with a small ring around it (no full-screen AoE)
  tangxun: {
    id: 'tangxun', cls: 'archer', identity: 'Hidden Weapons · Line Pierce · Anti-cast · Marked-target Blade Array',
    kit: {
      ...archer,
      skill: {
        ...archer.skill, name: 'เขี้ยวทะลวง', label: 'Piercing Fang', target: 'CURRENT', delivery: 'PROJECTILE', repeat: undefined,
        // one blade through the line: the units behind take their hit when it gets there (T034 / T036 on the sync sheet)
        effects: [{ type: 'DAMAGE', area: 'LINE_3', primary: 2.4, secondary: 1.2, pierceDelays: [0.067, 0.1] }],
      },
      skill2: {
        ...archer.skill2, name: 'โซ่ตัดเงา', label: 'Severing Chain', target: 'CASTING_INTERRUPTIBLE', fallback: ['CURRENT'],
        delivery: 'PROJECTILE',
        // three throws of the same single blade (clip DAMAGE events = spawns T014 / T030 / T045), 25 / 30 / 45 % of the
        // total · the interrupt (Break 40) and the Open Wound mark ride on throw 3 only
        repeat: { count: 3, gap: 0.26, weights: [0.25, 0.3, 0.45] },
        effects: [
          { type: 'DAMAGE', area: 'SINGLE', primary: 1.6 },
          { type: 'INTERRUPT', area: 'SINGLE', breakPower: 40, onHits: [2] },
          { type: 'APPLY_STATUS', status: 'open_wound', to: 'HIT', onHits: [2] },
        ],
      },
      ult: {
        ...archer.ult, name: 'ค่ายมีดตาข่ายสวรรค์', label: 'Heaven-Snaring Blade Array', range: Infinity,
        // lock priority (T068 scan → T074 mark check → T080 lock): the player's focus → Open Wound (S2) → back line →
        // a caster → the current target
        target: 'FOCUS', fallback: ['MARKED', 'FARTHEST_BACKROW', 'CASTING_INTERRUPTIBLE', 'CURRENT', 'LOWEST_HP_ENEMY'],
        markStatus: 'open_wound',
        // the array cuts the locked target 4 × (T108 / T112 / T116 / T120) then converges (T130): 10/10/10/15/55 % of
        // 300 % — minor cuts single-target (the first interrupts, Break 60), the finisher always crits + 100 % around it
        delivery: 'INSTANT',
        repeat: { count: 5, gap: 0.07, weights: [0.1, 0.1, 0.1, 0.15, 0.55], keepAfterKill: true },
        effects: [
          { type: 'DAMAGE', area: 'SINGLE', primary: 3.0, onHits: [0, 1, 2, 3] },
          { type: 'INTERRUPT', area: 'SINGLE', breakPower: 60, onHits: [0] },
          { type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 3.0, secondary: 1.82, guaranteedCrit: true, onHits: [4] },
        ],
      },
    },
  },
  // หลินเสวี่ย (Lin Xue — Lotus Spirit Physician, 3★ Healer / Support, remodel #5): Nature / Water / Jade · Lotus Spring
  // Qi · Lotus Staff · Healer class ids + cooldowns (rank tables apply), effects arranged to her skills until the skill
  // sheets arrive: S1 Lotus Prayer = heal the lowest-HP ally + a light heal around it · S2 Spirit Mend = strong
  // emergency heal + cleanse 1 debuff + a short Qi Guard shield · Ult Returning Spring Rite = team heal + cleanse
  // every debuff + revive 1 fallen ally
  linxue: {
    id: 'linxue', cls: 'healer', identity: 'Healer · Targeted Heal · Cleanse · Qi Guard · Team Revival',
    kit: {
      ...healer,
      attack: { ...healer.attack, id: 'light_bolt', name: 'บัววิญญาณ', label: 'Spirit Lotus' },
      skill: {
        ...healer.skill, name: 'บทสวดบัวสวรรค์', label: 'Lotus Prayer', target: 'LOWEST_HP_ALLY',
        // production sync sheet: the Heal Burst heals the weakest ally first (T025, 100 % ATK + 8 % max HP), then the
        // allies around it (T031, 40 % + 3 %) — two beats on the clip's DAMAGE events
        repeat: { count: 2, gap: 0.1, keepAfterKill: true },
        effects: [
          { type: 'HEAL', area: 'PRIMARY', atk: 1, maxHpPct: 0.08, onHits: [0] },
          { type: 'HEAL', area: 'ADJACENT_8', center: 'TARGET', atk: 0.4, maxHpPct: 0.03, skipPrimary: true, onHits: [1] },
        ],
        ai: { tier: 'HEAL', allyHpBelow: 0.8 },
      },
      skill2: {
        ...healer.skill2, name: 'ประสานวิญญาณ', label: 'Spirit Mend',
        // production sync sheet — three beats on the clip's DAMAGE events: cleanse the newest debuff (T030) → emergency
        // heal, class numbers (T038) → Qi Guard = 12 % of her max HP for 4 s (T048)
        repeat: { count: 3, gap: 0.12 },
        effects: [
          { type: 'CLEANSE', to: 'PRIMARY', count: 1, onHits: [0] },
          { type: 'HEAL', area: 'PRIMARY', atk: 2.2, maxHpPct: 0.1, onHits: [1] },
          { type: 'SHIELD', to: 'PRIMARY', selfPct: 0.12, allyPct: 0.12, duration: 4, onHits: [2] },
        ],
      },
      ult: {
        ...healer.ult, name: 'พิธีคืนวสันต์', label: 'Returning Spring Rite',
        // production sync sheet — three beats on the clip's DAMAGE events: team heal (class numbers) T092 → cleanse every
        // ally T104 → revival T114: the dead ally is chosen now (cue FX on it) and comes back 4 frames later (T118)
        repeat: { count: 3, gap: 0.2 },
        effects: [
          { type: 'HEAL', area: 'ALL_ALLIES', atk: 1.5, maxHpPct: 0.15, onHits: [0] },
          { type: 'CLEANSE', to: 'ALL_ALLIES', onHits: [1] },
          { type: 'REVIVE', hpPct: 0.4, count: 1, delay: 4 / 60, onHits: [2] },
        ],
      },
    },
  },
  // การ์ริก (Garrick Stoneward — The Iron Bell, 3★ Tank / Frontline Control, remodel #6): Earth / Steel / Guardian ·
  // Iron Bastion (Golden Lion = his crest, not a summon) · two-handed warhammer · Classic Western fantasy knight ·
  // Tank class ids + cooldowns (rank tables apply), effects arranged to his kit until the skill sheets arrive:
  // S1 Brace for Impact = self guard (class DR taunt_guard) + taunt the foes in front + the first foe to land a hit
  // is staggered · S2 Hammerfall = heavy slam on the cell in front (splash above / below), high Break, small knockback
  // · Ult Hold the Gate = taunt nearby + team −15 % damage taken + 25 % of the allies' damage intercepted by him +
  // stagger resistance (no immortality, no direct healing)
  garrick: {
    id: 'garrick', cls: 'tank', identity: 'Tank · Counter Stance · Hammer Break · Team Damage Interception',
    kit: {
      ...tank,
      skill: {
        ...tank.skill, name: 'ตั้งรับแรงปะทะ', label: 'Brace for Impact',
        effects: [
          { type: 'APPLY_STATUS', status: 'taunted', to: 'AREA', area: 'FRONT_ARC', center: 'SELF', team: 'ENEMY' },
          { type: 'APPLY_STATUS', status: 'taunt_guard', to: 'SELF' },
          { type: 'APPLY_STATUS', status: 'brace_counter', to: 'SELF' },
        ],
      },
      skill2: {
        ...tank.skill2, name: 'ค้อนถล่มปฐพี', label: 'Hammerfall', range: 1, movement: undefined,
        // no charge: he plants and slams the cell in front (every unit standing there), the lanes above / below take splash
        effects: [
          { type: 'DAMAGE', area: 'FRONT_T3', primary: 1.8, secondary: 0.6, interrupt: true, breakPower: 70 },
          { type: 'KNOCKBACK', cells: 1 },
        ],
      },
      ult: {
        ...tank.ult, name: 'ยืนหยัดเฝ้าประตู', label: 'Hold the Gate',
        effects: [
          { type: 'APPLY_STATUS', status: 'taunted', to: 'AREA', area: 'RADIUS_2', center: 'SELF', team: 'ENEMY' },
          { type: 'APPLY_STATUS', status: 'gate_ward', to: 'AREA', area: 'ALL_ALLIES', team: 'ALLY' },
          { type: 'APPLY_STATUS', status: 'gate_stance', to: 'SELF' },
        ],
      },
    },
  },
  // เดรเวน มอร์แคนต์ (Draeven Morcant — The Bloodwrought Sovereign, 3★ Tank / Fighter label → Tank class, Phase A
  // 2026-10-22): Blood Retaliation / Sustain Bruiser — keyword PUNISH (Yue Zheng = PROTECT, Garrick = STOP). Tank class
  // ids + cooldowns (rank tables apply); no shield, no ally interception, no stun / knockback / Break, no team heal.
  // Provisional numbers, no balance run:
  // S1 Blood Debt = taunt foes within 2 + Blood Debt on himself (he keeps fighting): 5 foe hits → Blood Reprisal
  // (Crimson Spike Eruption) 140 % ATK to foes within 1 cell + 3 % max HP per stack, cap 15 %
  // S2 Sovereign's Reprisal = a crimson slash on the column one cell in front (user 2026-10-26: up / front / down,
  // the front cell main, above / below splash) + Blood Brand (ATK −15 %, his hits on branded foes heal him 12 % of the damage)
  // Ult Blood Dominion (user 2026-10-26) = momentum wind-up (no hit), charge, ONE heavy downward strike on the 2 × 3
  // ahead (front cell main, the rest splash), Blood Brand on the hit, then Blood Dominion (sovereign_dominion: −20 %
  // damage taken, Blood Reprisal ×1.3 damage / ×1.2 self-heal, 6 s) and Blood Debt re-armed with a fresh taunt
  draeven: {
    id: 'draeven', cls: 'tank', identity: 'Tank / Fighter · Blood Retaliation · Self Sustain · ATK Suppression',
    kit: {
      ...tank,
      skill: {
        ...tank.skill, name: 'หนี้เลือด', label: 'Blood Debt',
        effects: [
          { type: 'APPLY_STATUS', status: 'taunted', to: 'AREA', area: 'RADIUS_2', center: 'SELF', team: 'ENEMY' },
          { type: 'APPLY_STATUS', status: 'blood_debt', to: 'SELF' },
        ],
      },
      skill2: {
        ...tank.skill2, name: 'การตอบแทนแห่งราชัน', label: "Sovereign's Reprisal", range: 1, target: 'CURRENT',
        fallback: undefined, movement: undefined,
        effects: [
          { type: 'DAMAGE', area: 'FRONT_T3', primary: 1.6, secondary: 1.0 },
          { type: 'APPLY_STATUS', status: 'blood_brand', to: 'HIT' },
        ],
        ai: { tier: 'NORMAL', minTargets: 1 },
      },
      ult: {
        ...tank.ult, name: 'อาณาจักรโลหิต', label: 'Blood Dominion', range: 1, target: 'CURRENT',
        effects: [
          { type: 'DAMAGE', area: 'FRONT_RECT_2X3', primary: 2.8, secondary: 1.2 },
          { type: 'APPLY_STATUS', status: 'blood_brand', to: 'HIT' },
          { type: 'APPLY_STATUS', status: 'sovereign_dominion', to: 'SELF' },
          { type: 'APPLY_STATUS', status: 'taunted', to: 'AREA', area: 'RADIUS_2', center: 'SELF', team: 'ENEMY' },
          { type: 'APPLY_STATUS', status: 'blood_debt', to: 'SELF' },
        ],
        ai: { tier: 'NORMAL', minTargets: 1 },
      },
    },
  },
  // เคล แอชเชน แวนการ์ด (Kael Ashen Vanguard, 3★ Fighter / Frontline DPS · Guard Breaker, remodel #7): Steel /
  // Martial Force · hand-and-a-half longsword · Classic Fantasy (Kingdom Adventurers) · Fighter class ids + cooldowns
  // (rank tables apply; same slot swap as Bai Long), effects arranged to his kit — provisional numbers, no balance run:
  // S1 Sundering Edge = heavy diagonal cut on one target, high Break (break-only: feeds a breakable cast's gauge, does
  // not interrupt), ×1.3 vs a guarded target (shield / damage-reducing status) · S2 Relentless Cross = horizontal cut
  // + stronger rising reverse cut (40 / 60 %), +20 % on the 2nd when both land on the same target · Ult Ashen Rupture =
  // one overhead cut releasing a sword wave down the lane: the 4 cells ahead (ground, every unit standing there), one hit
  // per unit when the wave reaches its cell (`travel` 10 cells / s, timeline v2: spawn F8, damage on collision)
  kael: {
    id: 'kael', cls: 'fighter', identity: 'Melee DPS · Guard Breaker · Combo Pressure · Line Burst',
    kit: {
      ...fighter,
      skill: {
        ...fighter.skill2, slot: 'skill', name: 'คมดาบแยกเกราะ', label: 'Sundering Edge', range: 1,
        effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 2.2, breakPower: 60, bonusVsGuard: 1.3 }],
        ai: { tier: 'NORMAL' },
      },
      skill2: {
        ...fighter.skill, slot: 'skill2', name: 'กากบาทไม่หยุดยั้ง', label: 'Relentless Cross', range: 1,
        effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 1.7 }],
        repeat: { count: 2, gap: 0.3, weights: [0.4, 0.6], comboBonus: 0.2 },
        ai: { tier: 'NORMAL' },
      },
      ult: {
        ...fighter.ult, name: 'เถ้าธุลีแยกแผ่นดิน', label: 'Ashen Rupture', range: 1,
        effects: [{ type: 'DAMAGE', area: 'FRONT_LINE_4', primary: 2.6, travel: 7 }], ai: { tier: 'NORMAL', minTargets: 1 },
      },
    },
  },
  bailong: {
    id: 'bailong', cls: 'fighter', identity: 'Spear Lancer · Line Pierce · Sweep · Three-strike Finisher',
    kit: {
      ...fighter,
      // ground-targeted areas (2026-10, user): fixed cells in front of Bai Long — every unit standing there is hit
      // (stacked units included), the VFX lands on the cell, never on a unit · multipliers = the class values
      // S1 [main][main] — the 2 cells straight ahead, 180 % both
      skill: {
        ...fighter.skill2, slot: 'skill', name: 'ทวนมังกรทะลวง', label: 'Dragon Thrust', range: 1,
        effects: [{ type: 'DAMAGE', area: 'FRONT_LINE_2', primary: 1.8 }], ai: { tier: 'NORMAL', minTargets: 1 },
      },
      // S2 the column in front (up / front / down), 170 % all
      skill2: {
        ...fighter.skill, slot: 'skill2', name: 'จันทร์กวาด', label: 'Sweeping Moon', range: 1,
        effects: [{ type: 'DAMAGE', area: 'FRONT_COLUMN_3', primary: 1.7 }], ai: { tier: 'HIGH_VALUE', minTargets: 1 },
      },
      // Ult: front cell 280 % (main), splash 140 % above / below it and one cell further — 3 strikes 25 / 30 / 45 %
      ult: {
        ...fighter.ult, name: 'ลำดับเก้ามังกร', label: 'Nine Dragon Sequence', range: 1,
        effects: [{ type: 'DAMAGE', area: 'FRONT_CROSS', primary: 2.8, secondary: 1.4 }], ai: { tier: 'NORMAL', minTargets: 1 },
        repeat: { count: 3, gap: 0.5, weights: [0.25, 0.3, 0.45], keepAfterKill: true },
      },
    },
  },
  // Mordrienne Vale (user 2026-10-26, Mage — Control / Debuff, existing Mage class ids / cooldowns / rank tables;
  // numbers provisional, no balance pass): Deep Emerald Curse. Identity = curses / hexes / slow + root / ATK + cast-speed
  // down / zone control rather than raw burst. Her spells hit Hex-Marked foes ×1.2 (`DAMAGE.bonusVsStatus`).
  mordrienne: {
    id: 'mordrienne', cls: 'mage', identity: 'Mage · Control / Debuff · Hex Mark · Slow / Root · ATK & Cast Speed Down · Curse Field',
    kit: {
      ...mage,
      // S1 Ashen Mark: one bolt from the wand at the current target → Hex Mark (8 s)
      skill: {
        ...mage.skill, name: 'ตราเถ้าธุลี', label: 'Ashen Mark', target: 'CURRENT', delivery: 'PROJECTILE',
        effects: [
          { type: 'DAMAGE', area: 'SINGLE', primary: 1.3, damageType: 'MAGIC', bonusVsStatus: { status: 'hex_mark', mul: 1.2 } },
          { type: 'APPLY_STATUS', status: 'hex_mark', to: 'HIT', duration: 8 },
        ],
        ai: { tier: 'NORMAL' },
      },
      // S2 Cinderbind Hex: strike 1 places the hex on the ground (2 × 2 around the cluster), twirl = charge, strike 2
      // activates it: AoE magic + Slow 3 s + Cinder Hex (ATK −15 %, cast speed −20 %, 4 s) · Hex-Marked foes are Rooted
      skill2: {
        ...mage.skill2, name: 'พันธนาการเถ้าถ่าน', label: 'Cinderbind Hex', target: 'CLUSTER', fallback: ['CURRENT'],
        delivery: 'INSTANT',
        effects: [
          { type: 'DAMAGE', area: 'SQUARE_2', primary: 1.0, secondary: 1.0, damageType: 'MAGIC',
            bonusVsStatus: { status: 'hex_mark', mul: 1.2 } },
          { type: 'APPLY_STATUS', status: 'root', to: 'HIT', duration: 1.5, when: { status: 'hex_mark', present: true } },
          { type: 'APPLY_STATUS', status: 'slow', to: 'HIT', duration: 3 },
          { type: 'APPLY_STATUS', status: 'cinder_hex', to: 'HIT', duration: 4 },
        ],
        ai: { tier: 'HIGH_VALUE', minTargets: 1, countArea: 'SQUARE_2' },
      },
      // Ult House of Ashes: draw the circle → raise to the sky → charge hold → slam → a curse field (3 × 3, 6 s).
      // Timeline Sync (user 2026-10-27): at the activation peak the field opens with its first pulse (initial magic
      // damage + Ash Curse: DEF −15 %, ATK −15 %, cast −20 %) + the Hex Mark bonus burst on already-marked foes,
      // then a pulse every 1 s (pulses 0…5 — the same 6 pulses as before, the first one moved to the opening)
      ult: {
        ...mage.ult, name: 'เรือนแห่งเถ้าธุลี', label: 'House of Ashes', target: 'CLUSTER', fallback: ['CURRENT'],
        delivery: 'INSTANT',
        effects: [
          { type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 1.2, secondary: 1.2, damageType: 'MAGIC',
            requireStatus: 'hex_mark' },
          { type: 'FIELD', field: {
            area: 'ADJACENT_8', duration: 6, interval: 1, pulseOnStart: true,
            effects: [
              { type: 'DAMAGE', area: 'ADJACENT_8', primary: 0.25, secondary: 0.25, damageType: 'MAGIC',
                bonusVsStatus: { status: 'hex_mark', mul: 1.2 } },
              { type: 'APPLY_STATUS', status: 'ash_curse', to: 'AREA', area: 'ADJACENT_8', duration: 1.1 },
            ],
          } },
        ],
        ai: { tier: 'HIGH_VALUE', minTargets: 1, countArea: 'ADJACENT_8' },
      },
    },
  },
  // Sylas Veyrn — The Dusk Reaver (user 2026-10-27): Archer class ids + cooldowns (rank tables apply), repeating
  // hand-crossbow · Dusk Mark makes the target take more from HIS shots (bonusVsStatus on every Sylas hit) and powers
  // the rest of the kit · provisional numbers (no balance pass yet)
  sylas: {
    id: 'sylas', cls: 'archer', identity: 'Ranged DPS · Hunter · Dusk Mark · Rapid Volley · Execution Shot',
    kit: {
      ...archer,
      attack: {
        ...archer.attack, name: 'ลูกดอกสนธยา', label: 'Dusk Shot',
        effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 1, bonusVsStatus: { status: 'dusk_mark', mul: 1.15 } }],
      },
      // S1 Dusk Mark: aim → short charge at the crossbow tip → one Dusk Bolt → the target carries Dusk Mark (8 s)
      skill: {
        ...archer.skill, name: 'ตราสนธยา', label: 'Dusk Mark', target: 'CURRENT', delivery: 'PROJECTILE', repeat: undefined,
        effects: [
          { type: 'DAMAGE', area: 'SINGLE', primary: 1.8, bonusVsStatus: { status: 'dusk_mark', mul: 1.15 } },
          { type: 'APPLY_STATUS', status: 'dusk_mark', to: 'HIT', duration: 8 },
        ],
        ai: { tier: 'NORMAL' },
      },
      // S2 Reaver Volley: three bolts on the clip's shots (two rapid bolts, then the Final Piercing Shot through the line
      // 1 × 3) · a Dusk-Marked target also takes the Marked Burst on the final bolt
      skill2: {
        ...archer.skill2, name: 'ห่าลูกดอกอสูร', label: 'Reaver Volley', target: 'CURRENT', fallback: ['NEAREST_ENEMY'],
        delivery: 'PROJECTILE',
        repeat: { count: 3, gap: 0.24, weights: [0.25, 0.25, 0.5] },
        effects: [
          { type: 'DAMAGE', area: 'SINGLE', primary: 2.0, bonusVsStatus: { status: 'dusk_mark', mul: 1.15 }, onHits: [0, 1] },
          { type: 'DAMAGE', area: 'LINE_3', primary: 2.0, secondary: 1.0, pierceDelays: [0.05, 0.08],
            bonusVsStatus: { status: 'dusk_mark', mul: 1.15 }, onHits: [2] },
          { type: 'DAMAGE', area: 'SINGLE', primary: 1.0, requireStatus: 'dusk_mark', onHits: [2] },
        ],
        ai: { tier: 'NORMAL' },
      },
      // Ult Nightfall Execution: lock the target (the player's focus → a Dusk-Marked foe → the weakest) → heavy charge →
      // one Execution Bolt → the vortex Impact Burst (small splash around it) · a Dusk-Marked target takes the
      // execution bonus
      ult: {
        ...archer.ult, name: 'ประหารรัตติกาล', label: 'Nightfall Execution', range: Infinity,
        target: 'FOCUS', fallback: ['MARKED', 'LOWEST_HP_ENEMY', 'CURRENT'], markStatus: 'dusk_mark',
        delivery: 'PROJECTILE',
        effects: [
          { type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 3.4, secondary: 0.8,
            bonusVsStatus: { status: 'dusk_mark', mul: 1.4 } },
        ],
        ai: { tier: 'NORMAL' },
      },
    },
  },
};

/** the kit a unit fights with: its hero's own kit, else its class kit */
export const kitOf = (heroId: string | undefined, cls: HeroClass): HeroKit =>
  (heroId && HERO_DEFINITIONS[heroId]?.kit) || CLASS_KITS[cls];

/** does this skill slot carry a dedicated interrupt? (UI: ⚡ badge, AUTO holds interrupt ultimates) */
export const kitInterrupts = (kit: HeroKit, slot: 'skill' | 'skill2' | 'ult'): boolean =>
  kit[slot].effects.some(e => e.type === 'INTERRUPT' || (e.type === 'DAMAGE' && !!e.interrupt));
