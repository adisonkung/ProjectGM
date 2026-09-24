/**
 * สกิลร่ายของศัตรู (STEP 7 Interrupt): ต้องร่ายค้างไว้ castTime วินาที ระหว่างนั้นยืนนิ่ง มีแถบร่ายให้เห็น
 * ถ้าโดนสกิลที่ตัดได้ (INTERRUPT ใน classes.ts) ระหว่างร่าย และ interruptible = true → ยกเลิก + สกิลเข้าคูลดาวน์เต็ม
 */
export type EnemySkillEffect =
  /** ดาเมจจริงทุกฮีโร่ = power × เลือดสูงสุดของแต่ละตัว (โล่ยังกันได้) */
  | 'quake'
  /** ดาเมจ power × atk ใส่เป้า + รอบเป้า 1 ช่อง (เป้า = แถวหลังเลือด % ต่ำสุดในระยะ) */
  | 'meteor'
  /** คลั่ง: atk และความเร็วตี ×(1 + power) นาน duration วิ */
  | 'berserk'
  /** ฮีลพวกเดียวกันทุกตัว power × เลือดสูงสุด (ร่ายเมื่อมีพวกเลือดต่ำกว่า 75%) */
  | 'massHeal';

export interface EnemySkillDef {
  id: string;
  /** ชื่อไทย (ลอยเหนือหัว) */
  name: string;
  /** ป้ายเตือนบนแถบร่าย */
  label: string;
  castTime: number;
  cooldown: number;
  interruptible: boolean;
  effect: EnemySkillEffect;
  power: number;
  duration?: number;
}

export const ENEMY_SKILLS: Record<string, EnemySkillDef> = {
  earthquake: {
    id: 'earthquake', name: 'แผ่นดินไหว', label: 'EARTHQUAKE',
    castTime: 3, cooldown: 15, interruptible: true, effect: 'quake', power: 0.5,
  },
  meteor: {
    id: 'meteor', name: 'อุกกาบาตมืด', label: 'METEOR',
    castTime: 3, cooldown: 14, interruptible: true, effect: 'meteor', power: 3,
  },
  deathNova: {
    id: 'deathNova', name: 'คลื่นมรณะ', label: 'DEATH NOVA',
    castTime: 3.5, cooldown: 16, interruptible: true, effect: 'quake', power: 0.45,
  },
  massHeal: {
    id: 'massHeal', name: 'ฟื้นฟูหมู่', label: 'MASS HEAL',
    castTime: 3, cooldown: 12, interruptible: true, effect: 'massHeal', power: 0.4,
  },
  berserk: {
    id: 'berserk', name: 'คลั่ง', label: 'BERSERK',
    castTime: 2, cooldown: 20, interruptible: false, effect: 'berserk', power: 0.5, duration: 8,
  },
};

/** สกิลร่ายเริ่มการต่อสู้ด้วยคูลดาวน์ครึ่งหนึ่ง (ให้เวลาเกจผู้เล่นขึ้นก่อน) */
export const ENEMY_SKILL_START_CD = 0.5;
