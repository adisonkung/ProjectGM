# Echo Trial review

User request: `docs/ECHO_TRIAL_SPEC.md`; preview every shipped hero requested separately.

- `/echo-lab`: live original/Echo sprite comparison for all 15 entries in `HEROES`, including basic and S1/S2 clip controls. No new hero artwork.
- `/dungeons/trial` → select a tier → deploy normally → start combat. One dynamically generated mirrored team, no monster/boss/reinforcement roster. Retry and rewards use the existing farm flow.
- `core/data/echo-trial.ts` owns the configurable provisional profile. Each tier uses its recommended upper level, class base stats and standard level growth. Selected heroes supply identity/formation, not equipment/stars/ranks/final stats. Display level may follow the player.
- `core/rules/echo-trial.ts` creates runtime kit copies, removes only REVIVE effects, and scales cooldowns. All Echo ultimate entry points and gauge gain are blocked. Shared heal/shield paths apply source-only multipliers (0.60/0.70), including heal bolts, HoTs, drain and retaliation. Control duration cap is 3s. Unbounded statuses are temporary and uncapped stacks are bounded; authored player definitions are unchanged.
- No summon effect or transformation effect exists in the current hero SkillEffect model; none is introduced. Enemy-faction temporary/permanent summons require explicit support if added to hero kits later. Eye masking is intentionally skipped as permitted by the spec.
- Echoes reuse the original S1/S2 FX. DOM/Pixi apply Shadow Violet treatment (user follow-up): darker, desaturated purple/indigo with a restrained violet edge and faint ground shadow mist, a small marker and lightweight fragments. A 0.65s opening and short death fade avoid long cinematics. No equipment/tower/other-dungeon tuning.

## Validation and evidence

- App/spec TypeScript checks and production build passed.
- Full Karma suite: 981/981 passed. Shipped roster simulation: 1 run per floor per AUTO/TACTICAL bot completed (20 battles), no tuning.
- Browser walkthrough: five-player team → five Echoes → victory in one wave → existing Skill Tome/first-clear/daily reward flow. No browser JavaScript errors.
- Desktop: 1440×1000 combat, 1440×1100 gallery; mobile: 390×844.
- `roster-desktop.png` pairs all 15 originals (left) and Echoes (right). `roster-mobile.png` and `roster-skill2.png` show responsive and clip previews.
- `combat-live.png`, `combat-result.png`, `combat-mobile-dom.png`: actual running game, not generated or retouched artwork.
- `menu-desktop.png` / `menu-mobile.png`: existing Skill Trial page updated with the mechanic text.

Design references (read before changes): [Skill Trial](../../design/eldervane-ui/09-skill-trial-summon.png) and [Battle](../../design/eldervane-ui/11-battle-preparation-combat.png). The spec's new gameplay/visual requirements override the old monster/challenge content. Existing page layouts were retained; this is not a claim of a new pixel-perfect redesign. The new developer gallery has no supplied image reference: original hero sprites and the user's written spectral-copy target are the comparison baseline.

[Side-by-side design reference and running game](comparison.html).

Visual revision: user rejected the initial green/cyan cast and requested Shadow Violet. Current gallery and combat evidence use the revised palette. Per-character eye masking remains unsupported; the shared treatment colors the existing eye pixels, without adding inaccurate face effects.

Mobile portrait combat retains the existing compact whole-board layout; it has no horizontal overflow, but actors/HUD remain small. The roster gallery uses readable stacked cards. This task does not redesign other battle layouts.

Shadow Violet aura follow-up (15 November 2026): the user approved the palette and requested stronger smoke/clone presence. Added looping violet wisps behind every living Echo. Pixi uses one shared 64×96 procedural alpha texture and three owned sprites per clone, released on removal/destroy; DOM battle and all-15 gallery share CSS wisps. No gameplay/stat/skill changes. Static reduced-motion treatment, no extra sprite blur or per-frame texture generation. Updated before/after gallery, live combat, mobile and motion evidence in `docs/reviews/echo-trial/`. App/spec typecheck, 981 Karma tests and browser 5v5 victory/rewards passed; no browser errors or mobile overflow.

Motion preview: `shadow-violet-aura.mp4` (live browser frame capture). Before/after uses the user-approved Shadow Violet snapshot from commit 3522712, preserved as `roster-before-aura.png`; current `roster-desktop.png` includes the wisps.
