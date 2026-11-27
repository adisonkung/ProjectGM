import { EquipmentDefinition, EquipmentTier, EquipStat, GearSet, OrdinarySlot, Rarity } from '../models/equipment';

export const ORDINARY_SLOTS: readonly OrdinarySlot[] = ['WEAPON', 'HELMET', 'ARMOR', 'NECKLACE', 'RING'];
export const PATCH_RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
export const EQUIPMENT_TIERS = [1, 2, 3, 4, 5] as const;
export const SLOT_NAMES = { WEAPON: 'อาวุธ', HELMET: 'หมวก', ARMOR: 'เกราะ', NECKLACE: 'สร้อย', RING: 'แหวน', ACCESSORY: 'เครื่องประดับ' } as const;
export const SLOT_ICONS = { WEAPON: 'sword', HELMET: 'shield', ARMOR: 'shield', NECKLACE: 'gem', RING: 'gem', ACCESSORY: 'gem' } as const;
type PatchRarity = typeof PATCH_RARITIES[number];

/** Draft tuning. Reuses the existing materials, ore and gold economy while ECO is pending. */
export const TIER_CONFIG = {
  1: { name: 'Iron', material: 'equip_frag_basic', floor: 0, scale: 1, fragments: 25, gold: 300, craft: [60, 30, 9, 1, 0] },
  2: { name: 'Refined Iron', material: 'equip_frag_refined_iron', floor: 2, scale: 1.2, fragments: 32, gold: 500, craft: [35, 40, 20, 4, 1] },
  3: { name: 'Steel', material: 'equip_frag_rare', floor: 4, scale: 1.45, fragments: 40, gold: 800, craft: [15, 30, 40, 13, 2] },
  4: { name: 'Tempered Steel', material: 'equip_frag_elite', floor: 6, scale: 1.75, fragments: 70, gold: 2000, craft: [0, 20, 50, 23, 7] },
  5: { name: 'Ancient Forge', material: 'equip_frag_epic', floor: 8, scale: 2.1, fragments: 110, gold: 4000, craft: [0, 0, 55, 35, 10] },
} satisfies Record<EquipmentTier, { name: string; material: string; floor: number; scale: number; fragments: number; gold: number; craft: number[] }>;

export const SUBSTAT_MILESTONES: Record<PatchRarity, readonly number[]> = {
  COMMON: [], UNCOMMON: [10], RARE: [6, 10], EPIC: [4, 6, 8, 10], LEGENDARY: [2, 4, 6, 8, 10],
};
export const SUBSTAT_COUNT: Record<PatchRarity, number> = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4 };
export const GEAR_SETS: Record<GearSet, { name: string; stat: EquipStat; bonuses: readonly number[] }> = {
  assault: { name: 'Assault', stat: 'atkPct', bonuses: [.08, .12, .22] },
  vitality: { name: 'Vitality', stat: 'hpPct', bonuses: [.08, .12, .22] },
  guardian: { name: 'Guardian', stat: 'defPct', bonuses: [.08, .12, .22] },
  precision: { name: 'Precision', stat: 'critChance', bonuses: [.05, .08, .15] },
  destruction: { name: 'Destruction', stat: 'critDamage', bonuses: [.10, .18, .30] },
};
export const SET_IDS = Object.keys(GEAR_SETS) as GearSet[];

export const PATCH_STATS = ['atkFlat', 'atkPct', 'hpFlat', 'hpPct', 'defFlat', 'defPct', 'critChance', 'critDamage'] as const;
type PatchStat = typeof PATCH_STATS[number];
/** Provisional T1 main values and independent initial/upgrade roll ranges. */
export const PATCH_MAIN: Record<PatchStat, number> = { atkFlat: 5, atkPct: .035, hpFlat: 28, hpPct: .04, defFlat: 3, defPct: .035, critChance: .02, critDamage: .04 };
export const PATCH_SUBSTAT_RANGE: Record<PatchStat, readonly [number, number]> = {
  atkFlat: [1, 3], atkPct: [.006, .014], hpFlat: [5, 16], hpPct: [.008, .018],
  defFlat: [1, 2], defPct: [.006, .014], critChance: [.004, .010], critDamage: [.008, .018],
};

export const PATCH_BASE: Record<OrdinarySlot, string> = {
  WEAPON: 'forge_blade', HELMET: 'forge_helmet', ARMOR: 'forge_armor', NECKLACE: 'forge_necklace', RING: 'forge_ring',
};
const MAIN_BY_SLOT: Record<OrdinarySlot, PatchStat[]> = {
  WEAPON: ['atkFlat'], HELMET: ['hpFlat'], ARMOR: ['defFlat'],
  NECKLACE: ['atkPct', 'hpPct', 'defPct', 'critChance', 'critDamage'],
  RING: ['atkPct', 'hpPct', 'defPct'],
};
export const PATCH_DEFS: EquipmentDefinition[] = ORDINARY_SLOTS.map(slot => ({
  id: PATCH_BASE[slot], name: SLOT_NAMES[slot], slot, mainStats: MAIN_BY_SLOT[slot], secondaryPool: [...PATCH_STATS], affixPool: [],
}));
export const huntId = (tier: EquipmentTier) => 'hunt_' + tier;
export const setThreshold = (pieces: number) => pieces >= 5 ? 5 : pieces >= 3 ? 3 : pieces >= 2 ? 2 : 0;
