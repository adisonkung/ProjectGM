# สเปกภาพ: ฉากเปิดกาชา "ตำราวีรชน · วิหารลอยฟ้า"

> ให้ AI gen ภาพตามสเปกนี้ แล้วส่งกลับมาเป็น ZIP · Claude จะตัดพื้น ตั้งจุดหมุน และทำแอนิเมชันในเกมเอง
> ภาพร่างที่ผู้ใช้เห็นชอบแล้ว: animatic (https://claude.ai/artifact/Dj67mgsb9TRdCoZahUXQyz) · ทุกอย่างในนั้นวาดด้วยโค้ดชั่วคราว
> สเปกนี้ใช้แทน [SUMMON_WORLDS_ART_SPEC.md](SUMMON_WORLDS_ART_SPEC.md) (แบบโลกโคจร ซึ่งยกเลิกแล้ว)

## เรื่องและอารมณ์

- **เรื่อง:** วิหารหินอ่อนบนเกาะลอยฟ้าของเอลเดอร์เวย์น มีตำราวีรชนที่บันทึกเรื่องราวของผู้กล้าทุกคน
- **ลำดับ:**
  1. แตะที่ปก
  2. ตำราดูดแสงรอบตัวเข้าไปแบบหลุมดำ
  3. ระเบิดเปิด แล้วหน้ากระดาษพลิกรัวเหมือนต้องลม
  4. อักษรโบราณเขียนตัวเองด้วยหมึกเรืองแสง
  5. แสงลอยออกจากตัวอักษรรวมเป็นเสาแสง แล้วกลายเป็นการ์ด
- **โทน:** แฟนตาซีสว่าง สนธยาสีม่วงทอง หินอ่อนขาวลายทอง
  - **ห้ามมืดแบบ dark fantasy:** ไม่มีโถงเสาหินมืด
  - **สีของแสง:** ปกติเป็นขาวฟ้า และเป็น**ทองเฉพาะเมื่อได้ 3★** (โค้ดเปลี่ยนสีให้เอง)
- **สไตล์:** ภาพ key art แฟนตาซีกึ่งสมจริง (semi-realistic painterly)
  - ห้ามออกการ์ตูน พาสเทล หรือเมฆม้วนแบบสายไหม
  - ห้ามออกเป็นภาพถ่าย
- **ภาพอ้างอิงในเกม:**
  - `public/banners/*.webp`: ระดับความสมจริงของการวาด
  - `public/island/sky_city/base.webp`: หน้าตาเมืองลอยฟ้า
  - `public/ui/summon-card*.jpg`: หลังการ์ด

## หลักการ: ขอเป็นชิ้นส่วน แล้วโค้ดประกอบเป็นฉาก

- **กล้อง:** ซูม สั่น พาราแลกซ์ และตัดมุม ทำในโค้ดทั้งหมด
- **ตำรา:** ขอเป็น**ลายผิวแบนหน้าตรง** (ปก หน้ากระดาษ ขอบสันกระดาษ) แล้วโค้ดนำไปห่อเป็นหนังสือ 3 มิติ ทั้งตอนเปิดปกและพลิกหน้า
  - เหตุผล: AI วาดหนังสือพลิกหน้าหลายเฟรมให้ตรงกันไม่ได้
  - ห้ามขอเป็นแผ่นแอนิเมชันหนังสือ
- **อักษรโบราณ:** ขอแค่**แผ่นออกแบบตัวอักษร** แล้ว Claude จะวาดเป็นเส้นเวกเตอร์ใหม่ เพื่อให้ "เขียนทีละเส้น" ได้จริง
- **แสงและระเบิด:** ขอเป็นแผ่น VFX บนพื้นดำ

## กติกาไฟล์

| ประเภท | ขนาด | พื้นหลัง | หมายเหตุ |
|---|---|---|---|
| **ฉาก / เลเยอร์** | ตามตาราง | ตามตาราง (โปร่งใส = PNG alpha) | ห้ามมีตัวหนังสือ ตัวละคร หรือโลโก้ |
| **ลายผิวตำรา** | ตามตาราง | เต็มภาพ | **มุมตรงแบนเหมือนสแกน** ไม่มีมุมเอียง ไม่มีเงาตก แสงสม่ำเสมอ ขอบภาพ = ขอบชิ้นงานพอดี ไม่เว้นขอบ |
| **ชิ้นส่วน** | ตามตาราง | โปร่งใส (ถ้าทำไม่ได้ใช้ดำสนิท) | 1 ไฟล์ = 1 ชิ้น เว้นขอบประมาณ 8 % |
| **VFX** | กริด **4 × 3 = 12 เฟรม** ขนาดช่องตามตาราง | **ดำสนิท #000000** | จุดศูนย์กลางเดียวกันทุกเฟรม · ห้ามมีตัวเลข ป้าย หรือเส้นกริด · เฟรม 1 = เริ่ม, เฟรม 12 = จางหมด |
| **VFX ลูป** | กริด 4 × 2 = 8 เฟรม | ดำสนิท | เฟรม 8 ต้องต่อกลับเฟรม 1 ได้เนียน |

- ตั้งชื่อไฟล์ตามคอลัมน์ "ชื่อไฟล์" แล้วรวมเป็น ZIP
- ทยอยส่งเป็นชุดได้ ต้นฉบับจะเก็บไว้ที่ `assets/ui/summon-book/` (อ่านอย่างเดียว)

### Prompt หลัก

ฉากและชิ้นส่วน (ใส่หน้าทุก prompt):

```
epic fantasy game key art, semi-realistic cinematic matte painting, AAA fantasy gacha quality,
warm dusk light from the upper right, soft violet and gold sky tones, rich detail, clean readable shapes
```

ลายผิวตำรา (ใช้แทน prompt ข้างบน):

```
game texture, perfectly flat orthographic front view, evenly lit, no perspective, no shadow,
the object fills the whole image edge to edge, high detail, semi-realistic painterly
```

VFX:

```
fantasy game VFX sprite sheet, 4 columns x 3 rows grid, 12 animation frames read left-to-right,
top-to-bottom, additive glow light, pure black background, same center point every frame,
no text, no grid lines, no numbers
```

ใส่ท้ายทุก prompt (ห้าม):

```
not cartoon, not chibi, no pastel colors, no swirly cotton-candy clouds, not a photo,
no dark gothic hall, no stone pillars, no text, no letters, no logo, no characters
```

---

## ชุด 1 — ตำราวีรชน ⭐ สำคัญสุด (ตัวเอกของฉาก)

สัดส่วนหน้าตำรา **1 : 1.4** (กว้าง : สูง) ทุกไฟล์ในชุดนี้ต้องเป็นสัดส่วนเดียวกัน

| ชื่อไฟล์ | ขนาด | คืออะไร | prompt เพิ่ม |
|---|---|---|---|
| `book_cover_front.png` | 1024 × 1434 | ปกหน้า | `the front cover of an ancient grimoire: deep oxblood-brown aged leather, an engraved champagne-gold border, ornate gold metal corner guards, a central gold emblem of a radiant four-pointed star inside two concentric rune circles, subtle wear and scratches` |
| `book_cover_inside.png` | 1024 × 1434 | ด้านในปก | `the inside of an old book cover: marbled endpaper in deep violet and gold swirls, framed by a thin gold-tooled leather turn-in at the edges` |
| `book_page_a.png` · `book_page_b.png` · `book_page_c.png` | 1024 × 1434 | หน้ากระดาษ 3 แบบ (ใช้สลับกันตอนพลิกหน้า) | `a single aged parchment page, warm ivory with darker worn edges and a few faint stains, very faint old handwritten lines and a small faded diagram` (แต่ละแบบเปลี่ยนรายละเอียด: a = เส้นลายมือ, b = แผนภาพวงกลมจาง ๆ, c = ภาพร่างดาวจาง ๆ) · **ต้องจางมาก** เพราะหมึกเรืองแสงจะเขียนทับ |
| `book_page_blank.png` | 1024 × 1434 | หน้ากลางที่อักษรเขียนทับ | เหมือน page_a แต่**ไม่มีลายมือเลย** ตรงกลางโล่ง |
| `book_page_edge.png` | 1434 × 160 | ขอบปึกกระดาษด้านข้าง | `the side edge of a thick stack of old parchment pages seen straight on, thin uneven layered lines, gilded gold edge` |
| `book_reference.png` *(อ้างอิง ไม่ใช้ในเกม)* | 2048 × 2048 | ภาพตำราปิดบนแท่น มุมกล้องเดียวกับฉาก | `the closed grimoire lying on a white marble altar, seen from slightly above` (ใช้เทียบให้ลายผิวทุกไฟล์เข้าชุดกัน) |

**สิ่งที่โค้ดทำเอง:**
- ห่อลายผิวเป็นหนังสือ 3 มิติ (สันหนังสืออยู่กับที่)
- ปกเปิดไปทางซ้าย
- หน้ากระดาษโค้งตอนพลิก และเงาบนหน้ากระดาษ
- ลมและเศษแสงที่พัดผ่าน

## ชุด 2 — อักษรโบราณ (แผ่นออกแบบ)

| ชื่อไฟล์ | ขนาด | คืออะไร | prompt เพิ่ม |
|---|---|---|---|
| `glyph_reference.png` | 2048 × 2048 ดำสนิท | อักษรโบราณประจำเอลเดอร์เวย์น 25 ตัว (กริด 5 × 5) | `a design sheet of 25 invented ancient magical runes in a 5 x 5 grid, each rune drawn with 2 to 4 elegant calligraphic strokes, thin white lines on pure black, mix of straight stems, sweeping curves, small hooks and tiny rings, consistent style like one alphabet, not resembling any real alphabet` |

Claude จะวาดตัวอักษรเหล่านี้ใหม่เป็นเส้นเวกเตอร์พร้อมลำดับการเขียน ส่วนแสงเรืองของหมึกและการเปลี่ยนเป็นสีทองทำในโค้ด จึงไม่ต้องขอภาพแสงของตัวอักษร

## ชุด 3 — วิหารลอยฟ้า (ฉาก)

> **ยกเลิกแล้ว (2026-11-21):** ห้องอัญเชิญเปลี่ยนเป็น "หอดาราจารึก" ดู [SUMMON_ARCHIVE_ART_SPEC.md](SUMMON_ARCHIVE_ART_SPEC.md) · ชุด 1, 2 และ 4 ยังใช้ต่อ

มุมกล้องหลัก (SC01–SC05) เป็นระดับสายตาที่สูงกว่าแท่นเล็กน้อย แท่นอยู่กลางภาพ ตอนเริ่มกล้องเห็นทั้งลาน แล้วซูมเข้าหาตำรา 2.5–3.3 เท่า **ทุกเลเยอร์ของมุมนี้ต้องใช้มุมกล้องและเส้นขอบฟ้าเดียวกัน** (ขอบฟ้าอยู่ประมาณ 40 % จากบน)

| ชื่อไฟล์ | ขนาด | พื้นหลัง | คืออะไร | prompt เพิ่ม |
|---|---|---|---|---|
| `sky_dusk.png` | 4096 × 2304 | เต็มภาพ | ท้องฟ้า (ชั้นไกลสุด) | `a vast dusk sky above a sea of clouds, violet and gold sunset, soft god rays from the upper right, a few stars at the top, no islands, no ground` |
| `cloud_sea.png` | 4096 × 1200 | โปร่งใส ด้านบน | ทะเลเมฆที่ขอบฟ้า **ต่อซ้าย-ขวาได้** | `a seamless horizontal band of a sunset cloud sea seen from above, lit gold on top, violet in the shadows, tileable left to right` |
| `far_islands.png` | 3200 × 1000 | โปร่งใส | เกาะลอยไกล ๆ 3–4 เกาะในหมอก | `three or four distant floating islands with white towers and waterfalls, hazy and soft from distance` · ตัวไหนใช้ภาพ Sky City เดิมได้จะใช้แทน |
| `shrine_platform.png` | 4096 × 2304 | โปร่งใส | ลานหินอ่อนลอยฟ้า + แท่นวางตำรา (**ยังไม่มีตำรา**) | `a round white marble shrine platform floating in the sky, inlaid concentric gold rune rings on the floor, small flower beds along the rim, a rocky floating-island underside fading into mist, in the center a white marble altar pedestal with gold trim and a flat empty top, no book, no columns, no roof` |
| `shrine_low_angle.png` | 3200 × 1800 | เต็มภาพ | มุมกล้องที่ตัดไปตอน SC05–06 (มองต่ำขึ้นฟ้า) | `a low camera angle from the edge of the marble shrine looking up into a huge dusk sky, the altar small at the bottom center, distant floating islands on both sides, plenty of open sky in the upper half for a pillar of light` (ห้ามวาดเสาแสง) |
| `crystal_shard.png` | 512 × 1024 | โปร่งใส | คริสตัลลอยรอบวิหาร (โค้ดใช้ซ้ำหลายชิ้น) | `a single floating elongated crystal shard, pale blue and white, softly glowing inside, vertical` |

**สิ่งที่โค้ดทำเอง:** ละอองแสงลอย การลอยขึ้นลงของคริสตัลและเกาะ และการเลื่อนของทะเลเมฆ

## ชุด 4 — VFX

| ชื่อไฟล์ | กริด / ช่อง | ใช้ตอน | prompt เพิ่ม |
|---|---|---|---|
| `fx_blackhole_charge.png` | 4 × 3 · 512 × 512 | SC02 ตำราดูดแสง | `a small black hole forming: frames 1-3 a faint ring of white-blue light appears, 4-9 the ring spins faster and shrinks around a growing dark core with light streaks spiraling inward, 10-12 the ring is tight, bright and trembling` |
| `fx_blackhole_loop.png` | 4 × 2 · 512 × 512 | ค้างระหว่างชาร์จ | `a tight spinning ring of white-blue light around a dark core, light streaks spiraling inward, loopable` |
| `fx_book_burst.png` | 4 × 3 · 1024 × 1024 | SC03 ระเบิดเปิดตำรา | `a burst of white-blue light: frames 1-2 a blinding point, 3-6 a radial explosion with a flat shockwave ring and shards of light, 7-12 drifting sparks and light fragments fade out` |
| `fx_light_pillar_blue.png` · `fx_light_pillar_gold.png` | 4 × 2 · 512 × 1024 (แนวตั้ง) | SC05–06 เสาแสง | `a tall vertical pillar of light from the bottom to the top edge, bright white core, soft rising particles inside, loopable` + `white-blue` / `rich gold with faint rainbow fringes` |
| `fx_orb_to_card.png` | 4 × 3 · 512 × 512 | SC06 ดวงแสงกลายเป็นการ์ด | `an orb of light blooms into a tall glowing rectangle of light in a 2:3 card shape: frames 1-3 bright orb, 4-8 it stretches into the card silhouette, 9-12 the glow fades leaving a soft rim` |

**สิ่งที่โค้ดทำเอง:**
- เส้นแสงที่ถูกดูดเข้าหาตำรา และการมืดลงของขอบจอ
- แสงเรืองของหมึก จุดแสงที่ปลายปากกา และแสงที่ลอยออกจากตัวอักษร
- แสงวาบตอนตัดมุมกล้อง
- ประกายเลื่อมบนการ์ด 3★ และข้อความ "แตะเพื่ออัญเชิญ" (ตัวหนังสือลอยเรืองแสง)

---

## ลำดับเวลา (นับจากตอนแตะ, ปรับได้ในโค้ด)

| ช่วง | ฉาก | ภาพที่ใช้ |
|---|---|---|
| ก่อนแตะ | SC01 ภาพกว้าง → ซูมเข้าหาตำราที่ปิดอยู่ทางขวาของแท่น **ปกยังไม่มีแสง** | ชุด 3 ทั้งหมด + `book_cover_front` + `book_page_edge` |
| 0.00–1.35 วิ | SC02 ชาร์จแบบหลุมดำ กล้องซูมเข้าช้า ๆ และสั่นแรงขึ้น | `fx_blackhole_charge` → `fx_blackhole_loop` |
| 1.35 วิ | SC03 ระเบิด ปกเปิดไปทางซ้าย | `fx_book_burst` + `book_cover_inside` |
| 1.65–3.40 วิ | หน้ากระดาษพลิกรัวแล้วหยุดที่หน้ากลาง | `book_page_a/b/c` → `book_page_blank` |
| 3.50–5.20 วิ | SC04 อักษรเขียนตัวเองด้วยหมึกเรืองแสง (3★ หมึกเปลี่ยนเป็นทองที่ประมาณ 4.05 วิ) | ตัวอักษรเวกเตอร์ (จาก `glyph_reference`) |
| 5.20–5.60 วิ | SC05 อักษรสว่างวาบ แสงลอยออกจากตัวอักษรรวมเป็นเสาแสง | `fx_light_pillar_*` |
| 5.60 วิ | แสงวาบแล้วตัดเป็นมุมกล้องต่ำ | `shrine_low_angle` + `sky_dusk` |
| 5.95–7.10 วิ | SC06 ดวงแสงออกจากเสาแสง กลายเป็นการ์ด | `fx_orb_to_card` + หลังการ์ดเดิม |

## ลำดับการส่ง

1. **ชุด 1 ตำรา** (7 ไฟล์ + อ้างอิง 1): เห็นผลชัดที่สุด และเป็นจุดที่โค้ดต้องทดสอบการห่อลายผิวก่อน
2. **ชุด 2 อักษร** (1 ไฟล์)
3. **ชุด 3 วิหาร** (6 ไฟล์)
4. **ชุด 4 VFX** (6 ไฟล์)

> **เคล็ดลับการ gen ให้เข้าชุดกัน:**
> - gen `book_reference.png` ก่อน แล้วแนบเป็น style reference ตอน gen ลายผิวทุกไฟล์ (`same book and materials as the reference image`)
> - gen `shrine_platform.png` ก่อน `sky_dusk` / `shrine_low_angle` แล้วแนบเป็น reference เหมือนกัน
