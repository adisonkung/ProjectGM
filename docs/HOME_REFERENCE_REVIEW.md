# Home visual reference review — 2026-10-24 (Bangkok)

User request: read the reference archive, match colors, shine, angles and icons closely, show actual screenshots before review, **do not deploy**. This pass starts with Home; no claim that all18 boards have been implemented.

## Images actually inspected

- `design/eldervane-ui/01-home.png`: desktop composition, rim geometry, party cards, preview above the CTA.
- `design/eldervane-ui/14-mobile.png`: first phone is the mobile Home reference.
- `design/eldervane-ui/16-island-details-themes.png`: building/hero/theme sheet framing (style reference; these sheets retain existing content/layout).

## Implementation

- The actual City/classic scene is always rendered immediately; removed panorama and its toggle. Retained plot hit areas, dragging/zoom, hero roaming, map/theme selection, unlock/reveal rules and tower entrance.
- Responsive SVG frames measure their own size; corners retain pixel dimensions and gold double contours across diagonal edges rather than clipping an ordinary border.
- Solid SVG glyphs and the Home-only interlocking header/dock use the ivory/gold reference language. Live treasury values have no invented purchase actions.
- Kingdom progress/next unlock and five actual party members use save/services. Portraits, classes, stars, levels, power and currencies are real; no sample heroes are inserted.
- Desktop places the next-stage preview above the primary shallow-hexagon action and a separate formation action below the party. Phones use the same controls around the playable map.
- The CTA uses a blank generated texture derived from the reference with no embedded text/icon. Text, gold tower glyph, chevron, disabled/busy semantics, focus and navigation stay live HTML/SVG.
- Existing Home sheets/buttons get the same continuous contours; no action/save behavior is changed.
- Original city assets remain layered and interactive. Only the sky is graded before other canvas layers; the sealed spire is visually lighter but keeps its actual stage/ring/glow conditions. Mobile fit leaves room for the overlays.

## Scope and visible differences to assess

The reference is a painted composition with different city/portrait illustrations. The runtime uses the original approved hero art and real progression-dependent city layers, so those illustrations and building positions are not pixel-identical to the reference. Decorative preview art is not a gameplay specification. This pass does not claim pixel-perfect completion or replace the original scene with a flat screenshot.

Header changes apply on Home only. Other routes retain their existing appearance. Motion uses existing transitions/entrance and reduced-motion support; screenshots are still images.

## Asset provenance

`public/ui/eldervane/home-tower-button.webp` comes from image generation using reference01, with instructions to remove all text/icons and isolate only a blank red/gold button. Technical delivery processing trims transparent padding and encodes WebP (1800×336, alpha,132582 bytes). Generated source: `exec-4f10e02e-c020-4f3f-9ecd-7d62fce2372d.png`. The18 reference PNGs remain untouched.

## Review and validation

Actual browser captures, scripts and test/build logs live under ignored `work/home-reference/`. Use screenshots from the final production build for the review, at desktop1586×992 and phone390×844, plus responsive and transaction checks. Validation completed: app/spec typechecks pass, Karma807/807 pass, and the production build passes. Existing CSS/CommonJS warnings remain; Home/sky styles exceed the warning threshold but remain below the unchanged error budgets. Native production Chromium passes10 viewport cases (320×640,360×740,390×844,720×1000,768×1024,844×390,1024×768,1440×900,1586×992,1920×1080), real plot/hero sheets, cosmetic classic/city switching, gameplay-data invariance, Home-only header isolation and tower entry with/without reduced motion. No page errors or missing local assets. The canonical city-map save representation omits the map field; the verification respects that default instead of changing gameplay serialization.

Final actual screenshots: `work/home-reference/production-home-1586.png`, `production-home-390.png`, and `production-building.png`. Full browser report: `work/home-reference/browser-report.json`. All fixtures are disposable browser storage; no user browser save is edited. Screenshot comparison is for user review; functional checks do not certify pixel identity.

No remote push, merge or deployment in this task.

## Follow-up — luminous logo and selected menu finish

User found the compact logo too dark and the selected menu too flat, with a detached hard underline. Home now uses the existing original full `eldervane-logo.webp`, fitted within the header with a restrained cyan glow; the original source asset is unchanged. Other routes retain their previous wordmark. The selected Home tab opts into a cropped lacquer texture from the existing blank CTA skin, a diagonal reflected-light coat and a small low-contrast engraved motif. It suppresses the frame's hard red/white underline; the CSS diamond is replaced with a blurred red shadow that blends into the gold rim. The header baseline is softened. No gameplay or navigation behavior changes.

