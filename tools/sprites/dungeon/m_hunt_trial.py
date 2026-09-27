from px import Sprite

# ================= HUNT (ถ้ำสมบัติ)
# 7. gem_beetle — ด้วงอัญมณี
def gem_beetle(pose='idle', k=1.0, leg=0):
    s = Sprite(72, 72, k)
    shell = pose == 'skill'
    # legs
    for n, x in enumerate((20, 30, 40, 50)):
        dx = 3 * leg * (1 if n % 2 else -1)
        s.line([(x, 52), (x - 4 + dx, 62)], '#3a2c40', width=2)
    # body shell (crystal amethyst)
    s.ellipse((16, 26, 62, 60), '#6b3fa0')
    # crystal spikes on shell
    for (x, h) in ((26, 14), (36, 10), (46, 14), (54, 20)):
        s.poly([(x - 5, 34), (x, 34 - h - 8), (x + 5, 34)], '#b07ae8')
        s.poly([(x - 1, 32), (x, 34 - h - 6), (x + 2, 32)], '#e6d0ff', shade=False, edge=False)
    s.line([(40, 30), (40, 56)], '#3e2266')                    # shell split
    # head (front-left), chibi big
    s.ellipse((4, 34, 30, 60), '#4a2e6e')
    if shell:  # tucked in, eyes shut
        s.line([(8, 44), (14, 44)], '#1e1a2a'); s.line([(17, 44), (23, 44)], '#1e1a2a')
    else:
        s.ellipse((8, 40, 15, 47), '#ffe16a', shade=False, edge=False); s.px([(10, 42), (11, 42)], '#1e1a2a')
        s.ellipse((17, 40, 24, 47), '#ffe16a', shade=False, edge=False); s.px([(19, 42), (20, 42)], '#1e1a2a')
    # horn with a gem
    s.poly([(4, 40), (0, 28), (8, 36)], '#8a5ac8')
    s.ellipse((0, 24, 6, 30), '#ff6fae')
    # mandibles
    s.poly([(4, 52), (0, 58), (8, 56)], '#2e1a44'); s.poly([(12, 54), (10, 60), (16, 57)], '#2e1a44')
    return s.outline()


# 8. mimic_chest — หีบมิมิค
def mimic_chest(pose='idle', k=1.0, leg=0):
    s = Sprite(80, 80, k)
    open_ = pose == 'skill'
    # stubby legs
    s.rect((22, 62, 28, 72), '#6b4424'); s.rect((50, 62, 56, 72), '#6b4424')
    # chest base
    s.rect((14, 44, 66, 66), '#9b5e2e')
    s.rect((14, 44, 66, 48), '#e3b341'); s.rect((14, 62, 66, 66), '#e3b341')
    s.rect((36, 44, 42, 66), '#e3b341')
    if open_:
        # lid thrown open: huge mouth with teeth + tongue
        s.poly([(14, 44), (66, 44), (60, 10), (8, 18)], '#8a4f26')
        s.poly([(12, 18), (60, 12), (60, 16), (13, 22)], '#e3b341')
        s.poly([(16, 44), (64, 44), (60, 24), (14, 28)], '#4a1020')          # mouth interior
        for x in range(18, 62, 7):
            s.poly([(x, 44), (x + 3, 38), (x + 6, 44)], '#f4efe0', shade=False)   # bottom teeth
            s.poly([(x - 1, 28), (x + 2, 34), (x + 5, 27)], '#f4efe0', shade=False)  # top teeth
        s.poly([(20, 42), (8, 36), (2, 44), (12, 48), (28, 44)], '#e35a7a')        # tongue lashing left
        s.ellipse((24, 14, 32, 22), '#ffe16a', shade=False); s.px([(27, 17)], '#1e1a2a')
    else:
        # closed lid + sneaky eye in the keyhole seam
        s.poly([(14, 44), (66, 44), (64, 30), (16, 30)], '#8a4f26')
        s.poly([(16, 30), (64, 30), (58, 24), (22, 24)], '#a86a34')
        s.rect((14, 40, 66, 44), '#e3b341')
        s.rect((35, 38, 43, 50), '#c9c3b0'); s.px([(38, 42), (39, 42), (38, 43)], '#1e1a2a')
        # two eyes peeking + drool
        s.ellipse((18, 42, 24, 46), '#ffe16a', shade=False, edge=False); s.px([(20, 43)], '#1e1a2a')
        s.ellipse((26, 42, 32, 46), '#ffe16a', shade=False, edge=False); s.px([(28, 43)], '#1e1a2a')
        s.poly([(16, 48), (18, 48), (17, 54)], '#9fd8ff', shade=False)
    # coins spilling
    for (x, y) in ((8, 68), (66, 70), (70, 66)):
        s.ellipse((x, y, x + 6, y + 4), '#f0cc55')
    return s.outline()


