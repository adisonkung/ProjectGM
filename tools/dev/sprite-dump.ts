/**
 * Prints what the sprite optimizer (tools/sprites/optimize.py) needs to know about every file in public/sprites:
 * FX strips (frames in the file, frame size) and character sheets (grid) — JSON on stdout.
 * npm run sprites:dump > dist/sprite-dump.json
 */
import { FX, SHEETS } from '../../src/app/core/data/sprites';

declare const console: { log(s: string): void };
const out: Record<string, unknown> = {};
for (const [name, d] of Object.entries(FX)) {
  const strip = d.stripFrames ?? d.frames;
  const prev = out[d.file] as { strip: number; names: string[] } | undefined;
  if (prev && prev.strip !== strip) throw new Error(`${d.file}: ${name} says ${strip} frames, another FX says ${prev.strip}`);
  out[d.file] = { kind: 'fx', strip, w: d.w, h: d.h, pixelated: !!d.pixelated, names: [...(prev?.names ?? []), name] };
}
for (const [file, d] of Object.entries(SHEETS)) {
  out[file] = { kind: 'sheet', cols: d.cols, rows: d.rows, cellW: d.cellW ?? 132, cellH: d.cellH ?? 100, pixelated: !!d.pixelated };
}
console.log(JSON.stringify(out, null, 1));
