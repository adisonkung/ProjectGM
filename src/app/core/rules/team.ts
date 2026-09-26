import { LANES, SIDE_DEPTH } from '../../battle/engine/grid';
import { HERO_BY_ID } from '../data/heroes';
import { OwnedHero } from '../models/hero';
import { TeamPreset, TeamSlot } from '../models/game-state';
import { UnitSpec } from '../models/unit';
import { heroStats } from './stats';
import { combatModifiers, skillRanksOf } from './progression';

export const TEAM_SIZE = 5;
/** ความลึกของฝั่งเรา (r ใน TeamSlot: 0 = หน้าสุด) และจำนวนเลน (c) */
export { LANES, SIDE_DEPTH };

const LANE_ORDER = [1, 0, 2];
/** ความลึกที่ใช้วางสายระยะไกลตอนจัดอัตโนมัติ (ไม่ต้องหลังสุด จะได้ยิงถึงเร็ว) */
const BACK_DEPTH = 3;

/** จัดทีมอัตโนมัติ: สายประชิด (แทงก์/นักสู้/นักฆ่า) คอลัมน์หน้า, สายระยะไกลคอลัมน์หลัง (เลนละตัว ล้นแล้วถอยไปอีกคอลัมน์) */
export function autoPlace(heroes: OwnedHero[]): TeamSlot[] {
  const slots: TeamSlot[] = [];
  const taken = new Set<string>();
  const put = (uid: number, depth: number, dir: 1 | -1) => {
    for (let r = depth; r >= 0 && r < SIDE_DEPTH; r += dir) {
      const c = LANE_ORDER.find(l => !taken.has(`${r},${l}`));
      if (c != null) {
        taken.add(`${r},${c}`);
        slots.push({ uid, r, c });
        return;
      }
    }
  };
  for (const h of heroes.slice(0, TEAM_SIZE)) {
    const cls = HERO_BY_ID[h.templateId].cls;
    if (cls === 'tank' || cls === 'fighter' || cls === 'assassin') put(h.uid, 0, 1);
    else put(h.uid, BACK_DEPTH, 1);
  }
  return slots;
}

/** แปลงทีมที่จัดไว้เป็นข้อมูลยูนิตสำหรับเอนจินต่อสู้ */
export function teamToUnits(team: TeamSlot[], heroes: OwnedHero[]): UnitSpec[] {
  const out: UnitSpec[] = [];
  for (const slot of team) {
    const h = heroes.find(x => x.uid === slot.uid);
    if (!h) continue;
    const t = HERO_BY_ID[h.templateId];
    out.push({
      name: t.name,
      cls: t.cls,
      star: t.star,
      level: h.level,
      sprite: t.sprite,
      heroUid: h.uid,
      heroId: t.id,
      stats: heroStats(t, h),
      mods: combatModifiers(h),
      skillRanks: skillRanksOf(h),
      pos: { r: slot.r, c: slot.c },
    });
  }
  return out;
}

// ---------------------------------------------------------------- team presets (Phase 4)

export const TEAM_PRESET_COUNT = 3;
export const defaultPresets = (): TeamPreset[] =>
  Array.from({ length: TEAM_PRESET_COUNT }, (_, i) => ({ name: `ทีม ${String.fromCharCode(65 + i)}`, team: [] }));

/** always exactly TEAM_PRESET_COUNT presets (old saves / bad data are padded or trimmed) */
export function normalizePresets(p: TeamPreset[] | undefined): TeamPreset[] {
  const base = defaultPresets();
  return base.map((d, i) => {
    const x = p?.[i];
    return x && Array.isArray(x.team) ? { name: (x.name ?? '').trim() || d.name, team: x.team.map(t => ({ ...t })) } : d;
  });
}

/**
 * a preset as a playable team: drops heroes no longer owned, cells off the ally side and duplicates;
 * never more than TEAM_SIZE
 */
export function presetToTeam(p: TeamPreset, heroes: OwnedHero[]): TeamSlot[] {
  const owned = new Set(heroes.map(h => h.uid));
  const cells = new Set<string>();
  const uids = new Set<number>();
  const out: TeamSlot[] = [];
  for (const t of p.team) {
    const key = `${t.r},${t.c}`;
    if (!owned.has(t.uid) || uids.has(t.uid) || cells.has(key)) continue;
    if (t.r < 0 || t.r >= SIDE_DEPTH || t.c < 0 || t.c >= LANES) continue;
    uids.add(t.uid);
    cells.add(key);
    out.push({ uid: t.uid, r: t.r, c: t.c });
    if (out.length >= TEAM_SIZE) break;
  }
  return out;
}