# 9. coin_kobold — โคโบลด์ขนทอง (treasure carrier)
def coin_kobold(pose='idle', k=1.0, leg=0):
    s = Sprite(72, 72, k)
    run = pose == 'skill'
    # huge sack on back
    s.ellipse((34, 18, 66, 54), '#c9a15d')
    s.poly([(44, 18), (54, 10), (58, 20)], '#a8844a')
    s.ellipse((46, 30, 58, 42), '#e3b341', shade=False); s.px([(51, 34), (52, 34), (51, 37), (52, 37)], '#9b6b1e')  # $ coin mark
    s.px([(38, 20), (41, 17), (60, 22)], '#f0cc55')
    # legs
    if run:
        s.poly([(22, 54), (14, 62), (18, 64), (26, 56)], '#c86a3a')
        s.poly([(32, 54), (40, 64), (44, 62), (36, 54)], '#c86a3a')
    else:
        s.rect((22 - 3 * leg, 54, 27 - 3 * leg, 66), '#c86a3a'); s.rect((31 + 3 * leg, 54, 36 + 3 * leg, 66), '#c86a3a')
    s.rect((18 - 3 * leg, 64, 28 - 3 * leg, 67) if not run else (12, 62, 20, 65), '#5a3a2a')
    s.rect((30 + 3 * leg, 64, 40 + 3 * leg, 67) if not run else (40, 62, 48, 65), '#5a3a2a')
    # body (vest)
    s.ellipse((18, 38, 40, 58), '#d97a42')
    s.poly([(20, 42), (36, 42), (34, 56), (22, 56)], '#3d6a5a')
    # head: lizard-dog kobold, big chibi head facing left
    s.ellipse((10, 10, 42, 42), '#e08a4a')
    s.poly([(4, 24), (14, 20), (16, 32), (4, 32)], '#e8a066')          # snout
    s.px([(5, 25), (6, 25)], '#3a2418')                                 # nostril
    s.poly([(30, 10), (40, 0), (40, 16)], '#e08a4a')                    # ear/horn
    s.poly([(34, 8), (39, 2), (38, 12)], '#f2b98a', shade=False)
    s.ellipse((16, 18, 24, 26), '#ffffff', shade=False, edge=False); s.px([(17, 21), (18, 21), (17, 22)], '#1e1a2a')
    # bandana + goggles on forehead
    s.poly([(12, 12), (40, 14), (40, 18), (12, 17)], '#3a6ab8')
    s.ellipse((20, 8, 28, 15), '#9fd8ff'); s.ellipse((27, 8, 35, 15), '#9fd8ff')
    if run:
        s.poly([(8, 30), (16, 30), (13, 36)], '#ffffff', shade=False)   # panic mouth
        s.px([(26, 4), (28, 2)], '#9fd8ff')                              # sweat
    else:
        s.line([(6, 31), (14, 31)], '#7a3a22')
    # coin in hand
    s.ellipse((10, 42, 18, 48), '#f0cc55')
    return s.outline()


# ================= SKILL TRIAL (หอสอบเวท)
# 10. rune_wisp — ภูตรูน
def rune_wisp(pose='idle', k=1.0, leg=0):
    s = Sprite(64, 64, k)
    cast = pose == 'skill'
    # flame tail
    s.poly([(30, 44), (42, 44), (40, 58), (36, 52), (34, 62), (31, 52)], '#3a7ad8')
    s.poly([(33, 46), (39, 46), (37, 56), (35, 50)], '#9fe0ff', shade=False)
    # body orb
    s.ellipse((14, 12, 50, 48), '#56a8f0')
    s.ellipse((20, 16, 34, 28), '#bfeaff', shade=False, edge=False)
    # floating rune stones orbiting
    for (x, y) in ((6, 20), (52, 16), (48, 42)):
        s.poly([(x, y), (x + 5, y - 3), (x + 9, y + 2), (x + 5, y + 7)], '#8a8fa8')
        s.px([(x + 4, y + 1), (x + 5, y + 2), (x + 4, y + 3)], '#7ff0ff' if cast else '#c9d2e0')
    # face (left)
    s.ellipse((19, 26, 25, 34), '#ffffff', shade=False, edge=False); s.px([(20, 29), (21, 29), (20, 30)], '#12306a')
    s.ellipse((28, 26, 34, 34), '#ffffff', shade=False, edge=False); s.px([(29, 29), (30, 29), (29, 30)], '#12306a')
    if cast:
        s.ellipse((22, 36, 29, 42), '#12306a', shade=False)          # "oh" casting
        s.ellipse((2, 30, 14, 42), '#7ff0ff', shade=False)           # rune charging in front
        s.px([(7, 33), (7, 34), (7, 35), (6, 36), (8, 36), (7, 38)], '#ffffff')
    else:
        s.line([(23, 38), (27, 39)], '#12306a')
    return s.outline()


