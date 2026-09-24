"""ตัดแผ่นไอคอน (แถวบน = รูปโปรไฟล์ 5 ตัว, 3 แถวล่าง = สกิล 1 / สกิล 2 / ท่าไม้ตาย) ออกเป็นไฟล์ webp

ใช้: python3 tools/art/slice_icons.py <sheet.png> aurel shade jin sylvie lumina
- หากรอบด้วยการฉายพิกเซลที่ไม่ดำ (ความสว่าง > 40) → 4 แถว × 5 คอลัมน์
- รูปโปรไฟล์: ครอปจัตุรัส 288 px → public/portraits/<id>.webp
- ไอคอน: ตัดขอบกรอบเข้าไป 7% (UI วาดกรอบเอง) ครอปจัตุรัส 160 px → public/skills/<id>-{s1,s2,ult}.webp
- ถ้าลำดับแถวไม่ตรงกับสกิล ให้สลับ id เอง (เช่นลูมิน่า: แถวหัวใจ = s2 พรศักดิ์สิทธิ์, แถวฮีลหมู่ = s1)
"""
import sys
import numpy as np
from PIL import Image


def spans(v, th=0.05):
    out, start = [], None
    for i, x in enumerate(v):
        if x > th and start is None:
            start = i
        elif x <= th and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(v)))
    return out


def main(src, ids):
    im = Image.open(src).convert('RGB')
    m = np.asarray(im).astype(int).max(2) > 40
    bands = spans(m.mean(1))
    slots = [None, 's1', 's2', 'ult']
    for bi, (y0, y1) in enumerate(bands[:4]):
        for hi, (x0, x1) in enumerate(spans(m[y0:y1].mean(0))[: len(ids)]):
            ys = np.where(m[y0:y1, x0:x1].mean(1) > 0.05)[0]
            X0, Y0, X1, Y1 = x0, y0 + ys[0], x1, y0 + ys[-1] + 1
            if bi:
                ins = int(0.07 * (X1 - X0))
                X0, X1, Y0, Y1 = X0 + ins, X1 - ins, Y0 + ins, Y1 - ins
            w, h = X1 - X0, Y1 - Y0
            s = min(w, h)
            cx, cy = X0 + (w - s) // 2, Y0 + (h - s) // 2
            crop = im.crop((cx, cy, cx + s, cy + s))
            if bi == 0:
                crop.resize((288, 288), Image.LANCZOS).save(f'public/portraits/{ids[hi]}.webp', quality=90)
            else:
                crop.resize((160, 160), Image.LANCZOS).save(f'public/skills/{ids[hi]}-{slots[bi]}.webp', quality=90)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
