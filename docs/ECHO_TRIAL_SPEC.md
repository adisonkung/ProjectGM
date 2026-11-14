# ELDERVANE TOWER
# SKILL TRIAL REWORK SPEC
# MODE: ECHO TRIAL / HALL OF REFLECTION

Rework the existing Skill Trial / Skill Material Dungeon into a completely different gameplay mode.

IMPORTANT:
Do NOT redesign Training Grounds or Equipment Hunt.

Only modify the Skill Trial mode.

The new Skill Trial should no longer use the normal multi-wave monster dungeon structure.

==================================================
1. CORE MODE CONCEPT
==================================================

Replace the existing Skill Trial gameplay with:

PLAYER TEAM
VS
ECHO CLONES OF THE PLAYER TEAM

This is a direct mirror-style battle.

The player enters with their normal deployed team.

The game dynamically generates an enemy Echo version of every deployed hero.

Example:

Player Team:
- Yue Zheng
- Bai Long
- Tang Xun
- Lin Xue
- Mo Ye

Enemy Team:
- Echo Yue Zheng
- Echo Bai Long
- Echo Tang Xun
- Echo Lin Xue
- Echo Mo Ye

The Echoes must preserve the identity and combat role of the original heroes.

==================================================
2. BATTLE STRUCTURE
==================================================

The new Skill Trial uses:

- ONE battle room
- ONE wave only
- ONE direct confrontation

Do NOT create:
- Wave 1
- Wave 2
- Wave 3
- normal monsters
- elite monsters
- separate dungeon boss

The enemy Echo team itself is the entire encounter.

The battle should begin as:

PLAYER TEAM
VS
FULL ECHO TEAM

at the same time.

==================================================
3. TEAM SIZE
==================================================

Generate one Echo enemy for every deployed player hero.

If player deploys:

5 heroes
→ generate 5 Echoes

If the game currently supports fewer deployed heroes:
generate the exact same number of Echoes.

Do NOT generate missing or additional characters.

==================================================
4. ECHO CHARACTER IDENTITY
==================================================

Each Echo must use the SAME HERO identity as the corresponding player hero.

Preserve:
- character model / sprite
- weapon
- class
- role
- base attack type
- attack range
- movement type
- Skill 1 identity
- Skill 2 identity

Do NOT randomly replace abilities.

Example:

Player Bai Long
→ Enemy Echo Bai Long

Player Lin Xue
→ Enemy Echo Lin Xue

==================================================
5. ECHO AVAILABLE ABILITIES
==================================================

Echo clones may use ONLY:

- Basic Attack
- Skill 1
- Skill 2

Echo clones MUST NOT use:

- Ultimate
- Ultimate Gauge
- Ultimate casting
- Ultimate VFX
- Ultimate AI

Ultimate should be completely disabled for Echo units.

==================================================
6. PASSIVE / SPECIAL MECHANIC SAFETY
==================================================

Do not blindly clone every passive mechanic if it can break the encounter.

For the initial implementation:

ALLOW:
- basic role-defining passive behavior if required for the hero to function

DISABLE or normalize:
- Revive
- permanent summons
- infinite stacking
- permanent invulnerability
- encounter-reset effects
- mechanics requiring player input
- mechanics that can create infinite battle loops

If the current hero architecture makes passive filtering difficult,
create an Echo-specific ability rules layer instead of modifying the original hero definitions.

Do NOT change the real playable hero.

==================================================
7. ECHO STAT SCALING
==================================================

CRITICAL:

Do NOT copy the player's exact final stats.

Do NOT directly copy:
- equipment stats
- artifact stats
- star bonuses
- temporary buffs
- current HP
- player gear quality

Otherwise players can manipulate dungeon difficulty by changing equipment.

Instead:

Echo stats should use the Skill Trial difficulty template.

Recommended structure:

EchoBaseStats =
DungeonTierScaling
× HeroRoleTemplate
× HeroLevelScaling

The player's selected hero determines:

- identity
- role
- abilities
- targeting behavior

The dungeon difficulty determines:

- HP
- ATK
- DEF
- Skill scaling

==================================================
8. LEVEL HANDLING
==================================================

Use whichever implementation fits the existing progression system best:

Preferred:
Echo hero level may visually match the deployed hero,
but combat stats should still be normalized by dungeon tier.

Do not create a system where deploying a Lv1 hero makes the Echo trivially weak.

==================================================
9. FORMATION
==================================================

For the first implementation:

Mirror the player's formation.

Example:

Player occupies:
Front Row Cell A
Back Row Cell B
etc.

Enemy Echo should appear on the mirrored enemy-side equivalent cells.

Preserve role positioning naturally.

Do NOT randomly rearrange Echo formation in V1.

This keeps the mechanic understandable and predictable.

==================================================
10. ECHO AI
==================================================

