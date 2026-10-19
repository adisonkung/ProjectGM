# Character detail UI — 2026-10-19

User reference: `1000004528.jpg`. Apply the visual direction to every owned hero detail page, retaining supplied art and gameplay. The reference is not a replacement gameplay specification.

## Repository base

Fresh `origin/master`: `455de5b`; clean working tree before edits, no local master. Created `feature/codex-hero-detail-ui` from master and fast-forwarded to explicitly continued published lobby dependency `7d20460`. Prior branches remain preserved. Publish this task branch only; no master merge or new canonical-local synchronization claim.

## Implementation

- Full 16:9 key art, uncropped, with a gentle blend into the dark blue identity plate and gold corner trim from the existing frame. Portrait fallback remains available. Original image pixels are unchanged.
- Real owned name/UID, class, stars, potential, Breakthrough tier, level/cap, EXP, power and team/training/main-island status. Four circular shortcuts show normal attack (generic glyph) and the supplied three skill icons; click opens the skill tab. No invented hero biography or names.
- Four tabs: ข้อมูล, ค่าสถานะ, สกิล, อุปกรณ์. Correct tab/panel relationships, roving tabindex, Left/Right/Home/End navigation, visible keyboard focus. Overview contains star development, compact stats with optional breakdown, equipment and growth. Other tabs isolate stats, skill development and equipment.
- Same 6★ cap, memory costs/perks, three actual equipment slots and registered stat/skill data. The reference's five-slot/five-star/crit examples do not override the repository. Use the existing memory, potion, Breakthrough, training, main-hero, skill upgrade and tome conversion services. Equipment links retain selected `hero` UID; growth links open existing Training/Ascension screens with their existing unlock rules.
- Two-column panels on wider screens, one column below 650px; four skill shortcuts/tabs fit phones down to 320px. Important Thai text is at least 13px. Restrained icon hover has no motion when reduced-motion is requested. Global chrome, Home, hero roster, art pipeline, combat/balance and save format are unchanged.

## Validation

App/spec TypeScript checks pass; full Karma **715/715** passes. The existing page regression now exercises overview gear, real skill navigation and keyboard selection of the stats breakdown. Production build passes; component-size warnings remain (hero detail CSS ~11.2kB versus 8kB warning threshold), with the existing global/battle/island and CommonJS warnings. No budgets changed. The cloud test run uses the existing task-local `/tmp/karma-elira-target.cjs` launcher because this checkout has no `karma.ci.cjs`; no CI config is added to the repository.

Native production-build verification at DPR2: 1440×1100, 854×1280, 768×1024, 390×844, 320×640 and 844×390. No horizontal overflow or clipped content panels. Verified all ten heroes plus unknown UID, tab clicks and keyboard focus, shortcuts, base/gear/final breakdown, previous/next, selected-hero equipment route, blocked star-up, actual star-up/potion/training/main-hero/skill actions, Breakthrough and max-star/max-level states. Fixtures are disposable browser saves; the user's save is untouched. No page errors or missing assets.

Review artifacts: `/workspace/scratch/hero-detail-review/`; temporary scripts/browser saves stay outside the repository.
