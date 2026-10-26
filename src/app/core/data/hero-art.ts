/**
 * ภาพประกอบของฮีโร่ (public/portraits, public/skills): รูปโปรไฟล์ + ไอคอนสกิล 1 / สกิล 2 / ท่าไม้ตาย
 * จาก art/incoming/<id>/art/{portrait,s1,s2,ult,banner}.png ผ่านสคริปต์ของฮีโร่ (tools/sprites/<id>.py) · ฮีโร่ที่ยังไม่มีภาพ ใช้ sprite ครอปแทน
 */
export interface HeroArt {
  portrait: string;
  /** skill icons — missing = the text badge (a hero whose skill art has not arrived yet) */
  s1?: string;
  s2?: string;
  ult?: string;
  /** wide key art behind the hero-detail header (optional) */
  banner?: string;
}

const art = (id: string): HeroArt => ({
  portrait: `portraits/${id}.webp`,
  s1: `skills/${id}-s1.webp`,
  s2: `skills/${id}-s2.webp`,
  ult: `skills/${id}-ult.webp`,
});

export const HERO_ART: Record<string, HeroArt> = {
  // Draeven UI art (user 2026-10-26, assets/heroes/Draeven/art → tools/sprites/draeven_art.py): portrait, the three
  // skill icons (Blood Debt sigil / crimson slash / Blood Dominion sword impact) and banner.
  draeven: { ...art('draeven'), banner: 'banners/draeven.webp' },
  // Supplied v_icon.zip (2026-10-21): dedicated portrait, all skill icons and banner.
  vaelric: { ...art('vaelric'), banner: 'banners/vaelric.webp' },
  // Supplied Elira_icn.zip (2026-10-19): dedicated portrait, all skill icons and banner.
  elira: { ...art('elira'), banner: 'banners/elira.webp' },
  // Supplied sylvana_icon.zip (2026-10-17): preserve the existing Sylvara entity ID.
  sylvara: { ...art('sylvara'), banner: 'banners/sylvara.webp' },
  // Supplied final-art ZIP (2026-10-17): portrait, skill icons and banner.
  mirelle: { ...art('mirelle'), banner: 'banners/mirelle.webp' },
  // ไป๋หลง: ภาพจากผู้ใช้ 2026-10 (art/incoming/bailong/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  bailong: { ...art('bailong'), banner: 'banners/bailong.webp' },
  // เยว่เจิ้ง: ภาพจากผู้ใช้ 2026-10 (art/incoming/yuezheng/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  yuezheng: { ...art('yuezheng'), banner: 'banners/yuezheng.webp' },
  // โม่เย่: ภาพจากผู้ใช้ 2026-10 (art/incoming/moye/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  moye: { ...art('moye'), banner: 'banners/moye.webp' },
  // ถังซวิ่น: ภาพจากผู้ใช้ 2026-10 (art/incoming/tangxun/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  tangxun: { ...art('tangxun'), banner: 'banners/tangxun.webp' },
  // หลินเสวี่ย: ภาพจากผู้ใช้ 2026-10 (art/incoming/linxue/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  linxue: { ...art('linxue'), banner: 'banners/linxue.webp' },
  // การ์ริก: ภาพจากผู้ใช้ 2026-10 (art/incoming/garrick/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  garrick: { ...art('garrick'), banner: 'banners/garrick.webp' },
  // เคล: ภาพจากผู้ใช้ 2026-10 (art/incoming/kael/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  kael: { ...art('kael'), banner: 'banners/kael.webp' },
};

export const heroArt = (heroId?: string): HeroArt | undefined => (heroId ? HERO_ART[heroId] : undefined);
