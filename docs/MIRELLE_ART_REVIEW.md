# Mirelle — supplied UI art and dedicated Ultimate field loop

2026-10-17, Codex. User supplied `mirelle-final-art.zip`, explicitly including a new Portrait and asking to try its Field loop in place of the old one. This is asset integration for visual review, not final skill timing approval.

## Source audit

Original PNG bytes are retained read-only under ignored `art/incoming/mirelle/`. ZIP names are mapped to the canonical source slots without changing the images:

| ZIP file | Source slot | Dimensions | SHA256 |
|---|---|---|---|
| `Portrait.png` | `art/portrait.png` | 1254×1254 | `126af61bd28a41853f5cf967d8a421f7c498e3d176dcd6b739f40971cbad86c3` |
| `s1_icon.png` | `art/s1.png` | 1254×1254 | `c7a5ac05a35de701fe4d5a102c03e64360b41a550ba3e8f2ec90c4bebed7466b` |
| `s2_icon.png` | `art/s2.png` | 1254×1254 | `942e972997f29a23b1f7a0cfcf9b56642eee4fb7597ca3adf6f76e3ee286208c` |
| `ult_icon.png` | `art/ult.png` | 1254×1254 | `6df36b2424d29d914c49d01a33cdf149c685c5d415f69cae8a26ec7c007f04fe` |
| `banner.png` | `art/banner.png` | 1672×941 | `56e6c5004be555e4d6dfa662c8e5ac6788ec7393cf0357d51c4dabe6558268e5` |
| `ult_field_loop.png` | `ult/ult_field_loop.png` | 2508×627 | `575b244fed078f6a50ccf1b027478bc5a0e76e7762e83036a8f5bd35ffc026bf` |

There is no README or timing metadata in this ZIP. All art uses the supplied design and colours; no generated replacements or redesign.

## Runtime integration

- `mirelle.py` now bakes the painted Portrait at288×288, replacing the initial reference-cropped portrait. It also bakes `public/skills/mirelle-{s1,s2,ult}.webp` at160×160 and `public/banners/mirelle.webp` at1400×788. Resize/format conversion only; the full image is preserved without cropping or stretching the Banner.
- `HERO_ART.mirelle` registers all five UI assets. Existing portrait cards, hero header and skill-detail UI consume them; no unrelated UI flow changes.
- `mirelle_ult.py` cuts the dedicated8-pose strip using the shared alpha/chroma pipeline and component-based cuts. Peak width200, cell204×270, ground pivot0.5/0.892593, zero outer-edge clipping. This replaces the previous2-pose formed-Main fallback.
- Loop presentation remains3 cells wide, underneath units, at the same fixed world centre. It starts after the existing800ms formation delay, now plays8×100ms per cycle as a provisional preview and stops on the existing field lifecycle. No final Timeline Sync is created.
- All character/action clips, Charge/Main/shatter/residual art and timing, S1/S2, field duration/pulses/control and other heroes remain unchanged. The larger Charge and ending Impact from the prior user revision remain intact.
- Reproduction requires the supplied original art files. Generators fail if the new sources are missing instead of silently restoring the old portrait/field fallback. `mirelle-production.ts` lists the new source slots; all skill timings remain provisional.

```bash
PYTHONPATH=/tmp/mirelle-python-deps python3 tools/sprites/mirelle.py
PYTHONPATH=/tmp/mirelle-python-deps python3 tools/sprites/mirelle_ult.py
npm run sprites:optimize
```

## Validation and review

App/spec typechecks, full Karma **650/650** and production build passed. Existing registration spec now expects the supplied UI asset paths. Sprite optimizer run; character/basic attack/Charge/Main/shatter/residual outputs match the previous commit byte-for-byte. No combat values or gameplay timings changed, so no combat sim retuning.

Native-DPR2 captures in ignored `tmp/mirelle-final-art/` show the actual portrait card, Banner, skill icons and Ultimate with the new loop. The UI check uses a disposable browser context with a training-owned Mirelle only; no starter grant, repository save or user's save is modified. Final S1/S2/Ult Timeline Sync remains pending individual review.

All five UI assets load; desktop/mobile header and icons checked. Final Pixi recording is `frames-v2/` (first capture was interrupted by dev-server reload during asset regeneration). Its real-engine log retains six pulse batches and natural expiry at7.2s; field views0 after ending. DOM and mirrored loop checked, views0 after reset/expiry, zero page errors. MP4s use the complete181 native frames at20FPS, or an unscaled960×562 crop at half speed. No wall-clock loop lifetime or final animation timing is introduced.
