import { Injectable, signal } from '@angular/core';
import { SKY_CITY_ASSETS } from '../data/sky-city';

/**
 * Loads + decodes the Sky City art once, as soon as the app starts, so the island never paints half-loaded or hitches
 * while a big image decodes mid-animation. The decoded images are kept referenced for the whole session.
 */
@Injectable({ providedIn: 'root' })
export class PreloadService {
  /** 0–1 */
  readonly progress = signal(0);
  readonly ready = signal(false);
  private readonly keep: HTMLImageElement[] = [];
  private readonly loaded = new Map<string, HTMLImageElement>();

  /** a decoded image of the city art (null until it has loaded) — the canvas renderer draws from these */
  image(src: string): HTMLImageElement | null {
    const hit = this.loaded.get(src);
    if (hit) return hit;
    if (typeof Image === 'undefined') return null;
    // not part of the preload list (or not started yet): load it now, draw it once it is there
    if (!this.keep.some(i => i.dataset['src'] === src)) {
      const img = new Image();
      img.dataset['src'] = src;
      img.onload = () => this.loaded.set(src, img);
      img.src = src;
      this.keep.push(img);
    }
    return null;
  }
  private started: Promise<void> | null = null;

  /** start (or join) the city preload; never rejects — a missing file just counts as done */
  warmCity(timeoutMs = 15000): Promise<void> {
    return (this.started ??= this.load(SKY_CITY_ASSETS, timeoutMs));
  }

  private async load(urls: readonly string[], timeoutMs: number): Promise<void> {
    if (typeof Image === 'undefined' || !urls.length) {
      this.progress.set(1);
      this.ready.set(true);
      return;
    }
    let done = 0;
    const one = (src: string) =>
      new Promise<void>(res => {
        const img = new Image();
        img.decoding = 'async';
        img.dataset['src'] = src;
        this.keep.push(img);
        const fin = () => {
          if (img.naturalWidth) this.loaded.set(src, img);
          this.progress.set(++done / urls.length);
          res();
        };
        img.onload = () => (img.decode ? img.decode().then(fin, fin) : fin());
        img.onerror = fin;
        img.src = src;
      });
    await Promise.race([Promise.all(urls.map(one)), new Promise<void>(r => setTimeout(r, timeoutMs))]);
    this.progress.set(1);
    this.ready.set(true);
  }
}
