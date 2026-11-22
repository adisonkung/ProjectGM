/**
 * Display copy for the summon book's gold-card intro: the hero's Latin name, epithet and one line they say.
 * Presentation only (no gameplay). From the approved animatic (2026-11-22); Vaelric and Mordrienne epithets and every
 * quote are first-draft copy the user may rewrite. A hero missing here still gets the intro with its game name.
 */
export interface HeroIntro { en: string; epithet: string; quote: string }

export const HERO_INTRO: Record<string, HeroIntro> = {
  bailong: { en: 'Bai Long', epithet: 'The White Dragon Spear', quote: 'ทวนเล่มนี้ไม่เคยถอย ตราบใดที่มังกรยังหายใจ' },
  yuezheng: { en: 'Yue Zheng', epithet: 'Iron Mountain Bastion', quote: 'ภูผาไม่เคยก้าวหลบ และข้าก็เช่นกัน' },
  moye: { en: 'Mo Ye', epithet: 'Shadow Orchid Blade', quote: 'กลีบกล้วยไม้ร่วงเงียบเพียงใด คมดาบข้าก็เงียบเพียงนั้น' },
  tangxun: { en: 'Tang Xun', epithet: 'The Whispering Blade', quote: 'เสียงกระซิบสุดท้ายที่เจ้าจะได้ยิน คือเสียงมีดของข้า' },
  linxue: { en: 'Lin Xue', epithet: 'Lotus Spirit Physician', quote: 'บัวยังบานได้ในโคลน ชีวิตก็ผลิได้ในความมืด' },
  garrick: { en: 'Garrick Stoneward', epithet: 'The Iron Bell', quote: 'ตราบใดที่ระฆังเหล็กยังดัง ประตูนี้จะไม่มีวันแตก' },
  kael: { en: 'Kael', epithet: 'The Ashen Vanguard', quote: 'จากเถ้าถ่านของสงคราม ข้ายืนอยู่แนวหน้าเสมอ' },
  mirelle: { en: 'Mirelle Frostglass', epithet: 'The Winter Scholar', quote: 'ความรู้คือน้ำแข็งที่ไม่มีวันละลาย' },
  sylvara: { en: 'Sylvara Windwhisper', epithet: 'The Emerald Huntress', quote: 'สายลมบอกข้าทุกอย่าง ที่เหลือลูกศรจะบอกเอง' },
  elira: { en: 'Elira Dawnmere', epithet: 'Keeper of the Hearthlight', quote: 'แสงเล็ก ๆ ในเตาผิง ก็พอจะพาทุกคนกลับบ้าน' },
  vaelric: { en: 'Vaelric Nocthar', epithet: 'The Silent Phantom', quote: 'เงาที่เจ้ามองไม่เห็น คือเงาที่จะพรากลมหายใจเจ้า' },
  draeven: { en: 'Draeven Morcant', epithet: 'The Bloodwrought Sovereign', quote: 'ทุกบาดแผลที่เจ้าทิ้งไว้ ข้าจะคืนให้เป็นเลือด' },
  mordrienne: { en: 'Mordrienne Vale', epithet: 'The Ashen Hex', quote: 'คำสาปของข้าไม่รีบร้อน มันรอได้เสมอ' },
  sylas: { en: 'Sylas Veyrn', epithet: 'The Dusk Reaver', quote: 'เมื่อสนธยามาเยือน ตราประหารก็ถูกประทับแล้ว' },
  lucien: { en: 'Lucien Valthorne', epithet: 'The Black Saint', quote: 'บาปของเจ้า ข้าจะแบกรับไว้เอง' },
};

export function heroIntro(id: string): HeroIntro {
  return HERO_INTRO[id] ?? { en: id.charAt(0).toUpperCase() + id.slice(1), epithet: '', quote: '' };
}
