import { unitDistance } from './footprint';
import { ROLE_BEHAVIOR, RoleBehavior, THREAT_PADDING } from '../../core/data/classes';
import { Cell, UnitFootprint } from '../../core/models/unit';
import type { BattleUnit } from './battle-engine';
import { BOARD_COLS, BOARD_ROWS, distance, Grid } from './grid';
import { isPlayerUnit } from './stage/party';

/**
 * Hero positioning rules (soft AI preferences, never hard walls):
 * formation leash, hostile melee threat zones, minimum safe range, preferred range, frontline awareness,
 * a simple DangerScore per cell, and `canSafelyEngage` (used by the soft Focus Target).
 */
export interface PositionHost {
  readonly grid: Grid;
  readonly units: BattleUnit[];
  isValidTarget(u: BattleUnit, t: BattleUnit): boolean;
  /** encounter-local formation anchor cell of a hero (null = none) */
  anchorOf(u: BattleUnit): Cell | null;
  /** cells `u` may not walk through (hostile heavy bodies) */
  bodyBlocked(u: BattleUnit): ((c: Cell) => boolean) | undefined;
  /** a hostile unit's attack range (monster definition range for monsters) */
  attackRangeOf(t: BattleUnit): number;
}

export interface ThreatZone {
  unitId: number;
  pos: Cell;
  radius: number;
  footprint?: UnitFootprint;
}

export interface SafeEngagementResult {
  canAttackNow: boolean;
  canRepositionSafely: boolean;
  /** where a ranged hero would shoot from (null = stay / melee path) */
  safePosition: Cell | null;
  blockedReason: 'INVALID' | 'TOO_FAR' | 'LEASH' | 'BLOCKED' | 'NO_SAFE_POSITION' | null;
}

/** weights of the DangerScore (configurable) */
export const DANGER = {
  /** each hostile melee threat zone containing the cell */
  threatZone: 10,
  /** each hostile melee unit closer than the hero's minSafeRange (outside its zone) */
  minSafeRange: 3,
  /** per cell from the formation anchor (ranged / melee) */
  anchorRanged: 1,
  anchorMelee: 0.2,
  /** per cell beyond the leash */
  beyondLeash: 6,
  /** a ranged hero standing ahead of the allied frontline */
  aheadOfFrontline: 5,
  /** a cell already taken by someone */
  occupied: 1,
};

/** cells with a DangerScore below this are "safe" (not inside any hostile melee threat zone) */
export const SAFE_DANGER = DANGER.threatZone;

export const isRanged = (u: BattleUnit) => u.range >= 3;
export const roleOf = (u: BattleUnit): RoleBehavior => ROLE_BEHAVIOR[u.cls];

export class Positioning {
  constructor(private readonly h: PositionHost) {}

  /** hostile melee units' threat zones (attack range + padding) */
  threats(u: BattleUnit): ThreatZone[] {
    return this.h.units
      .filter(t => t.side !== u.side && this.h.isValidTarget(u, t) && this.h.attackRangeOf(t) < 2.5)
      .map(t => ({ unitId: t.id, pos: t.pos, footprint: t.footprint, radius: this.h.attackRangeOf(t) + THREAT_PADDING }));
  }

  threatCount(cell: Cell, zones: ThreatZone[]): number {
    return zones.filter(z => unitDistance({ pos: cell },z) <= z.radius + 1e-9).length;
  }

  /** column of the allied frontline (furthest-forward melee hero); null = no melee left */
  frontlineX(u: BattleUnit): number | null {
    const melee = this.h.units.filter(a => a.side === u.side && a.alive && a.visible && !isRanged(a));
    if (!melee.length) return null;
    return isPlayerUnit(u) ? Math.max(...melee.map(a => a.pos.c)) : Math.min(...melee.map(a => a.pos.c));
  }

  /**
   * Formation anchor that moves with the fight: a ranged hero's anchor is shifted forward by as much as the allied
   * frontline has advanced beyond its own anchors (the backline follows the frontline, never ahead of it).
   */
  anchorOf(u: BattleUnit): Cell | null {
    const a = this.h.anchorOf(u);
    if (!a || !isRanged(u)) return a;
    const melee = this.h.units.filter(m => m.side === u.side && m.alive && m.visible && !isRanged(m));
    if (!melee.length) return a;
    const dir = isPlayerUnit(u) ? 1 : -1;
    let shift = 0;
    for (const m of melee) {
      const ma = this.h.anchorOf(m);
      if (ma) shift = Math.max(shift, (m.pos.c - ma.c) * dir);
    }
    if (shift <= 0) return a;
    return { r: a.r, c: Math.max(0, Math.min(BOARD_COLS - 1, a.c + Math.floor(shift) * dir)) };
  }

