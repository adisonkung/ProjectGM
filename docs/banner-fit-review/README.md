# Full hero banners — 2026-10-29

User follow-up: banner artwork was cropped. The existing fixed-height cover treatment clipped both wide and tall art, especially on mobile. Banner-bearing hero headers now follow native image dimensions, use contain, and put identity/level/power below the art. No gradient obscures the art. Fallback portrait behavior and other tabs remain unchanged. This intentionally changes the previous poster treatment in response to the user's request; no new visual reference was supplied.

| Viewport (DPR 2) | Before / reference | Actual game after | Side by side |
| --- | --- | --- | --- |
| 1440×1000 | [Before](banner-before-1440.png) | [After](banner-after-1440.png) | [Compare](compare-1440.png) |
| 390×844 | [Before](banner-before-390.png) | [After](banner-after-390.png) | [Compare](compare-390.png) |

Test data: CaraMelz fresh game, Bai Long banner. Comparison images crop the top of the original full-page screenshots and resize for comparison; original screenshots are linked separately. No generated or retouched application art. Existing design reference 02-hero-collection-overview.png was read; the user's full-banner request overrides its overlaid poster composition.

Validation: app/spec TypeScript checks,890/890 Karma tests,production build pass. Real browser verifies image aspect ratio matches source and identity does not overlap image at both sizes. All 15 hero banner ratios checked on desktop/mobile, including Vaelric 4:3 and Sylas 2:1; fresh synthetic roster used only in isolated browser localStorage. No source data or save-format changes. Existing build warnings retained. No deploy/master merge. Local commit only; previous push approval remains pending.
