# Charcoal character collection — 2026-11-25

User approved the final charcoal concept (including charcoal text AND icon on the selected ivory class filter) and requested implementation with comfortable spacing rather than an oversized/zoomed layout.

## Original scope and composition

- `/heroes` only owns a full-screen header and internal roster scroll. The route opts out of the legacy 75% CSS zoom; other collection/detail routes retain their existing chrome, zoom and scrolling.
- Page width is capped at 1600px, with 24–32px padding, a 175–200px class sidebar, 26–34px sidebar gap and five columns of tall cards. At 1670×942 each card is about 241×345px, slightly smaller than the reference's approximately 250×360px. Short Desktop heights compact the header area so two complete card rows remain visible.
- Neutral charcoal background, no scene or architectural decoration. Simple softly rounded rectangular full-bleed portraits, class upper left, short Thai name and actual stars lower left, actual Lv lower right. Full canonical names remain in accessible labels/tooltips/search. Six-star roster marks are static; the shared star component's new opt-out preserves its existing animated default elsewhere.
- Fine 3px luminous bottom lines (increased from2px in the latest follow-up) follow actual primary class: fighter red, tank gold, assassin purple, archer amber orange, mage light cyan, healer green. Selected filter text and icon both charcoal. First/main hero keeps a corner check only; the user subsequently removed its permanent ivory frame. It does not mutate hero selection/progression.
- Search (full name and ID), class filter (sidebar and toolbar), sort and detail navigation use live roster data. A registry-order sort provides the reference's default composition; previous power/level/star/name sorts remain available.
- Header uses real wallets, existing Home bag and the existing Home mock mail/menu counters. Bag works; news/mail/top-up retain the Home placeholder behavior. The menu exposes existing destinations. No store, extra rewards, balance, save migration or portrait replacement was added.

## Evidence and data differences

[Paired reference/native images](reviews/hero-collection-charcoal/index.html). `reference.png` is the unmodified selected generated draft, not a game capture. All `actual-*` and flow images are native Playwright screenshots with no retouching. The isolated review save owns the fifteen registered heroes and exercises 3–6★ / Lv5–10; it never changes a player's save. Example levels and stars drawn in the draft are not copied into production data.

Original game portraits differ from the generated draft's repainted characters. Native local Noto Thai fonts, rendered star glyphs and vector icons approximate the draft lettering/glyphs; they are not pixel-identical generated artwork. The implementation intentionally retains those approved original hero assets and slightly smaller scale. Visual acceptance remains with the user.

Reproduce: `HERO_COLLECTION_URL=http://127.0.0.1:4300 node tools/dev/hero-collection-browser.cjs` with `ng serve --port 4300`. The script checks Desktop 1280×720, 1440×860, 1670×942 and 1920×1080; portrait aspect/width cap, two complete rows, class lines/mapping, names/stars/Lv containment, selected text/icon, local fonts, filters/search/empty recovery/sort, scroll/detail route, bag/menu/Escape, top-up placeholder/back, and unchanged ownership/progression/wallet/inventory/team. Desktop only; Mobile remains deferred.

## Validation

App/spec typechecks pass. Full Karma suite passes 1048/1048 with the external no-sandbox configuration and source maps disabled. Native Desktop browser checks pass at all four sizes and all recorded flows. Optimized production build passes with the existing external `fonts:false` Architect override (tracked build configuration unchanged; Google Fonts inlining is unavailable in Cloud). No master merge or deployment requested in this task.

## Follow-up: remove selection frame and equalize dimensions

User requested removing the selected card's line/frame and checking every card's width/height. The previous grid distributed fractional track widths (up to0.015625px width /0.03125px height difference), while the featured card had an additional2px inset highlight and1.5px pseudo-border. Remove that special frame and bind all cards to identical whole-pixel tracks with CSS `round(down, …, 1px)` where supported; the equal-fraction track fallback remains for older engines. Explicit width100%, border-box and zero border/padding keep the slot independent of artwork and highlight state. The small corner check and keyboard-only focus indicator are retained.

