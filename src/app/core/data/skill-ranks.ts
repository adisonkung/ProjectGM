/**
 * Patch 1 Skill Upgrade data (spec: claude/patch1-skill-upgrade-spec.md) — every number here is tuning data.
 *
 * Rank 1 = the authored SkillDefinition (core/data/hero-skills.ts). Tables below give the TOTAL value at ranks 1–5
 * (index 0 = rank 1, which must equal the base skill). R1→R5: damage / heal ≈ +20–35 %, defensive ≈ +20–30 %
 * (tank tables are explicit), utility skills gain cooldown / Break / duration. Tables are keyed by skill id, so the
 * class-default kits (1–4★ heroes) use the same tables as the 5★ hero that owns the kit (Aurel ↔ tank, …).
 */
import { SkillKind } from '../models/progression';
import { HeroSkillPriority, SkillRankDefinition, SkillUpgradeEffect } from '../models/skill-rank';
import { StatusModifiers } from '../models/combat';
import { HeroClass } from '../models/hero';
import { ItemStack } from '../models/economy';

export const MAX_SKILL_RANK = 5;

/** rank cap by breakthrough tier (configurable): before BT I rank 2, BT I–II rank 4, BT III rank 5 */
export const SKILL_RANK_CAP_BY_TIER = [2, 4, 4, 5];

/** limits every table must respect (tests) and the resolver enforces */
export const SKILL_RANK_LIMITS = {
  /** rank cooldown reduction per skill (gear CDR ≤ 15 % multiplies on top) */
  maxRankCdr: 0.1,
  /** rank + gear cooldown reduction together */
  maxTotalCdr: 0.22,
  /** one skill's final Break (base + rank + gear) stays below the 100 a Forest-Oblivion-type cast needs */
  maxSingleBreak: 95,
  /** control caps (seconds) */
  ccCap: { root: 2, taunted: 3.5, taunt_guard: 3.5, stun: 1 } as Record<string, number>,
  /** R5 vs R1 power band: damage / heal ≤ ×1.35, shields ≤ +0.1 absolute */
  maxPowerMul: 1.35,
};

/** requirements + cost to REACH rank n (index = target rank). Gold rises steeply; Tome III only for R5. */
export const SKILL_RANK_COSTS: Record<number, { level: number; tier: number; items: ItemStack[]; gold: number }> = {
  2: { level: 3, tier: 0, items: [{ itemId: 'skill_tome_1', count: 2 }], gold: 300 },
  3: { level: 6, tier: 1, items: [{ itemId: 'skill_tome_1', count: 4 }, { itemId: 'skill_tome_2', count: 1 }], gold: 1200 },
  4: { level: 8, tier: 1, items: [{ itemId: 'skill_tome_2', count: 4 }], gold: 3500 },
  5: { level: 10, tier: 3, items: [{ itemId: 'skill_tome_3', count: 5 }], gold: 8000 },
};

/** optional, deliberately inefficient: 5 lower tomes → 1 higher tome */
export const TOME_CONVERSION: { from: string; to: string; ratio: number }[] = [
  { from: 'skill_tome_1', to: 'skill_tome_2', ratio: 5 },
  { from: 'skill_tome_2', to: 'skill_tome_3', ratio: 5 },
];

// ------------------------------------------------------------------ table authoring

type RV = [number, number, number, number, number];
interface Tracks {
  damage?: RV;
  heal?: RV;
  shield?: RV;
  break?: RV;
  cooldown?: RV;
  duration?: Record<string, RV>;
  potency?: Record<string, RV>;
  modifiers?: Record<string, [Partial<StatusModifiers>, Partial<StatusModifiers>, Partial<StatusModifiers>, Partial<StatusModifiers>, Partial<StatusModifiers>]>;
  execute?: [[number, number], [number, number], [number, number], [number, number], [number, number]];
  reviveHp?: RV;
}

