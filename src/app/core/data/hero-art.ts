/**
 * ภาพประกอบของฮีโร่ (public/portraits, public/skills): รูปโปรไฟล์ + ไอคอนสกิล 1 / สกิล 2 / ท่าไม้ตาย
 * ตัดมาจากแผ่นไอคอนที่ผู้เล่นเจนมา (ดู tools/art/slice_icons.py) · ฮีโร่ที่ยังไม่มีภาพ ใช้ sprite ครอปแทน
 */
export interface HeroArt {
  portrait: string;
  s1: string;
  s2: string;
  ult: string;
}

const art = (id: string): HeroArt => ({
  portrait: `portraits/${id}.webp`,
  s1: `skills/${id}-s1.webp`,
  s2: `skills/${id}-s2.webp`,
  ult: `skills/${id}-ult.webp`,
});

export const HERO_ART: Record<string, HeroArt> = {
  aurel: art('aurel'),
  shade: art('shade'),
  jin: art('jin'),
  sylvie: art('sylvie'),
  lumina: art('lumina'),
  ragnar: art('ragnar'),
  corvin: art('corvin'),
  nox: art('nox'),
  velma: art('velma'),
  morgan: art('morgan'),
};

export const heroArt = (heroId?: string): HeroArt | undefined => (heroId ? HERO_ART[heroId] : undefined);
