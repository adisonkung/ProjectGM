import { GameState } from '../models/game-state';
import { OwnedHero } from '../models/hero';
import { autoPlace, defaultPresets } from '../rules/team';
import { newIsland } from '../rules/island';

/** ทีมเริ่มต้น (ลงสนาม) และฮีโร่ที่มีให้ตั้งแต่เริ่มแต่อยู่ม้านั่ง */
export const STARTER_TEAM = ['bailong', 'yuezheng', 'moye'];
export const STARTER_BENCH: string[] = [];

/** เซฟเก่า: เพิ่มฮีโร่เริ่มต้นที่ยังไม่มี (ไว้ม้านั่ง ไม่แตะทีมที่จัดไว้) */
export function addMissingStarters(s: GameState): GameState {
  const owned = new Set(s.heroes.map(h => h.templateId));
  for (const templateId of [...STARTER_TEAM, ...STARTER_BENCH]) {
    if (owned.has(templateId)) continue;
    s.heroes.push({ uid: s.nextUid++, templateId, level: 1, potential: 'B', exp: 0, breakthroughTier: 0 });
  }
  return s;
}

/** สถานะเริ่มเกมใหม่ */
export function newGameState(): GameState {
  const ids = [...STARTER_TEAM, ...STARTER_BENCH];
  const heroes: OwnedHero[] = ids.map((templateId, i) => ({
    uid: i + 1,
    templateId,
    level: 1,
    potential: 'B',
    exp: 0,
    breakthroughTier: 0,
  }));
  const team = autoPlace(heroes);
  return {
    version: 6,
    gems: 1500,
    gold: 600,
    pity: 0,
    nextUid: heroes.length + 1,
    heroes,
    team,
    cleared: 0,
    inventory: {},
    daily: { day: '', used: {} },
    trainingSlots: [],
    farm: {},
    rewardCarry: {},
    equipment: [],
    nextItemId: 1,
    huntTarget: 'ANY',
    teamPresets: defaultPresets(),
    island: newIsland(0, heroes, team),
  };
}
