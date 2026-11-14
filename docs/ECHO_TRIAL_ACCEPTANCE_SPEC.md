Continue from the Skill Trial Echo Clone rework specification already provided.

Now implement the feature end-to-end in the existing project.

Do not only create a mockup or placeholder.

==================================================
IMPLEMENTATION GOAL
==================================================

The final playable flow must be:

1. Player opens Skill Trial.
2. Player selects/deploys their normal hero team.
3. Battle starts in ONE room and ONE wave.
4. The game dynamically creates enemy Echo versions of the selected heroes.
5. Echoes use:
   - Basic Attack
   - Skill 1
   - Skill 2
6. Echoes cannot use Ultimate.
7. Echoes use normalized Skill Trial dungeon stats.
8. Echoes are visually distinguishable with the shared Echo visual profile.
9. Player defeats all Echoes.
10. Existing Skill Material rewards are granted.
11. Battle ends normally.

==================================================
IMPORTANT IMPLEMENTATION RULES
==================================================

Do NOT create permanent duplicate Echo hero records.

Do NOT create one new database document per Echo run.

Do NOT create separate copied hero definitions unless absolutely required.

Prefer runtime Echo battle instances generated from the existing HeroDefinition / Hero data.

The original hero data must remain the source of truth.

==================================================
RUNTIME ECHO CREATION
==================================================

When the Skill Trial battle starts:

For each deployed player hero:

- read the original hero definition
- create a runtime enemy battle unit
- assign Enemy faction
- preserve hero identity
- preserve Basic Attack
- preserve Skill 1
- preserve Skill 2
- disable Ultimate
- disable Ultimate Gauge
- apply Skill Trial tier stats
- apply Echo combat modifiers
- apply Echo visual profile
- place the Echo in the mirrored enemy-side formation

Destroy / dispose of these temporary Echo instances when the battle ends.

Do not persist them unnecessarily.

==================================================
FACTION / TARGETING TEST
==================================================

This is CRITICAL.

Review all reused hero skill targeting logic.

Any concept such as:

- Ally
- Enemy
- Lowest HP Ally
- Nearest Enemy
- Frontline
- Backline
- Team Heal
- Team Buff
- Team Cleanse

must resolve relative to the Echo unit's CURRENT FACTION.

Example:

Echo healer must heal Echo allies,
not the player's team.

Echo offensive skills must target player units.

Do not leave hard-coded PlayerTeam references inside reusable hero skill logic.

==================================================
ABILITY SAFETY
==================================================

Test copied Skill 1 and Skill 2 behavior for:

- healing
- shielding
- cleanse
- buffs
- debuffs
- movement
- teleport
- AoE
- ranged attacks
- melee attacks
- summons
- revive
- crowd control

For Echoes:

- Ultimate disabled
- Revive disabled
- permanent summons disabled if unsafe
- infinite stacking disabled
- unsupported player-input mechanics disabled or adapted

Do not modify the playable hero's original skill.

Apply Echo-specific restrictions only in the Echo execution layer.

==================================================
ECHO VISUAL
==================================================

Reuse the original hero sprite / animation assets.

Do not generate duplicate hero artwork.

Apply a shared Echo visual treatment at runtime:

- reduced saturation
- cool cyan / teal tint
- restrained spectral rim / outline
- small generic Echo aura
- small ground trial marker

Keep pixel-art edges crisp.

Do not use blur-heavy post-processing.

Do not turn the hero into a flat blue silhouette.

The original hero must remain recognizable.

==================================================
PERFORMANCE RULE
==================================================

Keep the Echo system lightweight.

Do not:
- write temporary Echo units to MongoDB every battle
- clone large character documents unnecessarily
- generate textures server-side per battle
- duplicate animation assets in memory unnecessarily

Prefer:
- shared hero definitions
- runtime battle instances
- shared Echo material / shader / visual component
- shared aura / spawn effect

==================================================
SKILL TRIAL DATA
==================================================

Keep difficulty data configurable.

Skill Trial tier data should control the Echo combat stats.

Do not derive difficulty directly from equipped player gear.

At minimum support configurable:

- HP multiplier
- ATK multiplier
- DEF multiplier
- cooldown multiplier
- healing multiplier
- shield multiplier
- CC duration cap
- reward values

==================================================
TEST THE ACTUAL GAME
==================================================

After implementation, run the project and test the Skill Trial in the browser/game client.

Test at least:

1. Full 5-hero team.
2. Team with fewer heroes if supported.
3. Tank + DPS + Healer composition.
4. Healer Echo actually heals Echo allies.
5. Offensive Echo correctly targets player heroes.
6. Skill 1 works.
7. Skill 2 works.
8. Ultimate never triggers.
9. Echo cannot revive.
10. Echo visual treatment is clearly distinguishable.
11. Mirror formation is correct.
12. Victory triggers after all Echoes die.
13. Defeat triggers when player team dies.
14. Skill Material rewards still work.
15. Retry / replay works correctly.
16. Leaving and entering Skill Trial again does not leave stale Echo instances.

==================================================
REGRESSION TEST
==================================================

Verify that the changes do NOT break:

- normal hero battles
- Training Grounds
- Equipment Hunt
- hero Skill 1
- hero Skill 2
- player Ultimates
- normal faction targeting
- existing reward flow

==================================================
BUG FIXING
==================================================

If any runtime errors, targeting bugs, broken visuals, or battle-flow issues are found during testing:

Fix them before finishing.

Do not leave known errors as TODOs unless the issue is blocked by missing project data or assets.

If something cannot be completed safely,
document exactly:
- what is missing
- which file/system is affected
- what remains to be implemented

==================================================
FINAL REPORT
==================================================

After implementation and testing, provide a concise report containing:

- files changed
- new components/services/models added
- how runtime Echo generation works
- how Ultimate is disabled
- how stats are normalized
- how faction-aware skill targeting works
- how Echo visuals are applied
- tests performed
- bugs found and fixed
- any remaining limitations

Do not stop after describing the plan.

Implement and test the feature.