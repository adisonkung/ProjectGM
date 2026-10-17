# Sylvara — supplied portrait, skill icons and banner

User supplied `sylvana_icon.zip` and explicitly authorized adding all remaining UI art, pushing the task branch and merging into master before beginning another hero (2026-10-17). Preserve existing entity ID `sylvara`; the archive spelling is not a hero rename. No embedded instructions/documents are present.

Fresh fetch: master2ab8ebd (merged Sylvara), clean tree, no intervening agent changes. Create `feature/codex-sylvara-ui-art` from that exact master before edits. This is a UI-only follow-up, not a combat/balance/final Timeline Sync task.

## Read-only originals

Archive/extraction: `/workspace/attachments/0bf8c3bb-92ad-4dc9-a5df-2ef99e03e072/{sylvana_icon.zip,extracted/}`. All original hashes verified against the ZIP after production. All five sources are opaque palette PNGs; no source edits/repainting/cropping.

| File | SHA-256 |
|---|---|
| `banner.png` | `d5097c3c30da3f3b0600baefdacb587e825ad5e07a79f3ebf31b9fef10bbcc5c` |
| `icon_portrait.png` | `6d6e33d3703f9c20aaf6002ae314fc9e0d6369bcc0e14760f6cffaa28c85dd79` |
| `skill1.png` | `cbef3817b7203397eb905780b4378b733df0c9a9ba6923d141b45b4524113ace` |
| `skill2.png` | `db04ebbfaaf600580cae19733e02c5fe59b753be4b3ff61e6927e364ed134cf1` |
| `ultimate.png` | `465ff0ee40bb73ea20b524c1824447e9856014284067f5bcaa9e14566f20cc62` |

Square portrait/icons are1254×1254. Banner is1672×941. `sylvara_art.py` uses the existing hero-art convention: Lanczos, WebP quality92; portrait288×288, icons160×160, banner1400×788 preserving its ratio. Outputs:

- `public/portraits/sylvara.webp` replaces the temporary reference crop.
- `public/skills/sylvara-{s1,s2,ult}.webp` map to Emerald Piercer, Verdant Snare, Emerald Skyfall respectively.
- `public/banners/sylvara.webp` displays through the existing detail-page banner layout.

`HERO_ART.sylvara` registers all five; `SYLVARA_PRODUCTION.uiArt` records supplied status/archive. `sylvara.py` delegates UI production to `sylvara_art.bake_ui` and requires the dedicated art source, preventing full rebakes from silently restoring the old portrait. Its final optional argument is the UI source directory, default `art/incoming/sylvara/art` (same original filenames). All skill/base source arguments stay unchanged.

```bash
python3 tools/sprites/sylvara_art.py /workspace/attachments/0bf8c3bb-92ad-4dc9-a5df-2ef99e03e072/extracted
```

For a combined character/UI rebake, append that directory after the Ultimate source argument to `sylvara.py`; see its module usage. Original sources stay read-only. No sprite PNG/atlas/optimized sprite file changes, so no sprite optimizer run is needed for this UI-only task.

## Validation

- App/spec typechecks, **684/684 Karma**, production build and `git diff --check` pass.
- Full combined bake into `/tmp/sylvara-ui-rebake` reproduces all five UI outputs byte-for-byte and keeps the character atlas byte-identical; zero clipped character pixels. Five original hashes/opaque alpha verified. No combat sim rerun needed.
- Native DPR2 browser check uses a disposable browser account: roster portrait, hero-detail banner and all three skill icons load, desktop/mobile screenshots show no overflow or missing images/page errors. Captures in ignored `tmp/sylvara-ui-preview/`.

Portrait/icons/banner are complete. Final Timeline Sync and roster balance remain unchanged/pending; do not infer their approval from this UI task. The user authorized push and master merge after these checks; no remote branch deletion is included.
