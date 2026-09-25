import { SkillKind } from './sprites';

/**
 * สกิลเฉพาะตัวของฮีโร่ (ทับของสาย): ชื่อสกิล และสกิลที่ทำงานต่างจากสายปกติ
 * - rage:    นักสู้ โทสะเลือด — ฟันเป้า 150% + คลั่ง 6 วิ (atk/ความเร็วตี ×1.35)
 * - pierce:  นักฆ่า พุ่งผี — พุ่งฟันทะลุ 180% + ตัวที่อยู่ถัดไปข้างหลัง 120%
 * - miasma:  ฮีลเลอร์ เมฆพิษ — เมฆพิษตกใส่ศัตรู 110% + พิษรอบเป้า 1 ช่อง (แทนพรศักดิ์สิทธิ์)
 */
export type SkillVariant = 'rage' | 'pierce' | 'miasma';

export interface HeroKit {
  names: Record<SkillKind, string>;
  variant?: Partial<Record<SkillKind, SkillVariant>>;
}

export const HERO_KITS: Record<string, HeroKit> = {
  morgan: { names: { skill: 'ป้อมปราการมืด', skill2: 'โล่กระแทก', ult: 'ระเบิดโล่ทมิฬ' } },
  ragnar: { names: { skill: 'พายุขวาน', skill2: 'โทสะเลือด', ult: 'ขวานถล่มลาวา' }, variant: { skill2: 'rage' } },
  corvin: { names: { skill: 'หมอกเยียวยา', skill2: 'เมฆพิษ', ult: 'ปีกวิญญาณคืนชีพ' }, variant: { skill2: 'miasma' } },
  nox: { names: { skill: 'หายวับในเงา', skill2: 'พุ่งผี', ult: 'เก็บเกี่ยววิญญาณ' }, variant: { skill2: 'pierce' } },
  velma: { names: { skill: 'ตราสาปวิญญาณ', skill2: 'มือกระดูก', ult: 'ลำแสงวิญญาณ' } },
};

export const kitName = (heroId: string | undefined, kind: SkillKind): string | undefined =>
  heroId ? HERO_KITS[heroId]?.names[kind] : undefined;
export const kitVariant = (heroId: string | undefined, kind: SkillKind): SkillVariant | undefined =>
  heroId ? HERO_KITS[heroId]?.variant?.[kind] : undefined;
