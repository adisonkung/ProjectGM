/** Runtime testing switches. Disable before a balance pass or release.
 * Battle switches leave engine defaults/sim tools unchanged; freeSummons applies only through GachaService.
 */
export const DEV_FLAGS = {
  /** Temporary: all Ascension guardians selectable every day until the three replacement bosses are ready. */
  ascensionFreeChoice: true,
  /** Temporary user instruction: everyone has GM lab access until account roles are connected. */
  allPlayersAreGm: true,
  /** every hero starts each stage with a full ultimate gauge (tap the portrait to fire it right away) */
  fullUltAtStart: true,
  /** temporary user-requested free gacha; retain configured prices in the UI */
  freeSummons: true,
};
