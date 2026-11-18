# Ten themed ultimate cut-ins

User-approved style 3 for Bai Long, Yue Zheng, Mo Ye, Tang Xun, Lin Xue, Garrick, Kael, Mirelle, Sylvara and Elira, with extra VFX/aura and 10% smaller size. Branch `wip/codex-themed-ultimate-cutins` continues the existing map/card preview stack from be368b2.

[Approved references / actual game screenshots and clips](index.html). Source PNGs and hashes: assets/ui/cutins/manifest.json. Runtime: public/ui/cutins/*.webp. Re-export with `python3 tools/ui/import_cutins.py`. All images have genuine alpha; none includes the background battlefield or baked lettering. Original hero portraits and banners are preserved.

## Individual text/frame review (2026-11-18)

All ten heroes were calibrated sequentially against their own source plate and selected reference. Skill/title and name now have independent positions and sizes instead of one shared text column. All ten have a small gold name badge: the first three listed below reuse their embedded art badge; the other seven draw a live SVG double-line badge. Text stays on one line and uses self-hosted Trirong with gold italic titles and ivory names. The desktop/mobile image pairs are updated; normal-playback videos are also updated.

| Hero | Name frame | Individual correction |
| --- | --- | --- |
| Bai Long | Embedded | Align name inside the source badge; center title above it |
| Mo Ye | Embedded | Match the smaller badge, align both text centers |
| Lin Xue | Embedded | Align the name clear of lotus/petals |
| Yue Zheng | Live SVG | Add missing small badge below the large plaque |
| Tang Xun | Live SVG | Add badge/stars; fit long skill on one line |
| Garrick | Live SVG | Add badge inside the fortress plaque |
| Kael | Live SVG | Add badge/stars; fit long skill on one line |
| Mirelle | Live SVG | Wider badge/smaller type for the full name |
| Sylvara | Live SVG | Wider badge/smaller type for the full name |
| Elira | Live SVG | Separate name from the sanctuary title |

Reproduce one hero with `CUTIN_IDS=bailong node tools/dev/cutin-browser.cjs` (Playwright via NODE_PATH), or omit CUTIN_IDS for all 23 cases. Checks measure the skill width against its slot, name width against the badge's central area, ensure a name frame exists, preserve top-left position/scale and check overflow/page errors. Remaining differences: some source-art large plaque outlines/composition and the live Thai font still differ from the concepts. Aesthetic review remains pending.

The generic `ThemedCutinComponent` renders the hero-specific illustration, live skill/hero names, colored pulsing aura, energy rays, a moving light sweep and twelve flying motes. Its entrance overshoots briefly for impact and settles at scale(.9), top-left origin, on a 70vw base. Both dimensions shrink by 10%. The entire gameplay/HUD behind it dims by 65%. Normal overlay lifetime 1250ms; reduced motion 700ms with no translation, rays, sweep or particles. Existing combat hit-stop remains 650ms / 300ms reduced motion: engine time, skill events, damage, stats and targeting are unchanged. Five unselected heroes retain their previous cut-in. Team images preload before the battle starts.

Actual manual-cast checks cover all 10 heroes at 1440×860 and 844×390, plus reduced-motion Bai Long, Mirelle and Elira (23 cases). Browser fixtures create isolated owned heroes with existing classes/skills; no user save is touched. Comparison screenshots pause the actual cast's CSS animations at 400ms and pause the game to preserve a consistent inspection frame; they are not generated or retouched screenshots. The video clips show normal playback after a real button click. Runtime type remains editable text and differs from concept lettering; generated isolation has small detail differences versus the original draft, with all ten themes retained. No pixel-perfect equivalence is claimed.

Validation: app/spec typechecks; Karma 1005/1005, including consecutive themed-cast replacement, unselected-hero fallback and cleanup; 23 browser checks with no page errors, asset or text bounds failures; production compilation/budgets pass with font inlining temporarily disabled due to the environment's existing Google Fonts HTTP 403 issue. angular.json is restored unchanged. No master merge or production deployment.
