import { BOARD_COLS, BOARD_ROWS, SCENERY_ROWS } from '../../battle/engine/grid';
/** Reference proportions, with square combat cells and a bounded, unstretched upper crop. */
export function battleViewport(width: number, height: number, groundRows = .8) {
  const landscapePhone = width > height && height <= 500;
  const portraitPhone = width <= 700 && height > width;
  const gap = landscapePhone ? 8 : 112;
  const frameLimit = Math.min(1922, Math.max(18, width - (landscapePhone ? 8 : 32)));
  const rows = BOARD_ROWS + SCENERY_ROWS;
  // Decorative floor below the last lane; never part of movement, targeting or placement.
  const available = Math.max(1, height - gap - 2);
  const dockRows = landscapePhone ? 2.1 : 2.25;
  const cell = Math.max(1, Math.min(120, (frameLimit - 2) / BOARD_COLS, (available - 8) / (rows + groundRows + dockRows)));
  const foot = cell * dockRows + 8;
  // Match sheet 11B rather than filling tall screens by stretching the trees.
  const extraRows = landscapePhone || portraitPhone ? 0 : Math.max(0, Math.min(.65, (available - foot - cell * (rows + groundRows)) / cell));
  return { cell, extraRows, groundRows, foot, width: cell * BOARD_COLS + 2, height: cell * (rows + extraRows + groundRows) + foot + 2 };
}
