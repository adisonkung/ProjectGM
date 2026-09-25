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

// ------------------------------------------------------------------ 5★ heroes

const rename = (k: HeroKit, names: [string, string, string]): HeroKit => ({
  ...k,
  skill: { ...k.skill, name: names[0] },
  skill2: { ...k.skill2, name: names[1] },
  ult: { ...k.ult, name: names[2] },
});

export const HERO_DEFINITIONS: Record<string, HeroDefinition> = {
  aurel: { id: 'aurel', cls: 'tank', identity: 'Tank · Taunt · Shield · Close-range Interrupt', kit: tank },
  morgan: {
    id: 'morgan', cls: 'tank', identity: 'Tank · Taunt · Shield · Close-range Interrupt (Aurel mechanics, dark visuals)',
    kit: rename(tank, ['ป้อมปราการมืด', 'โล่กระแทก', 'ระเบิดโล่ทมิฬ']),
  },
  jin: { id: 'jin', cls: 'fighter', identity: 'Formation Cleave · Multi-target Melee DPS', kit: fighter },
  ragnar: {
    id: 'ragnar', cls: 'fighter', identity: 'Bruiser · Frontline Pressure · Self Rampage',
    kit: {
      attack: meleeAttack,
      skill: {
        id: 'axe_storm', name: 'พายุขวาน', label: 'Axe Storm', slot: 'skill', cooldown: 5, target: 'CURRENT',
        effects: [
          { type: 'DAMAGE', area: 'FRONT_ARC', center: 'SELF', primary: 1.5, secondary: 1.5 },
          { type: 'APPLY_STATUS', status: 'axe_frenzy', to: 'SELF', minHits: 2 },
        ],
        ai: { tier: 'NORMAL' },
      },
      skill2: {
        id: 'blood_rage', name: 'โทสะเลือด', label: 'Blood Rage', slot: 'skill2', cooldown: 10, target: 'CURRENT',
        effects: [
          { type: 'DAMAGE', area: 'SINGLE', primary: 1.5 },
          { type: 'APPLY_STATUS', status: 'blood_rage', to: 'SELF' },
        ],
        ai: { tier: 'NORMAL' },
      },
      ult: {
        id: 'lava_axe_crash', name: 'ขวานถล่มลาวา', label: 'Lava Axe Crash', slot: 'ult', range: 2, target: 'NEAREST_ENEMY',
        effects: [{ type: 'DAMAGE', area: 'LINE_3', primary: 2.4, secondary: 1.6 }],
        ai: { tier: 'NORMAL' },
      },
    },
  },
  shade: { id: 'shade', cls: 'assassin', identity: 'Priority Target · Poison · Guaranteed-Crit Execution', kit: assassin },
  nox: {
    id: 'nox', cls: 'assassin', identity: 'Backline Dive · Mobility · Low-HP Execution',
    kit: {
      attack: meleeAttack,
      skill: {
        id: 'vanish_into_shadow', name: 'หายวับในเงา', label: 'Vanish into Shadow', slot: 'skill', cooldown: 6, range: Infinity,
        target: 'FARTHEST_BACKROW', fallback: ['LOWEST_HP_ENEMY'], movement: { type: 'BLINK_BEHIND' },
        effects: [
          { type: 'DAMAGE', area: 'SINGLE', primary: 1.8 },
          { type: 'APPLY_STATUS', status: 'shadow_evasion', to: 'SELF' },
        ],
        ai: { tier: 'NORMAL' },
      },
      skill2: {
        id: 'ghost_dash', name: 'พุ่งผี', label: 'Ghost Dash', slot: 'skill2', cooldown: 12, target: 'CURRENT',
        movement: { type: 'DASH_THROUGH' },
        effects: [{ type: 'DAMAGE', area: 'LINE_2', primary: 1.7, secondary: 1.2 }],
        ai: { tier: 'NORMAL' },
      },
      ult: {
        id: 'soul_reap', name: 'เก็บเกี่ยววิญญาณ', label: 'Soul Reap', slot: 'ult', range: 4, target: 'LOWEST_HP_ENEMY',
        movement: { type: 'BLINK_BEHIND' },
        effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 3.2, executeBonus: { hpBelow: 0.35, mul: 1.35 } }],
        ai: { tier: 'NORMAL' },
      },
    },
  },
  sylvie: { id: 'sylvie', cls: 'archer', identity: 'Physical Ranged DPS · Projectiles · Long-range Interrupt', kit: archer },
  velma: { id: 'velma', cls: 'mage', identity: 'Magic AoE · Root / Movement Control · Burst', kit: mage },
  lumina: { id: 'lumina', cls: 'healer', identity: 'Burst Healing · Emergency Healing · Resurrection', kit: healer },
  corvin: {
    id: 'corvin', cls: 'healer', identity: 'Healing-over-Time · Poison Support · Resurrection',
    kit: {
      ...healer,
      skill: {
        id: 'healing_mist', name: 'หมอกเยียวยา', label: 'Healing Mist', slot: 'skill', cooldown: 8, target: 'SELF',
        effects: [
          { type: 'HEAL', area: 'RADIUS_2', center: 'SELF', atk: 0.7 },
          { type: 'APPLY_STATUS', status: 'healing_mist', to: 'AREA', area: 'RADIUS_2', center: 'SELF', team: 'ALLY' },
        ],
        // high priority when ≥ 2 allies are below 55%; also the emergency heal (skill 2 is offensive)
        ai: { tier: 'HEAL', allyHpBelow: 0.55, alliesBelowCount: 2, emergencyHpBelow: 0.35, countArea: 'RADIUS_2' },
      },
      skill2: {
        id: 'poison_cloud', name: 'เมฆพิษ', label: 'Poison Cloud', slot: 'skill2', cooldown: 15, target: 'CURRENT',
        effects: [
          { type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 1.1, secondary: 1.1, damageType: 'MAGIC' },
          { type: 'APPLY_STATUS', status: 'poison', to: 'HIT' },
        ],
        ai: { tier: 'NORMAL' },
      },
      ult: resurrection('spirit_wings', 'ปีกวิญญาณคืนชีพ', 'Spirit Wings Resurrection'),
    },
  },
};

/** the kit a unit fights with: its hero's own kit, else its class kit */
export const kitOf = (heroId: string | undefined, cls: HeroClass): HeroKit =>
  (heroId && HERO_DEFINITIONS[heroId]?.kit) || CLASS_KITS[cls];

/** does this skill slot carry a dedicated interrupt? (UI: ⚡ badge, AUTO holds interrupt ultimates) */
export const kitInterrupts = (kit: HeroKit, slot: 'skill' | 'skill2' | 'ult'): boolean =>
  kit[slot].effects.some(e => e.type === 'INTERRUPT' || (e.type === 'DAMAGE' && !!e.interrupt));
