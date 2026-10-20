# Summon sanctum UI — 2026-10-19

User supplied `1000004530.jpg` (hall) and `1000004531.jpg` (card back), requesting the prior gacha reference with static BG, bobbing centre cards and moving gold light.

## Repository base

Explicit fresh `origin/master` remains `455de5b`. Clean tree; no local master. Created `feature/codex-summon-sanctum` from master, then fast-forwarded to the explicitly continued published hero-detail/lobby dependency `b0ff2af`. Previous local/remote branches remain preserved. Publish this task branch only; no master merge or canonical-local synchronization claim.

## Assets and layout

The supplied JPEGs are copied byte-for-byte to `public/ui/summon-sanctum.jpg` (1280×720) and `public/ui/summon-card.jpg` (853×1280). No resizing, regeneration, retouching or alpha extraction. The card JPEG has a black surround; a CSS polygon clips the exterior at runtime, preserving the original ornamental shape. It is not represented as a transparent source PNG.

SHA-256:

- Hall: `15f5dfbb994a3922978fb61ba0f019d1243e930140a87d53c01ed831aa4e11a7`
- Card: `9c8d42d60594873163687eec7de4ad0cf98088bdc63bec6ae594ad3de5a3e178`

The page uses the shared six-item immersive navigation/resource chrome. Only `/home` and `/gacha` use that chrome and screen lock; ordinary pages retain four items. The hall is fixed and static beneath scrollable content. No separate portrait BG was supplied, so narrow screens use a centred cover crop, with UI stacking and accessible scrolling above the mobile dock. Do not claim a newly generated portrait asset.

Reference-inspired composition: standard-pool banner/menu at left; five existing hero portraits at lower left; live pity/rate summary and blue/gold x1/x10 actions at lower right. Sidebar actions open actual roster/Memory information or the hero page. No invented rate-up, friendship pool, countdown, tickets, history or exchange currency. A button reopens the latest result from this page session; this is not persistent summon history.

## Motion and interactions

`SummonSanctumComponent` draws one capped-DPR (1.5) canvas at up to 30fps: a slender white-gold column, five open energy trails with travelling highlights, and 32 rising motes. Light coordinates follow the actual centred 16:9 cover crop, anchored at the supplied altar. Four smaller CSS card wrappers have a restrained gold edge aura and independent bob/tilt timing; phones show three. Frame work stops when document-hidden, reacts to live reduced-motion changes and disconnects/cancels on destruction. Reduced motion draws a static light and disables card animation; cinematic playback skips background paint and pauses cards. The original supplied purple light stays baked into the static background.

Native modal dialogs provide focus containment, Escape and focus return for rates, complete ten-hero roster, Memory and result grids. The same GachaService, config, save transactions and existing summon cinematic are reused. One active cinematic guards repeated charges. Pull results are determined before presentation; closing/reopening results does not charge or reroll.

## Gameplay data

Costs remain 100/900 gems; pity at 50; configured tier rolls 60%/32%/8% for 1★/2★/3★. The current roster contains only 3★ templates. The existing rule falls back to the whole roster when a rolled tier is empty; result stars come from the template while pity tracks the rolled tier. The rate dialog explicitly explains this distinction. No SSR/rate-up labels, alternate rates or gameplay changes are introduced. Duplicate Hero/Universal Memory rules remain unchanged.

## Verification

App/spec typechecks pass; full Karma **717/717** passes, retaining the original gacha integration assertions and adding no-double-charge/failed-transaction coverage. Shell regression verifies six nav items on Home/summon and four on ordinary pages. Production build passes with size warnings (gacha CSS ~12.6kB, 8kB warning budget) and the existing global/island/battle/CommonJS warnings; budgets unchanged. The existing task-local `/tmp/karma-elira-target.cjs` is used because this checkout has no Karma CI config. No sprite changes, optimizer or combat/economy sim needed.

Native DPR2 review: 1280×720, 1440×1000, 1920×1080, 1024×768, 768×1024, 390×844, 320×640, 844×390. No horizontal overflow or sidebar/hero overlap; actions remain reachable above the mobile dock and short landscape can scroll. Verified distinct card transforms and changing canvas frames, live reduced-motion static/resume, rate/Memory/full roster dialogs with Escape/focus return, real x1/x10 spending, cinematic skip/results/reopen without another charge, insufficient gems, actual pity49/50 and navigation cleanup. No page errors or missing assets. Saves are disposable browser contexts, not the user's local save.

Short-landscape follow-up also verifies both quick tools after a real summon remain above the pity panel, with the actions reachable by scrolling.

