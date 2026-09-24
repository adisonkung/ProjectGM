import { OwnedHero } from './hero';

/** ตำแหน่งฮีโร่ในทีม: พิกัดในครึ่งกระดานของเรา (4 แถว x 7 คอลัมน์, r=0 แถวหน้า) */
export interface TeamSlot {
  uid: number;
  r: number;
  c: number;
}

export interface GameState {
  version: 1;
  gems: number;
  gold: number;
  pity: number;
  nextUid: number;
  heroes: OwnedHero[];
  team: TeamSlot[];
  /** ชั้นสูงสุดที่ผ่านแล้ว */
  cleared: number;
}
