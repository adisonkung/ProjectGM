# Full-screen map import review

User request: try the three uploaded maps in the game. Review branch: `fix/fullscreen-map-art`, based on origin/master 9544059. No master merge or deployment is included in this task.

[Side-by-side comparison: uploaded references / actual game](comparison.html). Each reference opens its untouched source PNG. Captures show a paused fight immediately after starting, with the default starter team, at 1440×860 and 844×390, for floors 1, 4 and 8. Preparation screens are captured separately. The browser fixture unlocks floors only in its isolated local save.

All three old forest files are replaced by lossless exports of the user's PNGs. The runtime pixels match the originals. Full-screen fights draw one continuous cover image, bottom aligned, instead of repeating the old scene under the lanes. Viewport geometry uses the authored tree line to center a square-cell 16-column board with three combat lanes above the party dock. Existing Ascension arena geometry and gameplay are unchanged. Preparation/sprite-lab use the single-scene arena rendering path.

Expected composition differences: desktop cover crops a little from the sides; wide phone cover crops sky from the top. HUD/actors/party controls overlay the source art. The board occupies a centered portion of the image width to keep three square-cell lanes above the controls; it does not stretch to all four image edges. Preparation remains a shallow formation preview with a tighter crop.

Validation: app/spec TypeScript checks, 1004/1004 Karma specs, six browser reference/capture scenarios without page errors. Production compilation passes with font inlining temporarily disabled because Google Fonts requests return HTTP 403 in this environment; angular.json is restored unchanged. No combat values, stage rules or save schema were changed. The viewport regression includes ultrawide 2560×900 to keep lanes clear of the dock.

- [Browser geometry report](report.json)
- [Source files and hashes](../../../assets/backgrounds/fullscreen-2026-11-18/manifest.json)

Live smoke runs also pass through the actual loading/start button for floors 1/4/10 with Pixi and floor 8 with DOM; all advanced beyond two seconds without page errors. [Live report](live-report.json) · [Floor 10 first-wave live capture](misty-floor10-1440-live.png).
