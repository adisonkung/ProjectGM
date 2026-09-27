from px import Sprite

# ============ 4. brass_shishi — สิงห์ทองเหลืองพิทักษ์ (Ascension I boss)
def brass_shishi(pose='idle', k=1.0, leg=0):
    s = Sprite(96, 96, k)
    roar = pose == 'skill'
    # stone pedestal plinth under back paws
    s.rect((50, 80, 82, 88), '#8d8a99')
    # back legs
    s.ellipse((58, 62, 80, 84), '#b98a34')
    s.rect((62 + 3 * leg, 78, 70 + 3 * leg, 88), '#b98a34'); s.rect((72 - 3 * leg, 78, 80 - 3 * leg, 88), '#b98a34')
    # tail curl (flame-like)
    s.ellipse((76, 44, 92, 60), '#2f8f7a'); s.ellipse((80, 38, 92, 50), '#3aa58c')
    # body
    s.ellipse((34, 50, 78, 82), '#d1a042')
    s.rect((40, 70, 72, 73), '#8a5e22')                    # engraved band
    for x in (44, 52, 60, 68):
        s.px([(x, 71)], '#f2d27a')
    # front legs
    fl = -4 * leg
    s.rect((36 + fl, 72, 45 + fl, 88), '#c99838'); s.rect((48 - fl, 74, 57 - fl, 88), '#b98a34')
    s.rect((33 + fl, 85, 46 + fl, 89), '#8a5e22'); s.rect((46 - fl, 85, 58 - fl, 89), '#8a5e22')
    # mane: teal curls (jade patina)
    for (x, y, r) in ((30, 20, 11), (44, 14, 11), (58, 20, 11), (62, 34, 11), (58, 48, 10), (26, 46, 10), (22, 32, 10)):
        s.ellipse((x - r, y - r, x + r, y + r), '#2f8f7a')
    # head (big, chibi)
    s.ellipse((16, 18, 58, 60), '#e0b24c')
    # brow + eyes (facing left)
    s.poly([(18, 30), (34, 28), (34, 33), (18, 35)], '#8a5e22', shade=False)
    s.ellipse((21, 33, 27, 39), '#ffffff', shade=False, edge=False); s.px([(22, 35), (23, 35), (22, 36)], '#1e1a2a')
    s.ellipse((30, 33, 36, 39), '#ffffff', shade=False, edge=False); s.px([(31, 35), (32, 35), (31, 36)], '#1e1a2a')
    # nose + muzzle
    s.ellipse((14, 38, 30, 50), '#f0c865')
    s.ellipse((14, 38, 20, 43), '#8a3b2a', shade=False, edge=False)
    if roar:
        s.poly([(12, 46), (30, 44), (28, 58), (14, 58)], '#5a1a1a')          # open mouth
        s.poly([(15, 46), (18, 46), (16, 50)], '#ffffff', shade=False, edge=False)
        s.poly([(24, 46), (27, 45), (25, 50)], '#ffffff', shade=False, edge=False)
        s.ellipse((17, 52, 26, 57), '#c8413a', shade=False)                     # tongue
    else:
        s.line([(16, 48), (22, 51), (28, 48)], '#8a3b2a')
        s.px([(19, 50), (25, 50)], '#ffffff')
    # jade gem on forehead + bell collar
    s.ellipse((36, 22, 43, 29), '#3fd0b0')
    s.poly([(30, 58), (58, 56), (58, 62), (32, 64)], '#c8413a')
    s.ellipse((40, 60, 48, 68), '#f0cc55')
    return s.outline()


