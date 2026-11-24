/**
 * Bag (Home → กระเป๋า, user 2026-11-24): read-only view of everything the player holds, split into category tabs.
 * Pure: builds slots from GameState, splits stacks at BAG_STACK_LIMIT, and the dev-only test seed.
 */
import { ITEMS } from '../data/economy';
import { EQUIPMENT_DEFS, RARITY_NAME, SELL_GOLD } from '../data/equipment';
import { GENERATED_ICONS } from '../data/generated-art';
import { HEROES } from '../data/heroes';
import { SUMMON_SEALS } from '../data/summon-seals';
import { ItemKind } from '../models/economy';
import { EquipmentInstance, Rarity } from '../models/equipment';
import { GameState } from '../models/game-state';
import { rollItem } from './equipment';

export const BAG_STACK_LIMIT = 999;

export type BagCategory = 'equipment' | 'materials' | 'summon';
export const BAG_TABS: { id: BagCategory; th: string; en: string }[] = [
  { id: 'equipment', th: 'อุปกรณ์', en: 'GEAR' },
  { id: 'materials', th: 'วัตถุดิบ', en: 'MATERIALS' },
  { id: 'summon', th: 'อัญเชิญ', en: 'SUMMON' },
];

/** exhaustive by ItemKind → adding a new kind fails to compile until it has a tab */
export const KIND_CATEGORY: Record<ItemKind, BagCategory> = {
  MATERIAL: 'equipment',
  EQUIPMENT_FRAGMENT: 'equipment',
  EXP_POTION: 'materials',
  BREAKTHROUGH_STONE: 'materials',
  BREAKTHROUGH_FRAGMENT: 'materials',
  SKILL_TOME: 'materials',
  SKILL_TOME_FRAGMENT: 'materials',
  HERO_MEMORY: 'materials',
  SUMMON_SEAL: 'summon',
};

/** where "ใช้" goes: a hero page tab (first team hero) or a fixed route */
export type BagUse = { heroTab: 'growth' | 'skills' | 'star' } | { route: string };
const KIND_USE: Record<ItemKind, BagUse> = {
  MATERIAL: { route: '/forge?tab=enhance' },
  EQUIPMENT_FRAGMENT: { route: '/forge' },
  EXP_POTION: { heroTab: 'growth' },
  BREAKTHROUGH_STONE: { heroTab: 'growth' },
  BREAKTHROUGH_FRAGMENT: { heroTab: 'growth' },
  SKILL_TOME: { heroTab: 'skills' },
  SKILL_TOME_FRAGMENT: { heroTab: 'skills' },
  HERO_MEMORY: { heroTab: 'star' },
  SUMMON_SEAL: { route: '/gacha' },
};

const ROMAN = ['', 'I', 'II', 'III'];
const FRAG_TIER: Record<string, string> = { basic: 'ธรรมดา', rare: 'หายาก', elite: 'ชั้นยอด', epic: 'มหากาพย์' };
const EQUIP_TH: Record<string, string> = {
  heavy_blade: 'ดาบหนัก', twin_daggers: 'มีดคู่', longbow: 'ธนูยาว', focus_staff: 'คทาสมาธิ', guard_armor: 'เกราะพิทักษ์', trinket: 'เครื่องราง',
};
const KIND_NOTE: Record<ItemKind, string> = {
  MATERIAL: 'ใช้ตีบวกอุปกรณ์ที่โรงตีเหล็ก',
  EQUIPMENT_FRAGMENT: 'ใช้คราฟต์อุปกรณ์ที่โรงตีเหล็ก',
  EXP_POTION: 'เพิ่ม EXP ให้ฮีโร่',
  BREAKTHROUGH_STONE: 'ใช้ทะลวงขีดจำกัดเลเวลของฮีโร่',
  BREAKTHROUGH_FRAGMENT: 'ครบ 10 ชิ้นรวมเป็นหินทะลวง 1 ก้อน',
  SKILL_TOME: 'ใช้อัปแรงก์สกิลของฮีโร่',
  SKILL_TOME_FRAGMENT: 'ครบ 10 ชิ้นรวมเป็นตำราสกิล 1 เล่ม',
  HERO_MEMORY: 'ใช้อัปดาวฮีโร่ตัวใดก็ได้',
  SUMMON_SEAL: 'ใช้อัญเชิญฮีโร่ที่วิหารอัญเชิญ',
};

/** Thai display name of an inventory item id (falls back to the registry name) */
export function itemNameTh(id: string): string {
  const seal = Object.values(SUMMON_SEALS).find(s => s.id === id);
  if (seal) return seal.name;
  const tier = (re: RegExp) => ROMAN[+(id.match(re)?.[1] ?? 0)] ?? '';
  if (id.startsWith('exp_potion_')) return 'ยาฝึกฝน' + ({ s: 'ขนาดเล็ก', m: 'ขนาดกลาง', l: 'ขนาดใหญ่' }[id.slice(-1)] ?? '');
  if (id.startsWith('bt_stone_')) return 'หินทะลวงขีดจำกัด ' + tier(/(\d)$/);
  if (id.startsWith('bt_fragment_')) return 'เศษหินทะลวง ' + tier(/(\d)$/);
  if (id.startsWith('skill_tome_frag_')) return 'เศษตำราสกิล ' + tier(/(\d)$/);
  if (id.startsWith('skill_tome_')) return 'ตำราสกิล ' + tier(/(\d)$/);
  if (id.startsWith('equip_frag_')) return 'เศษอุปกรณ์' + (FRAG_TIER[id.slice(11)] ?? '');
  if (id === 'enhancement_ore') return 'แร่ตีบวก';
  if (id === 'universal_memory') return 'ความทรงจำสากล';
  return ITEMS[id]?.name ?? id;
}