  /**
   * DangerScore(position, unit): hostile melee zones, min safe range, distance from the anchor / beyond the leash,
   * ranged heroes ahead of the allied frontline, occupied cells. Lower = better.
   */
  danger(u: BattleUnit, cell: Cell, zones = this.threats(u), frontX = this.frontlineX(u)): number {
    const role = roleOf(u);
    let d = 0;
    for (const z of zones) {
      const dist = unitDistance({ pos: cell },z);
      if (dist <= z.radius + 1e-9) d += DANGER.threatZone;
      else if (role.minSafeRange != null && dist < role.minSafeRange) d += DANGER.minSafeRange;
    }
    const anchor = this.anchorOf(u);
    if (anchor) {
      const a = distance(cell, anchor);
      d += a * (isRanged(u) ? DANGER.anchorRanged : DANGER.anchorMelee);
      if (a > role.leash) d += (a - role.leash) * DANGER.beyondLeash;
    }
    if (isRanged(u) && frontX != null) {
      const ahead = isPlayerUnit(u) ? cell.c > frontX : cell.c < frontX;
      if (ahead) d += DANGER.aheadOfFrontline;
    }
    if ((cell.r !== u.pos.r || cell.c !== u.pos.c) && !this.h.grid.isFree(cell)) d += DANGER.occupied;
    return d;
  }

  leashOf(u: BattleUnit): number {
    return roleOf(u).leash;
  }

  /** is `cell` within the hero's leash of its formation anchor? */
  withinLeash(u: BattleUnit, cell: Cell): boolean {
    const a = this.anchorOf(u);
    return !a || distance(cell, a) <= roleOf(u).leash + 1e-9;
  }

  /**
   * Best cell from which a ranged hero can shoot `t`: inside its range, reachable, not body-blocked,
   * optionally inside the leash and within `maxMove` cells — lowest DangerScore (+ small travel / range-band costs).
   */
  firingCell(u: BattleUnit, t: BattleUnit, o: { respectLeash: boolean; maxMove?: number; safeOnly?: boolean }): { cell: Cell; danger: number } | null {
    const zones = this.threats(u);
    const frontX = this.frontlineX(u);
    const blocked = this.h.bodyBlocked(u);
    const role = roleOf(u);
    let best: { cell: Cell; danger: number; score: number } | null = null;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const cell = { r, c };
        const here = r === u.pos.r && c === u.pos.c;
        if (!here && (!this.h.grid.canEnter(cell) || blocked?.(cell))) continue;
        const dt = unitDistance({ pos: cell }, t);
        if (dt > u.range) continue;
        const move = distance(cell, u.pos);
        if (o.maxMove != null && move > o.maxMove + 1e-9) continue;
        if (o.respectLeash && !this.withinLeash(u, cell)) continue;
        const danger = this.danger(u, cell, zones, frontX);
        if (o.safeOnly && danger >= SAFE_DANGER) continue;
        const band = role.preferredRange ? Math.max(0, role.preferredRange[0] - dt) * 0.5 : 0;
        const score = danger + move * 0.5 + band;
        if (!best || score < best.score - 1e-9) best = { cell, danger, score };
      }
    }
    return best ? { cell: best.cell, danger: best.danger } : null;
  }

  /**
   * Can `u` engage `t` without abandoning its role (soft Focus Target)?
   * Ranged: attack now if in range, else a safe firing cell inside the leash within maxFocusChase.
   * Melee: in range, or the target within maxFocusChase + range, inside leash + range, not behind another enemy.
   * Assassins may dive (their skills suspend the leash).
   */
  canSafelyEngage(u: BattleUnit, t: BattleUnit): SafeEngagementResult {
    const no = (blockedReason: SafeEngagementResult['blockedReason']): SafeEngagementResult =>
      ({ canAttackNow: false, canRepositionSafely: false, safePosition: null, blockedReason });
    if (!this.h.isValidTarget(u, t)) return no('INVALID');
    const role = roleOf(u);
    const d = unitDistance(u, t);
    if (d <= u.range) return { canAttackNow: true, canRepositionSafely: true, safePosition: null, blockedReason: null };
    if (isRanged(u)) {
      const spot = this.firingCell(u, t, { respectLeash: true, maxMove: role.maxFocusChase, safeOnly: true });
      return spot ? { canAttackNow: false, canRepositionSafely: true, safePosition: spot.cell, blockedReason: null } : no('NO_SAFE_POSITION');
    }
    if (u.cls === 'assassin') return { canAttackNow: false, canRepositionSafely: true, safePosition: null, blockedReason: null };
    if (d - u.range > role.maxFocusChase + 1e-9) return no('TOO_FAR');
    const anchor = this.h.anchorOf(u);
    if (anchor && unitDistance({ pos: anchor }, t) > role.leash + u.range + 1e-9) return no('LEASH');
    if (d > 2) {
      const lo = Math.min(u.pos.c, t.pos.c);
      const hi = Math.max(u.pos.c, t.pos.c);
      const foes = this.h.units.filter(f => f.side === t.side && f !== t && this.h.isValidTarget(u, f));
      if (foes.some(f => f.pos.c > lo && f.pos.c < hi && Math.abs(f.pos.r - t.pos.r) <= 1)) return no('BLOCKED');
    }
    return { canAttackNow: false, canRepositionSafely: true, safePosition: null, blockedReason: null };
  }
}
