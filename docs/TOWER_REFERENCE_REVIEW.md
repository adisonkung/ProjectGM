# Tower — reference07 review

24 Oct2026. User confirmed Forge random crafting and bulk salvage, then requested the next page. Tower is pending visual review; no deployment.

Read docs/design/eldervane-ui/README.md and inspected07-tower-training.png. The preview uses a cut-gold scenic panel and existing decorative citadel art, real stage title/level band/objective/time, clear EXP and first-clear EXP/items. No invented gems or summon tickets from the mock. Replay omits already earned first-clear rewards. Locked floors can be inspected but have no entry link.

Floor buttons ascend1–10, with gold contours, current selection lacquer matching Home, actual names/levels and locked/completed status. Detail/list stack on mobile. No stage, reward, battle or save rules changed.

Validation: app/spec typechecks;812/812 Karma tests; production build with existing budget/CommonJS warnings and no raised budgets. Browser checks320/390/768/1024/1586px, ascending order, default next floor, selected locked10 and actual rewards, replay after3 cleared, fully cleared10, no save mutation while viewing. Frame geometry and desktop/mobile screenshots inspected. Source patch base:f49dcf3.

Review: https://github.com/adisonkung/ProjectGM/blob/4f4e4fd2cac7150bda7d2d3676172d5509688e07/docs/review-images/2026-10-24-tower/README.md . All9 artifacts verifiedHTTP200 and exact Git blob hashes. Docs-only unattached snapshot, no production ref update.

## Premium follow-up — user-selected concept and real maps

User liked the first Tower pass and requested a more premium direction. Approved generated concept19-tower-premium-approved.png, then explicitly requested map backgrounds as reference. This supersedes the first pass's small decorative citadel preview and fully framed list rows.

Implementation on fix/codex-tower-premium from510f338: larger two-column poster/list proportions; thin champagne metal, engraved corner motifs, deep wine lacquer CTA and current floor; subdued separators for other rows; compact diamond floor medallions. Title/level, objective/time and real clear/first-clear rewards stay in the poster's bottom strip. All entry/unlock/replay rules remain unchanged.

Large preview and each thumbnail use the actual STAGES.background via BACKGROUNDS registry (forest1–3, twilight4–7, misty8–10). No new per-floor scenes are invented. The surrounding decorative sunset palace was generated using the approved concept, stripped of interface, then encoded toWebP atquality92 with no crop/rescale (1587×991,635122bytes). It is not a battle map. Original game maps remain unchanged. Header/nav keeps the approved Home controls and icons rather than copying fake menu labels from the image.

Local TowerOrnamentComponent supplies purely decorative thin cut contours, lacquer gradient/rune and corner SVG engraving. Native links/buttons own interaction, aria-pressed and keyboard focus. Removed obsolete Tower-only global overrides so its stylesheet owns responsive geometry. Other pages/frames unchanged. Actual scene art differs deliberately from the palace shown in the mock per user's later instruction; no pixel-perfect claim.

Validation: app/spec typechecks,812/812 tests, production build without raised budgets (Tower11.21kB warning plus existing warnings). Browser5widths320/390/768/1024/1586, ascending order/default next, locked10/real rewards, replay, completed10, no save mutation and actual map changes. Native Enter selection and entry navigation to battle preparation verified without changing save. Mobile screenshots are separate viewport captures. Implementation review still pending; no deployment.

Premium actual-map implementation review: https://github.com/adisonkung/ProjectGM/blob/0719c809595117e597f07892063fe590f12a2f3c/docs/review-images/2026-10-24-tower-premium/README.md . All11 artifacts verifiedHTTP200 and exact Git blob hashes, including binary source/art patch and approved concept. No branch update or deployment.

## Lighting revision — premium implementation rejected as too opaque

User said the implementation still differs from the approved concept: dull lighting and background. Continuefix/codex-tower-lighting fromf6df345. No visual approval or deployment implied.

Removed the dark page veils; the existing decorative palace now usesbrightness1.12/saturation0.94 plus a soft warm sky glow. Kept the actual battle-map poster/thumbnails requested previously. Reduced the image's bottom black fade. Raised title/stage-title hierarchy and thumbnail brightness/size.

Replaced opaque full-area metal backing with responsive SVG outline strokes: continuous champagne contour and inner hairline around every angled button/panel corner. Translucent dark faces admit the palace colors, and the right panel softly blurs the underlying scene. Crimson faces gain a defined top reflection, stronger thin gold highlight/bloom and clearer seal engraving. Native interaction and existing reduced-motion behavior unchanged; no game/reward/save changes.

