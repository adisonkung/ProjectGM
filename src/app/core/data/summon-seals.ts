/** User-selected summon currency: one seal per hero. Special-pool artwork is reserved for a future pool. */
export const SUMMON_SEALS = {
  standard: { id: 'astral_summon_seal', name: 'ศิลาดารา', icon: '/ui/summon-seals/standard.webp' },
  special: { id: 'golden_summon_seal', name: 'ศิลาดาราทอง', icon: '/ui/summon-seals/gold.webp' },
  aurora: { id: 'aurora_summon_seal', name: 'ศิลาออโรรา', icon: '/ui/summon-seals/aurora.webp' },
} as const;

export const SUMMON_SEAL_COST = { single: 1, multi: 10 } as const;
