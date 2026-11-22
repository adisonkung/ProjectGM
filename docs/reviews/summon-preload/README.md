# Route-entry summon preparation

User request: load library resources when entering `/gacha`, before gem confirmation, for faster entry. Review `index.html` for unchanged-room reference/game pairs at1280×720 and the cold-confirmation state.

Changes:

- `GachaComponent` retains an inactive `SummonBookComponent` on entry. The lazy scene module and decoded artwork start immediately; the old1200ms delay is removed.
- `book-preload.ts` coalesces image/decode promises by URL, prioritizes critical room art/portraits with six workers, starts intro banners afterward with three workers without blocking room readiness, and evicts failed requests for retry. Scene textures reuse these exact decoded images rather than downloading/decoding them again through TextureLoader.
- Prepare one actual WebGL room, upload/compile its initial frame, then pause its timeline/render loop behind a closed dialog. Confirmation supplies the real committed cards and presents that canvas. Preparation never rolls, spends or changes pity. Artwork, camera, trace timing and tap-to-summon flow are retained.
- If confirmation is attempted before preparation finishes, the button waits and the handler guards against spending. Existing confirmation, affordability, repeat guards and Reduced Motion/no-WebGL fallback remain.
- Back/repeat disposes the completed scene and prepares another; route exit disposes GPU resources. Async generation guards prevent a late preparation from attaching/rendering after destruction. Decoded image cache remains bounded by the scene/roster assets for reuse.

Validation:

- App/spec TypeScript and Karma1026/1026 pass, including decode sharing/retry, no transaction on entry, inactive/present/return lifecycle, and confirmation blocked until ready.
- `browser-report.json`: actual normal Desktop/phone and Reduced Motion checks captured before the user requested Mobile deferral. Checks verify no early spend, no additional room-art requests at confirmation, identical prepared canvas, zero draw calls while hidden, real room→book→summary, single transaction, reprepare and exit cleanup. Phone evidence is historical only; current dedicated work/QA is Desktop per PROJECT_RULES §22.
- `cold-report.json`: Desktop1280×720, delayed critical art, disabled confirmation, handler also blocks spending, cancel works, and leaving during loading creates no late WebGL context.
- Current free-test mode is used by native browser flows; paid gem deduction/double-confirm protection is exercised by the actual service unit suite.
- Native timings are from this environment's slow software WebGL. Baseline first art request1579ms after route navigation; prepared path508ms on Desktop. Room requests were25 before/51 by opening on the baseline, versus26 before/26 after confirmation on the prepared path. Both scenes have identical art. Full report timings include software-renderer stalls and the unchanged entry/tap animation; do not present them as real-device/FPS benchmarks.
- Standard production build encountered the existing Google Fonts HTTP403. Production compilation/budgets passed with font inlining temporarily disabled; angular.json was restored byte-for-byte. No production configuration change is part of this work.

Reproduce with Angular dev server4200 and Playwright via NODE_PATH:

```sh
node tools/dev/summon-preload-browser.cjs
node tools/dev/summon-preload-cold.cjs
```

Both scripts now default to Desktop. The first script supports explicit SUMMON_MOBILE=1 only for a user-requested future mobile pass. Saves are isolated browser contexts; no user save is used. Screenshots are real, unretouched game captures. Earlier failed automation attempts are excluded from pass evidence.
