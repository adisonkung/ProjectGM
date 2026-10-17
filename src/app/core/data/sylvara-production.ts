/** Asset inventory only; pending files are never registered as runtime sheets/FX. */
export const SYLVARA_PRODUCTION = {
  heroId: 'sylvara', phase: 'S1_VISUAL_REVIEW', timing: 'PROVISIONAL_REVIEW',
  rarity: 'PROVISIONAL_3_STAR', fxPrefix: 'sw',
  approvedArchive: 'sylvara_base.zip',
  approvedSources: {
    base: { file: 'Sylvara_base_combat.png', sha256: '0b5d35e73d54d21c6b81f5ec1fb8acc356b1eccb7bdbce5b3cc457b1999a64cf' },
    reference: { file: 'Sylvara_master_reference.png', sha256: '6736b2f7c4dbdff7b9145ca5348d680d208fe8e6ad854ab4aa62f6dc23d8749c' },
  },
  s1Sources: {
    archive: 'sylvara-s1-source.zip',
    character: { file: 's1_character.png', sha256: '4d9730519063f532c0434d1469c64d380ffe06020dd36cfe1d86ba686670907b' },
    main: { file: 's1_main.png', sha256: '2f3aa75de4d89f495e3f3504ab17f603a310e4d3fc8311882a6bdfacfb7e98e4' },
    impact: { file: 's1_impact.png', sha256: '084b3258da3dee1e351a38cfcca60b4e22f939c5cd4cef19fe31d46cb96ea9ab' },
    workbook: { file: 'SYLVARA_S1_UNIVERSAL_TIMELINE_V2.xlsx', sha256: '14c9e9ad420d6383d8f6ab31642060370492a3d4501ab2badc2333d25650d520' },
  },
  visualIdentity: 'Classic Fantasy / Kingdom Adventurers; female elf, emerald hunter clothing, brown leather, gold leaf motifs, Elven Longbow; Wind / Nature',
  clips: {
    skill: { state: 'PROVISIONAL_REVIEW', proposedLabel: 'Emerald Piercer', frames: 10,
      assets: ['CHARACTER', 'PROJECTILE', 'IMPACT'], charge: 'NO_SEPARATE_SOURCE',
      projectile: 'sw-s1-projectile', impact: 'sw-s1-impact', finalSync: 'AWAITING_REVIEW' },
    skill2: { state: 'AWAITING_SOURCE', proposedLabel: 'Verdant Snare', assets: ['CHARACTER', 'PROJECTILE', 'MAIN', 'ROOT_FIELD'] },
    ult: { state: 'AWAITING_SOURCE', label: 'Emerald Skyfall', launchCount: 1, waves: 5,
      columns: 3, lanes: 2, assets: ['CHARACTER', 'CHARGE', 'ASCENDING_ARROW', 'GROUND_FIELD', 'RAIN', 'IMPACT', 'RESIDUAL'] },
  },
  uiArt: { portrait: 'REFERENCE_CROP', skillIcons: 'AWAITING_SOURCE', banner: 'AWAITING_SOURCE' },
} as const;
