# Locked next-five cut-ins

Open `index.html` through a static server rooted at the repository for the Bai Long reference, five source/game pairs, and desktop/phone native clips. The source plates are isolated generated artwork using the canonical portraits as identity references; no gameplay screenshots were cut out or retouched. Badges use the established short display names. Full names remain in game data/accessibility text.

| Hero | Ultimate | Aura |
| --- | --- | --- |
| การ์ริก | ยืนหยัดเฝ้าประตู | Fortress gold / guardian sparks |
| เคล | เถ้าธุลีแยกแผ่นดิน | Ash / embers |
| มิเรลล์ | อาณาเขตแก้วเหมันต์ | Winterglass frost / crystals |
| ซิลวารา | ฝนศรมรกต | Emerald forest wind / pollen |
| เอลิรา | เขตพิทักษ์แสงอุ่น | Warm sanctuary light / featherlike motes |

All five use the approved 1899×828 source ratio, 76vw base × .9 top-left scale, dimmed field, readable lightly italic baked Thai text and two independently drifting/fading generated textures. Original first-five art/configuration/renderer behavior is retained. No combat or save changes. User visual review is pending.

Confirmed validation:

- App and spec TypeScript checks pass; Karma 1005/1005 passes (serial run).
- `browser-report.json`: 18 actual manual-cast cases, new five plus Bai Long at 1440×860, 844×390 and Reduced Motion; no page errors, wrong source, bounds failures, duplicate text/frame or horizontal overflow. Reduced Motion hides both moving layers.
- `video-report.json`: ten normal-playback manual casts with timed overlay cleanup and no page errors. Three desktop cases were recaptured with fewer workloads; their rerun report is retained separately and replaces those entries in the combined report.
- `native-frame-report.json`: all ten clips contain a clear actual plate across several sampled frames and show entry/exit; posters are original video frames. Pixel matching locates the plate, not a design-approval score.
- Lossless export verifier passes for both manifests. Evaluated first-five configuration objects match the locked checkpoint exactly, and first-five source/runtime assets plus shared renderer have no diff.
- Still screenshots pause CSS at400ms and combat for inspection. Videos use no animation freezing, compositing or retouching. The compilation concatenates the five desktop clips.
- An initial concurrent Karma run was killed (exit137) during multiple Chromium workloads; it is not counted as a pass. The serial run passed. No new production build for this asset/data-only extension; no master merge/deployment.

Reproduce with Angular dev server on4200, Playwright installed (or NODE_PATH set), Chromium at `/usr/bin/chromium` and FFmpeg available:

```sh
python tools/ui/export_locked_cutins.py --check --manifest assets/ui/cutins/locked-next-five/manifest.json
CUTIN_OUTPUT_DIR=docs/reviews/locked-next-five CUTIN_IDS=garrick,kael,mirelle,sylvara,elira,bailong node tools/dev/cutin-browser.cjs
CUTIN_OUTPUT_DIR=docs/reviews/locked-next-five CUTIN_IDS=garrick,kael,mirelle,sylvara,elira node tools/dev/record-locked-cutins.cjs
```

Browser contexts contain only isolated fixtures; user saves are never used. Run browser capture/recording and Karma separately to avoid excess memory pressure. Recorder also supports CUTIN_WIDTHS and CUTIN_VIDEO_REPORT for scoped reruns. Native WebMs are saved as `/tmp/locked-<id>-<width>.webm`. Each MP4 is its last4.7seconds:

```sh
ffmpeg -sseof -4.7 -i /tmp/locked-garrick-1440.webm -an -c:v libx264 -threads 1 -preset fast -crf 22 -pix_fmt yuv420p -movflags +faststart docs/reviews/locked-next-five/garrick-1440.mp4
python tools/dev/check-locked-cutin-videos.py
```

The frame checker reads actual stage bounds from the browser report, compares opaque source pixels with ten sampled native frames per second, verifies clear plate/entry/exit, and selects an untouched native frame as each poster. It does not alter gameplay or the recorded frames.
