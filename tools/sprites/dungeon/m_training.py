from px import Sprite, tone, hexc

# ============ 1. straw_recruit — หุ่นฟางพลทหาร
def straw_recruit(pose='idle', k=1.0, leg=0):
    s = Sprite(64, 64, k)
    atk = pose == 'attack'
    bob = 0
    # back leg / front leg (wood pegs)
    b, f = 3 * leg, -3 * leg
    s.rect((33 + b, 48, 36 + b, 58), '#8a5a32')
    s.rect((25 + f, 48, 28 + f, 58) if not atk else (22, 48, 25, 58), '#8a5a32')
    s.rect((32 + b, 57, 38 + b, 59), '#5e3b20'); s.rect((22 if atk else 24 + f, 57, 29 + f if not atk else 27, 59), '#5e3b20')
    # body: burlap tunic tied with rope
    s.poly([(22, 37), (41, 37), (43, 50), (20, 50)], '#8f6a3c')
    s.rect((21, 43, 42, 45), '#7a4e2a')  # rope belt
    s.px([(31, 44), (32, 44)], '#e7c88a')
    # wooden plank shoulder guard
    s.poly([(34, 35), (44, 36), (44, 41), (35, 41)], '#a56a3a')
    s.px([(37, 38), (41, 38)], '#5e3b20')
    # straw tufts (back)
    for x0 in (26, 32, 38):
        s.poly([(x0, 12), (x0 + 3, 4 + (x0 % 3)), (x0 + 5, 12)], '#e8c64e', edge=False)
    # head: burlap sack
    s.ellipse((17, 9, 45, 37), '#d8b474')
    # stitches + button eyes (facing left)
    s.px([(21, 21), (22, 22), (23, 23), (23, 21), (21, 23)], '#3a2418')       # X eye
    s.ellipse((28, 19, 32, 23), '#3a2418', shade=False, edge=False)            # button eye
    s.px([(29, 20)], '#8c7a6a')
    s.line([(20, 29), (31, 30)], '#6b3f22')                                    # stitched mouth
    s.px([(22, 28), (22, 30), (25, 28), (25, 31), (28, 29), (28, 31)], '#6b3f22')
    s.px([(34, 14), (36, 13), (38, 15)], '#b8935a')                            # patch seam
    # head band (training ribbon)
    s.poly([(17, 15), (45, 17), (45, 20), (17, 18)], '#c8413a')
    s.poly([(44, 17), (52, 13), (52, 20), (45, 20)], '#a8322d')
    # arm + wooden sword
    if atk:
        s.poly([(20, 38), (12, 40), (12, 43), (21, 42)], '#8a5a32')
        s.poly([(1, 38), (13, 40), (13, 43), (1, 43)], '#c9a36a')       # sword thrust forward
        s.rect((12, 37, 14, 46), '#6b4424')
    else:
        s.poly([(21, 38), (15, 44), (17, 46), (23, 41)], '#8a5a32')
        s.poly([(14, 25), (17, 25), (18, 45), (15, 45)], '#c9a36a')     # sword held up
        s.rect((12, 43, 20, 45), '#6b4424')
    return s.outline()


