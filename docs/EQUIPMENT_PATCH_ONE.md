# Equipment Patch 1

Patch 1 opens T1–T5. Equipment Hunts unlock at start, F2, F4, F6 and F8. The first clear of each Hunt unlocks its matching Forge recipe, which consumes the corresponding fragments and gold. Crafting selects Tier, slot and set, then rolls rarity, main stat where applicable, and unique substats. The five ordinary slots are weapon, helmet, armor, necklace and ring. The artifact socket is reserved. The Forge and Celestial Seal armory show Tier, rarity, set and enhancement progress. [Desktop captures and design references](reviews/equipment-patch-one/index.html)

The corrected archive supplies the exact T1–T5 weapon artwork by filename. Runtime WebPs are in `public/ui/equipment/patch-one/`. The original T6 PNG is archived in `assets/ui/equipment/future/weapon-t6.png`, outside the shipped asset directory. Other ordinary slots reuse existing equipment art. Combat sprite and hero kit assets are outside this change.

Existing saves retain their gear, rolls, affixes, enhancement levels, upgrade caps and material balances. Legacy trinkets occupy the necklace position. A necklace swap returns the trinket intact to the bag. New ordinary gear caps at +10. Each enhancement applies all crossed milestones once and persists the result with its resource cost. Set counts use the highest applicable 2-, 3- or 5-piece bonus for each set. The existing combat caps still apply, including the +25 percentage-point equipment cap on Crit Damage, which limits the draft 5-piece Destruction bonus.

## Validation

- App, test and simulation TypeScript checks passed. Chromium Karma passed 1,119 tests.
- The optimized build passed with external font inlining disabled for the verification build. The package and stylesheet budget warnings remain visible.
- Production-browser QA exercised the five named weapon images, T5 crafting and resource deduction, five ordinary sockets, mixed active sets, enhancement and save reload. A build artifact search confirmed that the T6 source is absent from the shipped files.
- In a small F10 engine sample, one Lv9 starter team with T5 +10 equipment won 10/10 runs with Epic gear and 10/10 with Legendary gear in both AUTO and TACTICAL. Mean times were 74 s and 71 s for Epic and 71 s and 69 s for Legendary, respectively. This fixture highlights the need to tune the endgame AUTO target and expand the sample across different builds. The existing F7–F10 simulator ran as a smoke test using its legacy gear profiles.
- At the draft T5 craft rates, the expected totals for 25 Epic-or-better results and 25 Legendary results are about 56 and 250 crafts, respectively. This craft-only comparison uses rarity as the threshold and omits drops, stat quality, and enhancement. Full time-to-usable and time-to-optimal remain part of the combined economy pass.

Drop income, craft and enhancement costs, stat roll ranges, set strengths and economy timings are provisional. The production target for leveling time and the impact of the full progression loop remain unverified.
