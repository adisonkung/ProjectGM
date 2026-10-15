/**
 * who draws the board: Pixi (WebGL, one game clock — the default since phase 6) or DOM (Web Animations, kept as the
 * fallback: a device without WebGL gets it automatically, and the switch stays in the pause menu / sprite lab).
 * Remembered per browser; the key was bumped with the default change so an old test toggle does not pin DOM.
 */
export type BoardRenderer = 'dom' | 'pixi';

const KEY = 'projectgm-renderer-v2';

export function savedRenderer(fallback: BoardRenderer = 'pixi'): BoardRenderer {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'pixi' || v === 'dom' ? v : fallback;
  } catch {
    return fallback;
  }
}

export function saveRenderer(r: BoardRenderer): void {
  try {
    localStorage.setItem(KEY, r);
  } catch {
    /* private window: just this session */
  }
}