Actual production screenshots for this follow-up: `work/home-reference/refined-header-desktop.png`, `refined-home-desktop.png`, and `refined-home-mobile.png`. Header verification checks320/390/768/1024/1440/1586 widths, actual image source, selected texture, soft indicator, navigation and other-route isolation. Results/logs: `header-refinement-report.json`, `tests-refinement.log`, `build-refinement.log`. No remote publication or deployment.

## Follow-up — docked party and logo contrast guidance

The user requested the party frame at the bottom and a small formation action inside a corner instead of the detached wide button. Desktop Home now docks the party at a16px safe margin; the44px click target with a small crossed-swords glyph sits inside the upper-right of the team frame. Mobile retains its party/entry/dock order and reserves header space so actual power does not overlap the action. Same route and party data, no gameplay changes.

Logo guidance is preview-only: A uses a thin ivory plaque under the original dark-core logo; B keeps the dark header and adds silver edge light. These are temporary browser CSS previews, not a committed change to the runtime logo. A gives stronger contrast while keeping the original artwork; user has not selected a treatment. Artifacts: `work/home-reference/logo-contrast-guide.png`, `team-corner-closeup.png`, `team-position-desktop.png`, `team-position-mobile.png`. App/spec checks,Karma807/807 and production build pass. Browser checks five viewport sizes for bottom alignment, inset44px action, nonoverlapping power text and a real click to formation. No page errors. This remains local review without deployment.


## Follow-up — raised corner formation control

Reduced desktop party count/power typography to a17px maximum (from20/21px) and its power glyph to22px. The existing44px formation target remains inside the top-right of the party frame, now with a larger double-gold contour, beveled gloss, underside shadow, hover lift, pressed state and visible keyboard focus. Reduced-motion disables movement. Route and game data are unchanged. Champagne/ivory full-logo and compact-wordmark recolors are preview-only under ignored work files; neither replaces runtime branding. No deployment.

Latest follow-up validation: app/spec typechecks, production build and Karma807/807 pass. Production browser checks320/390/768/1024/1586 widths, corner containment, nonoverlapping stats, desktop bottom alignment and actual formation navigation. Captures: team-corner-closeup.png, team-position-desktop.png and team-position-mobile.png under ignored work/home-reference. Existing build warnings remain; budgets unchanged.

Header follow-up: user approved champagne/ivory logos in runtime (compact shared navigation/summon heading, full welcome). Team corner action inset increases7px desktop/5px mobile. Home lower gold rail is brighter with layered metal and resource gloss. Wallet formats exact values below100k and truncated k/m/b above, with full accessible/title values; saved balances unchanged. Fixed wallet widths reserve six characters across breakpoints. No deployment; current screenshots/checks live under ignored work/home-reference/*wallet*.

Header/wallet validation: app/spec typechecks pass; Karma808/808 and production build pass. Production Chromium passes40 combinations (eight balances × five widths320–1586), exact balance tooltips, fixed currency containment, no menu overlap, inset corner action and real formation navigation; no page errors/missing local assets. Layout-readiness waits account for SVG ResizeObserver sizing before review captures. Original balances/save format remain unchanged.

Header seam refinement: replace the heavy multi-line gold rail with a single1px warm metal edge, restrained inset highlight, irregular specular glints and a6px translucent reflection fading into the sky. Removes the detached opaque brown/gold lower stripe. Pointer-transparent decoration, no changes to dimensions/navigation/currency behavior. No deployment.

Seam validation: app/spec typechecks, Karma808/808 and production build pass. Production Chromium checks five widths320/390/768/1024/1586 for1px edge,6px fading reflection and no document overflow. Actual before/after header comparison and full Home captures live under ignored work/header-seam and work/home-reference/seam-*. Existing build warnings remain; no deployment.

Home deployment authorization (2026-10-24 Bangkok): user approved the reviewed Home and explicitly requested deployment, then the next page. This supersedes no-deploy statements above for the completed Home changes only. Publish the reviewed Home snapshot through a task branch/PR, verify the remote tree before merge, inspect Cloudflare status for the actual merged commit. Next page: hero collection, use reference02/14/18 and real hero data; show screenshots before deploying that next page.
