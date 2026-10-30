import type { SheetDef } from '../../core/data/sprites';

/** Enlarge presentation around the authored feet (14px above the cell bottom), never the combat cell. */
export function unitGeometry(def: Pick<SheetDef, 'cellW' | 'cellH' | 'displayScale'>, cell = 100) {
  const base = cell * 1.65 / 132;
  const k = base * (def.displayScale ?? 1);
  return { k, width: (def.cellW ?? 132) * k, height: (def.cellH ?? 100) * k,
    bottomY: cell * .96 + 14 * (k - base) };
}
