# Ultimate cut-in prototype

The user requested an example after discussing Persona 5 and Brown Dust 2 references. This is an original concept prototype using existing Eldervane hero banner art, champagne gold/burgundy colors, a quick diagonal entrance/exit, large central artwork and skill typography over a darkened live battlefield. No external game artwork is copied.

[References, previous implementation, prototype and clips](comparison.html).

Presentation lasts 950 ms, or 650 ms with reduced motion. The existing presentation freeze remains 650 ms (300 ms reduced motion); engine time, damage and authored skill timing are unchanged. Reduced motion uses a stationary band with a short fade and no pan/sweep/spark animations. Existing cut-in replacement, exit and route cleanup remain in place.

Actual manual ultimate clicks in the browser: floor 1, starter Bai Long, 1440×860 and 844×390, plus reduced motion. PNGs are unchanged frames extracted from those browser recordings at the central reveal; MP4s contain the real click/cast sequence. They are not generated artwork or composited mockups. Cover cropping differs from the old banner. Other hero banners may require individual focal-point tuning; only Bai Long has been visually checked in this prototype review.

No merge/deploy. Same `fix/fullscreen-map-art` review branch. See report.json for captured text, viewports and page errors.

Validation: app/spec typechecks and Karma 1004/1004 pass, including the existing cut-in player/enemy distinction, frozen game tick and route cleanup checks.
