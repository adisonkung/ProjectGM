import { DailyState } from './economy';
import { OwnedHero } from './hero';

/** ตำแหน่งฮีโร่ในทีม: พิกัดในฝั่งเรา (r = ความลึก 0-4, 0 = หน้าสุด; c = เลน 0-6) */
export interface TeamSlot {
  uid: number;
  r: number;
  c: number;
}

/** progress in one farm dungeon */
export interface FarmRecord {
  clears: number;
  firstClearDone: boolean;
  /** best clear rating 1–3 (3★ = no death + under target time) — future auto repeat / sweep unlock */
  bestRating: number;
}

export interface GameState {
  version: 5;
  gems: number;
  gold: number;
  pity: number;
  nextUid: number;
  heroes: OwnedHero[];
  team: TeamSlot[];
  /** ชั้นสูงสุดที่ผ่านแล้ว (unlocks Training / Ascension difficulties) */
  cleared: number;
  /** EXP potions, breakthrough stones / fragments … (item id → count) */
  inventory: Record<string, number>;
  /** daily bonus usage per pool (TRAINING / ASCENSION) — reset at the local day change, nothing else resets */
  daily: DailyState;
  /** reserve heroes in Training Slots (uids) — they get a share of Training battle EXP */
  trainingSlots: number[];
  farm: Record<string, FarmRecord>;
  /** fractional item rewards (e.g. 0.7 potion on a repeat clear) carried to the next run — deterministic, nothing lost */
  rewardCarry: Record<string, number>;
}
