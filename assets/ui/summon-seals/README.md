# Eldervane summon seals

**Superseded art (2026-11-23):** runtime now uses the user-approved loose ancient pages in `assets/ui/summon-pages` / `public/ui/summon-pages`. The old stones remain for provenance; stable inventory IDs are unchanged. The rest of this note describes the earlier stone integration.

User selected rune stones instead of paper tickets and requested three colour variants: blue/silver, gold, purple/pink iridescent. Original generated PNGs are unchanged here. `blue-aurora-source.png` contains the blue/silver and aurora stones; `gold-source.png` is the additional matching gold variant. The superseded paper-ticket study is retained outside the repository in the execution workspace, not installed in the game.

Export: `python3 tools/ui/export_summon_seals.py`. It measures visible alpha≥8, adds12px safety padding, crops the original cells and exports512px-tall WebP delivery copies. No colour/shape/paint changes. All crystal tips remain inside the export. Crop/source metadata: exports.json.

Runtime: public/ui/summon-seals/{standard,gold,aurora}.webp. IDs/names/icons live in core/data/summon-seals.ts and are registered as SUMMON_SEAL items in core/data/economy.ts. Only the standard seal is currently spent by the standard pool; the other two are prepared inventory/art entries without new pools, rates, acquisition grants or gem conversions.
