/**
 * Sheets wider / taller than the GPU's MAX_TEXTURE_SIZE (8192 on many devices and in software GL; FX strips here
 * reach 11 174 px) draw black when uploaded whole. They are cut into chunks of whole frames instead — each chunk a
 * canvas within the limit — and a frame is a sub-rectangle of its chunk. Small sheets keep one texture.
 */
export interface FrameChunk {
  /** chunk key (column / row group) */
  cx: number;
  cy: number;
  /** the chunk's rectangle in the image (px) */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** the frame's top-left inside the chunk */
  fx: number;
  fy: number;
}

export function frameChunk(col: number, row: number, fw: number, fh: number, imgW: number, imgH: number, max: number): FrameChunk {
  const per = Math.max(1, Math.floor(max / fw));
  const perR = Math.max(1, Math.floor(max / fh));
  const cx = Math.floor(col / per);
  const cy = Math.floor(row / perR);
  const sx = Math.round(cx * per * fw);
  const sy = Math.round(cy * perR * fh);
  return {
    cx,
    cy,
    sx,
    sy,
    sw: Math.min(Math.round((cx + 1) * per * fw), imgW) - sx,
    sh: Math.min(Math.round((cy + 1) * perR * fh), imgH) - sy,
    fx: col * fw - sx,
    fy: row * fh - sy,
  };
}
