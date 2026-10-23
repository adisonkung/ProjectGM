# Eldervane — Refined Citadel UI

User-approved direction, 2026-10-23: Japanese/Korean fantasy beauty with a strong charcoal, crimson and antique-gold identity. Keep the angled menu silhouettes from Obsidian Order, with finer edges, lighter environments and less heavy western ironwork. Replaces the Jade Court presentation. This task implements the approved drafts across the production UI; mockup character paintings, star counts, prices and floor totals are not game data.

## Design and implementation

- `src/styles.scss`: charcoal surfaces, warm readable text, champagne-gold edges, crimson primary/selected controls, sky-blue magic accents. Thai text uses IBM Plex Sans Thai; Cinzel remains for Latin display text. Shared angled buttons keep horizontal labels and inset keyboard focus outlines.
- `shared/_fantasy-ui.scss`: surface, angled-control and environment mixins. Panels that hold content/scrollbars retain rectangular bounds; angled clipping applies to controls. Short hover/press/page/dialog transitions respect reduced motion.
- Shared header: slim full-width dark navigation, consistent six core destinations on menu pages, real balances and account access. Phones retain labeled bottom navigation and safe-area padding. Battle retains the compact menu and existing full-screen behavior.
- Home: new sky-citadel panorama, live kingdom/progression, original hero portraits, current five-slot party, next-stage preview and tower entry. A labeled map toggle restores the original interactive Sky City/classic map; the theme picker still works. A desktop building rail opens the existing progression sheets. On compact screens, the map button preserves access to every building. Panorama is temporary presentation state and does not change saves; roaming simulation stepping/publication pauses while the map is not shown.
- Heroes: class-filter sidebar on desktop, original owned-hero art, larger four-column cards, search, sort and grid/list controls. Phone filters scroll inside their rail, and cards use two columns. Live roster/team/development summaries and empty-search reset remain.
- Formation: the same 18 legal allied cells (3 lanes × 6 depths), now rectangular floor markers, existing sprites and stable nameplate spacing. A desktop sidebar reads the actual deployed heroes/power and selects through the existing interaction. It folds away below 1050px. Presets, reserve filters, tap/keyboard/drag, automatic arrangement and immediate persistence remain unchanged.
- Summon: new luminous sanctum, original roster lead's banner as showcase, readable dark information panels, clearly separated single/multi controls. Actual service prices, temporary free-testing disclosure, rates/pity and duplicate-memory rules remain authoritative. Native confirmation/cancel/transaction, cinematic/reveal/skip and rewards are unchanged. Cinematic highlights use blue/gold instead of purple; authored timing is untouched.
- Hero detail, armory, forge, tower, all dungeon tabs, account, welcome, battle controls, shared save import and saved teams use matching materials and typography. Original hero/gear art and battle fields remain. Armory/forge share the luminous sanctum environment; their original supplied backgrounds remain available in the repository. Tower and magical dungeon variants use the new environment assets; Hunt keeps its vault.

## Artwork

`public/ui/eldervane/citadel.webp` and `sanctum.webp` are original generated environment-only illustrations, derived from the approved draft direction on 2026-10-23. They contain no baked-in controls, characters or text. Generated PNG masters remain outside the repository in the session artwork workspace. Delivery WebP files are quality88, without upscaling. No approved hero art, generated island source/manifest, sprite sheet or atlas was changed. The approved full/compact Eldervane logos are unchanged.

## Verification

Completed validation:

- App/spec TypeScript checks pass; full Karma 807/807 passes. The existing City/classic rendering checks now open their maps through the real toggle, including unchanged save-state and return-to-panorama assertions.
- Final production build passes (591.42kB initial, about133.10kB estimated transfer). Component style warning budgets and the existing Pixi CommonJS warning remain; no budgets were changed.
- Native Chromium production preview: 90 route/viewport cases across 320×740,390×844,768×1024,1024×768,1440×1000,1920×1080; no document overflow, header overlap, page errors or missing local assets. Four welcome sizes also pass.
- Real UI checks: map toggle without save mutation, building sheets, search/reset/list, all18 formation cells, actual5-member sidebar, keyboard placement with persistence after reload, automatic arrangement, hero skill/stat keyboard tabs, rates Escape, summon cancellation without save mutation, actual summon reward, and reduced motion.
- Battle preparation/start passes at390×844,1440×1000 and844×390 landscape, with no overflow or browser errors.
- Review scripts, screenshots and reports are local under ignored `work/fantasy-ui/`. They are implementation screenshots, separate from generated drafts.

## Scope and publication

No combat, roster, progression, economy, save format, unlock or animation timing changes. Current work starts from fetched `origin/master` f65ed90 on `wip/codex-eldervane-fantasy-ui`. The remote task branch was created at the base. Automatic approval review rejected publishing the new source/documentation/art tree to this public repository, stating that UI implementation approval did not authorize public disclosure of this specific payload. Two generated artwork blobs were accepted before tree publication was rejected; no new source tree or commit was published, no PR opened, and no master merge/deployment occurred. Finish local work and obtain explicit permission to publish this complete UI source, documentation and generated art and merge for the connected Cloudflare deployment before retrying. This document makes no canonical-local synchronization claim.

### Publication authorization — 2026-10-23

The user explicitly answered “อนุญาต” to publishing this complete new UI source, documentation and generated art to public `adisonkung/ProjectGM`, merging into `master`, and triggering the connected Cloudflare deployment. This supersedes the pending-publication restriction above. Source is validated; only this authorization note and the corresponding notebook/handoff entries change afterwards. Verify published tree equality and the exact merged commit's build before reporting deployment success. No new canonical-local sync claim.
