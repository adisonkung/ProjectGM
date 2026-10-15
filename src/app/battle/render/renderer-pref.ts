/** who draws the board: DOM (Web Animations) or Pixi (WebGL, one game clock) — remembered per browser */
export type BoardRenderer = 'dom' | 'pixi';

const KEY = 'projectgm-renderer';

export function savedRenderer(fallback: BoardRenderer = 'dom'): BoardRenderer {
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
