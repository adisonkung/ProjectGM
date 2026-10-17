import { SemanticEvent } from '../models/monster';

/** Production/review state only. Runtime presentation lives in sprites.ts; no final Timeline Sync here. */
interface PendingClip {
  clip: 'skill' | 'skill2' | 'ult';
  state: 'AWAITING_SKILL_REVIEW' | 'PROVISIONAL_REVIEW';
  events: SemanticEvent[];
  assets: { key: string; file: string; role: 'PROJECTILE' | 'CHARGE' | 'MAIN' | 'IMPACT' | 'FIELD' | 'RESIDUAL'; optional?: boolean }[];
}

export const MIRELLE_PRODUCTION = {
  heroId: 'mirelle', phase: 'ULT_REVIEW', timing: 'PROVISIONAL_SKILL_REVIEW',
  approvedReferences: [
    'ChatGPT Image Oct 17, 2026, 12_38_47 AM.png',
    'ChatGPT Image Oct 17, 2026, 12_39_00 AM.png',
  ],
  sourcesAvailableInWorkspace: true,
  sourceSlots: {
    reference: 'art/incoming/mirelle/reference.png', base: 'art/incoming/mirelle/base.png',
    s1: 'art/incoming/mirelle/s1',
    s2: 'art/incoming/mirelle/s2',
    ult: 'art/incoming/mirelle/ult',
  },
  expectedSheet: 'hero-mirelle.png',
  expectedPortrait: 'portraits/mirelle.webp',
  visualIdentity: 'Classic Western Fantasy / Kingdom Adventurers; approved face, hair, proportions, costume and silhouette; spellbook + floating crystal focus; navy / ice blue / muted silver',
  clips: {
    skill: {
      clip: 'skill', state: 'PROVISIONAL_REVIEW',
      events: ['CAST_START', 'PROJECTILE_SPAWN', 'DAMAGE', 'IMPACT', 'RECOVERY_START', 'ANIMATION_END'],
      assets: [
        { key: 'mf-s1-projectile', file: 'fx-mirelle-s1-projectile.png', role: 'PROJECTILE' },
        { key: 'mf-s1-impact', file: 'fx-mirelle-s1-impact.png', role: 'IMPACT' },
      ],
    },
    skill2: {
      clip: 'skill2', state: 'PROVISIONAL_REVIEW',
      events: ['CAST_START', 'SKILL_ACTIVATE', 'VFX_SPAWN', 'DAMAGE', 'IMPACT', 'RECOVERY_START', 'ANIMATION_END'],
      assets: [
        { key: 'mf-s2-main', file: 'fx-mirelle-s2-main.png', role: 'MAIN' },
        { key: 'mf-s2-bind', file: 'fx-mirelle-s2-bind.png', role: 'IMPACT', optional: true },
      ],
    },
    ult: {
      clip: 'ult', state: 'PROVISIONAL_REVIEW',
      events: ['CAST_START', 'CHARGE_START', 'SKILL_ACTIVATE', 'VFX_SPAWN', 'RECOVERY_START', 'ANIMATION_END'],
      assets: [
        { key: 'mf-ult-charge', file: 'fx-mirelle-ult-charge.png', role: 'CHARGE' },
        { key: 'mf-ult-main', file: 'fx-mirelle-ult-main.png', role: 'MAIN' },
        { key: 'mf-ult-field', file: 'fx-mirelle-ult-field.png', role: 'FIELD' },
        { key: 'mf-ult-shatter', file: 'fx-mirelle-ult-shatter.png', role: 'IMPACT', optional: true },
        { key: 'mf-ult-residual', file: 'fx-mirelle-ult-residual.png', role: 'RESIDUAL', optional: true },
      ],
    },
  } satisfies Record<'skill' | 'skill2' | 'ult', PendingClip>,
};