Validation: app/spec typechecks, full812tests, production build with unchanged budgets (TowerCSS11.52kB warning and existing warnings). Browser5widths320/390/768/1024/1586; checked actual map changes, next/locked/replay/complete and save preservation; waited for SVG contour width AND height to match the rendered frames before screenshots. User visual review pending.

Lighting implementation review: https://github.com/adisonkung/ProjectGM/blob/c33f0afafc2cde190858540abb281cc4bcac4482/docs/review-images/2026-10-24-tower-lighting/README.md . All10artifacts verifiedHTTP200 and exact Git blob hashes; no branch ref change or deployment.

## Right list subtitle removal

User requested removing “ชั้นที่ … · Lv …” on the right. Onfix/codex-tower-list-labels fromd33af41, removed only that secondary line below each stage name. The floor medallion, map thumbnail, boss/lock status and left detailed level remain. No CSS/game/data/save change. Production build, app/spec typechecks,812tests and5widths checked; no deployment, screenshots pending user review.

Right-list labels review: https://github.com/adisonkung/ProjectGM/blob/9161bddb8148e37e31a5c07a00b8c1a6a235dcc2/docs/review-images/2026-10-24-tower-list-labels/README.md . All5artifacts verifiedHTTP200/exact bytes. No deployment.

## Challenge chevron, larger right-list names and floor sigils

User asked to replace “ท้าชิงชั้น1” with “>”, slightly enlarge the right-side font and embellish the square floor badges. Onfix/codex-tower-floor-ornaments fromc7e8cc7: challenge button now shows a single centered >, with descriptive aria-label including actual floor. Replay retains its label/action. Right names increase17→18px desktop and by1px at smaller breakpoints. Each numeric badge gains a fine segmented gold sigil with four cardinal accents; selected floor has a gentle opacity shimmer/glow, disabled with reduced motion. Existing numbers, actual maps, rewards, locks and routes retained.

Validation: app/spec typechecks, full812tests, production build (existing warnings/no raised budgets);5widths320/390/768/1024/1586, no horizontal overflow,10sigils, challenge symbol/accessible label, reduced-motion animation off, locked preview and unchanged save. No deployment; implementation screenshots pending review.

Chevron/font/sigils review: https://github.com/adisonkung/ProjectGM/blob/02b273312de39b4ab1c58dcaf758b40118ac968f/docs/review-images/2026-10-24-tower-floor-ornaments/README.md . All6artifacts verifiedHTTP200/exact bytes. No deployment.

## Challenge button correction — icon, label and chevron

User clarified their previous request: the button should match Ref as Icon + ท้าชิงชั้น1 + >, not just >. Onfix/codex-tower-challenge-label from4c2904a restored crossed-sword icon and dynamic challenge/replay label, with the > on the right. Keep descriptive aria-label, larger list names, sigils, lighting and actual maps unchanged. No game/action/save change. App/spec typecheck,812tests,production build and5widths checked; no deployment.

Corrected challenge composition review: https://github.com/adisonkung/ProjectGM/blob/dd4129671748c86b07183a112b4b8afb0f16a42a/docs/review-images/2026-10-24-tower-challenge-label/README.md . All5artifacts verifiedHTTP200/exact bytes. No deployment.

## User-cropped CTA reference — proportion, type and swords

User supplied a close crop of the desired challenge button. Continuefix/codex-tower-reference-cta fromb9a7233. CTA now caps at430×78desktop (66px tall on phone), with an independently positioned gold crossed-sword SVG on the left, centered dynamic label in Trirong700 and > on the right. Mobile font22/20px. Browser inspection found the pre-existing remote Trirong faces failed to load; self-hosted the existing family's Thai/Latin700 WOFF2 subsets from Google Fonts with OFL.txt, under the Tower-only Eldervane Trirong family name. Browser verifies the real font is loaded before screenshots. A challenge-only input on TowerOrnamentComponent isolates the deeper red lacquer, more restrained outer bloom and subtle end engraving from the floor-list surfaces. Stage names, sigils, maps, rewards and routes unchanged.

Validation: app/spec typechecks,812tests,production build with existing budget/CommonJS warnings/no raised budgets,5widths320/390/768/1024/1586,accessible label/locked behavior/save preservation/reduced-motion. Desktop,phone and enlarged actual CTA screenshots inspected against the user crop. No deployment; pending visual review.

User-crop CTA review: https://github.com/adisonkung/ProjectGM/blob/deefb7619d8ac18fae1cc20505d2cdb0c6157fca/docs/review-images/2026-10-24-tower-reference-cta/README.md . All6artifacts verifiedHTTP200/exact bytes, including actual enlarged CTA and binary font/source patch. No deployment.

User outcome after the final cropped CTA/font revision: “โอเค หน้าต่อไป” — Tower visually approved; continue Dungeons. This does not authorize deployment.
