# Elira — supplied portrait, skill icons and banner

User supplied `Elira_icn.zip` and requested adding Elira's portrait, skill icons and banner (2026-10-19, Asia/Bangkok). The ZIP contains five PNGs, no documents or embedded instructions. This task integrates the supplied images with the existing UI; it does not resume the cancelled UI redesign.

## Reconciliation and scope

Fresh `origin/master` remains `72a3f34`. Elira is not merged there. The clean `feature/codex-elira-ui-art` branch was created from that master, then fast-forwarded to published `origin/fix/elira-ultimate-target` (`b3c6c04`) as the dependency explicitly continued by this request. The prior local `9db1c3c` remains preserved on its branch. Publish only this task branch; no master merge/deletion or new canonical-local synchronization claim.

## Read-only inputs

Archive: `/workspace/attachments/f56babdc-aa9c-43eb-ad5d-ee066bfa9fb0/Elira_icn.zip`. Extracted input copy: `/workspace/scratch/elira-ui-art-source/`. All sources are opaque palette PNGs; source bytes were checked against the ZIP after baking. No repainting, cropping or alpha removal.

| Source | Dimensions | SHA-256 |
|---|---|---|
| `banner.png` | 1672 × 941 | `2bb7bbbd2e37ab5d6138697b1e5534ab21987cfbf46be9473914c36779aa413d` |
| `icon.png` | 1254 × 1254 | `4848935fc2928ff4d8bc4d0bbaf0ef0eac2734c1e7b858c3cb4c12802c11d53d` |
| `skill1.png` | 1254 × 1254 | `51681491e7a8d7af75bffa81acf8c57934574b88073c370c2b21121de9846465` |
| `skill2.png` | 1254 × 1254 | `c789a41d6ca19c68f6091798b3597eff99613d52a08bd3849ba2c1211d6c6c26` |
| `ultimate.png` | 1254 × 1254 | `1b4210f70e1d774f78d0faaf7b411f3a3dd0812ab4fd347f13d21756bfc3a0fe` |

## Outputs and rebuild

Follow the existing Sylvara UI pipeline: Lanczos resize, WebP quality 92, full composition preserved.

- `public/portraits/elira.webp`: 288 × 288; replaces the temporary master-reference crop.
- `public/skills/elira-{s1,s2,ult}.webp`: 160 × 160, mapped to Hearthlight Blessing, Sanctuary Veil and Hearthlight Sanctuary respectively.
- `public/banners/elira.webp`: 1400 × 788; existing hero-detail layout displays the complete image.

`HERO_ART.elira` registers all five images. `ELIRA_PRODUCTION.uiArt` records supplied status/archive while all skill final-sync flags stay pending. `elira_art.py` performs the standalone conversion:

```bash
python3 tools/sprites/elira_art.py /workspace/scratch/elira-ui-art-source
```

`elira.py` now requires dedicated UI sources (default `art/incoming/elira/art`), checks them before writing outputs and delegates to `elira_art.bake_ui`. A combined bake accepts the UI directory as its last argument, after the existing Ultimate directory. No reference-crop fallback remains. To rebuild without editing original inputs:

```bash
PYTHONPATH=/tmp/elira-ui-pydeps python3 tools/sprites/elira.py \
  /workspace/attachments/elira-originals \
  /tmp/elira-ui-rebake/sprites /tmp/elira-ui-rebake/portraits \
  /workspace/attachments/1ae50a17-cd64-4d10-9f71-0e4f0d17aa48/extracted \
  /workspace/attachments/66ad3692-362f-4ceb-afe0-4e3545a95ea8/extracted \
  /workspace/attachments/ef1a9a1d-8322-44d4-b01f-f20e3d47cf4d/extracted \
  /workspace/scratch/elira-ui-art-source
```

The temporary Python dependency directory supplies the art pipeline's scikit-image dependency; it is outside the repository.

## Validation

- App/spec typechecks, **711/711 Karma**, production build and `git diff --check` pass. Existing stylesheet-budget/CommonJS build warnings remain.
- Combined bake reproduces all five UI files, the character atlas and basic projectile byte-for-byte, with zero clipped character pixels. No sprite PNG/atlas/optimized output changes, so no optimizer or combat-simulation rerun is needed for this UI-only addition.
- Native DPR2 Chromium checks use a disposable browser save containing Elira: roster portrait, team page, complete hero banner, and all three skill images. Desktop (1440 px) and mobile (390 px): no missing assets, page errors or detail-page horizontal overflow. Screenshots and `verification.json`: `/workspace/scratch/elira-ui-preview/`.
- Source hashes are unchanged. Combat values, Ultimate targeting, field persistence, character scale, saves, other heroes and final Timeline Sync approval are unchanged.

Next: review these UI assets alongside the existing provisional skill animations. Consult `ELIRA_ULT_TARGETING.md` for current fixed target-centred field behavior; historical home-zone descriptions in older phase notes are superseded. Balance remains deferred until roster completion.
