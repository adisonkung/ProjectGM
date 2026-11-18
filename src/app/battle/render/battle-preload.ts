/**
 * Pre-battle warm-up: fetch + decode every image the fight will draw before the board appears (the first cast of a
 * cold session used to miss its VFX while the strip was still loading). Presentation only — never touches the engine.
 *
 * - With the Pixi renderer each sprite strip goes through `Assets.load` (the same URL string PixiUnitLayer uses), so the
 *   layer finds the texture already in Pixi's cache; the Pixi chunk itself is fetched here too.
 * - Plain images (backgrounds, banners, DOM renderer) are decoded with HTMLImageElement.decode().
 * - A file that fails or exceeds its timeout is skipped; the whole run is capped by `budgetMs`. Never throws.
 */
export interface PreloadJob {
  /** sprite strips (sprites/… URLs, spriteUrl()) */
  sprites: string[];
  /** other images (absolute or relative URLs) */
  images: string[];
  pixi: boolean;
  onProgress?: (done: number, total: number) => void;
  /** per file */
  timeoutMs?: number;
  /** whole run */
  budgetMs?: number;
  /** set `cancelled` to stop early (route left / prepare()) */
  token?: { cancelled: boolean };
}

const CONCURRENCY = 6;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(null); });
  });
}

export function decodeImage(url: string): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(false);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(() => true, () => false);
}

type AssetsLike = { load: (url: string) => Promise<unknown> };

export async function preloadBattle(job: PreloadJob): Promise<{ loaded: number; failed: number }> {
  const timeout = job.timeoutMs ?? 6000;
  const tasks: (() => Promise<unknown>)[] = [];
  let assets: AssetsLike | null = null;
  if (job.pixi) {
    tasks.push(() => withTimeout(import('./pixi-units'), timeout));
    assets = await withTimeout(import('pixi.js').then(m => m.Assets as unknown as AssetsLike), timeout);
  }
  for (const url of job.sprites) tasks.push(() => assets ? withTimeout(assets.load(url), timeout) : withTimeout(decodeImage(url), timeout));
  for (const url of job.images) tasks.push(() => withTimeout(decodeImage(url), timeout));
  const total = tasks.length;
  let done = 0;
  let loaded = 0;
  job.onProgress?.(0, total);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length && !job.token?.cancelled) {
      const ok = await tasks[next++]();
      done++;
      if (ok) loaded++;
      job.onProgress?.(done, total);
    }
  };
  const all = Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  await withTimeout(all, job.budgetMs ?? 10000);
  return { loaded, failed: done - loaded };
}
