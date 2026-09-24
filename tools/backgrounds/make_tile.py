"""ทำภาพพื้นหลังให้ต่อซ้าย-ขวาได้ไร้รอยต่อ (ผสมขอบขวาเข้ากับขอบซ้าย) แล้วบันทึกเป็น webp

ใช้: python3 tools/backgrounds/make_tile.py <ต้นฉบับ.png> public/backgrounds/<ชื่อ>.webp [ความกว้างแถบผสม=48]
ความกว้างผลลัพธ์ = ต้นฉบับ - แถบผสม
"""
import sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
band = int(sys.argv[3]) if len(sys.argv) > 3 else 48
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
h, w, _ = im.shape
t = np.linspace(0, 1, band)[None, :, None]
tile = im[:, : w - band].copy()
# ช่วงต้นภาพ: ค่อย ๆ เปลี่ยนจากขอบขวาเดิม (ต่อจากท้ายภาพ) ไปเป็นขอบซ้ายเดิม
tile[:, :band] = im[:, w - band :] * (1 - t) + im[:, :band] * t
Image.fromarray(tile.clip(0, 255).astype(np.uint8)).save(out, quality=92, method=6)
print(out, tile.shape[1], 'x', h)
