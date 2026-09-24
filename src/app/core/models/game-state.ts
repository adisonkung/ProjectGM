import { OwnedHero } from './hero';

/** ตำแหน่งฮีโร่ในทีม: พิกัดในฝั่งเรา (r = ความลึก 0-4, 0 = หน้าสุด; c = เลน 0-6) */
export interface TeamSlot {
  uid: number;
  r: number;
  c: number;
}

export interface GameState {
  version: 3;
  gems: number;
  gold: number;
  pity: number;
  nextUid: number;
  heroes: OwnedHero[];
  team: TeamSlot[];
  /** ชั้นสูงสุดที่ผ่านแล้ว */
  cleared: number;
}
