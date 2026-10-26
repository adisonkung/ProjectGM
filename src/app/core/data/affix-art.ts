import { AFFIXES, FLAT_STATS, RARITY_RULES } from './equipment';
import { Rarity } from '../models/equipment';

/** Presentation atlas cells for existing AFFIXES IDs; labels and effects come from equipment registry. */
export const AFFIX_ART: Readonly<Record<string, { sheet: string; col: number; row: number }>> = {
  "bleed_guard": {
    "sheet": "/ui/affixes/wards.webp",
    "col": 0,
    "row": 0
  },
  "poison_ward": {
    "sheet": "/ui/affixes/wards.webp",
    "col": 1,
    "row": 0
  },
  "rootbreaker": {
    "sheet": "/ui/affixes/wards.webp",
    "col": 2,
    "row": 0
  },
  "guardian": {
    "sheet": "/ui/affixes/wards.webp",
    "col": 0,
    "row": 1
  },
  "medic": {
    "sheet": "/ui/affixes/wards.webp",
    "col": 1,
    "row": 1
  },
  "backline_guard": {
    "sheet": "/ui/affixes/wards.webp",
    "col": 2,
    "row": 1
  },
  "bulwark": {
    "sheet": "/ui/affixes/wards.webp",
    "col": 0,
    "row": 2
  },
  "mist_hunter": {
    "sheet": "/ui/affixes/offense.webp",
    "col": 0,
    "row": 0
  },
  "breaker": {
    "sheet": "/ui/affixes/offense.webp",
    "col": 1,
    "row": 0
  },
  "execution": {
    "sheet": "/ui/affixes/offense.webp",
    "col": 2,
    "row": 0
  },
  "focus": {
    "sheet": "/ui/affixes/offense.webp",
    "col": 0,
    "row": 1
  },
  "keen_eye": {
    "sheet": "/ui/affixes/offense.webp",
    "col": 1,
    "row": 1
  },
  "mender": {
    "sheet": "/ui/affixes/offense.webp",
    "col": 2,
    "row": 1
  }
};

/** Display the same rarity-scaled value used by itemLines, preserving conditional thresholds. */
export function equipmentAffixLabel(id: string | undefined, rarity: Rarity = 'RARE'): string {
  const a = id ? AFFIXES[id] : undefined;
  if (!a) return '';
  const value = a.effect.value * RARITY_RULES[rarity].affixScale;
  const shown = FLAT_STATS.includes(a.effect.stat) ? Math.round(value) : Number((value * 100).toFixed(2));
  return a.name + ' — ' + a.description.replace(/\d+(?:\.\d+)?/, String(shown));
}
