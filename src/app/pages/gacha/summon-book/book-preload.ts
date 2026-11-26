import { HEROES } from '../../../core/data/heroes';
import { heroArt } from '../../../core/data/hero-art';
import { BOOK_ART, BOOK_ART_DIR } from './book-assets';
import { preloadBookCardType } from './book-card-type';
import { HERO_STAR_LIT } from '../../../shared/hero-star-art';

/** Keep decoded images, not just fire-and-forget HTTP requests. Three reuses these exact images. */
const images = new Map<string, Promise<HTMLImageElement>>();
export const BOOK_PORTRAITS: Record<string, string> = Object.fromEntries(HEROES.flatMap(h => {
  const portrait = heroArt(h.id)?.portrait;
  return portrait ? [[h.id, '/' + portrait]] : [];
}));
let warming: Promise<void> | undefined;

export function loadBookImage(url: string): Promise<HTMLImageElement> {
  const cached = images.get(url);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => { image.decode().then(() => resolve(image), reject); };
    image.onerror = () => reject(new Error('Cannot load summon art: ' + url));
    image.src = url;
  }).catch(error => { images.delete(url); throw error; });
  images.set(url, pending);
  return pending;
}

/** Start on route entry. Bound concurrency so loading the room does not crowd out the visible page. */
export function preloadBookImages(): Promise<void> {
  if (warming) return warming;
  const urls = [...new Set([BOOK_ART_DIR + BOOK_ART['plateA'], ...Object.values(BOOK_ART).map(f => BOOK_ART_DIR + f), BOOK_ART_DIR + 'blank.webp', HERO_STAR_LIT, ...Object.values(BOOK_PORTRAITS)])];
  let next = 0;
  warming = Promise.all([preloadBookCardType(), ...Array.from({ length: 6 }, async () => {
    while (next < urls.length) await loadBookImage(urls[next++]);
  })]).then(() => {
    // Hero-intro banners start on entry too, after the room's critical images; they do not delay room readiness.
    const banners = HEROES.flatMap(h => { const banner = heroArt(h.id)?.banner; return banner ? ['/' + banner] : []; });
    let banner = 0;
    void Promise.all(Array.from({ length: 3 }, async () => {
      while (banner < banners.length) await loadBookImage(banners[banner++]).catch(() => {});
    }));
  }).catch(error => { warming = undefined; throw error; });
  return warming;
}
