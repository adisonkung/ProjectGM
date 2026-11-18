# Locked first-five cut-ins

Open `index.html` through a static server rooted at the repository for source/game pairs and eight native clips. Sources are the four original generated isolated plates, not screenshot cutouts. Bai Long is the locked baseline. Small diacritic/name-badge contact is explicitly accepted by the user; no subsequent blank-badge or typography-edit variants were imported.

- Desktop: 1440×860; landscape phone: 844×390; phone Reduced Motion also checked.
- Screenshots: actual manual casts, with CSS paused at 400ms and combat paused for inspection.
- Videos: native Chromium recording, normal playback, no frozen/composited frames. The four-desktop compilation simply concatenates the individual clips.
- `browser-report.json`: 15 cases across the first five, no page errors, correct source/bounds, no duplicate live text, two layers and Reduced Motion hides layers.
- `video-report.json`: eight native manual casts with timed overlay cleanup and no page errors.
- App/spec typechecks and Karma 1005/1005 pass. No new production build for this asset/data extension. No master merge/deployment.

Reproduce with the Angular dev server on port 4200 (isolated browser saves only):

```sh
python tools/ui/export_locked_cutins.py --check
CUTIN_OUTPUT_DIR=docs/reviews/locked-first-five CUTIN_IDS=yuezheng,moye,tangxun,linxue,bailong node tools/dev/cutin-browser.cjs
node tools/dev/record-locked-cutins.cjs
```

Playwright must be installed or available through NODE_PATH; Chromium defaults to `/usr/bin/chromium`. Native WebM recordings are saved to `/tmp/locked-<id>-<width>.webm`. Each MP4 is the final 4.7 seconds encoded with:

```sh
ffmpeg -sseof -4.7 -i /tmp/locked-tangxun-1440.webm -an -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -movflags +faststart docs/reviews/locked-first-five/tangxun-1440.mp4
```

Generated art and exact sprite-sheet crops are documented in `assets/ui/cutins/locked-five/manifest.json`. Runtime export check compares decoded RGBA pixels, not only file hashes. The original Bai Long plate/textures and shared renderer have no diff in this extension. Hero-specific art changes the visual theme, using the existing two-texture drift/fade animation.
