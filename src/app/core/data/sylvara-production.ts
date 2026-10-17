/** Asset inventory only; pending files are never registered as runtime sheets/FX. */
export const SYLVARA_PRODUCTION = {
  heroId: 'sylvara', phase: 'BASE_ART_AND_GAMEPLAY', timing: 'PROVISIONAL_BASIC_FALLBACK',
  rarity: 'PROVISIONAL_3_STAR', fxPrefix: 'sw',
  approvedArchive: 'sylvara_base.zip',
  approvedSources: {
    base: { file: 'Sylvara_base_combat.png', sha256: '0b5d35e73d54d21c6b81f5ec1fb8acc356b1eccb7bdbce5b3cc457b1999a64cf' },
    reference: { file: 'Sylvara_master_reference.png', sha256: '6736b2f7c4dbdff7b9145ca5348d680d208fe8e6ad854ab4aa62f6dc23d8749c' },
  },
  visualIdentity: 'Classic Fantasy / Kingdom Adventurers; female elf, emerald hunter clothing, brown leather, gold leaf motifs, Elven Longbow; Wind / Nature',
  clips: {
    skill: { state: 'AWAITING_SOURCE', proposedLabel: 'Emerald Piercer', assets: ['CHARACTER', 'CHARGE', 'PROJECTILE', 'IMPACT'] },
    skill2: { state: 'AWAITING_SOURCE', proposedLabel: 'Verdant Snare', assets: ['CHARACTER', 'PROJECTILE', 'MAIN', 'ROOT_FIELD'] },
    ult: { state: 'AWAITING_SOURCE', label: 'Emerald Skyfall', launchCount: 1, waves: 5,
      columns: 3, lanes: 2, assets: ['CHARACTER', 'CHARGE', 'ASCENDING_ARROW', 'GROUND_FIELD', 'RAIN', 'IMPACT', 'RESIDUAL'] },
  },
  uiArt: { portrait: 'REFERENCE_CROP', skillIcons: 'AWAITING_SOURCE', banner: 'AWAITING_SOURCE' },
} as const;
