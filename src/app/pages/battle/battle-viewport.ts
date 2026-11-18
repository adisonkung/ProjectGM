import { BOARD_COLS, BOARD_ROWS, SCENERY_ROWS } from '../../battle/engine/grid';
/** Reference proportions, with square combat cells and a bounded, unstretched upper crop. */
export function battleViewport(width: number, height: number, groundRows = .8, skyRows = 0) {
  const landscapePhone = width > height && height <= 500;
  const portraitPhone = width <= 700 && height > width;
  const gap = landscapePhone ? 8 : 112;
  const frameLimit = Math.min(1922, Math.max(18, width - (landscapePhone ? 8 : 32)));
  const rows = BOARD_ROWS + SCENERY_ROWS;
  // Decorative floor below the last lane; never part of movement, targeting or placement.
  const available = Math.max(1, height - gap - 2);
  const dockRows = landscapePhone ? 2.1 : 2.25;
  const cell = Math.max(1, Math.min(120, (frameLimit - 2) / BOARD_COLS, (available - 8) / (rows + skyRows + groundRows + dockRows)));
  const foot = cell * dockRows + 8;
  // Match sheet 11B rather than filling tall screens by stretching the trees.
  const extraRows = skyRows + (landscapePhone || portraitPhone ? 0 : Math.max(0, Math.min(.65, (available - foot - cell * (rows + skyRows + groundRows)) / cell)));
  return { cell, extraRows, groundRows, foot, width: cell * BOARD_COLS + 2, height: cell * (rows + extraRows + groundRows) + foot + 2 };
}

/**
 * Full-screen fight (mobile-landscape style, every screen size): the 16 columns fill the window width when the height
 * allows, square cells, nothing stretched. The party dock floats over the bottom (it may cover the decorative floor
 * rows, never a lane); sky the art cannot supply is left to the blurred backdrop.
 *  - `maxExtra`: extra sky rows the stage art can reveal (beyond `skyRows`, which a background requires)
 *  - `foot`: the ground strip under the lanes, sized so the board reaches the bottom of the window
 *  - `dock`: party dock height (px) · `partyCell`: cell size the party cards are drawn with (capped on big screens)
 */
export function fullscreenViewport(width: number, height: number, groundRows = .8, skyRows = 0, maxExtra = 0) {
  const phone = height <= 500;
  const rows = BOARD_ROWS + SCENERY_ROWS;
  const dockRows = phone ? 1.85 : 1.95;
  const partyCap = phone ? 60 : 84;
  const W = Math.max(1, width), H = Math.max(1, height);
  // the dock may hide up to 60 % of the decorative floor; lanes and sky stay clear
  let cell = Math.max(1, Math.min(140, W / BOARD_COLS, H / (rows + skyRows + groundRows * .4 + dockRows)));
  const partyCell = Math.min(cell, partyCap);
  const dock = partyCell * dockRows;
  cell = Math.max(1, Math.min(cell, (H - dock) / (rows + skyRows + groundRows * .4)));
  const spare = (H - dock - cell * (rows + skyRows + groundRows)) / cell;
  const extraRows = skyRows + Math.max(0, Math.min(maxExtra, spare));
  const foot = Math.max(0, H - cell * (rows + extraRows + groundRows));
  return { cell, extraRows, groundRows, foot, dock, partyCell, width: cell * BOARD_COLS, height: cell * (rows + extraRows + groundRows) + foot };
}