# 11. grimoire_familiar — ตำราเวทมีชีวิต
def grimoire_familiar(pose='idle', k=1.0, leg=0):
    s = Sprite(72, 72, k)
    cast = pose == 'skill'
    # little bat wings
    s.poly([(52, 24), (68, 14), (66, 30), (70, 34), (56, 36)], '#5a2e6e')
    s.poly([(18, 24), (4, 16), (6, 30), (2, 34), (16, 36)], '#5a2e6e')
    if cast:
        # book opened wide, pages flying
        s.poly([(14, 30), (36, 36), (36, 60), (12, 54)], '#7a2e44')
        s.poly([(36, 36), (58, 30), (60, 54), (36, 60)], '#7a2e44')
        s.poly([(17, 32), (35, 37), (35, 56), (15, 51)], '#f2e8cc')
        s.poly([(37, 37), (55, 32), (57, 51), (37, 56)], '#f2e8cc')
        for y in (40, 44, 48):
            s.line([(19, y), (32, y + 2)], '#9a8a6a'); s.line([(40, y + 2), (53, y)], '#9a8a6a')
        for (x, y) in ((8, 8), (24, 4), (50, 6), (60, 44)):
            s.poly([(x, y), (x + 7, y + 1), (x + 6, y + 8), (x - 1, y + 7)], '#f2e8cc')
        s.ellipse((30, 42, 42, 54), '#ffd84a', shade=False)          # glowing sigil
    else:
        # closed book body standing, face on cover
        s.rect((16, 22, 54, 60), '#7a2e44')
        s.rect((50, 24, 56, 60), '#f2e8cc')                         # page edges (spine faces left)
        s.rect((16, 22, 20, 60), '#5a1e30')
        s.poly([(22, 26), (48, 26), (48, 30), (22, 30)], '#e3b341')
        s.poly([(22, 52), (48, 52), (48, 56), (22, 56)], '#e3b341')
        s.ellipse((22, 34, 30, 42), '#ffffff', shade=False, edge=False); s.px([(23, 37), (24, 37), (23, 38)], '#1e1a2a')
        s.ellipse((34, 34, 42, 42), '#ffffff', shade=False, edge=False); s.px([(35, 37), (36, 37), (35, 38)], '#1e1a2a')
        s.poly([(26, 45), (38, 45), (34, 49), (28, 49)], '#3a1020')
        s.px([(28, 45), (35, 45)], '#ffffff')
        s.rect((31, 16, 35, 22), '#e3b341')                          # bookmark ribbon + clasp
        s.poly([(31, 60), (35, 60), (34, 68), (32, 66)], '#c8413a')
    return s.outline()


# 12. arcane_examiner — ผู้คุมสอบจอมเวท (ELITE)
def arcane_examiner(pose='idle', k=1.0, leg=0):
    s = Sprite(88, 88, k)
    cast = pose == 'skill'
    # robe (long, floor)
    s.poly([(26, 44), (58, 44), (66, 82), (20, 82)], '#3b2a7a')
    s.poly([(38, 44), (46, 44), (48, 82), (36, 82)], '#e3b341')      # gold trim stripe
    s.poly([(24, 44), (60, 44), (58, 52), (26, 52)], '#2a1d5a')
    # scholar cape
    s.poly([(52, 40), (74, 44), (76, 76), (62, 70)], '#7a2e44')
    # beard (long white)
    s.poly([(18, 38), (40, 38), (34, 64), (28, 58), (24, 66)], '#eeeae0')
    # head
    s.ellipse((14, 10, 50, 44), '#f0c8a0')
    # mortarboard / wizard square cap with tassel
    s.poly([(8, 14), (38, 4), (62, 12), (32, 22)], '#2a1d5a')
    s.rect((20, 14, 46, 20), '#3b2a7a')
    s.line([(38, 8), (56, 22), (56, 30)], '#e3b341')
    s.ellipse((53, 28, 59, 34), '#e3b341')
    # monocle + stern eyes (left)
    s.line([(18, 25), (25, 26)], '#6a4a3a')                            # brow
    s.px([(21, 28), (22, 28)], '#1e1a2a')
    s.ellipse((27, 24, 36, 33), '#bfe9ff', shade=False)
    s.px([(31, 28), (32, 28)], '#1e1a2a')
    s.line([(36, 30), (44, 40)], '#e3b341')
    s.poly([(14, 34), (24, 32), (22, 36)], '#e0a888')                  # nose
    # arms / staff with floating grading quill + seal
    if cast:
        s.poly([(26, 46), (12, 34), (16, 31), (30, 44)], '#3b2a7a')
        s.rect((6, 4, 10, 60), '#8a5e22')
        s.ellipse((0, 0, 16, 14), '#c86aff')
        s.ellipse((-2, 36, 14, 52), '#ffd84a', shade=False)             # seal glyph in hand
        s.px([(5, 42), (6, 43), (7, 44), (5, 44), (7, 42)], '#7a2e44')
    else:
        s.poly([(26, 50), (14, 56), (16, 60), (28, 54)], '#3b2a7a')
        s.rect((10, 22, 14, 82), '#8a5e22')
        s.ellipse((4, 14, 20, 28), '#c86aff')
        # floating clipboard (exam sheet)
        s.rect((64, 20, 80, 38), '#e9e2d0'); s.rect((70, 18, 74, 21), '#8a8fa8')
        for y in (25, 29, 33):
            s.line([(66, y), (77, y)], '#9a8a6a')
        s.px([(76, 25), (77, 24), (76, 33), (77, 32)], '#c8413a')
    return s.outline()
