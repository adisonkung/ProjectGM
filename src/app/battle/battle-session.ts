/**
 * The one place the meta-game creates battles and reads their results (combat-modes-plan guardrails):
 * pages / tower / farm code never call `new BattleEngine(...)` or read engine internals directly.
 */
import { ENEMIES } from '../core/data/enemies';
import { StageDef } from '../core/models/stage';
import { UnitSpec } from '../core/models/unit';
import { BattleEngine, BattleResult } from './engine/battle-engine';
import { PLAYER_TEAM } from './engine/stage/party';
import { ModeScore, StageResult } from './engine/stage/types';

export interface BattleSetup {
  allies: UnitSpec[];
  stage: StageDef;
  autoUlt?: boolean;
  seed?: number;
}

export function createBattle(o: BattleSetup): BattleEngine {
  return new BattleEngine({ allies: o.allies, stage: o.stage, enemyTemplates: ENEMIES, autoUlt: o.autoUlt, seed: o.seed });
}

/** what a finished battle means for rewards / result screens */
export interface BattleOutcome {
  win: boolean;
  result: BattleResult | null;
  /** seconds of combat (time limits, clear rating) */
  time: number;
  deaths: number;
  /** deployed hero uids */
  participants: number[];
  stage: StageResult | null;
  mode?: ModeScore;
  failReason?: string;
}

export function outcomeOf(e: BattleEngine): BattleOutcome {
  const r = e.stageResult;
  return {
    win: e.result === 'win',
    result: e.result,
    time: e.fightTime,
    deaths: e.metrics.deaths,
    participants: e.units.filter(u => u.side === PLAYER_TEAM && u.heroUid != null).map(u => u.heroUid!),
    stage: r,
    ...(r?.mode ? { mode: r.mode } : {}),
    ...(r?.failReason ? { failReason: r.failReason } : {}),
  };
}

/** short live status of a special stage mode (HUD line) — null for story stages */
export function modeStatus(e: BattleEngine): { goal: string; line: string } | null {
  const sp = e.flow.special;
  if (sp.kind === 'STORY') return null;
  const s = e.flow.score;
  switch (sp.kind) {
    case 'SURVIVAL':
      return { goal: sp.goal, line: `รอดอีก ${Math.max(0, Math.ceil(e.timeLimit - e.fightTime))} วิ · ฆ่า ${s.kills}${sp.killStars ? ` (★★ ${sp.killStars[0]} · ★★★ ${sp.killStars[1]})` : ''}` };
    case 'BOSS_DUEL': {
      const at = sp.enrage?.at ?? 0;
      return { goal: sp.goal, line: s.enraged ? '🔥 บอสคลั่งแล้ว!' : `คลั่งในอีก ${Math.max(0, Math.ceil(at - e.fightTime))} วิ` };
    }
    case 'TREASURE':
      return { goal: sp.goal, line: `💰 จับได้ ${s.carriersKilled}/3 · หนีไป ${s.escaped}` };
    case 'CHALLENGE': {
      const rules = (sp.challenge ?? []).map(r => r.type === 'CAST_LIMIT' ? `ร่ายสำเร็จ ${s.strikes}/${r.max}` : `ล้ม ${r.monsterId} ภายใน ${r.seconds} วิ`);
      return { goal: sp.goal, line: rules.join(' · ') };
    }
  }
  return null;
}