Echoes use standard enemy AI.

They should automatically:

- select targets
- move if required
- basic attack
- cast Skill 1
- cast Skill 2

Use the hero's normal combat logic where practical,
but execute it through enemy-side AI.

Do not require player input.

==================================================
11. ECHO COOLDOWNS
==================================================

Skill 1 and Skill 2 should use dungeon-adjusted cooldowns.

Start with the existing hero cooldown values if compatible.

However, provide configuration values so Echo cooldowns can later be tuned globally.

Example:

echoCooldownMultiplier = 1.0

This should be data/config driven,
not hard-coded separately for every hero if avoidable.

==================================================
12. HEALER ECHO RULES
==================================================

Healer Echoes may heal their Echo allies.

However, prevent endless mirror battles.

Add an Echo healing modifier.

Recommended initial value:

Echo Healing Effectiveness:
60%

Example:

normal heal = 1000
Echo heal = 600

Make this configurable.

Suggested config:

echoHealingMultiplier = 0.60

Do NOT modify player healing.

==================================================
13. SHIELD RULES
==================================================

Echo shields should also be normalized if needed.

Suggested initial value:

echoShieldMultiplier = 0.70

Keep this configurable.

Do NOT alter the original hero skill data.

Apply the multiplier through the Echo combat layer.

==================================================
14. REVIVE RULE
==================================================

Echo clones cannot revive fallen Echoes.

If a copied hero Skill 1 or Skill 2 includes Revive:

REMOVE only the Revive component from the Echo version.

Other valid portions of the skill may continue.

Example:

Heal + Cleanse + Revive

Echo version becomes:

Heal + Cleanse

Do NOT change the player's original skill.

==================================================
15. CROWD CONTROL SAFETY
==================================================

Use existing Crowd Control behavior.

However, provide a configurable duration cap for Echo-generated CC if needed.

Example:

echoMaxCrowdControlDuration = 3.0 seconds

Do not hard-code this unless the combat architecture already uses configuration.

==================================================
16. VICTORY CONDITION
==================================================

Victory:

All enemy Echo clones are defeated.

No separate boss phase.

No additional monster spawn after victory.

==================================================
17. DEFEAT CONDITION
==================================================

Defeat:

All deployed player heroes are defeated.

Use the existing dungeon defeat flow.

==================================================
18. REWARD
==================================================

Keep the mode's existing purpose:

SKILL MATERIAL FARMING.

Do not convert the reward into Equipment or EXP.

Use the existing Skill Trial reward pipeline where possible.

Only replace the combat encounter.

==================================================
19. ECHO VISUAL TREATMENT
==================================================

Enemy Echo clones MUST be visually distinguishable from the real player heroes.

Do NOT create entirely new character sprites.

Reuse the original hero combat sprite,
then apply an Echo-specific visual treatment.

Target style:

ECHO BLUE / SPECTRAL TRIAL COPY

==================================================
20. BASE ECHO COLOR TREATMENT
==================================================

Apply a consistent visual treatment to every Echo:

- reduce original saturation
- slightly darken midtones
- add restrained cyan / teal-blue spectral tint
- preserve enough original values so the hero remains recognizable

Do NOT completely recolor the character into a flat blue silhouette.

The player should immediately recognize:

"This is my hero"

while also immediately understanding:

"This is the enemy Echo version."

==================================================
21. ECHO EYES
==================================================

Where technically practical:

Add a subtle cyan / pale teal eye glow.

Keep it small.

Do NOT create giant glowing eyes.

If per-character eye masking is impractical,
skip this rather than introducing unstable sprite processing.

==================================================
22. ECHO OUTLINE
==================================================

Add a restrained Echo outline / rim.

Recommended:
- pale cyan
- teal-blue
- low intensity

The outline should remain readable without obscuring pixel art.

Avoid:
- thick glow
- blur
- soft anti-aliased halo

Preserve crisp pixel-art presentation.

==================================================
23. ECHO IDLE AURA
==================================================

Add a very small generic Echo aura around enemy clones.

Visual language:
- subtle spectral fragments
- small upward particles
- faint distortion
- restrained cyan/teal energy

Keep it lightweight.

The effect should NOT visually compete with:
- Skill VFX
- hit VFX
- battlefield readability

==================================================
24. ECHO GROUND MARKER
==================================================

Add a small enemy Echo identifier beneath each Echo.

Preferred:
a shallow spectral ellipse / trial sigil.

Requirements:
- small
- unobtrusive
- cyan/teal
- transparent
- low brightness

Do NOT create a large magic circle.

This marker is primarily for instant team readability.

==================================================
25. ECHO HEALTH BAR
==================================================

Enemy Echoes should use the enemy health-bar style.

If appropriate,
add a small Echo identifier to their UI.

Examples:
- small Echo icon
- mirror icon
- spectral diamond icon

