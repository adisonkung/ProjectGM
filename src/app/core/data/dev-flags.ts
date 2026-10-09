/**
 * Switches for testing new characters in the real battle screen. They only touch the battle page (BattleComponent),
 * never the engine defaults, the lab's 100-run simulation, the balance / sim tools or the tests.
 * Turn them off before a balance pass or a release.
 */
export const DEV_FLAGS = {
  /** every hero starts each stage with a full ultimate gauge (tap the portrait to fire it right away) */
  fullUltAtStart: true,
};