Artifacts include `summon-reference.png`, desktop/tablet/phone views, phone action views, `verification.json`, `landscape-latest-results.png` and a native four-second `summon-motion.mp4` recording in `/workspace/scratch/summon-review/`; temporary scripts/fixtures stay outside the repository.

## User visual refinement — 2026-10-19

User re-supplied the reference and requested smaller gold-aura cards and flowing energy instead of circular/coiled lines. Continue the same feature branch from local `50c2001`; clean reconciliation, fresh master still `455de5b`.

Cards shrink about 38% at the reference desktop size and on phones (desktop clamp 48–90px; phone base 58px before per-card depth size), with a 2px gold edge and modest 7px glow. Bobbing becomes ±6px/±1.5°. The main column uses a warm elliptical haze, four tapered shaft strokes and a soft altar flare/reflection. Five open cubic paths arrive from the sides/upper chamber, with independently travelling bright segments; horizontal coordinates are monotonic along each curve, so no path forms a coil or orbit. Only the existing two scene files change product behavior; supplied images, layout, gameplay and summon flow remain as before.

Public publication of the prior 14-file feature was rejected by automatic approval review even after confirming owner/admin access to the public origin repository. Explicit payload-disclosure permission is pending. This visual follow-up is kept in the workspace; do not retry through another tool or indirect route. The original implementation and this refinement are both local until authorized. Remote branch creation/assets may already exist, but the feature tree/ref was not published. No new canonical-local sync claim.

Refinement artifacts: `/workspace/scratch/summon-energy-review/`. App/spec typechecks, full717/717 Karma and production build pass, retaining prior size/CommonJS warnings and budgets. Native DPR2 review at1280×720,1440×1000,390×844 and320×640 verifies smaller cards with restrained gold aura, static BG, changing card/light frames, live reduced-motion stop/resume, reachable phone actions, scene removal and zero missing assets/page errors. Native four-second recording `summon-motion.mp4`, screenshots and `verification.json` are in that directory; no new image editing/generation or gameplay tests were needed for this cosmetic pass.

## Publication and merge authorization — 2026-10-19

After reviewing the refined scene, the user explicitly requested pushing and merging into master. This resolves the earlier public-disclosure approval blocker and authorizes publication of the current completed feature to its existing public origin. Earlier pending/no-merge statements in this document are historical. Fresh master is still `455de5b`; the task branch also contains the Home/hero-detail UI dependencies, with the tested product tree at local `c8c0fae`. Only handoff documentation changes afterwards. Publish the task branch, create/attach a PR, merge with the verified head SHA, then verify remote master tree equality. Preserve branches and prior local checkpoints; do not claim canonical-local sync.


## Confirmed summon and card reveal — 2026-10-19

User supplied five visual references and requested confirmation → skippable full-screen summon → larger central light when a received hero is 3★ (brief smaller light otherwise), cards scattering toward the camera in both cases, sealed cards and results. New branch `wip/codex-summon-reveal` starts from fresh `origin/master` `cdacdcd`, with a clean working tree and no new other-agent work. The earlier UI is already merged; prior publication checkpoints above are historical.

- `GachaComponent.summon` opens a native confirmation showing actual config cost and live balance. Cancel/Escape/backdrop spends nothing. Confirm consumes pending intent before calling the existing service exactly once, rechecks affordability, and commits rewards immediately. Repeated clicks, reveal, skip and results never call the pull service again. Repeating from results asks for confirmation again. No gacha prices, rates, pity, duplicate rewards, save schema or starter grants change.
- `SummonSceneComponent` is presentation only: native full-screen modal/focus containment, supplied static hall plus gold/purple light core, open curved energy paths, motes and twelve decorative cards flying out toward the camera. Actual `results.some(star >= 3)` controls the grand beam, not the underlying rarity roll (which can fall back to another tier). No numbered UI screenshots or new hero/item rewards are baked into art.
- Intro lasts 3.15 seconds with 3★ or 2.05 seconds without, including the flight. Sealed grid shows the actual number of pulls. Tap a card / Open next opens a hero spotlight using existing banner/portrait, real name/class/stars and new/duplicate reward. Continue returns to unopened cards, finishing after the last. Open all / Skip / Escape opens the full-screen result summary. Skip is available throughout and idempotent.
- System reduced motion, including a live preference change during intro, goes straight to sealed cards and stops extra CSS motion. Native modal handles keyboard focus; timers/listeners/dialogs are cleaned up on scene destruction. No global keyboard handler remains. Narrow and short layouts scroll within the modal when required.
- Current roster consists exclusively of 3★ heroes, so real pulls currently always use the grand beam. The lower-star presentation is verified with isolated test/browser fixtures only. Reference SSR/SR/R labels, equipment drops, ticket currencies and reference prices are not introduced.

