/**
 * Placeholder content for the K7 home screen (user 2026-11-19: "จำลองใส่มาก่อน").
 * Events, world boss, missions, mail … do not exist in the game yet — every entry here is mock data.
 * An entry with a `route` opens a real page; one without shows "coming soon".
 */
export interface HomeEvent { tag: string; title: string; sub: string; time: string; banner: string; pos: string; route?: string }

export const HOME_EVENTS: HomeEvent[] = [
  { tag: 'EVENT 01', title: 'ศึกเฝ้าประตูเมือง', sub: 'บอสร่วมทีม · รางวัลจำกัด', time: 'D-06 · 12:40:22', banner: 'banners/garrick.webp', pos: '62% 25%' },
  { tag: 'SUMMON', title: 'วิหารอัญเชิญ', sub: 'อัญเชิญฮีโร่ใหม่เข้าทีม', time: 'เปิดตลอด', banner: 'banners/draeven.webp', pos: '50% 22%', route: '/gacha' },
  { tag: 'LIMITED', title: 'ปาฏิหาริย์ทมิฬ', sub: 'กิจกรรมจำกัดเวลา', time: 'D-09 · 04:12:08', banner: 'banners/lucien.webp', pos: '50% 25%' },
  { tag: 'TOWER', title: 'หอคอยแห่งบททดสอบ', sub: 'พิชิตชั้นใหม่รับรางวัลครั้งแรก', time: 'เปิดตลอด', banner: 'banners/kael.webp', pos: '40% 20%', route: '/tower' },
];

export interface MenuTile { icon: string; th: string; en: string; badge?: string; dot?: boolean; route?: string }

export const MENU_TILES: MenuTile[] = [
  { icon: 'event', th: 'กิจกรรม', en: 'EVENTS', badge: '3' },
  { icon: 'mission', th: 'ภารกิจ', en: 'MISSIONS', badge: '2/5' },
  { icon: 'achieve', th: 'ความสำเร็จ', en: 'ACHIEVEMENTS', badge: 'NEW' },
  { icon: 'login', th: 'ล็อกอินรายวัน', en: 'LOGIN BONUS', dot: true },
  { icon: 'forge', th: 'ตีเหล็ก', en: 'FORGE', route: '/forge' },
  { icon: 'account', th: 'บัญชี', en: 'ACCOUNT', route: '/account' },
];

/** mock counters on the top-right buttons */
export const MOCK_MAIL = 3;
export const WORLD_BOSS = { title: 'บอสโลก', ends: '02:14:30' };
