export const SUMMON_ALTAR_ART = '/ui/summon-isometric-altar.webp';

export const SUMMON_TIMING = {
  ordinary: { charge: 950, burst: 1150, gather: 710, launch: 940, liftDelay: 50, stagger: 14 },
  grand: { charge: 1800, burst: 1600, gather: 1250, launch: 1300, liftDelay: 180, stagger: 22 },
} as const;
