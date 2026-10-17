/** Inventory of supplied art, not final skill/FX production or balance approval. */
export const ELIRA_PRODUCTION = {
  heroId: 'elira', phase: 'BASE_AND_PROVISIONAL_GAMEPLAY', timing: 'BASE_FALLBACK',
  sourceSlots: { base: 'art/incoming/elira/base.png', reference: 'art/incoming/elira/reference.png' },
  sources: {
    base: { file: 'Elira Dawnmere Cleric Sprite Sheet.png', sha256: 'bc5d315a1ee50f30065b48a6af63501b9544dde608f746e21378257f18939409' },
    reference: { file: 'Sunrise Cleric Character Concept Sheet.png', sha256: '3104c273ad2831344c77e655ed859310a23acb8104461892d7c5e3ba5b39eba5' },
  },
  clips: {
    skill: { label: 'Hearthlight Blessing', state: 'AWAITING_SOURCE', finalSync: 'PENDING' },
    skill2: { label: 'Sanctuary Veil', state: 'AWAITING_SOURCE', finalSync: 'PENDING' },
    ult: { label: 'Hearthlight Sanctuary', state: 'AWAITING_SOURCE', finalSync: 'PENDING',
      columns: 6, lanes: 3, assets: ['CHARGE', 'DOME_FORMATION', 'DOME_LOOP', 'DOME_DISSOLVE'] },
  },
  uiArt: { portrait: 'REFERENCE_CROP', skillIcons: 'AWAITING_SOURCE', banner: 'AWAITING_SOURCE' },
} as const;
