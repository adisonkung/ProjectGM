# Eldervane — Forge stage and tier equipment

26 Oct 2026 · User-selected three-column forge reference. Work branch `wip/codex-forge-tier-showcase`, based on production4088691.

- New15individual foreground assets: armor, necklace, ring × Common/Uncommon/Rare/Elite/Epic. Distinct silhouettes/materials; transparent backgrounds. PNG masters remain outside runtime in `/workspace/eldervane-equipment-tier-production/`; runtime512/1024WebP files in `public/ui/equipment/tiered/`.
- Existing approved5sword masters are reused. Large1024WebP variants generated from the same originals. No weapon family or save identifiers change.
- Empty generated sky-palace/anvil background in `public/ui/forge/`; center equipment and live VFX are rendered separately.
- References: [Forge](forge-reference.png), [equipment art direction](equipment-reference.png). Source hashes and paths in [manifest](manifest.json).

Implementation and native desktop/mobile visual review are in progress. No merge or deployment in this task. Final validation/evidence and remaining differences will be recorded here before completion.
