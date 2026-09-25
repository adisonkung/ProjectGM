/**
 * Visual definitions — kept apart from MonsterDefinition so gameplay never depends on art.
 * A monster points at one with `MonsterDefinition.visual`; when real art arrives, switch that entry to
 * `{ kind: 'sprite', sheet }` (or give the monster `animation.sheet`) — no gameplay data changes.
 *
 * MOCK = placeholder shape drawn in CSS: shape + body colour + accent (outline / eyes) + size (× cell).
 */
export type MockShape = 'circle' | 'capsule' | 'square' | 'cap' | 'diamond' | 'triangle' | 'hex' | 'wisp';

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
  // shapes / colours from the Stage 4–10 design spec (MOCK VISUAL REQUIREMENTS)
  mock_magic_mushroom: { kind: 'mock', shape: 'circle', color: '#8e44c9', accent: '#e9d4ff', size: 0.85 },
  mock_forest_spirit: { kind: 'mock', shape: 'circle', color: '#34d6e0', accent: '#e8fffe', size: 0.8 },
  mock_shadow_panther: { kind: 'mock', shape: 'capsule', color: '#15121c', accent: '#b98bff', size: 0.95 },
  mock_goblin_guard: { kind: 'mock', shape: 'square', color: '#7a5230', accent: '#e0c79a', size: 1 },
  mock_goblin_shaman: { kind: 'mock', shape: 'circle', color: '#3f9a3a', accent: '#d8ffb0', size: 0.9, glyph: '⚚' },
  mock_elder_treant: { kind: 'mock', shape: 'capsule', color: '#6b4726', accent: '#b6e07a', size: 1.6 },
  mock_corrupted_wolf: { kind: 'mock', shape: 'circle', color: '#6e1620', accent: '#ff6a6a', size: 0.9 },
  mock_mist_wraith: { kind: 'mock', shape: 'circle', color: '#5d8fe0', accent: '#e4efff', size: 0.9, ghost: true },
  mock_corrupted_treant: { kind: 'mock', shape: 'square', color: '#1f4a2a', accent: '#8fd08a', size: 1.3 },
  mock_dark_shaman: { kind: 'mock', shape: 'circle', color: '#5a2d78', accent: '#7fe07a', size: 0.95, glyph: '☽' },
  mock_mist_witch: { kind: 'mock', shape: 'circle', color: '#8a5ad6', accent: '#f0e4ff', size: 0.95, glyph: '✦' },
  mock_fallen_guardian: { kind: 'mock', shape: 'capsule', color: '#5a0f14', accent: '#ff4a3a', size: 2 },
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
