/** Self-hosted Thai face shared with the approved summon controls. Load before baking canvas labels. */
const THAI_FACE = '"Eldervane Summon Serif", serif';
let ready: Promise<void> | undefined;

export function preloadBookCardType(): Promise<void> {
  if (!ready) {
    ready = document.fonts.load('600 64px ' + THAI_FACE, 'เวลริค น็อกธาร์').then(() => {}).catch(error => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
}

/** Centre the visible glyphs, including Thai overhangs; fit long names inside the same safe area. */
function fittedName(g: CanvasRenderingContext2D, text: string, family: string, size: number,
  center: number, baseline: number, maxWidth: number): void {
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.direction = 'ltr';
  let metrics: TextMetrics;
  for (;;) {
    g.font = `normal 600 ${size}px ${family}`;
    metrics = g.measureText(text);
    const width = Math.max(metrics.width, metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight);
    if (width <= maxWidth || size <= 28) break;
    size = Math.max(28, Math.floor(size * maxWidth / width) - 1);
  }
  g.fillText(text, center + (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2, baseline);
}

export function drawBookCardNames(g: CanvasRenderingContext2D, th: string, en: string,
  width: number, height: number, accent: string): void {
  g.save();
  g.fillStyle = accent;
  g.globalAlpha = .88;
  fittedName(g, en.toUpperCase().split('').join('\u200a'), 'Georgia, serif', 32, width / 2, height - 250, width * .84);
  g.globalAlpha = 1;
  g.fillStyle = '#fff4df';
  g.shadowColor = 'rgba(0,0,0,.8)';
  g.shadowBlur = 10;
  fittedName(g, th, THAI_FACE, 64, width / 2, height - 170, width * .84);
  g.restore();
}
