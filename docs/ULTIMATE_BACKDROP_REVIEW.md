# Ultimate foreground and persistent backdrop — 25 November 2026

The active hero and the Ultimate's new VFX stay bright in front of a dark backdrop until the existing exclusive action finishes. Other heroes/enemies, older effects, the battlefield and HUD stay behind the dimmed exposure. The existing cut-in plate still appears briefly; its separate full-screen shade is suppressed during a real exclusive action, so the darkness does not stack or disappear when that plate fades.

Pixi uses the same canvas and renderer: the ordinary world sits below an RGBA(8,5,5,.65) graphics plane, while a foreground container holds the caster, ground rings/smoke, new under/over/track effects, projectiles and their particles. Under/actor/over ordering and bloom are preserved within the foreground. The plane covers the renderer's current dimensions and scenery offset. DOM fallback uses a z300 dimmer below the caster/new action layers. DOM bars/annotations above the Pixi canvas and the HUD match the behind-backdrop exposure. An outside-only shadow covers margins around a height-fitted board without applying the dimmer twice inside the field.

The existing exclusive action still owns duration, input locking, pause, death/reset cleanup and next-Ultimate availability. No combat timing, damage, skills, art assets, save data or Mobile design changes.

## Native Desktop evidence and checks

[Reference and current game](reviews/ultimate-backdrop/index.html) · [actual Pixi action](reviews/ultimate-backdrop/pixi-ultimate.png) · [actual DOM action](reviews/ultimate-backdrop/dom-ultimate.png) · [native clip](reviews/ultimate-backdrop/ultimate-flow.mp4) · [renderer report](reviews/ultimate-backdrop/browser-report.json) · [wide-screen report](reviews/ultimate-backdrop/wide-report.json).

Unmodified native1440×860 Pixi/DOM runs verify the active caster and new visible FX above the shade after the cut-in plate disappears, other actors below it, the existing action/input hold, then the next hero and restoration of ordinary layers. The Pixi run uses one canvas. Both renderers report no page errors. The reference is the prior approved cut-in screenshot; the new screenshot intentionally shows the later action phase whose persistent backdrop the user requested. Actor positions and aura phases are live game state, not a pixel-identical reference claim. Stills/video come from the running game without retouching or replacing its timeline.

At2560×900 the board is centered with side margins. Pixel samples inside the board and in both margins match RGBA(8,5,5,.65) once, with at most1RGB step of rounding error. Full-screen corner clipping is disabled during the action so the background cannot show through bright triangular gaps.

App/spec TypeScript checks,24targeted specs and the full1106/1106Karma suite pass. The final corner stylesheet is additionally verified by native screenshots and the optimized production build. The build uses the existing external fonts:false override for the environment's Google Fonts403; existing template/style/CommonJS warnings remain. No repository font/build configuration changed. This rendering-only follow-up does not change the engine or require new balancing simulations. Headless/software WebGL checks are not a real-device FPS benchmark.

No master merge or deployment.
