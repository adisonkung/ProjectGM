"""
Generate an Island theme asset pack (Default Forest, or a cosmetic theme from tools/island/themes/).

    python3 tools/island/generate.py                  # default_forest
    python3 tools/island/generate.py frozen_kingdom   # tools/island/themes/frozen_kingdom.py

Writes PNGs to public/island/<theme>/<category>/island_<prefix>_<category>_<name>.png, a JSON manifest next to them,
and src/app/core/data/island/<theme-with-dashes>.assets.ts (slot → asset) that the game's theme manifest references.
Art is authored at native resolution (1 px = layout.pixelScale world units).

A theme module re-uses the SAME drawing code and the SAME semantic slots (so every building keeps its footprint,
anchor and FX anchors): it swaps the palette before the generators are imported (`PALETTE`), may replace individual
generator functions (`patch(mods)`), post-processes each asset (`post(slot, category, arr, frames)`, e.g. snow caps) and
may add theme-only slots (`extra(emit, L)`). The layout JSON is read-only here.
"""
from __future__ import annotations

import json
import os
import sys

import importlib

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

THEME = sys.argv[1] if len(sys.argv) > 1 else 'default_forest'
TH = None
if THEME != 'default_forest':
    import pixart  # noqa: E402
    TH = importlib.import_module(f'themes.{THEME}')
    # palette swap BEFORE the generators import their colours
    for k, v in TH.PALETTE.items():
        assert hasattr(pixart, k), f'unknown palette entry {k}'
        setattr(pixart, k, v)

import gen_buildings as B  # noqa: E402
import gen_fx_props as F  # noqa: E402
import gen_nature as N  # noqa: E402
import gen_terrain as T  # noqa: E402
import gen_tower as TW  # noqa: E402
from pixart import CYAN, EMERALD, GOLD, VIOLET, CLOTH_BLUE, CLOTH_RED  # noqa: E402

if TH:
    TH.patch({'B': B, 'F': F, 'N': N, 'T': T, 'TW': TW})

L = json.load(open(os.path.join(ROOT, 'src/app/core/data/island/default-layout.json')))
PREFIX = TH.PREFIX if TH else 'default'
OUT_DIR = os.path.join(ROOT, f'public/island/{THEME}')
TS_OUT = os.path.join(ROOT, f"src/app/core/data/island/{THEME.replace('_', '-')}.assets.ts")
TS_CONST = 'DEFAULT_FOREST_ASSETS' if not TH else f'{THEME.upper()}_ASSETS'
ASSETS: dict[str, dict] = {}


def emit(slot: str, category: str, name: str, arr: np.ndarray, frames: int = 1, fps: float | None = None, anchor: str | tuple = 'bottom',
         loop: str | None = None):
    """save + register. anchor: 'bottom' (bottom-centre), 'center', 'top-left' or (x, y) native px inside one frame"""
    if TH: arr = TH.post(slot, category, arr, frames)
    os.makedirs(os.path.join(OUT_DIR, category), exist_ok=True)
    fname = f'island_{PREFIX}_{category}_{name}.png'
    Image.fromarray(arr.astype(np.uint8), 'RGBA').save(os.path.join(OUT_DIR, category, fname), optimize=True)
    h, w = arr.shape[:2]
    fw = w // frames
    if anchor == 'bottom': ax, ay = fw / 2, h - 1
    elif anchor == 'center': ax, ay = fw / 2, h / 2
    elif anchor == 'top-left': ax, ay = 0, 0
    else: ax, ay = anchor
    e = {'src': f'island/{THEME}/{category}/{fname}', 'w': fw, 'h': h, 'ax': ax, 'ay': ay}
    if frames > 1: e.update({'frames': frames, 'fps': fps or 8})
    if loop: e['loop'] = loop
    ASSETS[slot] = e