[Latest before/after native comparison](reviews/hero-card-uniform/index.html). All15cards measure exactly189×270px at1280×720;209×298.5625px at1440×860;241×344.28125px at1670×942 and1920×1080. Every card has the same base shadow and no selection pseudo-border. The browser script now asserts exact equality, not just an aspect/width limit; select `HERO_COLLECTION_REVIEW=docs/reviews/hero-card-uniform` to preserve the earlier evidence. Existing native flow/save checks also pass. No art, data, page scale, spacing, star/level placement or Mobile change.

Follow-up validation: app/spec typechecks, full1048/1048Karma and optimized production build pass (same external fonts:false override). Native exact-dimension checks and unchanged interaction/save checks pass.

## Follow-up: brighter class glow

User requested making every class strip slightly larger and much more luminous. Uniform3px strips replace2px; bottom offset remains1px. Three shared glow layers use4/12/24px blur with1/3/4px spread; the two broad layers mix the same class color at70%/35% opacity. The glow stays clipped inside the card and rises behind the lower portrait rather than creating a new selection frame or shifting the card. Class palette, grid bounds, text and progression are unchanged.

[Latest native before/after](reviews/hero-class-glow/index.html). Browser checks assert3px on all15cards, both broad glow layers and exactly equal card dimensions at all four Desktop sizes; all original flow/save checks also pass. App/spec typechecks, full1048/1048Karma and optimized production build pass (existing external fonts:false override). No Mobile/master merge/deploy.

## Follow-up: 80% body, six columns, full Desktop width — 2026-11-26

The latest user instruction supersedes the original five-column width cap: sidebar and roster body use80% CSS zoom, while the header keeps its original native size and bounds. The body fills the viewport with existing32px outer padding; six equal columns use remaining space. Sidebar width/gap scale from200/34px to160/27.2px (175/26px to140/20.8px on narrower Desktop). The header alone retains its former1536px content maximum. Grid rounding uses1.25 logical pixels so physical card widths remain integral under zoom. Card art stays fluid to fill the six columns rather than leaving unused wide-screen space.

Class lines are still3 logical pixels (2.4 rendered), with the same palette/glow and no permanent selected frame. Original art, progression and services remain unchanged. [Native before/after and original reference](reviews/hero-roster-six-columns/index.html). All15slots are equal within0.02px browser rounding tolerance:165×235.703px at1280,182×260px at1440,220×314.281px at1670,262×374.281px at1920. All sizes show two complete rows. Wallet/title bounds match the prior native report within0.1px. Search, filters, sorts, detail/back, bag/menu/Escape and save-preservation checks pass.

Reproduce with `HERO_COLLECTION_URL=http://127.0.0.1:4300 HERO_COLLECTION_REVIEW=docs/reviews/hero-roster-six-columns node tools/dev/hero-collection-browser.cjs`. App/spec typechecks, full1109/1109Karma and optimized production build pass (existing external fonts:false override). Task branch `feature/hero-roster-six-columns`; pending visual review, no master merge/deploy. Desktop only.

## Follow-up: larger toolbar, original class line seals and archive light

Search/filter/sort grow35→41 logical pixels tall (28→32.8 rendered under80% body zoom). Search maximum330→380, filter65→74, sort minimum211→244logical pixels; toolbar text14→16. The toolbar row grows accordingly, retaining two full card rows at all four Desktop sizes. No header/card width/column change.

Six original angular line seals now render from64-unit SVG paths with shared2.6-unit stroke and small solid facets. The same paths render in sidebar class colors and ivory on portrait badges: fighter flame, tank bastion, assassin shadow crystal, archer winged arrow, mage arcane prism, healer lotus. These follow the attached examples' faceted line-art direction, not copied HSR assets. Selected class filter remains charcoal text/icon on ivory. No class registry/gameplay mapping changed.

Background remains neutral charcoal but lighter, with static pale diagonal beams, thin elliptical orbit lines and sparse star glints in `public/ui/collection/archive-light.svg`. Decoration is pointer-transparent and requires no animation/canvas/timers. [Native before/after, original UI baseline and icon sheet](reviews/hero-class-seals/index.html). The icon sheet uses the same vector paths as the game; native actual captures are unretouched. Existing portrait assets, ownership/progression and save rules are unchanged. Native four-size layout and existing interaction/save checks pass. Desktop only; no master merge/deploy.

Final validation for the icon/lighting follow-up: App/spec typechecks, full1109/1109Karma and optimized production build pass (existing external fonts:false override; tracked build settings unchanged). 
