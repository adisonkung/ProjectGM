/**
 * The state looks the DOM board puts on a `.unit` with CSS (filters on the element, ground rings as ::before / ::after),
 * as data for the Pixi renderer — a filter on the hidden DOM sheet would not show on the canvas.
 *   buffed    → pulsing red-orange glow (drop-shadow 5–9 px, 0.9 s)
 *   enraged   → red glow
 *   reviving  → warm white glow
 *   broken    → darkened sepia + a 2 px jitter
 *   untargetable → partly grey (its 0.4 opacity already comes in through the unit's alpha)
 *   rings     → 5★ / 6★ star aura, elite ring, taunt ring (ground decals under the sprite)
 */
export type GroundRing = 'aura5' | 'aura6' | 'elite' | 'taunt';

export interface UnitLook {
  glow?: number;
  glowPulse?: boolean;
  broken?: boolean;
  gray?: boolean;
  rings?: GroundRing[];
}

export interface LookSource {
  alive: boolean;
  side: string;
  star?: number;
  buffed?: boolean;
  enraged?: boolean;
  reviving?: boolean;
  broken?: boolean;
  untargetable?: boolean;
  elite?: boolean;
  taunt?: boolean;
}

export const LOOK_COLORS = {
  buffed: 0xff5a3c,
  enraged: 0xff2a2a,
  reviving: 0xfff6d0,
  gold: 0xd9b464,
  r5: 0xf0b54a,
  r6: 0xff6fae,
  aura5Rim: 0xffe29a,
  aura6Rim: 0xffc2de,
};

/** the same class conditions as board.component.html */
export function unitLook(u: LookSource): UnitLook | undefined {
  const look: UnitLook = {};
  if (u.reviving) look.glow = LOOK_COLORS.reviving;
  else if (u.alive && u.enraged) look.glow = LOOK_COLORS.enraged;
  else if (u.alive && u.buffed) (look.glow = LOOK_COLORS.buffed), (look.glowPulse = true);
  if (u.alive && u.broken) look.broken = true;
  if (u.alive && u.untargetable) look.gray = true;
  const rings: GroundRing[] = [];
  if (u.taunt) rings.push('taunt');
  else if (u.alive && u.side !== 'enemy' && (u.star ?? 0) >= 6) rings.push('aura6');
  else if (u.alive && u.side !== 'enemy' && u.star === 5) rings.push('aura5');
  if (u.elite) rings.push('elite');
  if (rings.length) look.rings = rings;
  return Object.keys(look).length ? look : undefined;
}

/** ring box in cells (the CSS pseudo-element: centre x 0.5, centre y from the cell top, width, height) */
export const RING_BOX: Record<GroundRing, { cy: number; w: number; h: number }> = {
  aura5: { cy: 1.04 - 0.15, w: 0.92, h: 0.3 },
  aura6: { cy: 1.04 - 0.15, w: 0.92, h: 0.3 },
  elite: { cy: 1.02 - 0.13, w: 0.88, h: 0.26 },
  taunt: { cy: 1 - 0.15, w: 0.8, h: 0.3 },
};
