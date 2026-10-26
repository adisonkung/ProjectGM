# Dungeons — four-mode review

24 Oct2026. User approved final Tower/CTA and requested next page. Workonfix/codex-dungeons-review frome577c8e. Dungeons still pending visual review; “ต่อเลย” during implementation means continue work. No deployment.

Read docs/design/eldervane-ui/README.md and inspected07-tower-training.png,08-ascension-equipment-hunt.png,09-skill-trial-summon.png. Preserve actual game data: Training5tiers, Ascension3, Hunt5, Skill Trial4; real level bands/unlock floors rather than the reference's invented high levels/previous-tier gates.

Presentation: four Thai mode tabs with gold angled contours and crimson current selection, bright existing palace backdrop, decorative mode emblem, framed description/rules and daily bonus counter, framed tier list with actual map accents, objective, base rewards and clear entry/lock conditions. Bonus exhaustion stays playable. Today's guardian remains text from the actual date schedule. Hunt target remains the same saved preference, with no Relic/extra equipment category.

Reward labels now show the actual firstClearBonus items (including Memory onAscension and Ore onHunt), guaranteed firstClearItem rarity and bonusDrops chance/items. Skill Trial extra chance comes from its real8% value, Ascension20%; the old blanket20% text and generic+1stone first reward were incomplete. Fractional tomes are labeled as accumulating fragments without inventing whole-item payouts. Multipliers derive from definitions; no reward, RNG or balance values changed.

Asset: public/ui/eldervane/dungeon-emblems.webp,1254×1254RGBA, quality92/alpha100 encoding of image-generated transparent2×2sheet (sourceexec-dd2c4bc9-24c1-4154-a3a4-f4e109861170.png). Swords/laurel, generic shrine statue, chest/gear and grimoire are decorative category illustrations, not new items/enemies or the actual daily boss. No crop/rescale or battle art replacement. OriginalPNG remains in workspacegenerated_images. Existing actual battle map files remain unchanged.

Reuses the pure TowerOrnamentComponent decoration. Shared adventure-fonts now owns the same localTrirong700Thai/Latin faces so both lazy routes render the approved typography; Tower's duplicate component declarations removed, font files/weight unchanged. Removed only obsolete Dungeons-specific global page overrides.

Validation: app/spec typecheck,812tests, production build without raised budgets (existing initial/style/CommonJS warnings). Browser20cases across4modes ×320/390/768/1024/1586; correct tier/entry counts, registry reward text/chances/first items, daily guardian, starter locks, claimed first clear, ratings, empty bonus with entry still available, Hunt target-only save change/persistence, native keyboard route switching, battle preparation and Tower local-font regression. The1586×1050Tower screenshot is pixel-identical to the prior approved-source capture (0 changed pixels), verifying font-face relocation did not alter it. Mobile top/details/tier screenshots are separate viewport captures. Implementation screenshots pending user review.

Published review: https://github.com/adisonkung/ProjectGM/blob/2de638eef8c3501ba10996f6af6a1a39303aa251/docs/review-images/2026-10-24-dungeons/README.md . All26artifacts verifiedHTTP200/exact bytes, including complete lower-tier states, source/art binary patch and Tower regression image. No branch ref update or deployment.

## Reference-layout revision — first pass rejected

User said the examples look better and requested that direction. First implementation is not visually approved. Continuefix/codex-dungeons-reference-layout from24d8283. Rework to the actual07B/08/09Acomposition: blue/ivory citadel backdrop, compact top mode strip, large410pxillustration left, title/reward/rules card plus compact bonus, dense112px tier rows right. Removed the oversized page heading and large text-chip rows. No new generated art: existing mode illustrations reused larger.

Visible row rewards are colored SVG illustrations of existing item kinds with actual quantities/accessibility labels. EXP/gold/equipment chance use existing glyphs. Main reward previews are explicitly summaries; native “เงื่อนไขและรางวัล” details retain the complete objective, base items/gold/drop chance, first-clear items/rarity and extra-drop chances, including items omitted from the compact preview. No rewards/rules/save/service changes. Mobile expansion makes room for full details without crowding the entry button.

TowerOrnamentComponent adds optional inherited CSS variables for normal-face palette and outline width. Dungeons sets a cooler near-black palette and stronger gold outline; Tower fallbacks preserve the approved defaults and challenge variant.

Validation: app/spec typechecks,812tests,production build without budget increases;20collapsed viewport cases plus4expanded mobile cases, reward data/chances, locked/completed/bonus-exhaustion/Hunt target persistence/native keyboard and battle-preparation checks. Tower regression screenshot compared with previous approved source:0changed pixels. New implementation still pending visual review; no deployment.

Reference-layout implementation review: https://github.com/adisonkung/ProjectGM/blob/0acbf8ae6fd555b8a2a1dd22c468950b9aa54830/docs/review-images/2026-10-24-dungeons-reference/README.md . All26artifacts verifiedHTTP200/exact bytes, including closed/open details and unchanged Tower capture. No branch ref update or deployment.

## Antique gold border and material-icon backlog

User requested darker premium borders matching the examples and a list of mock material icons for later batch art. Onfix/codex-dungeons-antique-gold fromead9344: Dungeons inherits antique-gold gradient stops, thin warm highlights, dark recessed groove and reduced contour/red-control bloom; reward tiles/roman badges/today indicator use the same darker gold. Layout, imagery, real data and interaction unchanged. The grooved input is enabled only for Dungeons; Tower defaults remain unchanged.

Saved docs/art/material-icons/README.md andbacklog.json:21existing item ids,14temporary SVG kinds,1generic Memory glyph and6without dedicated art. Planned asset paths are not created/bound in the game. This pass does not generate or replace any material images. The class comment and designREADME link the list for future batch work. EXP/gold/drop-chance UIglyphs and temporary equipment vectors are distinguished from the material queue.

Validation: app/spec typechecks,812tests,production build without budget increase;4modes×5widths plus4expanded mobile views, existing rewards/first-clear/bonus/targeting/locked/navigation checks and Tower pixel regression (0changed pixels). Material backlog21ids checked against ITEMS; no generation started. Screenshot review pending; no deployment.

Antique-gold / material backlog review: https://github.com/adisonkung/ProjectGM/blob/59227bdb9d04b357169391297995f21a564d4c5f/docs/review-images/2026-10-24-dungeons-antique-gold/README.md . All14artifacts verifiedHTTP200/exact bytes. Tower regression0changed pixels. No branch ref update or deployment.

## User review

User responded “ต่อเลย” after the antique-gold/material backlog pass: approved to continue to Summon. Dungeons is no longer pending visual review. No deployment.
