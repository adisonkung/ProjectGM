import { Cell, UnitFootprint } from '../../core/models/unit';
import { Grid } from './grid';

export interface SpatialUnit { pos: Cell; footprint?: UnitFootprint }

export function footprintBounds(u: SpatialUnit) {
  const f = u.footprint;
  const r0 = u.pos.r - (f?.anchorR ?? 0), c0 = u.pos.c - (f?.anchorC ?? 0);
  return { r0, c0, r1: r0 + (f?.rows ?? 1) - 1, c1: c0 + (f?.cols ?? 1) - 1 };
}

export function occupiesCell(u: SpatialUnit, c: Cell): boolean {
  const b = footprintBounds(u);
  return c.r >= b.r0 && c.r <= b.r1 && c.c >= b.c0 && c.c <= b.c1;
}

export function footprintCells(u: SpatialUnit): Cell[] {
  const b = footprintBounds(u), cells: Cell[] = [];
  for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) {
    if (Grid.inBounds({ r,c })) cells.push({ r,c });
  }
  return cells;
}

/** Chebyshev distance between logical bodies. Point-sized units retain their existing range exactly. */
export function unitDistance(a: SpatialUnit, b: SpatialUnit): number {
  if (!a.footprint && !b.footprint) return Math.max(Math.abs(a.pos.r-b.pos.r),Math.abs(a.pos.c-b.pos.c));
  const x = footprintBounds(a), y = footprintBounds(b);
  return Math.max(0, x.r0 - y.r1, y.r0 - x.r1, x.c0 - y.c1, y.c0 - x.c1);
}
