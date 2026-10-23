# Eldervane branding

Official name: **Eldervane / เอลเดอร์เวย์น** (user decision,2026-10-23; PROJECT_RULES §1).

## Approved visual direction

On2026-10-23 the user supplied `ChatGPT Image 23 Oct 2026, 19_50_28.png`, selected its blackened-steel/silver/antique-gold title, pale-blue magic and floating tower composition, and authorized refining and installing it in the game. This supersedes the earlier exploratory black/red/gold concept boards for the actual logo assets. The mark is English-only; Thai remains the official localized game name in copy.

- Full lockup: recognizable title with a floating island/tower behind the right half, fine summoning orbit and small star details. Refined V/A spacing and a quieter horizontal flare.
- Compact lockup: matching metal letterforms and small blue accents, without the illustrative island/tower/orbits; intended for navigation-size display.
- Both are generated refinements of the supplied reference, not the original attachment bytes. Transparent PNG masters and original generated files are retained. Do not restore the discarded logo explorations automatically.

## Runtime assets

| Asset | Purpose |
| --- | --- |
| `public/ui/branding/eldervane-logo.png` | Full transparent generated master,1774×887 |
| `public/ui/branding/eldervane-logo.webp` | Full welcome-screen asset,1774×887 |
| `public/ui/branding/eldervane-wordmark.png` | Compact transparent generated master,2120×742 |
| `public/ui/branding/eldervane-wordmark.webp` | Navigation/summon asset,900×315 |

WebP encodes use quality92,alpha quality100; compact is scaled from its PNG master to900px width. This is delivery optimization only. PNG masters are unchanged. Runtime uses WebP; master PNGs are retained for future derivatives.

## Placement

- `app.component`: compact logo replaces the generic tower crest and text brand. The link retains its accessible Home label. Centering and vertical overflow handling hide transparent top/bottom padding while preserving the complete horizontal wordmark at phone/tablet/desktop sizes.
- `welcome.component`: full logo on an transparent masthead over the citadel environment replaces the generic floating-island SVG. The page retains a semantic, visually hidden Eldervane h1; nearby Thai welcome copy gives the localized name.
- `summon-scene.component`: compact logo replaces the stale SUMMON TOWER label. Only the heading is changed; summon timing, cards, actions and probabilities are unchanged.

No gameplay, save format, hero art, economic values or battle/sprite timing changes. No new production dependencies, animation loops or changes to build budgets.

## Deployment

The user explicitly authorized public publication of the UI, game-name and logo source/assets/documentation and merging this complete stack into `adisonkung/ProjectGM` branch `master` on2026-10-23. This supersedes the earlier pending-approval statements for this stack. The user confirms the live Cloudflare Worker is connected to that production branch. Runtime Git identity `webuilddeveloper` lacks push access; use the connected repository owner account. Verify the published tree against the local reviewed tree before merging, and inspect deployment status afterward. Do not claim a live update from merge success alone.

## Validation

App/spec TypeScript checks pass; full Karma807/807 and production build pass. Native Chromium on the production build verifies full-logo welcome layouts at360/390/768/1440px, header layouts at360/390/768/1024/1440/1920px, Home-link navigation and the summon-dialog logo. No document overflow, header overlap or page errors. A narrow-screen form min-content overflow discovered at360px is fixed with bounded grid tracks. Runtime compact WebP matches its built copy byte-for-byte. Screenshots/results are local under `work/logo-review/`. Build retains existing component-style/Pixi warnings; budgets are unchanged.

## Champagne/ivory revision — review only (2026-10-24 Bangkok)

User approved applying the previewed champagne/ivory recolors. New transparent delivery files `eldervane-logo-champagne.webp` (1738×863) and `eldervane-wordmark-champagne.webp` (2023×456) are cropped/encoded from generated PNGs `exec-43968c18-83e7-49a9-9211-128d5797ed93.png` and `exec-b5ad1ec3-0763-4650-8e35-fc6fabb1cf72.png`. Original masters and original WebPs remain available. Shared navigation and summon heading use the compact version; welcome uses the full floating-tower logo. Home fits the complete wordmark with contain, removing the earlier full-logo crop. The latest explicit no-deploy instruction supersedes the historical deployment authorization above for this review.