Validation and native artifacts are recorded on the finished branch. Browser checks use disposable saves, never the user's canonical save. No canonical-local synchronization is claimed; prior confirmed sync metadata is retained.

App/spec typechecks and full 723/723 Karma pass. Production build passes with existing component-size/CommonJS warnings plus the new scene style warning (9.88kB); budgets remain unchanged. Native checks and actual-browser recording: `/workspace/scratch/summon-reveal-review/`.

Native DPR2 checks pass at 1280×720,1440×1000,1024×768,768×1024,390×844,320×640 and844×390: cancel/no spend, rapid double-confirm/one charge, reveal/no spend, skip, latest results, repeat-confirmation, reachable scrolling actions and no horizontal scene overflow. Single pull, lower-star fixture, reduced motion and route cleanup pass; zero page errors or missing assets. `verification.json`, screenshots and actual-browser `summon-reveal.mp4` are in the review directory.


## Supplied 3-star card back — 2026-10-19

User supplied `1000004534.jpg` and requested it for 3★. Continue the existing clean summon-review task branch; fresh master remains `cdacdcd`, remote feature head `cff713b6` has identical content to local checkpoint `f292702`. Copy the 853×1280 original JPEG byte-for-byte to `public/ui/summon-card-3star.jpg` (SHA256 `51612dcc6fb3cfcb9602d72e11bc29116399c607bcd6dbc4f1c0c180b82e4d4e`). No image regeneration/editing. A runtime-only polygon preserves the wider frame, corner gems and pointed tips. Sealed cards choose the supplied back from each actual result's star; decorative flying cards repeat the same actual result sequence. Lower stars retain the previous back. Neutral idle-scene cards retain their existing art. No pull/save/config changes. Publish only the current review branch; no master merge or canonical-local sync claim.

3★ follow-up validation: app/spec typechecks, full723/723 Karma and production build pass (size/CommonJS warnings retained). Native desktop/mobile captures verify ten3★ cards use the supplied asset; isolated mixed1★/2★/3★ fixture verifies both sealed backs and all12 flying backs, with zero missing assets/page errors. Review artifacts: `/workspace/scratch/summon-3star-review/`. Source-copy SHA256 matches exactly.


## Latest follow-up — temporary free summons (Codex, 2026-10-20)

User replaced the request to top up their private browser save with “ปรับเปิดกาชาฟรีไปก่อนงั้น แต่ขึ้นจำนวนที่ใช้ค้างไว้”: allow free test pulls while retaining nominal prices. Continue the current summon-review branch, clean at local `1c7fdfd` / content-identical remote `02885552`; fresh master remains `cdacdcd`. No new other-agent changes. Publish only the current task branch for review; no new merge or canonical-local sync claim.

- `DEV_FLAGS.freeSummons = true` is the single temporary runtime switch. GachaService passes an explicit free option to the pure pull rule; the ordinary rule defaults to paid. Free mode never checks/debits gems, so zero-gem accounts can pull x1/x10 and repeat from results. Normal RNG, pity, new heroes and duplicate Memory persist as usual; no gems are minted and no save migration is needed.
- Keep configured100/900 prices everywhere, including buttons, confirmation wallet/action and repeat action. Show “free test / no gem deduction” on actions/notice, show “ราคาเดิม” in confirmation and explain free mode in rates. Confirmation/cancel/idempotence/cinematic/3-star backs remain intact. Toggle freeSummons to false to restore paid affordability/debit and paid copy; do not change GACHA prices. This temporary cost waiver is explicitly user-authorized, superseding the earlier no-cost-change notes for this follow-up only.
- Inspect `core/data/dev-flags.ts`, `core/rules/stars.ts`, `core/services/gacha.service.*`, `pages/gacha/gacha.component.*`. App/spec typechecks,729/729 Karma and production build pass. Native production-build desktop and390px phone checks pass with0 and1375 gems: nominal100/900 prices retained, cancel leaves the save unchanged, rapid double-confirm causes one pull, x10/repeat/x1 all preserve gems and persist rewards, no page errors or missing assets. Disposable saves only. Screenshots and verification.json: `/workspace/scratch/free-summons-review/`. Existing size/CommonJS build warnings remain; budgets unchanged. Last confirmed canonical-local sync metadata remains unchanged.
