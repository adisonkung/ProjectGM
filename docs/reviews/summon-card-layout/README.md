# Summon card layout and stationary revealed heroes — 2026-11-23

User reported a wide raised card edge and misaligned/slanted Thai/English names, then requested that the revealed hero cards stop swaying. Scope: Desktop book-scene cards only.

## Reference / actual game

- [Before / after comparison and full roster](index.html)
- [Before: actual ×10 summary](before-10-summary.png)
- [After: actual ×10 summary](after-10-summary.png)
- [After: single hero](after-1-summary.png)
- [First ten heroes](roster-a-10-summary.png) · [remaining five plus repeated long names](roster-b-10-summary.png)
- [Browser report](after-report.json) · [original Canvas labels](before-text.json)

All images are unretouched native frames from the real Angular/three.js game at1280×720, not generated/composited game images. The before frame uses the preceding implementation as the reference for the reported defects. The user-supplied screenshot was inspected in chat. Source portraits and hero/name registries are unchanged.

## Changes

- Body: 1.04×1.56 / .03depth with a raised .012/.014 bevel → 1.012×1.518 / .014depth without bevel. The edge is rougher and its environment reflection reduced. Front/back planes sit just outside the thinner body.
- The rounded alpha mask now matches the full painted face instead of cropping3% off its dimensions. The painted gold outline decreases14→8texture pixels. Existing gold corner details and rarity colors remain.
- Names use explicit upright fonts. Thai uses the existing self-hosted Noto Serif Thai600, loaded during route preparation before Canvas textures are baked. English uses an upright serif. Both names share an optical center based on the actual glyph bounds and the same84% safe width; long names shrink to fit. The class tag also uses the local Thai font.
- Revealed cards settle upright and stop changing position/scale/rotation after their existing flip/settle. Shot2 lateral camera oscillation and the moving card light are removed; the initial camera push remains. The surrounding aura/particles still animate. Waiting backs retain their existing subtle motion.

## Validation

App/spec typechecks, Karma1026/1026 and optimized production compilation/budgets pass. As before, production validation uses an untracked Architect override disabling external-font inlining because this cloud environment receives Google Fonts403; tracked build config is unchanged.

`tools/dev/summon-card-layout-browser.cjs` covers one real gold tap→intro→open, ×10 Skip, and two deterministic real-service ten-pulls covering all15 shipped heroes. It passes an RNG through GachaService's existing RNG parameter in isolated test saves; production results/services are not replaced. Read-only instrumentation records native Canvas text metrics, mesh sizes, transforms and aura time. Text fits and has the same visible center; body size is correct; all opened card world matrices remain identical over5seconds of scene time while aura uniforms advance. Skip/reveal adds no save transaction. No page/local-resource/shader errors. External Google Fonts failures are recorded separately.

Frames are paused by advancing the existing scene RAF in100ms steps and rendering the final real frame. These checks establish presentation/geometry, not native-speed/FPS performance. No Mobile work. This new correction is on its task branch for review; the previous master deployment failure is a separate outstanding Cloudflare-log issue.
