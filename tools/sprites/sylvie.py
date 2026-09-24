from extract_char import extract
G = [240, 392, 540, 693, 843, 993, 1149, 1303]
ROWS = [('idle', 38, 161, 8), ('walk', 161, 290, 8), ('hurt', 290, 415, 8), ('die', 415, 537, 8),
        ('attack', 537, 658, 8), ('skill', 658, 792, 8), ('skill2', 792, 908, 8), ('ult', 908, 1013, 8)]
C = {r[0]: G for r in ROWS}
C['die'] = [243, 395, 537, 696, 856, 1013, 1166, 1319]
extract('elf.png', 172, ROWS, 1013, 0.65, 'out/hero-sylvie.png', centres=C, CH=120)
