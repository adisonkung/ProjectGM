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
  /** ตำแหน่งในครึ่งกระดานของตัวเอง: r=0 คือแถวหน้าสุด (ติดกลางสนาม) */
  pos: Cell;
  star?: number;
  level?: number;
  sprite?: string;
  boss?: boolean;
  heroUid?: number;
}