def main():
    W, H = L['world']['w'] // L['pixelScale'], L['world']['h'] // L['pixelScale']
    # ---------------------------------------------------------------- terrain
    M = T.materials()
    names = {'grass_a': 'grassA', 'grass_b': 'grassB', 'grass_dark': 'grassDark', 'grass_c': 'grassMoss', 'dirt': 'dirt', 'dirt_worn': 'dirtWorn',
             'dirt_packed': 'dirtPacked', 'stone_ground': 'stoneGround', 'mossy_stone': 'mossyStone', 'plaza_ground': 'plazaGround',
             'stone_platform': 'stonePlatform', 'cliff_edge': 'cliffEdge', 'height_transition': 'heightTransition'}
    for k, slot in names.items():
        emit(f'terrain.{slot}', 'terrain', k, M[k], anchor='top-left')
    emit('terrain.ground', 'terrain', 'ground_composite', T.ground(L, M), anchor='top-left')
    water, (wx, wy) = T.stream_water(L)
    emit('terrain.streamWater', 'terrain', 'stream_water', water, frames=4, fps=4, anchor=(-wx, -wy))
    emit('terrain.waterfall', 'terrain', 'waterfall', T.waterfall_sheet(L), frames=6, fps=10, anchor=(9, 0))
    # ---------------------------------------------------------------- roads
    emit('road.layer', 'road', 'layer', T.road_layer(L, M), anchor='top-left')
    for k, slot in [('curve_left', 'curveLeft'), ('curve_right', 'curveRight'), ('s_curve', 'sCurve'), ('sharp_curve', 'sharpCurve'),
                    ('diagonal_ne', 'diagonalNE'), ('diagonal_nw', 'diagonalNW'), ('plaza_connector', 'plazaConnector'),
                    ('narrow_trail', 'narrowTrail'), ('fork_30', 'fork30'), ('fork_45', 'fork45'), ('junction_irregular', 'junction'),
                    ('stair_path', 'stairPath'), ('bridge_entrance', 'bridgeEntrance'), ('road_end', 'end'), ('broken_road', 'broken')]:
        emit(f'road.{slot}', 'road', k, T.road_piece(k), anchor='top-left')
    emit('road.bridge', 'road', 'bridge', F.bridge(), anchor='center')
    emit('road.stairs', 'road', 'stairs', F.stone_stairs())
    # ---------------------------------------------------------------- background
    emit('bg.sky', 'bg', 'sky', T.sky(W * 2, H), anchor='top-left')  # wide: parallax drift while panning
    emit('bg.mountains', 'bg', 'mountains', T.mountains(W * 2), anchor='top-left')
    emit('bg.forestFar', 'bg', 'forest_far', T.forest_far(W * 2), anchor='top-left')
    emit('bg.mist', 'bg', 'mist', T.mist_band(W + 80), anchor='top-left')
    for i in range(3): emit(f'bg.cloud{i + 1}', 'bg', f'cloud_0{i + 1}', F.cloud(10 + i, 60 + i * 14, 20 + i * 3), anchor='center')
    for i in range(2): emit(f'bg.floatingRock{i + 1}', 'bg', f'floating_rock_0{i + 1}', F.floating_rock(4 + i, 34 + i * 12, 30 + i * 6), anchor='center')
    # ---------------------------------------------------------------- tower (multi-layer)
    for v in ('sealed', 'awakened', 'active', 'corrupted', 'ascended'):
        emit(f'building.tower.base.{v}', 'building', f'tower_base_{v}', TW.base(v))
    for k, ramp in (('emerald', EMERALD), ('violet', VIOLET), ('gold', GOLD)):
        emit(f'building.tower.runes.{k}', 'building', f'tower_rune_{k}', TW.rune_overlay(ramp))
        emit(f'building.tower.crystal.{k}', 'building', f'tower_crystal_{k}', TW.crystal(ramp), anchor='center')
        emit(f'building.tower.fx.aura.{k}', 'fx', f'tower_aura_{k}', TW.aura_sheet(ramp, corrupt=(k == 'violet')), frames=8, fps=4, anchor='center')
        emit(f'building.tower.fx.particles.{k}', 'fx', f'tower_particles_{k}', TW.particle_sheet(ramp), frames=8, fps=6)
        emit(f'building.tower.fx.pulse.{k}', 'fx', f'tower_pulse_{k}', TW.pulse_sheet(ramp), frames=10, fps=12, anchor='center', loop='rare')
    emit('building.tower.glow.cyan', 'building', 'tower_glow_cyan', TW.glow_overlay(CYAN))
    emit('building.tower.glow.gold', 'building', 'tower_glow_gold', TW.glow_overlay(GOLD))
    emit('building.tower.shadow', 'building', 'tower_shadow', TW.shadow())
    # ---------------------------------------------------------------- buildings
    emit('building.tavern.base', 'building', 'tavern_base', B.tavern(1))
    emit('building.hall.base', 'building', 'hero_hall_base', B.tavern(2))
    emit('building.tavern.light', 'building', 'tavern_light', B.tavern_lights(1))
    emit('building.workshop.base', 'building', 'workshop_base', B.workshop(1))
    emit('building.forge.base', 'building', 'forge_base', B.workshop(2))
    emit('building.forge.arcane', 'building', 'forge_arcane_base', B.workshop(3))
    emit('building.forge.light', 'building', 'forge_light', B.workshop_lights(2))
    emit('building.forge.fx.fire', 'fx', 'forge_fire', F.fire_sheet(), frames=6, fps=10)
    emit('building.forge.fx.smoke', 'fx', 'forge_smoke', F.smoke_sheet(), frames=8, fps=6)
    emit('building.forge.fx.sparks', 'fx', 'forge_sparks', F.sparks_sheet(), frames=6, fps=14, loop='rare')
    for st in (0, 1, 2):
        emit(f'building.skill.base.s{st}', 'building', f'skill_shrine_s{st}', B.skill_shrine(st))
        emit(f'building.ascension.base.s{st}', 'building', f'ascension_shrine_s{st}', B.ascension_shrine(st))
    for st in (1, 2):
        emit(f'building.skill.runes.s{st}', 'building', f'skill_shrine_runes_s{st}', B.skill_runes(st))
    emit('building.skill.crystal', 'building', 'skill_crystal', TW.crystal(CYAN), anchor='center')
    emit('building.ascension.crystal', 'building', 'ascension_crystal', TW.crystal(VIOLET), anchor='center')
    emit('building.ascension.fx.runeCircle', 'fx', 'ascension_rune_circle', B.ascension_rune_circle(), frames=8, fps=5, anchor='center')
    for st in (0, 1):
        emit(f'building.memorial.base.s{st}', 'building', f'memorial_s{st}', B.memorial(st))
        emit(f'building.board.base.s{st}', 'building', f'challenge_board_s{st}', B.challenge_board(st))
        emit(f'building.dock.base.s{st}', 'building', f'dock_s{st}', B.dock(st))
    emit('building.ruin.large', 'building', 'ruin_large', B.ruin_foundation(80, 30, 3))
    emit('building.ruin.medium', 'building', 'ruin_medium', B.ruin_foundation(62, 26, 7))
    emit('building.ruin.small', 'building', 'ruin_small', B.ruin_foundation(44, 22, 9, charred=False))
    # training ground (open functional area — parts)
    emit('training.dummy', 'prop', 'training_dummy', B.dummy())
    emit('training.target', 'prop', 'archery_target', B.archery_target())
    emit('training.rack', 'prop', 'weapon_rack', B.weapon_rack())
    emit('training.fence', 'prop', 'fence', B.fence(3))
    emit('training.fenceBroken', 'prop', 'fence_broken', B.fence(3, True))
    emit('training.mat', 'prop', 'practice_mat', B.practice_mat())
    emit('training.banner', 'prop', 'training_banner', B.banner_sheet(CLOTH_RED), frames=6, fps=7)
    emit('prop.bannerBlue', 'prop', 'banner_blue', B.banner_sheet(CLOTH_BLUE, emblem=GOLD), frames=6, fps=7)
    # ---------------------------------------------------------------- nature
    for k, slot in [('large_a', 'largeA'), ('large_b', 'largeB'), ('medium_a', 'mediumA'), ('medium_b', 'mediumB'), ('small', 'small'), ('dead', 'dead'), ('blossom', 'blossom')]:
        emit(f'tree.{slot}', 'tree', k, N.tree(k, sum(map(ord, k)) % 97))
    for k, slot in [('a', 'bushA'), ('b', 'bushB'), ('fern', 'fern'), ('tall_grass', 'tallGrass'), ('flowers', 'flowers'), ('mushrooms', 'mushrooms'), ('moss', 'moss')]:
        emit(f'veg.{slot}', 'veg', k, N.bush(k, 5 + len(k)))
    for k, slot in [('small', 'small'), ('medium', 'medium'), ('large_mossy', 'largeMossy'), ('cluster', 'cluster')]:
        emit(f'rock.{slot}', 'rock', k, N.rock(k, 9 + len(k)))
    for k, slot in [('pillar', 'pillar'), ('wall', 'wall'), ('slab', 'slab'), ('runestone', 'runeStone'), ('statue', 'statue')]:
        emit(f'ruin.{slot}', 'ruin', k, N.ruin(k, 4 + len(k)))
    # ---------------------------------------------------------------- props + magic
    emit('prop.barrel', 'prop', 'barrel_01', F.barrel())
    emit('prop.crate', 'prop', 'crate_01', F.crate())
    emit('prop.lanternPost', 'prop', 'lantern_post', F.lantern_post())
    emit('prop.signpost', 'prop', 'signpost', F.signpost())
    emit('prop.bench', 'prop', 'bench', F.bench())
    emit('prop.table', 'prop', 'table', F.table())
    emit('prop.cart', 'prop', 'cart', F.cart())
    emit('prop.firewood', 'prop', 'firewood', F.firewood())
    emit('prop.fountain', 'prop', 'fountain', F.fountain())
    emit('prop.fountainWater', 'fx', 'fountain_water', F.fountain_water(), frames=4, fps=4, anchor='center')
    emit('prop.campfire', 'prop', 'campfire', F.campfire_base())
    emit('magic.crystalCluster', 'prop', 'crystal_cluster', N.crystal_cluster(2))
    emit('magic.runeStone', 'prop', 'rune_stone_glow', F.rune_stone_glow())
    emit('magic.glowMushrooms', 'prop', 'glow_mushrooms', F.mushroom_glow())
    # ---------------------------------------------------------------- fx
    emit('fx.fire', 'fx', 'fire', F.fire_sheet(seed=3), frames=6, fps=10)
    emit('fx.smoke', 'fx', 'smoke', F.smoke_sheet(seed=5), frames=8, fps=6)
    emit('fx.sparks', 'fx', 'sparks', F.sparks_sheet(), frames=6, fps=14, loop='rare')
    emit('fx.lantern', 'fx', 'lantern', F.lantern_sheet(), frames=4, fps=6, anchor='center')
    emit('fx.particlesCyan', 'fx', 'particles_cyan', F.particle_sheet(CYAN), frames=8, fps=6)
    emit('fx.particlesViolet', 'fx', 'particles_violet', F.particle_sheet(VIOLET, seed=4), frames=8, fps=6)
    emit('fx.particlesGold', 'fx', 'particles_gold', F.particle_sheet(GOLD, seed=5), frames=8, fps=6)
    emit('fx.fireflies', 'fx', 'fireflies', F.fireflies_sheet(), frames=8, fps=5, anchor='center')
    emit('fx.windowFlicker', 'fx', 'window_flicker', F.window_flicker_sheet(), frames=6, fps=5, anchor='top-left')
    # ---------------------------------------------------------------- foreground
    emit('fore.branchLeft', 'fore', 'branch_left', T.fore_branch(2), anchor='top-left')
    emit('fore.branchRight', 'fore', 'branch_right', T.fore_branch(3, flip=True), anchor='top-left')
    emit('fore.grass', 'fore', 'grass', T.fore_grass(4))
    emit('fore.grassB', 'fore', 'grass_b', T.fore_grass(6, 70, 22))
    if TH: TH.extra(emit, L)

    # ---------------------------------------------------------------- manifest
    with open(os.path.join(OUT_DIR, 'manifest.json'), 'w') as f:
        json.dump({'theme': THEME, 'pixelScale': L['pixelScale'], 'assets': ASSETS}, f, indent=1, sort_keys=True)
    title = 'Default Forest' if not TH else TH.NAME
    cmd = '' if not TH else f' {THEME}'
    lines = [f'// GENERATED by tools/island/generate.py{cmd} — do not edit by hand. Slot → native-pixel asset of the {title} theme.',
             "import { IslandAsset } from '../../models/island';", '',
             f'export const {TS_CONST}: Record<string, IslandAsset> = {{']
    for k in sorted(ASSETS):
        lines.append(f"  '{k}': {json.dumps(ASSETS[k], separators=(', ', ': '))},")
    lines.append('};')
    open(TS_OUT, 'w').write('\n'.join(lines) + '\n')
    total = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT_DIR) for fn in fns)
    print(f'{len(ASSETS)} assets · {total / 1024:.0f} KiB → {OUT_DIR}')


if __name__ == '__main__':
    main()