/** tracks → SkillRankDefinition[1..5]; a rank lists only values that differ from rank 1 */
function ranks(skillId: string, t: Tracks): SkillRankDefinition[] {
  return [1, 2, 3, 4, 5].map(rank => {
    const i = rank - 1;
    const fx: SkillUpgradeEffect[] = [];
    const diff = (v?: RV) => !!v && v[i] !== v[0];
    if (diff(t.damage)) fx.push({ type: 'DAMAGE', mul: t.damage![i] });
    if (diff(t.heal)) fx.push({ type: 'HEAL', mul: t.heal![i] });
    if (diff(t.shield)) fx.push({ type: 'SHIELD', add: t.shield![i] });
    if (diff(t.break)) fx.push({ type: 'BREAK', value: t.break![i] });
    if (diff(t.cooldown)) fx.push({ type: 'COOLDOWN', value: t.cooldown![i] });
    for (const [status, v] of Object.entries(t.duration ?? {})) if (diff(v)) fx.push({ type: 'STATUS_DURATION', status, value: v[i] });
    for (const [status, v] of Object.entries(t.potency ?? {})) if (diff(v)) fx.push({ type: 'STATUS_POTENCY', status, mul: v[i] });
    for (const [status, v] of Object.entries(t.modifiers ?? {})) {
      if (JSON.stringify(v[i]) !== JSON.stringify(v[0])) fx.push({ type: 'STATUS_MODIFIER', status, modifiers: v[i] });
    }
    if (t.execute && JSON.stringify(t.execute[i]) !== JSON.stringify(t.execute[0])) fx.push({ type: 'EXECUTE', hpBelow: t.execute[i][0], mul: t.execute[i][1] });
    if (diff(t.reviveHp)) fx.push({ type: 'REVIVE_HP', value: t.reviveHp![i] });
    const c = SKILL_RANK_COSTS[rank];
    return {
      skillId, rank, upgradeEffects: fx,
      requiredMaterials: c ? c.items.map(x => ({ ...x })) : [],
      requiredGold: c?.gold ?? 0,
      requiredHeroLevel: c?.level ?? 1,
      requiredBreakthroughTier: c?.tier ?? 0,
    };
  });
}

// damage curves (×R1): standard DPS +28 %, big ults +30 %, secondary damage +20–25 %
const DPS: RV = [1, 1.07, 1.14, 1.21, 1.28];
const ULT: RV = [1, 1.07, 1.14, 1.22, 1.3];
const MID: RV = [1, 1.06, 1.12, 1.19, 1.25];
const LOW: RV = [1, 1.05, 1.1, 1.15, 1.2];
const tg = (dr: number) => ({ damageTakenMultiplier: +(1 - dr).toFixed(2) });

