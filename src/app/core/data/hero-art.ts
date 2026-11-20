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
  /** the hero stands right of centre in the banner → hero detail mirrors it so the right-hand info column never covers them */
  bannerMirror?: boolean;
  /** looping animated banner (muted MP4); `banner` stays the still / poster for reduced motion and small previews */
  bannerVideo?: string;
  /** full-screen banner pushed down by this % of the box (top-anchored, never crops the head; the gap above is a
   *  blurred copy that fades in) — for art whose head sits right at the top edge */
  bannerDrop?: number;
}

const art = (id: string): HeroArt => ({
  portrait: `portraits/${id}.webp`,
  s1: `skills/${id}-s1.webp`,
  s2: `skills/${id}-s2.webp`,
  ult: `skills/${id}-ult.webp`,
});

// Latest portrait/banner override: user new_portrait_banner.zip (2026-10-30), retained as
// assets/ui/hero-refresh-2026-10-30.zip and imported by tools/dev/import_hero_ui_art.py.
// 11 portraits (including Draeven) + 10 banners; original aspect ratios retained. Skill icons unchanged.
export const HERO_ART: Record<string, HeroArt> = {
  // Lucien UI art (user 2026-10-28, assets/heroes/Lucien/art → tools/sprites/lucien_art.py): portrait, the three
  // skill icons cut from one framed strip (Black Benediction cross / Martyr's Veil linked crosses / Black Miracle
  // radiant cross) and banner.
  // Animated banner (user Archive 2.zip, 2026-11-20; original in assets/ui/banner-video-2026-11-20), still = first frame.
  lucien: { ...art('lucien'), banner: 'banners/lucien.webp', bannerVideo: 'banners/lucien.mp4', bannerDrop: 8 },
  // Sylas UI art (user 2026-10-27, assets/heroes/Sylas/art → tools/sprites/sylas_art.py): portrait, the three skill
  // icons (Dusk Mark bolt + crosshair / Reaver Volley three bolts / Nightfall Execution vortex) and banner (2:1).
  sylas: { ...art('sylas'), banner: 'banners/sylas.webp' },
  // Mordrienne UI art (user 2026-10-27, assets/heroes/Mordrienne/art → tools/sprites/mordrienne_art.py): portrait, the
  // three skill icons (Ashen Mark broken hex / Cinderbind Hex thorned ground hex / House of Ashes serpent field) and banner.
  // Animated banner (user Archive 2.zip, 2026-11-20); mirror kept so hero detail's right panel doesn't cover her face.
  mordrienne: { ...art('mordrienne'), banner: 'banners/mordrienne.webp', bannerVideo: 'banners/mordrienne.mp4', bannerDrop: 8, bannerMirror: true },
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
  bailong: { ...art('bailong'), banner: 'banners/bailong.webp', bannerMirror: true },
  // เยว่เจิ้ง: ภาพจากผู้ใช้ 2026-10 (art/incoming/yuezheng/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  yuezheng: { ...art('yuezheng'), banner: 'banners/yuezheng.webp' },
  // โม่เย่: ภาพจากผู้ใช้ 2026-10 (art/incoming/moye/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  moye: { ...art('moye'), banner: 'banners/moye.webp', bannerMirror: true },
  // ถังซวิ่น: ภาพจากผู้ใช้ 2026-10 (art/incoming/tangxun/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  tangxun: { ...art('tangxun'), banner: 'banners/tangxun.webp' },
  // หลินเสวี่ย: ภาพจากผู้ใช้ 2026-10 (art/incoming/linxue/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  linxue: { ...art('linxue'), banner: 'banners/linxue.webp' },
  // การ์ริก: ภาพจากผู้ใช้ 2026-10 (art/incoming/garrick/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  garrick: { ...art('garrick'), banner: 'banners/garrick.webp' },
  // เคล: ภาพจากผู้ใช้ 2026-10 (art/incoming/kael/art, ไม่ commit) → webp 288 / 160 / แบนเนอร์ 1400 กว้าง
  // Animated banner (user knight_idle_loop_smooth.mp4, 2026-11-20): original kept in assets/ui/banner-video-2026-11-20,
  // runtime = 1600 px H.264 loop; the still banner is its first frame.
  kael: { ...art('kael'), banner: 'banners/kael.webp', bannerVideo: 'banners/kael.mp4', bannerDrop: 8 },
};

export const heroArt = (heroId?: string): HeroArt | undefined => (heroId ? HERO_ART[heroId] : undefined);
