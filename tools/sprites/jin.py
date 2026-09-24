from extract_char import extract
G = [200, 333, 461, 586, 717, 852, 990, 1125]
ROWS = [('idle', 28, 142, 8), ('walk', 152, 276, 8), ('hurt', 282, 402, 8), ('die', 405, 534, 7),
        ('attack', 537, 684, 8), ('skill', 688, 812, 8), ('skill2', 818, 942, 8), ('ult', 944, 1095, 8)]
C = {r[0]: G for r in ROWS}
C['die'] = [210, 339, 461, 597, 738, 908, 1103]
C['skill2'] = [210, 340, 465, 578, 705, 845, 975, 1110]
LABEL = [(0, 536, 140), (536, 1110, 162)]
extract('samurai.png', LABEL, ROWS, 1110, 0.7, 'out/hero-jin.png', centres=C, CH=120)