# ============ 5. moonblade_ronin — วิญญาณดาบจันทรา (Ascension II boss)
def moonblade_ronin(pose='idle', k=1.0, leg=0):
    s = Sprite(96, 96, k)
    stance = pose == 'skill'
    ghost = '#8fb4e8'
    # wispy ghost tail instead of legs
    s.poly([(38, 70), (64, 70), (72, 90), (58, 84), (50, 92), (44, 82), (34, 88)], '#6a86c8')
    # hakama / robe
    s.poly([(34, 48), (66, 48), (70, 74), (30, 74)], '#2b3160')
    s.poly([(34, 48), (50, 48), (44, 74), (30, 74)], '#343b72')
    s.rect((32, 56, 68, 60), '#c8a24a')                             # obi
    # torn cape
    s.poly([(58, 44), (80, 50), (84, 72), (76, 66), (72, 76), (64, 60)], '#5a1f3a')
    # arms / sword
    if stance:
        # mirror stance: sword held vertical in front, crescent guard glowing
        s.poly([(34, 52), (26, 50), (26, 56), (34, 58)], ghost)
        s.rect((24, 8, 27, 56), '#dfe8ff')                          # blade up
        s.rect((20, 54, 31, 57), '#c8a24a')                         # tsuba
        s.rect((24, 57, 27, 66), '#3a2a44')                         # handle
    else:
        s.poly([(36, 52), (26, 60), (30, 63), (38, 57)], ghost)
        s.line([(6, 70), (30, 60)], '#dfe8ff', width=3)             # blade low (iaido)
        s.poly([(28, 57), (33, 62), (31, 64), (26, 59)], '#c8a24a')
        s.line([(31, 62), (38, 66)], '#3a2a44', width=3)
    # head: pale spirit face, big chibi
    s.ellipse((26, 14, 64, 50), ghost)
    # straw kasa hat (tilted)
    s.poly([(16, 22), (46, 4), (76, 20), (70, 24), (46, 12), (22, 26)], '#c9a15d')
    s.poly([(22, 24), (46, 10), (70, 22), (46, 18)], '#e0bf7a', shade=False)
    # crescent moon crest on hat
    s.poly([(43, 3), (47, 1), (45, 5), (46, 9), (50, 11), (45, 12), (42, 8)], '#f5e6a0', shade=False)
    # eyes: glowing blue slits (face left)
    s.poly([(28, 32), (36, 30), (36, 33), (29, 34)], '#e8f6ff', shade=False, edge=False)
    s.poly([(40, 30), (47, 31), (46, 34), (40, 33)], '#e8f6ff', shade=False, edge=False)
    s.px([(31, 32), (43, 32)], '#3a6adf')
    # mouth guard (mempo)
    s.poly([(26, 38), (46, 38), (44, 47), (30, 47)], '#3a3f58')
    s.px([(32, 42), (36, 42), (40, 42)], '#8c93b0')
    return s.outline()


# ============ 6. astral_seraph — เทวรูปดวงดาว (Ascension III boss)
def astral_seraph(pose='idle', k=1.0, leg=0):
    s = Sprite(104, 104, k)
    cast = pose == 'skill'
    # halo ring behind head
    s.ring((24, 2, 80, 28), '#f5d76e', width=4, shade=False)
    # wings: 4 floating marble panels
    for dx, dy, mirror in ((0, 0, False),):
        pass
    s.poly([(62, 34), (98, 20), (100, 44), (70, 56)], '#e8e4f4')
    s.poly([(64, 56), (100, 52), (96, 76), (68, 70)], '#d6d0ea')
    s.px([(80, 32), (86, 30), (84, 60), (90, 62)], '#f5d76e')
    # floating lower body: marble skirt tapering to a star point
    s.poly([(34, 60), (70, 60), (60, 88), (52, 100), (44, 88)], '#cfc8e4')
    s.poly([(38, 62), (52, 62), (50, 96), (44, 86)], '#e2dcf2', shade=False)
    s.rect((34, 60, 70, 64), '#c9a13a')
    # torso
    s.ellipse((34, 40, 70, 68), '#ebe7f6')
    s.ellipse((47, 48, 57, 58), '#6a5ae0')                        # core gem
    s.px([(50, 50), (51, 50)], '#d8d2ff')
    # arms: holding a sceptre / raising for judgement
    if cast:
        s.poly([(36, 46), (22, 28), (26, 25), (40, 42)], '#ebe7f6')
        s.rect((16, 4, 20, 30), '#c9a13a')                        # sceptre raised
        s.ellipse((10, 0, 26, 12), '#9f8cff')
    else:
        s.poly([(36, 50), (22, 58), (25, 62), (38, 56)], '#ebe7f6')
        s.rect((17, 36, 21, 80), '#c9a13a')                       # sceptre held
        s.ellipse((11, 26, 27, 40), '#9f8cff')
    # head: serene mask (chibi big)
    s.ellipse((30, 12, 70, 50), '#f2eefa')
    s.poly([(30, 20), (50, 10), (70, 20), (68, 26), (32, 26)], '#c9a13a')  # gold circlet
    s.ellipse((46, 13, 54, 21), '#9f8cff')
    # closed / glowing eyes
    if cast:
        s.rect((34, 31, 42, 33), '#bfe9ff', shade=False, edge=False); s.rect((48, 31, 56, 33), '#bfe9ff', shade=False, edge=False)
    else:
        s.line([(34, 33), (38, 31), (42, 33)], '#6a6090'); s.line([(48, 33), (52, 31), (56, 33)], '#6a6090')
    s.px([(40, 41), (41, 41), (42, 41)], '#b79ad8')
    return s.outline()