# ============ 2. crossbow_dummy — หุ่นหน้าไม้
def crossbow_dummy(pose='idle', k=1.0, leg=0):
    s = Sprite(64, 64, k)
    atk = pose == 'attack'
    # wheeled cart base
    s.rect((16, 46, 46, 52), '#7a5634')
    s.ellipse((16, 48, 27, 59), '#5a4030'); s.ellipse((35, 48, 46, 59), '#5a4030')
    s.ellipse((19, 51, 24, 56), '#a88a5c', shade=False); s.ellipse((38, 51, 43, 56), '#a88a5c', shade=False)
    # post body
    s.rect((28, 33, 35, 47), '#9b6b3e')
    # round target-board head (red/white rings)
    s.ellipse((17, 6, 47, 36), '#e9e2d0')
    s.ellipse((21, 10, 43, 32), '#c8413a', edge=False)
    s.ellipse((25, 14, 39, 28), '#e9e2d0', edge=False)
    s.ellipse((29, 18, 35, 24), '#c8413a', edge=False)
    # arrow stuck in the head
    s.line([(41, 13), (52, 6)], '#6b4424', width=1); s.px([(52, 5), (53, 5), (53, 6)], '#e9e2d0')
    # angry painted eyes (face left)
    s.poly([(20, 19), (26, 21), (25, 23), (20, 22)], '#1e1a2a', shade=False, edge=False)
    s.px([(22, 21)], '#f2d34a')
    # crossbow mounted in front
    y = 37 if not atk else 36
    s.rect((6, y, 30, y + 3), '#6e4a2a')            # stock
    s.line([(9, y - 8), (6, y + 1), (9, y + 11)], '#4a3a3a', width=2)   # bow limbs
    s.line([(9, y - 8), (14 if not atk else 10, y + 1), (9, y + 11)], '#d9d0b8')  # string
    if not atk:
        s.rect((4, y + 1, 22, y + 1), '#cfc7b4'); s.px([(3, y + 1), (4, y), (4, y + 2)], '#8c96a8')  # loaded bolt
    s.rect((24, y + 3, 26, y + 6), '#4a3a3a')        # trigger
    return s.outline()


# ============ 3. drill_sergeant — จ่าหุ่นเหล็ก (ELITE)
def drill_sergeant(pose='idle', k=1.0, leg=0):
    s = Sprite(72, 72, k)
    cast = pose == 'skill'
    # legs (iron boots)
    f, b = -3 * leg, 3 * leg
    s.rect((30 + f, 55, 37 + f, 65), '#59606e'); s.rect((42 + b, 55, 49 + b, 65), '#59606e')
    s.rect((27 + f, 62, 38 + f, 67), '#3c4150'); s.rect((41 + b, 62, 52 + b, 67), '#3c4150')
    # barrel body
    s.ellipse((22, 36, 58, 60), '#7b8494')
    s.rect((24, 45, 56, 48), '#b08a3e')  # brass band
    s.px([(30, 46), (38, 46), (46, 46)], '#f0d27a')
    # medal
    s.ellipse((42, 40, 47, 45), '#e3b341', edge=False); s.px([(44, 39), (45, 39)], '#c8413a')
    # pauldron + arm holding shield (back arm)
    s.ellipse((46, 33, 60, 43), '#8e98a8')
    s.poly([(52, 42), (62, 44), (60, 58), (52, 56)], '#4a6fa8')  # round shield back
    s.px([(56, 48), (57, 49), (56, 50)], '#e3b341')
    # head: bucket helm with visor + red plume
    s.poly([(38, 3), (50, 1), (48, 12), (40, 12)], '#c8413a')
    s.ellipse((22, 8, 54, 40), '#9aa4b4')
    s.rect((24, 20, 52, 25), '#353a48', shade=False, edge=False)  # visor slit
    s.px([(28, 22), (29, 22), (34, 22), (35, 22)], '#ffd84a')     # glowing eyes
    s.rect((22, 27, 54, 29), '#b08a3e')                            # brass rim
    s.px([(33, 12), (36, 12), (42, 13)], '#c9d2e0')                 # rivets
    # moustache (painted) under visor
    s.poly([(24, 31), (32, 30), (35, 34), (26, 35)], '#3a2a22', shade=False)
    # front arm: whistle / megaphone
    if cast:
        s.poly([(24, 40), (16, 30), (19, 28), (27, 37)], '#7b8494')
        s.poly([(8, 20), (19, 26), (16, 31), (6, 27)], '#e3b341')    # brass megaphone raised
        s.ellipse((4, 19, 10, 29), '#c28e28')
    else:
        s.poly([(24, 42), (16, 47), (18, 50), (26, 46)], '#7b8494')
        s.poly([(8, 44), (18, 45), (18, 50), (8, 52)], '#e3b341')    # megaphone lowered
        s.ellipse((5, 43, 10, 53), '#c28e28')
    return s.outline()
