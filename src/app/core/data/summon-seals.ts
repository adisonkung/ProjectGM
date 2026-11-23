/** Ancient summoning pages: one per hero. Keep inventory IDs stable for existing saves. */
export const SUMMON_SEALS = {
  standard: { id: 'astral_summon_seal', name: 'หน้าตำราดารา', icon: '/ui/summon-pages/standard.webp' },
  special: { id: 'golden_summon_seal', name: 'หน้าตำราทอง', icon: '/ui/summon-pages/gold.webp' },
  aurora: { id: 'aurora_summon_seal', name: 'หน้าตำราออโรรา', icon: '/ui/summon-pages/aurora.webp' },
} as const;

export const SUMMON_SEAL_COST = { single: 1, multi: 10 } as const;