export const SKILL_RANK_TABLES: Record<string, SkillRankDefinition[]> = {
  // ---- TANK (Aurel / Morgan / class tank): utility + defence, Break is the core
  provoke: ranks('provoke', {
    damage: [1, 1.1, 1.1, 1.15, 1.15],
    modifiers: { taunt_guard: [tg(0.4), tg(0.4), tg(0.43), tg(0.43), tg(0.45)] },
    duration: { taunted: [3, 3, 3, 3.5, 3.5], taunt_guard: [3, 3, 3, 3.5, 3.5] },
  }),
  shield_charge: ranks('shield_charge', {
    damage: [1, 1.02, 1.04, 1.053, 1.067], // 150 → 153 → 156 → 158 → 160 %
    break: [60, 60, 65, 65, 70],
    cooldown: [12, 12, 12, 11.5, 11.5],
  }),
  holy_fortress: ranks('holy_fortress', {
    shield: [0, 0.01, 0.01, 0.02, 0.02],
    break: [70, 70, 72, 72, 75],
  }),

  // ---- FIGHTER — Jin: formation cleave
  spinning_sword: ranks('spinning_sword', { damage: [1, 1.07, 1.14, 1.21, 1.3] }),
  piercing_thrust: ranks('piercing_thrust', { damage: MID }),
  dragon_execution: ranks('dragon_execution', { damage: ULT }),

  // ---- FIGHTER — Ragnar: bruiser (damage + a little uptime)
  axe_storm: ranks('axe_storm', { damage: [1, 1.06, 1.12, 1.18, 1.24], duration: { axe_frenzy: [3, 3, 3.5, 3.5, 4] } }),
  blood_rage: ranks('blood_rage', { damage: LOW, duration: { blood_rage: [6, 6, 6.5, 7, 7] } }),
  lava_axe_crash: ranks('lava_axe_crash', { damage: DPS }),

  // ---- ASSASSIN — Shade: priority target, poison modest
  shadow_assault: ranks('shadow_assault', { damage: MID }),
  poison_smoke: ranks('poison_smoke', { damage: LOW, potency: { poison: [1, 1, 1.1, 1.1, 1.2] } }),
  shadow_execution: ranks('shadow_execution', { damage: DPS }),

  // ---- ASSASSIN — Nox: dive, execute slight
  vanish_into_shadow: ranks('vanish_into_shadow', { damage: [1, 1.06, 1.12, 1.18, 1.24], duration: { shadow_evasion: [2, 2, 2.25, 2.25, 2.5] } }),
  ghost_dash: ranks('ghost_dash', { damage: [1, 1.06, 1.12, 1.18, 1.24] }),
  soul_reap: ranks('soul_reap', {
    damage: [1, 1.06, 1.12, 1.18, 1.24],
    execute: [[0.35, 1.35], [0.35, 1.35], [0.38, 1.35], [0.38, 1.35], [0.4, 1.4]],
  }),

  // ---- ARCHER — Sylvie: Arrow Rain Break + cooldown, ult Break modest
  rapid_shot: ranks('rapid_shot', { damage: MID }),
  arrow_rain: ranks('arrow_rain', {
    damage: [1, 1, 1, 1.08, 1.08],
    cooldown: [11, 10.5, 10.5, 10.5, 10],
    break: [40, 40, 45, 45, 50],
  }),
  heavenly_arrow_rain: ranks('heavenly_arrow_rain', { damage: [1, 1.06, 1.12, 1.18, 1.24], break: [60, 60, 63, 63, 65] }),

  // ---- MAGE — Velma: damage, root slight (never an interrupt)
  soul_curse: ranks('soul_curse', { damage: DPS }),
  bone_hand: ranks('bone_hand', { damage: LOW, duration: { root: [1.5, 1.5, 1.65, 1.65, 1.8] } }),
  soul_beam: ranks('soul_beam', { damage: ULT }),

  // ---- HEALER — Lumina: heals; resurrection limit stays 1 per stage
  prayer: ranks('prayer', { heal: DPS }),
  holy_blessing: ranks('holy_blessing', { heal: ULT, cooldown: [15, 15, 15, 14.25, 14.25] }),
  holy_resurrection: ranks('holy_resurrection', { heal: [1, 1.06, 1.12, 1.18, 1.24], reviveHp: [0.4, 0.4, 0.45, 0.45, 0.5] }),

  // ---- HEALER — Corvin: HoT / poison modest
  healing_mist: ranks('healing_mist', { heal: [1, 1.06, 1.12, 1.18, 1.24], potency: { healing_mist: [1, 1, 1.1, 1.1, 1.2] } }),
  poison_cloud: ranks('poison_cloud', { damage: LOW, potency: { poison: [1, 1, 1.1, 1.1, 1.2] } }),
  spirit_wings: ranks('spirit_wings', { heal: [1, 1.06, 1.12, 1.18, 1.24], reviveHp: [0.4, 0.4, 0.45, 0.45, 0.5] }),
};

/** which slot each hero upgrades first (simulation profiles; also the UI "recommended" badge) */
export const SKILL_PRIORITY_BY_CLASS: Record<HeroClass, HeroSkillPriority> = {
  tank: { critical: 'skill2', important: 'ult', secondary: 'skill' },
  fighter: { critical: 'skill', important: 'ult', secondary: 'skill2' },
  assassin: { critical: 'ult', important: 'skill', secondary: 'skill2' },
  archer: { critical: 'skill2', important: 'ult', secondary: 'skill' },
  mage: { critical: 'skill', important: 'ult', secondary: 'skill2' },
  healer: { critical: 'skill2', important: 'skill', secondary: 'ult' },
};
export const SKILL_PRIORITY_BY_HERO: Record<string, HeroSkillPriority> = {
};

/**
 * Skill profiles (ranks by priority): S0 all 1 · S1 critical 2 · S2 critical 3 / important 2 ·
 * S3 critical 4 / important 3 / secondary 2 · S4 critical 5 / important 4 / secondary 3 · S5 all 5.
 */
export const SKILL_PROFILES: Record<string, Record<'critical' | 'important' | 'secondary', number>> = {
  S0: { critical: 1, important: 1, secondary: 1 },
  S1: { critical: 2, important: 1, secondary: 1 },
  S2: { critical: 3, important: 2, secondary: 1 },
  S3: { critical: 4, important: 3, secondary: 2 },
  S4: { critical: 5, important: 4, secondary: 3 },
  S5: { critical: 5, important: 5, secondary: 5 },
};
export type SkillProfileId = keyof typeof SKILL_PROFILES;

export const SKILL_SLOTS: SkillKind[] = ['skill', 'skill2', 'ult'];
