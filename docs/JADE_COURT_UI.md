# Jade Court UI — 2026-10-23

User request: modern, readable, luxurious fantasy game UI with smooth buttons/windows; avoid the violet-black theme.

## Presentation

- Warm ivory navigation, brass iconography and a jade selected state. Six destinations persist on hero detail and account pages. Desktop has a compact command bar; phones keep a six-item dock and safe-area padding. A keyboard skip link leads to the main content.
- Home has ivory kingdom and party folios, quieter borders and a brushed-gold tower action. Original city art, scene interactions and tower entry behavior remain.
- Hero collection has ivory portrait cards, readable power/class labels, live owned/team/development counts, Thai-name and case-insensitive hero-ID search, combined search/class filters, clearable empty states and grid/list views. Phone class filters scroll within their rail rather than widening the page.
- Formation, adventure, equipment, battle HUD/result controls, hero detail, summon information and account/welcome controls share jade/sage surfaces and warm copy instead of violet/navy chrome. Rarity colors remain semantic. Important equipment labels are larger on phones.
- Shared button feedback lasts 150–180 ms, route opacity enters in 260 ms and dialogs enter in 240 ms. Native dialogs use progressive `@starting-style` / discrete display-overlay transitions for a 220 ms close where supported; older browsers retain the entrance fallback. Full-screen summon choreography is excluded. Reduced-motion preferences disable the added page/dialog/press movement. No new timers or animation loops.

## Boundaries

No changes to combat, sprite/VFX timing, hero art, game balance, summon odds/costs, saves, unlocks or service actions. No new UI packages, generated assets, fonts or production budget changes.

## Validation

- App and spec TypeScript checks pass.
- Existing full Karma suite: 805/805. Updated page/shell tests: 10/10, including two new regression cases for combined search/reset and detail/account navigation.
- Production build passes; existing component-style and Pixi CommonJS warnings remain. Hero collection styles are consolidated rather than layered overrides.
- Native Chromium: 40 menu route/viewport combinations plus battle preparation/start at390px,1440px and844×390 landscape, across 360,390,768,1024,1440,1920px; no document overflow, page errors or missing local assets. Search by ID, clearable empty state, grid/list switch, native info dialog/Escape, cancelled summon and reduced-motion route behavior pass. Screenshots and machine-readable results are local under `work/ui-review/`.

Branch: `wip/codex-jade-court-ui`, based on `origin/master` 1eeba94. Review before merging. This records no new canonical-local synchronization claim.

Publication was initially blocked because CLI identity lacked push permission and automatic approval review required explicit public-disclosure consent. On2026-10-23 the user explicitly authorized publishing the complete UI/name/logo source,assets,documentation stack and merging it into public `adisonkung/ProjectGM` master to trigger Cloudflare. This supersedes the earlier pending-publication status.