Avoid displaying large text permanently over every unit.

==================================================
26. ECHO SKILL VFX
==================================================

For V1:

Reuse the hero's existing Skill 1 and Skill 2 VFX.

Do NOT require a complete second VFX library for every Echo.

Optional rendering treatment:
- slightly desaturate
- subtle cyan/teal overlay
- reduced original accent saturation

But preserve skill readability.

Do not recolor so heavily that different hero skills become visually identical.

==================================================
27. ECHO DEATH
==================================================

Echo clones should NOT use a normal corpse if possible.

Preferred Echo death:

HP reaches 0
→ character briefly destabilizes
→ spectral cyan fragments break away
→ sprite fades / dissolves
→ Echo disappears

Keep death short.

Do NOT:
- explode violently
- leave permanent corpse
- create large particles

If implementing a custom death is expensive,
reuse the normal death animation first,
then apply the Echo dissolve at the final frame.

==================================================
28. BATTLE START PRESENTATION
==================================================

At the start of Skill Trial:

1. Player team enters / loads normally.
2. Echo team becomes visible opposite them.
3. Apply a short Echo materialization effect.
4. Battle starts.

Optional:
0.5–1 second Echo materialization presentation.

Do not create a long cinematic.

This is still a repeatable farming mode.

==================================================
29. ECHO MATERIALIZATION VFX
==================================================

If the project already supports generic spawn VFX,
create or reuse one generic Echo spawn effect.

Visual:
- faint cyan silhouette trace
- vertical spectral fragments
- quick stabilization
- final character sprite becomes fully readable

Reuse the SAME generic effect for all heroes.

Do not build a unique spawn effect per hero.

==================================================
30. DAILY FARMING PRIORITY
==================================================

This is a repeatable Skill Material dungeon.

Therefore prioritize:

- short loading
- short battle start
- clear combat
- predictable rules
- fast retry
- minimal unnecessary cinematic sequences

Do NOT make each run excessively long.

==================================================
31. MODE IDENTITY
==================================================

Skill Trial should now feel fundamentally different from the other Daily Dungeons.

TRAINING GROUNDS:
- standard enemies
- tactical timing
- formation / interrupt pressure

EQUIPMENT HUNT:
- dungeon monsters
- physical combat
- heat hazards
- forge boss

SKILL TRIAL:
- direct team mirror battle
- no monsters
- no boss
- fight Echo copies of your deployed heroes
- test understanding of hero Skill 1 / Skill 2 interactions

==================================================
32. UI / DESCRIPTION UPDATE
==================================================

Update Skill Trial description to communicate the mechanic.

Suggested player-facing description:

"Face spectral Echoes of your own deployed heroes. Echoes retain their Basic Attack, Skill 1, and Skill 2, but cannot use Ultimates. Defeat your reflected team to earn Skill Materials."

Use the project's existing localization / text architecture.

Do not hard-code UI strings directly into components if localization infrastructure already exists.

==================================================
33. PRE-BATTLE INFORMATION
==================================================

On the Skill Trial team-selection screen,
add a small mechanic explanation.

Communicate:

- Enemy team mirrors your deployed heroes.
- Echoes use Basic Attack + Skill 1 + Skill 2.
- Echoes cannot use Ultimate.
- Rewards remain Skill Materials.

Do not overload the screen with instructions.

==================================================
34. IMPLEMENTATION ARCHITECTURE
==================================================

IMPORTANT:

Do NOT duplicate every hero prefab / definition manually.

Prefer a dynamic Echo layer.

Possible architecture:

Player selects hero
↓
Create enemy battle instance using same HeroDefinition
↓
Apply EchoCombatProfile
↓
Override team/faction
↓
Apply dungeon stat template
↓
Disable Ultimate
↓
Apply Echo healing / shield / revive rules
↓
Apply Echo visual treatment
↓
Run enemy AI

Keep existing playable HeroDefinition data as the source of truth.

Do NOT fork a permanent second copy of every hero unless the current architecture absolutely requires it.

==================================================
35. SUGGESTED ECHO PROFILE
==================================================

Create a configurable Echo combat profile concept equivalent to:

EchoCombatProfile

Properties may include:

- allowBasicAttack = true
- allowSkill1 = true
- allowSkill2 = true
- allowUltimate = false
- ultimateGaugeEnabled = false

- healingMultiplier = 0.60
- shieldMultiplier = 0.70
- reviveEnabled = false

- cooldownMultiplier = 1.00
- damageMultiplier = configurable
- hpMultiplier = configurable
- defenseMultiplier = configurable

- maxCrowdControlDuration = configurable

Exact naming should follow the existing project conventions.

Do not force these exact property names if a better existing abstraction already exists.

==================================================
36. DATA DRIVEN DIFFICULTY
==================================================

Support different Skill Trial tiers without changing hero definitions.

