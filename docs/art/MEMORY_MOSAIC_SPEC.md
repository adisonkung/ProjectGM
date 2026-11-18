> **ยกเลิกแล้ว (ผู้ใช้ 2026-11-18)** — แท็บอัปดาวใช้ banner + แผง Star Ascension แทน · ไม่ต้อง gen ภาพชุดนี้

# สเปกภาพ: Memory Mosaic (แท็บอัปดาว) — ภาพความทรงจำรายดาว + กรอบ + VFX

> ให้ผู้ใช้ gen ด้วย AI แล้วส่ง ZIP กลับมา · Claude ตัดพื้น จัดขนาด และใส่เกมเอง
> ทิศทางภาพ Gilded Ember (`src/app/shared/_gilded.scss`): ดำอุ่น · ทองแชมเปญ · แดงเบอร์กันดี · ห้ามม่วง/น้ำเงินเป็นสีหลัก
> ภาพอ้างอิงที่ผู้ใช้ส่ง (Kael Memory Mosaic, 2026-11-18) = เป้าหมายของอารมณ์ภาพ
> ตอนนี้ในเกม: ชิ้นทั้ง 6 ตัดจาก banner รูปเดียว (`public/banners/<id>.webp`) — เมื่อได้ภาพชุดนี้จะใส่แทนรายชิ้น โครงหน้าไม่ต้องเปลี่ยน

## 1. ภาพความทรงจำรายดาว (ต่อฮีโร่ 6 ภาพ)

แต่ละดาว = 1 ฉากจากเรื่องราวของฮีโร่ เรียงจากอดีต → ปัจจุบัน → ตำนาน ภาพจะถูกตัดเป็นชิ้นรูปลิ่ม (wedge) แสดงเฉพาะส่วนกลางภาพ จึง**ต้องวางจุดสำคัญ (หน้า / อาวุธ) ไว้กลางภาพ** และมีพื้นที่ภาพรอบ ๆ ให้ครอปได้

| ไฟล์ (ต่อฮีโร่) | ดาว | ฉากที่ควรเป็น | ตัวอย่าง (Kael) |
|---|---|---|---|
| `memory_1.png` | 1★ | ใบหน้าระยะใกล้ อารมณ์ของตัวละคร | close-up หน้า Kael ผมปลิว ผ้าคลุมแดง |
| `memory_2.png` | 2★ | ตัวละครเต็มตัว ยืนในบ้านเกิด / ปราสาท | Kael ยืนบนกำแพงเมือง ธงสิงโต |
| `memory_3.png` | 3★ | อาวุธ / มือ / สัญลักษณ์ประจำตัว (ระยะใกล้มาก) | มือสวมเกราะกำด้ามดาบ อัญมณีแดง |
| `memory_4.png` | 4★ | ท่าพร้อมรบ ดราม่า แสงอุ่น | Kael ชักดาบ หันมองขอบฟ้า |
| `memory_5.png` | 5★ | ความทรงจำมืด / บาดแผล (แสดงเป็นภาพขาวดำตอนล็อก) | เดินในซากเมืองที่ถูกเผา |
| `memory_6.png` | 6★ | ร่างตื่นพลัง ระดับตำนาน (ชมพู-ทอง) | Kael ในชุดเกราะทองเรืองแสง |

- ขนาด **1600 × 1600** · PNG หรือ JPG · **พื้นหลังเป็นฉากเต็ม** (ไม่ต้องใส)
- สไตล์ภาพเดียวกับ banner ของฮีโร่ตัวนั้น (ชุด/สีผม/อาวุธต้องตรงกันทุกภาพ)
- วางไว้ `memories/<heroId>/memory_N.png` ใน ZIP

Prompt หลัก (ต่อท้ายด้วยฉากของแต่ละดาว):

```
premium anime fantasy gacha key art, painterly, cinematic warm golden rim light, rich detail,
same character design as the reference image, subject centered with generous margins on all sides
for cropping, no text, no frame, no UI
```

## 2. กรอบโมเสก (ใช้ร่วมทุกฮีโร่)

| ไฟล์ | ขนาด | พื้นหลัง | prompt เพิ่ม |
|---|---|---|---|
| `mosaic_edge.png` | 1024 × 64 | โปร่งใส | `a straight ornate polished gold frame strip with fine engraved filigree and small gem studs, tileable horizontally` |
| `mosaic_corner.png` | 256 × 256 | โปร่งใส | `an ornate gold corner bracket ornament with a small ruby, filigree curls, for a stained-glass panel corner` |
| `mosaic_lock.png` | 256 × 256 | โปร่งใส | `an antique gold padlock emblem with engraved star, slightly worn, soft rim light` |
| `mosaic_backplate.png` | 2400 × 1700 | ทึบ | `dark burgundy velvet drapery with faint gold dust, soft vignette, background for a gallery of memory shards, no objects` |

## 3. VFX (แผ่นเฟรม 4 × 3 = 12 เฟรม, ช่องละ 512 × 512, **พื้นดำสนิท**)

| ไฟล์ | ใช้ตอน | prompt เพิ่ม |
|---|---|---|
| `vfx_star_ignite_loop.png` | ดาวถัดไป "ติดไฟ" วนตลอด (ต้องต่อกันเนียนเฟรม 12 → 1) | `a golden star igniting with flickering warm fire-like light, licks of golden flame and embers around a bright core, seamless loop` |
| `vfx_frame_glow_loop.png` | แสงวิ่งรอบขอบกรอบชิ้นถัดไป | `a short bright golden light streak with a soft glow trail moving left to right across the frame, seamless loop, thin horizontal` |
| `vfx_shard_unlock.png` | ชิ้นปลดล็อก (ภาพขาวดำ → สี) | `a burst of golden light and shimmering glass fragments radiating outward, frames 1-4 build, 5-7 bright flash, 8-12 sparkles settle and fade` |
| `vfx_corner_glint.png` | ประกายที่มุมกรอบ | `a tiny four-pointed star glint flashing on a gold edge, frames 1-3 appear, 4-6 peak with rays, 7-12 fade` |

- ทุกเฟรมจุดศูนย์กลางเดียวกัน · ห้ามมีตัวเลข/ป้าย/เส้นกริด · เฟรมสุดท้ายของ VFX แบบครั้งเดียวต้องดำสนิท

## Prompt หลักของ VFX

```
fantasy game VFX sprite sheet, 4 columns x 3 rows grid, 12 animation frames read left-to-right,
top-to-bottom, golden and warm white light, champagne gold sparks, additive glow,
pure black background, same center point every frame, no text, no grid lines
```

## หลังได้ภาพ (ฝั่ง Claude)

1. ต้นฉบับเข้า `assets/ui/gilded/mosaic/` และ `assets/heroes/<Id>/memories/` (ห้ามแก้)
2. สคริปต์นำเข้า (ต่อจาก `tools/ui/import_gilded.py`): ภาพความทรงจำ → WebP 1200 px, VFX ดำ → alpha จริง
3. `HeroArt.memories?: string[6]` (ไม่มี = ใช้ banner ตัดเหมือนเดิม) → ชิ้นที่ N ใช้ภาพ N
4. กรอบ/มุม/แม่กุญแจ/VFX แทนของที่วาดด้วยโค้ดตอนนี้ (เส้น SVG, ประกาย sparkle, ลูปจากแผ่น burst)
5. เทียบภาพก่อน/หลังในเกมจริง ส่งให้ผู้ใช้ดูก่อน merge
