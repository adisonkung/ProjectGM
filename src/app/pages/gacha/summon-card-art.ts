/** Presentation assets for the existing 1–3★ system; does not add roster entries or rates. */
export function summonCardBack(star: number): string {
  if (star <= 1) return '/ui/eldervane/summon-card-common.webp';
  if (star === 2) return '/ui/eldervane/summon-card-uncommon.webp';
  return '/ui/eldervane/summon-card-celestial.webp';
}