Example:

SkillTrial I
SkillTrial II
SkillTrial III
etc.

Each tier may define:

- Echo HP
- Echo ATK
- Echo DEF
- reward quantity
- combat multipliers

Use existing dungeon-tier data architecture where possible.

==================================================
37. IMPORTANT EDGE CASES
==================================================

Handle:

- duplicate heroes if the game ever allows them
- fewer than maximum team members
- dead / unavailable heroes before entering
- summoned units
- pets
- hero transformations
- revive skills
- skills that specifically target allies
- skills that specifically target enemies
- skills that reference player faction
- skills that rely on Ultimate Gauge

Echoes must correctly treat:
- Echo units as allies
- Player units as enemies

Do not simply reuse player targeting references without changing faction context.

==================================================
38. SUMMON HANDLING
==================================================

For V1:

If Skill 1 or Skill 2 creates a temporary summon,
allow it ONLY if the summon system safely supports enemy faction cloning.

Otherwise disable the summon component specifically for Echoes.

Document any unsupported hero skill after implementation.

Do not crash or block the encounter.

==================================================
39. TEST CASES
==================================================

Test at minimum:

A. Standard balanced 5-hero team
B. Team containing healer
C. Team containing tank
D. Team containing assassin
E. Team containing ranged DPS
F. Team containing AoE Skill 1 / Skill 2
G. Team containing shield skill
H. Team containing cleanse
I. Team containing revive component
J. Team with fewer than 5 heroes

Verify:
- correct heroes cloned
- correct formation
- correct faction
- Basic Attack works
- Skill 1 works
- Skill 2 works
- Ultimate never activates
- Echo healing modifier works
- Echo cannot revive
- victory works
- defeat works
- rewards work
- no infinite combat loop

==================================================
40. VISUAL TESTS
==================================================

Verify Echo characters remain recognizable.

At gameplay scale confirm:

- Player and Echo versions can be distinguished immediately
- Echo treatment works on bright characters
- Echo treatment works on dark characters
- cyan tint does not destroy original silhouette
- health bars clearly identify faction
- Echo effects do not obscure Skill VFX
- pixel-art edges remain crisp

==================================================
41. RESPONSIVENESS / PERFORMANCE
==================================================

Do not create duplicate high-cost materials or effects unnecessarily.

Prefer:
- shared Echo material
- shared Echo aura
- shared spawn/dissolve effect

The system must support a full enemy team of Echo clones without unnecessary performance overhead.

==================================================
42. DO NOT CHANGE
==================================================

Do NOT change:
- normal playable hero art
- normal playable hero Skill 1
- normal playable hero Skill 2
- player Ultimate behavior
- Training Grounds
- Equipment Hunt
- core equipment progression
- Skill Material reward identity

Only create an Echo battle-layer version for Skill Trial.

==================================================
43. FINAL EXPECTED RESULT
==================================================

After implementation:

Player opens Skill Trial
→ selects/deploys normal hero team
→ starts battle
→ one battle room loads
→ Echo copies of the selected heroes appear on enemy side
→ Echoes use Basic Attack + Skill 1 + Skill 2
→ Echoes cannot use Ultimate
→ Echoes have normalized dungeon stats
→ Echoes have clearly different spectral visuals
→ player defeats the full Echo team
→ Skill Material rewards are granted
→ dungeon ends

No extra waves.
No normal monsters.
No Elite.
No separate Boss.

==================================================
44. VISUAL TARGET — ECHO COPY
==================================================

Final Echo presentation should feel like:

SPECTRAL REFLECTION
+
TRAINING COPY
+
DISTORTED VERSION OF THE ORIGINAL HERO

NOT:
- undead version
- corrupted demon version
- entirely new costume
- new character skin
- holographic sci-fi clone

Recommended visual language:

ORIGINAL CHARACTER
+
LOWER SATURATION
+
COOL CYAN / TEAL TINT
+
SUBTLE SPECTRAL EDGE
+
SMALL ECHO PARTICLES
+
SMALL GROUND TRIAL MARKER

Keep the original hero recognizable at all times.

==================================================
45. IMPLEMENTATION PRIORITY
==================================================

Implement in this order:

1. Replace multi-wave Skill Trial encounter with one-wave dynamic Echo team.
2. Correctly clone selected hero identities.
3. Convert clones to enemy faction.
4. Apply normalized dungeon stats.
5. Restrict abilities to Basic + Skill 1 + Skill 2.
6. Disable Ultimate.
7. Apply healer/shield/revive safety rules.
8. Implement victory / reward flow.
9. Add Echo visual distinction.
10. Test all major hero archetypes.
11. Fix Skill Trial UI description.
12. Verify existing Daily Dungeons remain unaffected.

Do not stop at visual mockups.

Implement the actual playable flow and test the battle end-to-end.