import { GameState } from '../models/game-state';
import { OwnedHero } from '../models/hero';
import { autoPlace } from '../rules/team';

/** สถานะเริ่มเกมใหม่ */
export function newGameState(): GameState {
  const ids = ['aurel', 'jin', 'shade', 'sylvie', 'lumina'];
  const heroes: OwnedHero[] = ids.map((templateId, i) => ({
    uid: i + 1,
    templateId,
    level: 1,
    potential: 'B',
    injury: 0,
  }));
  return {
    version: 4,
    gems: 1500,
    gold: 600,
    pity: 0,
    nextUid: heroes.length + 1,
    heroes,
    team: autoPlace(heroes),
    cleared: 0,
  };
}
