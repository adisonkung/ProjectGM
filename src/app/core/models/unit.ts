import { HeroClass, Stats } from './hero';

export type Side = 'ally' | 'enemy';

/** ตำแหน่งบนกระดาน */
export interface Cell {
  r: number;
  c: number;
}

/** ข้อมูลตั้งต้นของยูนิตก่อนเข้าสนาม */
export interface UnitSpec {
  name: string;
  cls: HeroClass;
  stats: Stats;
  /** ตำแหน่งในฝั่งตัวเอง: r = ความลึก (0 = หน้าสุด ติดเส้นกลาง), c = เลน 0-6 */
  pos: Cell;
  star?: number;
  level?: number;
  sprite?: string;
  boss?: boolean;
  heroUid?: number;
  /** id ต้นแบบฮีโร่ (ใช้หาภาพโปรไฟล์/ไอคอนสกิล) */
  heroId?: string;
}
