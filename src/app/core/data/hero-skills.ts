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
  // 2026-10 remodel: Bai Long is the only hero (the template the remodelled roster follows) — the old roster was removed
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
        // emergency heal (class numbers) + the newest debuff washed off + Qi Guard (12 % of her max HP, 4 s)
        effects: [
          { type: 'HEAL', area: 'PRIMARY', atk: 2.2, maxHpPct: 0.1 },
          { type: 'CLEANSE', to: 'PRIMARY', count: 1 },
          { type: 'SHIELD', to: 'PRIMARY', selfPct: 0.12, allyPct: 0.12, duration: 4 },
        ],
      },
      ult: {
        ...healer.ult, name: 'พิธีคืนวสันต์', label: 'Returning Spring Rite',
        effects: [...healer.ult.effects.slice(0, 1), { type: 'CLEANSE', to: 'ALL_ALLIES' }, ...healer.ult.effects.slice(1)],
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
};

/** the kit a unit fights with: its hero's own kit, else its class kit */
export const kitOf = (heroId: string | undefined, cls: HeroClass): HeroKit =>
  (heroId && HERO_DEFINITIONS[heroId]?.kit) || CLASS_KITS[cls];

/** does this skill slot carry a dedicated interrupt? (UI: ⚡ badge, AUTO holds interrupt ultimates) */
export const kitInterrupts = (kit: HeroKit, slot: 'skill' | 'skill2' | 'ult'): boolean =>
  kit[slot].effects.some(e => e.type === 'INTERRUPT' || (e.type === 'DAMAGE' && !!e.interrupt));
