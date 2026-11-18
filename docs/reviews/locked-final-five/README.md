# Final five roster cut-ins

Open `index.html` through a static server rooted at the repository for the Bai Long reference, five source/game pairs and desktop/phone recordings. These five complete the current15-hero roster. Sources are isolated generated artwork based on canonical portraits, with separate generated aura/particle sheets; no screenshot cutouts or retouched gameplay images. Badges use short names; full names remain in game data and accessible image text.

| Hero | Ultimate | Aura |
| --- | --- | --- |
| เวลริค | พิธีศพพันคมดาบ | Silver/crimson phantom mist |
| เดรเวน | อาณาจักรโลหิต | Blood dominion / ruby sparks |
| มอร์เดรียนน์ | เรือนแห่งเถ้าธุลี | Emerald/charcoal curse ashes |
| ไซลัส | ประหารรัตติกาล | Teal dusk wind |
| ลูเซียน | ปาฏิหาริย์ทมิฬ | Gold/crimson black-miracle light |

Same locked1899×828 ratio, 76vw base × .9 top-left scale, dimmed field, lightly italic readable baked Thai text, two independently drifting/fading aura textures,1250/700ms overlay and650/300ms engine freeze. Previous ten evaluated configurations and source/runtime images plus the shared renderer are unchanged. No gameplay/stat/save changes. Visual approval remains with the user.

Validation/evidence:

- App/spec TypeScript checks and Karma1005/1005 pass. Consecutive-cast coverage checks all15 heroes and a fixture-only unregistered-art fallback.
- `browser-report.json`:18 actual manual-cast cases, new five plus Bai Long at1440×860,844×390 and Reduced Motion. No page errors or source/bounds/duplicate-text failures. Both moving layers hide in Reduced Motion.
- All actual cast skill/full-name strings match the manifest's canonical names and skill titles in every case. Baked source lettering also inspected visually.
- `video-report.json`: ten normal-playback manual casts, no page errors and timed overlay cleanup. `native-frame-report.json` locates a clear plate and verifies entry/exit in all ten clips. Posters are untouched native video frames. Pixel comparison locates the plate; it is not a design-approval score.
- Screenshots pause CSS at400ms and combat for inspection. Videos use no freezing/compositing/retouching. The compilation concatenates the five desktop clips.
- Source/crop/hash/lossless RGBA verification passes for five plates/ten layers. All15 shipped heroes have a cut-in and two existing runtime layer files.
- No new production build for this asset/data extension; no master merge/deployment. The preceding checkpoint documents the environment's Google Fonts403 and successful temporary-bypass compilation.

Reproduce with Angular dev server on4200, Playwright installed (or NODE_PATH set), Chromium at `/usr/bin/chromium` and FFmpeg available:

```sh
python tools/ui/export_locked_cutins.py --check --manifest assets/ui/cutins/locked-final-five/manifest.json
CUTIN_OUTPUT_DIR=docs/reviews/locked-final-five CUTIN_IDS=vaelric,draeven,mordrienne,sylas,lucien,bailong node tools/dev/cutin-browser.cjs
CUTIN_OUTPUT_DIR=docs/reviews/locked-final-five CUTIN_IDS=vaelric,draeven,mordrienne,sylas,lucien node tools/dev/record-locked-cutins.cjs
```

Browser contexts use isolated fixtures, never user saves. Run screenshot capture, native recording and Karma separately. Adding public files while the server was running initially left some preview URLs404; restarting ng serve refreshed them, all15 new files returnedHTTP200, and the full browser run passed afterwards.

Native WebMs: `/tmp/locked-<id>-<width>.webm`. Each MP4 is the final4.7seconds:

```sh
ffmpeg -sseof -4.7 -i /tmp/locked-vaelric-1440.webm -an -c:v libx264 -threads 1 -preset fast -crf 22 -pix_fmt yuv420p -movflags +faststart docs/reviews/locked-final-five/vaelric-1440.mp4
python tools/dev/check-locked-cutin-videos.py --manifest assets/ui/cutins/locked-final-five/manifest.json --output docs/reviews/locked-final-five
```

The frame checker uses actual stage bounds, sampled native frames and opaque source pixels to locate a clearly visible plate, verify entry/exit and extract an unchanged original video frame as each poster. It does not alter gameplay or recording frames.
