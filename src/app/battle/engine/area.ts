import { AreaCenter, AreaPattern } from '../../core/models/combat';
import { Cell } from '../../core/models/unit';
import { distance, LANES } from './grid';

/** What the resolver needs of a unit */
export interface AreaUnit {
  id: number;
  pos: Cell;
}

export interface AreaQuery<T extends AreaUnit> {
  pattern: AreaPattern;
  caster: T;
  /** primary target (SINGLE / LINE / TARGET-centred areas) */
  primary: T | null;
  center?: AreaCenter;
  /** valid units of the affected team (already filtered: alive, targetable, on the battlefield) */
  candidates: T[];
}

const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/**
 * Attack direction from the caster to the target: column step (never 0 — units face the enemy side)
 * and lane step (only when the target is on another lane and the column is the same).
 */
function direction(from: Cell, to: Cell, facing: 1 | -1): { dc: number; dr: number } {
  const dc = sign(to.c - from.c) || facing;
  const dr = to.c === from.c ? sign(to.r - from.r) : 0;
  return { dc, dr };
}

/**
 * AreaResolver — standardized AoE shapes on the logical grid (8-direction distance).
 * The primary target (when inside the area) is always first; each unit appears once (no double hits).
 */
/**
 * the cell directly in front of the caster (toward the primary target, else the enemy side) — ground-targeted
 * areas (FRONT_CELL / FRONT_3X3) are anchored here, not on a unit, so stacked units never move the effect
 */
export function frontCell<T extends AreaUnit>(caster: T, primary: T | null, candidates: T[]): Cell {
  const facing: 1 | -1 = candidates.some(c => c.pos.c > caster.pos.c) || !candidates.length ? 1 : -1;
  const dc = primary ? direction(caster.pos, primary.pos, facing).dc : facing;
  return { r: caster.pos.r, c: caster.pos.c + dc };
}

/**
 * ground-targeted shapes, [columns ahead, lane offset, main?] from the caster — anchored on the caster's own cell and
 * facing, never on a unit: every unit standing in a marked cell is hit (stacked units included). `main` cells take the
 * DAMAGE primary multiplier, the others the secondary (splash).
 */
export const GROUND_SHAPES: Partial<Record<AreaPattern, [number, number, boolean][]>> = {
  FRONT_CELL: [[1, 0, true]],
  FRONT_3X3: [[0, -1, false], [0, 0, false], [0, 1, false], [1, -1, false], [1, 0, true], [1, 1, false], [2, -1, false], [2, 0, false], [2, 1, false]],
  // [main][main] — the two cells straight ahead
  FRONT_LINE_2: [[1, 0, true], [2, 0, true]],
  // the column in front: up / front / down
  FRONT_COLUMN_3: [[1, -1, true], [1, 0, true], [1, 1, true]],
  // main in front, splash above / below it and one cell further
  FRONT_CROSS: [[1, 0, true], [1, -1, false], [1, 1, false], [2, 0, false]],
  // main in front, splash on the cells above / below it (Garrick Hammerfall)
  FRONT_T3: [[1, 0, true], [1, -1, false], [1, 1, false]],
  // the 4 cells straight ahead, all main (Kael Ashen Rupture: one sword wave down the lane)
  FRONT_LINE_4: [[1, 0, true], [2, 0, true], [3, 0, true], [4, 0, true]],
};

/** the ground shape cell a unit stands in: true = main, false = splash, null = outside */
export function groundCell<T extends AreaUnit>(pattern: AreaPattern, caster: T, primary: T | null, candidates: T[], u: T): boolean | null {
  const shape = GROUND_SHAPES[pattern];
  if (!shape) return null;
  const f = frontCell(caster, primary, candidates);
  const dir = f.c - caster.pos.c;
  for (const [dc, dr, main] of shape) if (u.pos.c === caster.pos.c + dc * dir && u.pos.r === caster.pos.r + dr) return main;
  return null;
}

