/** Asset inventory only; pending files are never registered as runtime sheets/FX. */
export const SYLVARA_PRODUCTION = {
  heroId: 'sylvara', phase: 'S2_VISUAL_REVIEW', timing: 'PROVISIONAL_REVIEW',
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
  s2Sources: {
    archive: 'sylvara-s2-source.zip',
    character: { file: 's2_character.png', sha256: '81e59bb0e325bf6d8afc9dcfd3b8143d2a42eddbfef22965b02a083844de962c' },
    main: { file: 's2_main.png', sha256: '8d6c36c55f88576a7fcd7fb99b4ecf812ec106bb79dd5ee7adadd6ebebd491ee' },
    impact: { file: 's2_impact.png', sha256: 'cf6b05aedda14eaddbd18ab78223a4c76517f0fa4e760b630e5758b9a8e3bdd7' },
    root: { file: 's2_root.png', sha256: '5630d947466ef58e5d734159de9410df6e69d73887cbf5155e57f49a14509ba1' },
    workbook: { file: 'SYLVARA_S2_UNIVERSAL_TIMELINE_V2.xlsx', sha256: '620ff9ef683dc80ad8ba34258a41376a6292e469c12eb826b4c6122d6f989cb3' },
  },
  clips: {
    skill: { state: 'PROVISIONAL_REVIEW', proposedLabel: 'Emerald Piercer', frames: 10,
      assets: ['CHARACTER', 'PROJECTILE', 'IMPACT'], charge: 'NO_SEPARATE_SOURCE',
      projectile: 'sw-s1-projectile', impact: 'sw-s1-impact', finalSync: 'AWAITING_REVIEW' },
    skill2: { state: 'PROVISIONAL_REVIEW', proposedLabel: 'Verdant Snare', frames: 10,
      sourcePose7: 'RETAINED_IN_ATLAS_NOT_PLAYED_BAKED_VOLLEY',
      assets: ['CHARACTER', 'PROJECTILE', 'IMPACT', 'ROOT_START', 'ROOT_LOOP'], finalSync: 'AWAITING_REVIEW' },
    ult: { state: 'AWAITING_SOURCE', label: 'Emerald Skyfall', launchCount: 1, waves: 5,
      columns: 3, lanes: 2, assets: ['CHARACTER', 'CHARGE', 'ASCENDING_ARROW', 'GROUND_FIELD', 'RAIN', 'IMPACT', 'RESIDUAL'] },
  },
  uiArt: { portrait: 'REFERENCE_CROP', skillIcons: 'AWAITING_SOURCE', banner: 'AWAITING_SOURCE' },
} as const;
