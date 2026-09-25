/**
 * Visual definitions — kept apart from MonsterDefinition so gameplay never depends on art.
 * A monster points at one with `MonsterDefinition.visual`; when real art arrives, switch that entry to
 * `{ kind: 'sprite', sheet }` (or give the monster `animation.sheet`) — no gameplay data changes.
 *
 * MOCK = placeholder shape drawn in CSS: shape + body colour + accent (outline / eyes) + size (× cell).
 */
export type MockShape = 'circle' | 'cap' | 'diamond' | 'square' | 'triangle' | 'hex' | 'wisp';

export interface MockVisual {
  kind: 'mock';
  shape: MockShape;
  color: string;
  accent: string;
  /** body size relative to a normal unit (1 = 60% of a cell) */
  size: number;
  /** translucent body (spirits / mist) */
  ghost?: boolean;
  /** short text drawn on the body */
  glyph?: string;
}

export interface SpriteVisual {
  kind: 'sprite';
  sheet: string;
}

export type VisualDefinition = MockVisual | SpriteVisual;

export const VISUALS: Record<string, VisualDefinition> = {
  mock_magic_mushroom: { kind: 'mock', shape: 'cap', color: '#b0453f', accent: '#f6e7c8', size: 0.85, glyph: '•' },
  mock_forest_spirit: { kind: 'mock', shape: 'wisp', color: '#5ee0d0', accent: '#e8fffb', size: 0.8, ghost: true },
  mock_shadow_panther: { kind: 'mock', shape: 'diamond', color: '#2a2140', accent: '#c68bff', size: 0.95 },
  mock_goblin_guard: { kind: 'mock', shape: 'square', color: '#4f7a3a', accent: '#c9d6a3', size: 1, glyph: '▣' },
  mock_goblin_shaman: { kind: 'mock', shape: 'triangle', color: '#5d8f3b', accent: '#8cff9c', size: 0.9, glyph: '✚' },
  mock_elder_treant: { kind: 'mock', shape: 'hex', color: '#6b4a2b', accent: '#9fd36a', size: 1.6, glyph: '♣' },
  mock_corrupted_wolf: { kind: 'mock', shape: 'diamond', color: '#5a1f2a', accent: '#ff5a5a', size: 0.95 },
  mock_mist_wraith: { kind: 'mock', shape: 'wisp', color: '#9aa6b8', accent: '#e8eef8', size: 0.9, ghost: true },
  mock_corrupted_treant: { kind: 'mock', shape: 'square', color: '#3d2f24', accent: '#8a5ab8', size: 1.25, glyph: '♣' },
  mock_dark_shaman: { kind: 'mock', shape: 'triangle', color: '#3b2552', accent: '#c78cff', size: 0.95, glyph: '☽' },
  mock_mist_witch: { kind: 'mock', shape: 'triangle', color: '#57477a', accent: '#d3c2ff', size: 0.95, glyph: '✦' },
  mock_fallen_guardian: { kind: 'mock', shape: 'hex', color: '#1f1a1a', accent: '#ff3b3b', size: 1.9, glyph: '✹' },
};

export const visualOf = (id: string | undefined): VisualDefinition | undefined => (id ? VISUALS[id] : undefined);
export const mockVisualOf = (id: string | undefined): MockVisual | undefined => {
  const v = visualOf(id);
  return v?.kind === 'mock' ? v : undefined;
};

/** status → small icon over the head (mock mode and real art alike) */
export const STATUS_ICONS: Record<string, string> = {
  poison: '☠', bleed: '🩸', corruption: '☣', root: '🌿', stun: '💫', untargetable: '👻', boss_seal: '🔒',
  dark_fog: '🌫', soul_link: '🔗', broken: '💥', healing_reduction: '💔', panther_frenzy: '⚡', enraged_forest: '😡',
  guardian_empowered: '🩸', guardian_enrage: '🔥', taunted: '❗', alpha_howl_buff: '🐺', blood_rage: '😡',
};
