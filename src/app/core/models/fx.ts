/** Presentation-only curves, milliseconds relative to the visible start of one FX instance. */
export interface FxTrack {
  durationMs: number;
  alpha: [number, number][];
  /** Board-cell percent, x forward along the instance's facing. */
  motion?: [number, number, number][];
  scale?: [number, number][];
  /** Explicit source-frame state, held until the next key (reverse strips / accumulated cuts). */
  frames?: [number, number][];
  /** Reveal the original ribbon from its left edge, without stretching pixels. */
  reveal?: [number, number][];
  /** A stable energy loop after the initial strike; sampled on game time, ending before the shared fade. */
  cycle?: { fromMs: number; untilMs: number; periodMs: number;
    alpha?: [number, number]; reveal?: [number, number] };
}
