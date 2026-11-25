import { Injectable } from '@angular/core';
import { BattleLoadToken } from './battle-entry-assets';

export interface PreloadJob {
  sprites: string[];
  images: string[];
  pixi: boolean;
  onProgress?: (loaded: number, total: number) => void;
  timeoutMs?: number;
  token?: BattleLoadToken;
}
export interface PreloadResult {
  loaded: number;
  total: number;
  failed: string[];
  pixiAvailable: boolean;
}
const CONCURRENCY = 6;

function bounded<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve(null); });
  });
}

export function decodeImage(url: string): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(false);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image.decode().then(() => true, () => false);
}

/** All required images must succeed. Timeouts/failures stay below 100% and require retry. */
export async function preloadBattle(job: PreloadJob): Promise<PreloadResult> {
  const timeout = job.timeoutMs ?? 15000;
  const files = [...new Set([...job.sprites, ...job.images])];
  const result: PreloadResult = { loaded: 0, total: files.length, failed: [], pixiAvailable: false };
  const report = () => { if (!job.token?.cancelled) job.onProgress?.(result.loaded, result.total); };
  report();
  type AssetsLike = { load(url: string): Promise<unknown> };
  let assets: AssetsLike | null = null;
  if (job.pixi && !job.token?.cancelled) {
    // A missing WebGL/chunk still permits the existing DOM fallback, after decoding the same sheets.
    const modules = await bounded(Promise.all([import('pixi.js'), import('./pixi-units')]), timeout);
    if (modules) { assets = modules[0].Assets; result.pixiAvailable = true; }
  }
  const sprites = new Set(job.sprites);
  let next = 0;
  const worker = async () => {
    while (next < files.length && !job.token?.cancelled) {
      const url = files[next++];
      const loaded = await bounded(assets && sprites.has(url) ? assets.load(url).then(Boolean) : decodeImage(url), timeout);
      if (job.token?.cancelled) return;
      if (loaded) result.loaded++; else result.failed.push(url);
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
  return result;
}

/** Injection seam for battle entry: tests can hold real readiness without launching the engine. */
@Injectable({ providedIn: 'root' })
export class BattlePreloadService {
  load(job: PreloadJob): Promise<PreloadResult> { return preloadBattle(job); }
}
