# Armory review — 24 Oct 2026

User accepted the formation correction and asked for the next page. Continue with Armory on fix/codex-armory-review from417368d. No deployment authorized.

Read design README and opened sheet05 before editing. Keep real roster/art, equipment bases, rarity, item values, compatibility, locks, prices and service actions. The illustration/numbers in the reference are not new content.

Changes:

- Left panel uses the selected hero's original optional banner, falling back to the existing portrait. Name/stars/class sit over a fading lower shadow; existing hero picker remains the real selection source.
- Compact380px desktop equipment column sits beside the bag/comparison panel; tablet/mobile stack. Three real slot categories keep shallow square-cut metal frames and readable stacked labels.
- Hero picker gets a continuous cut-gold container. Inventory/artwork buttons use square-cut outlines rather than elongated hex shapes. Selected controls retain the reviewed Home lacquer; action buttons keep their hex contours.
- Bag uses four actual item columns and a separate detail/comparison panel on wide screens, stacked on phones. Costs, inventory counts and compatibility messages stay real. Status feedback uses the same metal material.
- Preserve native sale confirmation, equip/unequip, sort/filter, item lock and forge navigation. No economy/gameplay/save/art-registry changes.

Validation: app/spec typechecks, Karma809/809, production build (existing warning thresholds unchanged), and actual Chromium320/390/768/1024/1586 viewports without horizontal overflow. Browser interactions exercise real weapon filtering, rarity sort, lock disabling sale, cancel preserving save, equip/unequip and hero switching. Capture initial/filled, equipped, empty, sale confirmation and mobile lower sections with disposable fixtures using existing registry/rule data. Evidence/scripts/logs live under ignored work/armory-review.

Formation is visually accepted. Armory awaits user review. Screenshots from the earlier all-pages batch are superseded for this page; other pages retain their status.

Latest Armory screenshots: https://github.com/adisonkung/ProjectGM/blob/5b6a094e3d2c074f93f3c44a85a5dd4b7ee7644a/docs/review-images/2026-10-24-armory/README.md . All10 files verifiedHTTP200/hash; user review pending. Docs-only unattached snapshot, no deployment.

## Four-cell layout follow-up

User requested a slightly wider left column and a roomy2×2 arrangement anticipating Relic. Desktop equipment column increases380→460px (420px at intermediate widths); the grid uses two columns on phones as well. Artwork targets increase to100px desktop/96px phone, with14px desktop/13px phone slot labels and more padding. The fourth cell explicitly says Relic / ช่องสำหรับอนาคต / ยังไม่เปิดใช้งาน, has no button or inventory action, and is presentation-only. SLOTS, item registries, save schema, stats and equipment rules stay unchanged at three functional equipment slots. No Relic implementation was added.

Native Chromium checks320/390/768/1024/1586 widths,2×2 geometry, minimum card width, no horizontal overflow, noninteractive Relic and unchanged browsing save. Actual equip/unequip still uses only real slots. App/spec typechecks,809 tests and production build pass. New screenshots under work/armory-four supersede the previous Armory layout and await user review. No deployment.

Latest roomy2×2 screenshots: https://github.com/adisonkung/ProjectGM/blob/de29673981e0b3200d43dee2442e97968f2e0d12/docs/review-images/2026-10-24-armory-four/README.md . VerifiedHTTP200/hash; no deployment. Relic remains presentation-only and user review is pending.

User outcome: “โอเค หน้าต่อไป” after the460px/2×2 screenshots. Armory including the clearly locked future Relic preview is visually accepted; this does not authorize deploying or adding Relic gameplay. Next page is Forge.
