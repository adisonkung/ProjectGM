import { LANES, SIDE_DEPTH } from '../../battle/engine/grid';
import { HERO_BY_ID } from '../data/heroes';
import { OwnedHero } from '../models/hero';
import { TeamSlot } from '../models/game-state';
import { UnitSpec } from '../models/unit';
import { heroStats } from './stats';

export const TEAM_SIZE = 5;
/** ความลึกของฝั่งเรา (r ใน TeamSlot: 0 = หน้าสุด) และจำนวนเลน (c) */
export { LANES, SIDE_DEPTH };

/** จัดทีมอัตโนมัติ: สายประชิด (แทงก์/นักสู้/นักฆ่า) แถวหน้า, สายระยะไกลแถวหลัง */
export function autoPlace(heroes: OwnedHero[]): TeamSlot[] {
  const front = [3, 2, 4, 1, 5, 0, 6];
  const back = [3, 1, 5, 2, 4, 0, 6];
  const slots: TeamSlot[] = [];
  let fi = 0;
  let bi = 0;
  for (const h of heroes.slice(0, TEAM_SIZE)) {
    const cls = HERO_BY_ID[h.templateId].cls;
    if (cls === 'tank' || cls === 'fighter' || cls === 'assassin') slots.push({ uid: h.uid, r: 0, c: front[fi++] });
    else slots.push({ uid: h.uid, r: SIDE_DEPTH - 1, c: back[bi++] });
  }
  return slots;
}

/** แปลงทีมที่จัดไว้เป็นข้อมูลยูนิตสำหรับเอนจินต่อสู้ (ข้ามตัวที่บาดเจ็บ) */
export function teamToUnits(team: TeamSlot[], heroes: OwnedHero[]): UnitSpec[] {
  const out: UnitSpec[] = [];
  for (const slot of team) {
    const h = heroes.find(x => x.uid === slot.uid);
    if (!h || h.injury > 0) continue;
    const t = HERO_BY_ID[h.templateId];
    out.push({
      name: t.name,
      cls: t.cls,
      star: t.star,
      level: h.level,
      sprite: t.sprite,
      heroUid: h.uid,
      stats: heroStats(t, h),
      pos: { r: slot.r, c: slot.c },
    });
  }
  return out;
}