/** Centre of the existing oriented 2×2 footprint, shared by targeting and ground presentation. */
export function square2Center(caster: Cell, primary: Cell, facing: 1 | -1 = 1): Cell {
  return { r: Math.max(0, Math.min(LANES - 2, primary.r)) + 0.5,
    c: primary.c + (sign(primary.c - caster.c) || facing) * 0.5 };
}

export function resolveArea<T extends AreaUnit>(q: AreaQuery<T>): T[] {
  const { pattern, caster, primary, candidates } = q;
  const centerCell = (q.center ?? 'TARGET') === 'SELF' || !primary ? caster.pos : primary.pos;
  const facing: 1 | -1 = candidates.some(c => c.pos.c > caster.pos.c) || !candidates.length ? 1 : -1;
  let hit: T[];
  switch (pattern) {
    case 'SINGLE':
      hit = primary && candidates.includes(primary) ? [primary] : [];
      break;
    case 'SQUARE_2': {
      // Primary cell + one column toward the enemy; choose the next lane, or the previous at the bottom edge.
      const dc = primary ? direction(caster.pos, primary.pos, facing).dc as 1 | -1 : facing;
      const at = square2Center(caster.pos, centerCell, dc);
      hit = candidates.filter(u => Math.abs(u.pos.r - at.r) <= 0.5 && Math.abs(u.pos.c - at.c) <= 0.5);
      break;
    }
    case 'ADJACENT_8':
      hit = candidates.filter(u => distance(u.pos, centerCell) <= 1);
      break;
    case 'CROSS_1':
      hit = candidates.filter(u => Math.abs(u.pos.r - centerCell.r) + Math.abs(u.pos.c - centerCell.c) <= 1);
      break;
    case 'RADIUS_2':
      hit = candidates.filter(u => distance(u.pos, centerCell) <= 2);
      break;
    case 'RADIUS_3':
      hit = candidates.filter(u => distance(u.pos, centerCell) <= 3);
      break;
    case 'ALL_ALLIES':
    case 'ALL_ENEMIES':
      hit = [...candidates];
      break;
    case 'FRONT_CELL':
    case 'FRONT_3X3':
    case 'FRONT_LINE_2':
    case 'FRONT_COLUMN_3':
    case 'FRONT_CROSS':
    case 'FRONT_T3':
    case 'FRONT_LINE_4':
      // ground-targeted: every unit in the shape's cells (any number stacked), main cells first
      hit = candidates.filter(u => groundCell(pattern, caster, primary, candidates, u) !== null);
      hit = [...hit.filter(u => groundCell(pattern, caster, primary, candidates, u)), ...hit.filter(u => !groundCell(pattern, caster, primary, candidates, u))];
      break;
    case 'FRONT_ARC': {
      // short cone in front of the caster: its own column (sides / stacked foes) up to 2 columns ahead, within ±1 lane
      const dir = primary ? direction(caster.pos, primary.pos, facing).dc : facing;
      hit = candidates.filter(u => {
        const ahead = (u.pos.c - caster.pos.c) * dir;
        return ahead >= 0 && ahead <= 2 && Math.abs(u.pos.r - caster.pos.r) <= 1;
      });
      break;
    }
    case 'LINE_2':
    case 'LINE_3': {
      if (!primary || !candidates.includes(primary)) {
        hit = [];
        break;
      }
      // primary + the next unit(s) straight behind it along the attack direction (one unit per cell)
      const { dc, dr } = direction(caster.pos, primary.pos, facing);
      const n = pattern === 'LINE_2' ? 1 : 2;
      hit = [primary];
      for (let k = 1; k <= n; k++) {
        const cell = { r: primary.pos.r + dr * k, c: primary.pos.c + dc * k };
        const next = candidates.filter(u => !hit.includes(u) && u.pos.r === cell.r && u.pos.c === cell.c).sort((a, b) => a.id - b.id)[0];
        if (next) hit.push(next);
      }
      break;
    }
  }
  if (primary && hit.includes(primary)) hit = [primary, ...hit.filter(u => u !== primary)];
  return hit;
}
