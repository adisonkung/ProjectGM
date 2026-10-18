/** Inventory of supplied art, not final skill/FX production or balance approval. */
export const ELIRA_PRODUCTION = {
  heroId: 'elira', phase: 'ALL_SKILLS_PROVISIONAL_REVIEW', timing: 'AWAITING_FINAL_SYNC',
  sourceSlots: { base: 'art/incoming/elira/base.png', reference: 'art/incoming/elira/reference.png', s1: 'art/incoming/elira/s1', s2: 'art/incoming/elira/s2', ult: 'art/incoming/elira/ult' },
  sources: {
    base: { file: 'Elira Dawnmere Cleric Sprite Sheet.png', sha256: 'bc5d315a1ee50f30065b48a6af63501b9544dde608f746e21378257f18939409' },
    reference: { file: 'Sunrise Cleric Character Concept Sheet.png', sha256: '3104c273ad2831344c77e655ed859310a23acb8104461892d7c5e3ba5b39eba5' },
  },
  clips: {
    skill: { label: 'Hearthlight Blessing', state: 'PROVISIONAL_REVIEW', finalSync: 'AWAITING_REVIEW', frames: 10,
      assets: ['CHARACTER', 'CASTER_MAIN', 'TARGET_IMPACT'], charge: 'NO_SEPARATE_SOURCE',
      workbookSha256: 'c7eb125d6848f5834f5f75521725b491fef053a1bfb16e689ed555ce67b95124' },
    skill2: { label: 'Sanctuary Veil', state: 'PROVISIONAL_REVIEW', finalSync: 'AWAITING_REVIEW', frames: 10,
      assets: ['CHARACTER', 'TARGET_MAIN', 'TARGET_IMPACT'], charge: 'NO_SEPARATE_SOURCE',
      workbookSha256: 'b7842ad712fee8796083279f299f070e774f6dabb137494ed82455994cbcf9ae' },
    ult: { label: 'Hearthlight Sanctuary', state: 'PROVISIONAL_REVIEW', finalSync: 'AWAITING_REVIEW', frames: 10,
      workbookSha256: 'e3b8ed82e24ddfc401ff881d1136761a05986eb654db1832c2a83a67c3d6375b',
      columns: 6, lanes: 3, assets: ['CHARGE', 'DOME_FORMATION', 'DOME_LOOP', 'DOME_DISSOLVE'] },
  },
  uiArt: { portrait: 'SUPPLIED', skillIcons: 'SUPPLIED', banner: 'SUPPLIED', archive: 'Elira_icn.zip' },
} as const;
