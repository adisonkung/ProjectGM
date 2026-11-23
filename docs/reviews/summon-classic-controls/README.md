# Classic summon controls — Desktop integration, 2026-11-23

User selected the classic gold design, restored the circular crystal medallion / black angled price strip, requested a slightly smaller premium Thai font, and removed the free-test footer. The selected design is now implemented in the real /gacha page, together with generated information/roster/memory/back/home/lock icons and rectangular controls. The preceding preload, bounded gold-card aura, stationary fullscreen banner and Desktop-first work are retained.

## Reference and actual game

- [Side-by-side review](index.html)
- [Selected button reference](reference.png)
- [Actual Desktop 1280×720](game-1280.png) · [button crop](buttons-1280.png)
- [Actual Desktop 1600×900](game-1600.png) · [button crop](buttons-1600.png)
- [Browser geometry and interactions](browser-report.json)

Actual frames are unretouched Playwright screenshots from the running Angular game. The featured video is paused only for capture; no composited game frames. Button reference is the approved in-conversation design, rendered with the footer removed. Labels/prices remain live, using GACHA nominal costs 100/900. The surrounding full-game background is the existing Lucien animation; the focused button reference does not specify a new character/background. No assertion of full-page pixel identity or frame-rate measurement.

Buttons are 291×76px at both checked Desktop widths, with a 12px gap, 44% price region, Noto Serif Thai 600/22px label, Georgia 18px multiplier and 18.5px price. Original generated PNGs and font source are retained in assets/ui/summon-classic; optimized WebP icons/skins and the licensed self-hosted WOFF are runtime assets. CSS is globally loaded but scoped to the summon theme, avoiding the near-limit gacha component stylesheet budget.

The idle free-test message is removed as requested. The existing free-summon flag, confirmation/rates disclosures, pull costs, rewards, pity, roster, save format and cinematic timings are unchanged. Both summon buttons open the existing confirmation dialog; cancel preserves the save byte-for-byte. All three information controls remain functional. No dedicated Mobile work or verification.

Validation: app/spec typechecks; full Karma suite 1026/1026; production compilation and budgets with external-font inlining disabled via an untracked Architect override (Google Fonts returns HTTP403 in this environment; tracked build config unchanged). Real Desktop geometry/font/no-overflow checks, ×1/×10 confirmation-and-cancel, and rates/hero/Memory dialogs are covered by tools/dev/summon-classic-browser.cjs. External Google Fonts failures are recorded separately from local errors.

User explicitly authorized combining all completed changes into master, pushing and deploying on 2026-11-23. GitHub/Cloudflare status must be checked for the actual published commit; this review document does not itself assert deployment success.