export interface BagSlot {
  /** unique per slot (stacks of one id get #index) */
  key: string;
  category: BagCategory;
  type: 'item' | 'equipment' | 'memory';
  /** item id · hero template id (memory) · equipment definition id */
  id: string;
  name: string;
  note: string;
  count: number;
  /** all of this item the player holds (count is only this slot's share) */
  total: number;
  icon?: string;
  rarity?: Rarity;
  instance?: EquipmentInstance;
  use: BagUse;
  /** gold per item, null = cannot be sold */
  sellGold: number | null;
  sellNote?: string;
}

/** 2500 → [999, 999, 502] · 0 → [] */
export function splitStacks(count: number, limit = BAG_STACK_LIMIT): number[] {
  const n = Math.max(0, Math.floor(count));
  const out: number[] = [];
  for (let left = n; left > 0; left -= limit) out.push(Math.min(limit, left));
  return out;
}

const NO_SELL = 'ยังขายไม่ได้ — ยังไม่มีราคาขายในเกม';

function itemSlots(id: string, count: number, base: Omit<BagSlot, 'key' | 'count' | 'total'>): BagSlot[] {
  return splitStacks(count).map((c, i) => ({ ...base, key: `${base.type}:${id}#${i}`, count: c, total: count }));
}

/** every slot the bag shows, in registry order (ITEMS → hero memory → equipment, unknown ids last) */
export function bagSlots(s: GameState): BagSlot[] {
  const slots: BagSlot[] = [];
  const inv = s.inventory ?? {};
  const known = Object.keys(ITEMS);
  const extra = Object.keys(inv).filter(id => !ITEMS[id]).sort();
  for (const id of [...known, ...extra]) {
    const count = inv[id] ?? 0;
    if (count <= 0) continue;
    const kind = ITEMS[id]?.kind;
    slots.push(...itemSlots(id, count, {
      category: kind ? KIND_CATEGORY[kind] : 'materials', type: 'item', id, name: itemNameTh(id),
      note: kind ? KIND_NOTE[kind] : '', icon: Object.values(SUMMON_SEALS).find(x => x.id === id)?.icon ?? GENERATED_ICONS[id],
      use: kind ? KIND_USE[kind] : { route: '/heroes' }, sellGold: null, sellNote: NO_SELL,
    }));
  }
  for (const h of HEROES) {
    const count = s.heroMemory?.[h.id] ?? 0;
    if (count <= 0) continue;
    slots.push(...itemSlots(h.id, count, {
      category: 'materials', type: 'memory', id: h.id, name: `ความทรงจำ · ${h.name}`, note: 'ใช้อัปดาวของฮีโร่ตัวนี้',
      use: { heroTab: 'star' }, sellGold: null, sellNote: NO_SELL,
    }));
  }
  for (const it of s.equipment ?? []) {
    const def = EQUIPMENT_DEFS[it.definitionId];
    slots.push({
      key: `equipment:${it.instanceId}`, category: 'equipment', type: 'equipment', id: it.definitionId,
      name: `${EQUIP_TH[it.definitionId] ?? def?.name ?? it.definitionId}${it.upgradeLevel ? ' +' + it.upgradeLevel : ''}`,
      note: `${RARITY_NAME[it.rarity]} · ${def?.slot ?? ''}`, count: 1, total: 1, rarity: it.rarity, instance: it,
      use: { route: '/armory' }, sellGold: it.locked ? null : SELL_GOLD[it.rarity], sellNote: it.locked ? 'ล็อกอยู่ — ปลดล็อกที่คลังอุปกรณ์ก่อนขาย' : undefined,
    });
  }
  return slots;
}

/** constant-rng roll so the seeded gear is identical every time */
const SEED_RNG = () => 0.5;

/**
 * DEV/TEST only (DEV_FLAGS.bagTestSeed): one of every inventory item id + one RARE item per equipment base.
 * Only runs from the explicit button in the bag; never on load.
 */
export function seedBag(s: GameState): GameState {
  const inventory = { ...s.inventory };
  for (const id of Object.keys(ITEMS)) inventory[id] = (inventory[id] ?? 0) + 1;
  let next = s.nextItemId;
  const gear = Object.keys(EQUIPMENT_DEFS).map(def => rollItem(def, 'RARE', SEED_RNG, next++));
  return { ...s, inventory, equipment: [...s.equipment, ...gear], nextItemId: next };
}
