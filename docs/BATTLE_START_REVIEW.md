# Pearl Battle Start — 25 November 2026

The approved pearl cut-in is installed in the actual battle flow. Both English taglines are removed. The real map name and stage label are larger; at the reviewed Desktop viewport1440×860 they use30.24px and23.04px. The dark left and pearl right pieces occupy approximately half the battlefield at contact, their outer tails extend offscreen, and small white/gold friction sparks follow the slanted contact line. Timing:240ms entry,560ms sliding scrape,230ms accelerated pass-through/fade, followed by the completed backdrop fade.

[Reference and actual-game comparison](reviews/battle-start/index.html) · [comparison PNG](reviews/battle-start/comparison.png) · [actual Pixi frame](reviews/battle-start/actual-pixi.png) · [updated reference](reviews/battle-start/reference-updated.png) · [original selected reference](reviews/battle-start/selected-reference.png).

The updated reference preserves the selected design and applies the requested tagline removal and enlarged map/floor typography; it is a design image. The actual image comes from Angular/Pixi at1440×860, with its native animation paused at600ms for inspection. It is not generated or retouched. The original reference was designed for the chat's1024px surface and is resized for comparison. Native actors, HUD and stage data remain current game data; decorative sparkle positions and the small top-right real-stage label can differ. The new caption and typography intentionally replace the old small subtitle. These checks are not a real-device FPS benchmark or a claim of pixel-identical backgrounds.

## Entry and readiness

`BattlePreloadService` deduplicates and decodes required images, or uses the same Pixi Assets URLs as the renderer. Only successful files count toward100%; failures/timeouts offer retry. The prior10second overall skip budget is removed. The black loading screen reaches100% before the battlefield preparation state is shown. At100%, the bar/runner snap to their completed position rather than leaving the numeric label ahead of an unfinished width transition.

`BoardComponent.prepareBattle` waits for the mounted renderer. Pixi frame/chunk caches are populated for the resolved party/all-wave graph, sources are uploaded using PrepareSystem, and representative normal/additive/bloom draw paths render offscreen without gameplay events. Native board paints and a one-off GPU completion barrier finish under the dark backdrop. Disposal releases every prepared frame view without destroying shared Assets-owned images; a focused ownership regression covers this boundary. Unavailable WebGL/chunks retain the DOM fallback, with the same sheets decoded before entry continues.

`BattleEntryComponent` owns presentation. Both real panel animation promises and the backdrop fade must finish before the parent starts combat. Animation readiness uses a fresh presentation timestamp after a long preparation frame. The game loop then resets its accumulator and time origin. Request tokens and per-attempt IDs guard cancellation and stale completion; retries own fresh DOM images and animation callbacks. Restart uses this same entry gate. Reduced Motion uses a short static announcement.

No hero clip timing, semantic combat events, balance, stage composition, rewards or save schema changed. Asset preparation removes cold asset/renderer gaps; it does not establish that every authored attack/skill timeline is correct.

## Validation

- App/spec TypeScript checks pass; full Karma1054/1054 pass. New coverage checks failed assets never complete progress, file timeout, cancelled progress, black100%/renderer/intro engine gating, fresh retry identity and restart routing.
- Native Desktop Pixi flow resolves93required files,65renderer texture entries and1561frame entries. Engine time remains0 until entry completion; combat then advances. [Unmodified flow report](reviews/battle-start/native-report.json).
- HTTP503 simulation rejects the pearl aura and a Bai Long FX strip. The engine stays stopped below100%; retry restores Pixi and a newly loaded aura image. Restart cancellation remains stopped; a subsequent Pixi entry reuses the cached images successfully after disposal. Reduced-motion DOM entry completes. [Resilience report](reviews/battle-start/resilience-report.json).
- [Visual report](reviews/battle-start/visual-report.json) records the paused native frame, actual caption sizes and completed loading-bar ratio1. The100% still replays the real completed-download state after assets are ready; the separate unmodified flow report verifies ordering.
- `python3 tools/ui/export_battle_entry.py --check` verifies immutable source hashes and reproducible runtime exports. The generated transparent aura and existing goblin walk frames are retained with their manifest.
- Normal `npm run build` is blocked by the environment's existing Google Fonts403. Optimized production build passes with an external Architect override `{ optimization: { scripts: true, styles: true, fonts: false } }`; no workspace/index/font configuration was changed. Entry CSS9.52KB exceeds the8KB soft warning but stays below the24KB hard limit. Existing component/style warnings remain.

Desktop only, following the user's current phase. No Mobile work, master merge or deployment.
