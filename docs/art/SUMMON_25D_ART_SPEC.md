# สเปกภาพ: ฉากอัญเชิญ 2.5D "หอดาราจารึก"

> ผู้ใช้ 2026-11-22: ไม่เอา 3D เต็มรูปแบบ ให้รู้สึกเป็น 2.5D ที่มีความลึก แบบคลิปตัวอย่าง (ฉากภาพวาดที่ขยับได้จริง)
> สเปกนี้ใช้แทนการสร้างห้องเป็นรูปทรง 3 มิติใน [SUMMON_ARCHIVE_ART_SPEC.md](SUMMON_ARCHIVE_ART_SPEC.md) · ชิ้นส่วนที่ส่งมาแล้ว (แอสโตรเลบ ปก/สันหนังสือลอย ฟ้าดาว เปลวเทียน VFX) ยังใช้ต่อ

## สถานะ

- **2026-11-22 อนุมัติแล้ว:** `a_full.png` (1672 × 941) และ `book_cover_front.png` (1060 × 1484) อยู่ใน `assets/ui/summon-25d/`
- `book_cover_trace.png` **ไม่ต้องทำ:** Claude ดึงเส้นทองจากปกได้เองอัตโนมัติ (ลายทองตัดกับหนังดำชัด)
- ก่อนแยกชั้นฉาก A ให้ขยาย `a_full.png` อย่างน้อย 2 เท่าด้วยตัวขยายภาพ AI ก่อน แล้วแยกทุกชั้นจากภาพที่ขยายแล้ว
- ต่อไป: ชั้นของฉาก A + ชิ้นที่เหลือของตำรา (ด้านในปก หน้ากระดาษ ขอบ สัน)

## หลักการ 2.5D

- **ฉาก = ภาพวาดหลายชั้นซ้อนกัน** วาดจากมุมกล้องเดียวกัน แต่แยกตามระยะ (ไกล → ใกล้) แล้วโค้ดวางแต่ละชั้นไว้คนละระยะ
- **กล้องขยับนิดเดียว** (เลื่อน/ซูมช้า ๆ) ชั้นใกล้จะเลื่อนมากกว่าชั้นไกล จึงเห็นความลึกโดยไม่ต้องมีห้อง 3 มิติ และภาพไม่ยืดแบบรอบก่อน
- **ของที่ต้องขยับเองแยกเป็นชิ้น:** ตำรา แอสโตรเลบ ฟ้าในช่องฟ้า แสงจันทร์ เปลวเทียน ละออง
- **ตำราเป็นวัตถุชิ้นเดียวที่เป็น 3D** (บาง ๆ แบบหนังสือจริง) เพราะต้องเปิดปกและพลิกหน้า
- **เอฟเฟกต์ใช้ภาพวาด VFX** ไม่วาดเส้นด้วยโค้ด (ผู้ใช้ติว่ารอบก่อนดูเป็นเส้นโค้ด)

## ลำดับฉาก (ตามที่ผู้ใช้กำหนด)

| ช่วง | ฉาก | เกิดอะไร |
|---|---|---|
| ก่อนแตะ | **A ห้องกว้าง** | ฉากมีชีวิต: ตำราลอยขึ้นลงเบา ๆ บนแท่น, ฟ้าในช่องฟ้าเลื่อน, แสงจันทร์ส่ายช้า ๆ, แอสโตรเลบหมุน, เทียนไหว, ละอองลอย · ข้อความ "แตะเพื่ออัญเชิญ" ลอยในวงแหวน |
| 0–0.9 วิ | A → ซูมเข้าตำรา | กล้องเคลื่อนเข้าหาตำรา ชั้นหน้าเลื่อนผ่านกล้อง |
| 0.5–1.8 วิ | **B ใกล้ตำรา** | **แสงทองไล่ตามเส้นลวดลายและอักขระบนปก** จากตรากลางออกไปจนทั่วปก แล้วทั้งปกสว่างวาบ |
| 2.0 วิ | B | ระเบิดเปิดตำรา (เหมือนเดิม) ปกเปิดไปทางซ้าย |
| 2.0–3.8 วิ | B | หน้ากระดาษพลิกรัวไปหยุดหน้ากลาง |
| 3.9–6.3 วิ | B | อักขระตัวเล็ก ๆ เขียนตัวเองเต็มทั้งสองหน้า (3★ หมึกเป็นทอง) |
| 6.3–6.9 วิ | B | แสงทองระเบิดจากหน้ากระดาษ รวมเป็นเสาแสง |
| 6.9 วิ | แสงวาบ ตัดภาพ | |
| 6.9–8.5 วิ | **C มุมต่ำ** | มองจากพื้นทะลุชั้นหนังสือขึ้นไปถึงช่องฟ้า เสาแสงพุ่งผ่านกลาง แตกเป็นแสงที่ช่องฟ้า |
| 7.3–9.0 วิ | C | ดวงแสงหล่นจากเสาแสง แต่ละดวงบานเป็นการ์ดเรียงกันทีละใบ (เหมือนเวอร์ชัน 3D) |

## กติกาไฟล์

| ประเภท | พื้นหลัง | หมายเหตุ |
|---|---|---|
| **ชั้นฉาก** | ชั้นไกลสุด = เต็มภาพ · ชั้นอื่น = **โปร่งใส PNG alpha** | ทุกชั้นของฉากเดียวกัน **ต้องมุมกล้อง ขอบฟ้า และขนาดเท่ากันทุกพิกเซล** (gen ภาพรวมก่อน แล้วแยกชั้นจากภาพรวมด้วย image edit) · ขยายขอบเกินกรอบ 6 % ทุกด้าน เผื่อกล้องเลื่อน |
| **ลายผิวตำรา** | เต็มภาพ | มุมตรงแบนเหมือนสแกน แสงสม่ำเสมอ ขอบภาพ = ขอบชิ้นงาน |
| **VFX** | **ดำสนิท #000000** | กริดตามตาราง จุดศูนย์กลางเดียวกันทุกเฟรม ไม่มีตัวเลขหรือเส้นกริด · ลูป: เฟรมสุดท้ายต่อกลับเฟรมแรก |

- ห้ามมีตัวหนังสือ ตัวละคร หรือโลโก้
- **ชั้นฉากห้ามมีตำราและแอสโตรเลบ** (โค้ดใส่เอง) ให้แท่นว่างไว้
- ต้นฉบับเก็บที่ `assets/ui/summon-25d/` (อ่านอย่างเดียว)

### วิธี gen ให้ชั้นตรงกัน (สำคัญ)

1. gen ภาพรวมของฉากก่อน 1 ภาพ (`*_full.png`) แล้วผู้ใช้อนุมัติ
2. ใช้ image edit กับภาพรวมนั้น สั่งลบส่วนที่ไม่ใช่ชั้นนั้นให้โปร่งใส ทีละชั้น เช่น `keep only the left foreground bookshelf and candelabra, make everything else transparent, do not move or redraw anything`
3. ชั้นที่อยู่หลังของชิ้นอื่น ให้สั่ง `fill in the area hidden behind the removed foreground` เพื่อไม่ให้มีรูตอนกล้องเลื่อน

### Prompt หลัก (ใส่หน้าทุก prompt ของฉาก)

```
epic fantasy game key art, semi-realistic painterly, AAA fantasy gacha quality,
the Astral Archive: a colossal round library tower at night, tiers of curved bookshelves with gold-railed balconies,
deep indigo and violet shadows, warm candlelight, champagne gold, cool silver-blue moonlight from a round star oculus
```

ใส่ท้ายทุก prompt (ห้าม):

```
not cartoon, not chibi, not a photo, no text, no letters, no logo, no characters, no people,
no book on the lectern, no astrolabe
```

---

## ฉาก A — ห้องกว้าง (ก่อนแตะ + ซูมเข้าตำรา)

มุมกล้อง: ระดับสายตาสูงกว่าแท่นเล็กน้อย มองตรงเข้าแท่นกลางห้อง · แท่นอยู่กึ่งกลาง ด้านบนของแท่นอยู่ราว 60 % จากบน · เห็นชั้นหนังสือรอบห้องและช่องฟ้าที่ขอบบน (คล้าย `archive_reference.png` แต่แท่นว่างและไม่มีแอสโตรเลบ)

| ชื่อไฟล์ | ขนาด | ชั้น | คืออะไร / prompt เพิ่ม |
|---|---|---|---|
| `a_full.png` | 3840 × 2160 | อ้างอิง | ภาพรวมของฉาก `wide shot of the empty central marble lectern under the oculus, the lectern top is flat and empty` |
| `a_sky.png` | 3840 × 1200 | 0 ไกลสุด | ฟ้าที่เห็นผ่านช่องฟ้า **กว้างกว่าช่อง** ให้เลื่อนได้ `a night sky with dense stars and a soft violet-blue nebula, seen at a steep upward angle` |
| `a_back.png` | 3840 × 2160 | 1 | ผนังชั้นหนังสือไกล + โดม + **ช่องฟ้าโปร่งใส** |
| `a_mid.png` | 3840 × 2160 | 2 โปร่งใส | ระเบียงและราวทองช่วงกลาง ซ้าย-ขวา (ส่วนที่ใกล้กว่าผนังไกล) |
| `a_floor.png` | 3840 × 2160 | 3 โปร่งใส | พื้นหินอ่อนขัดเงา + วงรูนทองรอบแท่น (ครึ่งล่างของภาพ) |
| `a_lectern.png` | 3840 × 2160 | 4 โปร่งใส | แท่นหินอ่อนขอบทอง **ว่าง** พร้อมเงาบนพื้น |
| `a_fore_left.png` · `a_fore_right.png` | 3840 × 2160 | 5 ใกล้สุด โปร่งใส | ชั้นหนังสือ/เสา/เชิงเทียนที่อยู่ใกล้กล้องที่ขอบซ้ายและขวา (จะถูกเบลอให้ดูใกล้) |
| `a_lectern_hd.png` | 4096 × 2304 | 4 ฉบับละเอียด | ครอปเฉพาะส่วนบนของแท่น (ภาพเดียวกับ `a_lectern` ส่วนบน) ใช้ตอนซูมใกล้ ไม่ให้ภาพแตก |

## ฉาก C — มุมต่ำมองทะลุหอขึ้นฟ้า

มุมกล้อง: อยู่บนพื้นใกล้แท่น มองเงยขึ้นเกือบตรง เห็นชั้นหนังสือเป็นวงซ้อนขึ้นไปจนถึงช่องฟ้ากลางภาพด้านบน (เหมือนมุมต่ำของเวอร์ชัน 3D)

| ชื่อไฟล์ | ขนาด | ชั้น | คืออะไร / prompt เพิ่ม |
|---|---|---|---|
| `c_full.png` | 3840 × 2160 | อ้างอิง | `extreme low angle looking straight up the inside of the round library tower, concentric rings of bookshelf balconies rising to a round star oculus near the top center` |
| `c_sky.png` | 2048 × 2048 | 0 | ฟ้าดาวที่เห็นผ่านช่องฟ้า (ใช้ `oculus_sky.png` เดิมได้ ถ้าโทนเข้ากัน) |
| `c_upper.png` | 3840 × 2160 | 1 โปร่งใส | ชั้นบน ๆ + ขอบช่องฟ้า (ช่องโปร่งใส) |
| `c_lower.png` | 3840 × 2160 | 2 โปร่งใส | ชั้นล่าง ๆ ที่ใกล้กล้อง ตรงกลางเปิดให้เห็นชั้นบน |
| `c_fore.png` | 3840 × 2160 | 3 ใกล้สุด โปร่งใส | ขอบแท่นและพื้นที่ขอบล่างของภาพ |

## ตำราใหม่ — ลวดลายโบราณแบบขลัง ๆ

สัดส่วนหน้า **1 : 1.4** เหมือนเดิม · ทุกไฟล์ต้องเป็นเล่มเดียวกัน

| ชื่อไฟล์ | ขนาด | คืออะไร | prompt |
|---|---|---|---|
| `book_cover_front.png` | 1536 × 2150 | ปกหน้า | `the front cover of an ancient arcane grimoire, perfectly flat front view, evenly lit: aged midnight-black leather, an intricate inlaid champagne-gold filigree of interlocking arcane circles, a central sigil of a star inside nested rune rings, borders of small engraved ancient runes running around the edges, fine gold lines connecting the circles like a star chart, worn gold corner guards, a gold clasp on the right edge, mysterious and sacred` |
| `book_cover_trace.png` | 1536 × 2150 | **เส้นสำหรับแสงทองไล่** | image edit จากปกหน้า: `turn this into a mask: only the gold engraved lines, runes and filigree as pure white on pure black, keep the exact same composition, do not redraw` · ถ้าได้ไม่ตรง Claude จะดึงเส้นทองจากปกเอง |
| `book_cover_inside.png` | 1536 × 2150 | ด้านในปก | `inside of an ancient grimoire cover: dark marbled endpaper in midnight blue and gold, a thin gold-tooled leather turn-in at the edges, flat front view` |
| `book_page_a.png` · `_b` · `_c` | 1536 × 2150 | หน้ากระดาษพลิก 3 แบบ | `a single aged vellum page, warm ivory with darker worn edges, very faint old ruled lines and a faded circular diagram, flat front view` (ต้องจางมาก) |
| `book_page_blank.png` | 1536 × 2150 | หน้ากลางที่อักขระจะเขียนทับ | เหมือน page_a แต่ไม่มีลายเลย |
| `book_page_edge.png` | 2150 × 200 | ขอบปึกกระดาษ | `the gilded edge of a thick stack of old vellum pages seen straight on, fine uneven layers, gold leaf edge` |
| `book_spine.png` | 300 × 2150 | สันหนังสือ | `the spine of the same grimoire, black leather with raised bands and gold rune tooling, flat front view` |

**สิ่งที่โค้ดทำเอง:** แสงทองไล่ตามเส้นของ `book_cover_trace` จากตรากลางออกไป, ห่อลายผิวเป็นหนังสือ, เปิดปก, พลิกหน้า, เขียนอักขระตัวเล็กเต็มหน้า (ใช้แผ่นอักษรเดิม)

## VFX ที่ต้องเพิ่ม

| ชื่อไฟล์ | กริด / ช่อง | ใช้ตอน | prompt เพิ่ม |
|---|---|---|---|
| `fx_moonlight.png` | 4 × 2 · 512 × 1024 | ฉาก A แสงจันทร์ส่าย (ลูป) | `soft volumetric moonlight god rays falling diagonally from the top, silver-blue, gently shifting, loopable` |
| `fx_gold_burst.png` | 4 × 3 · 1024 × 1024 | ระเบิดเปิดตำรา + ระเบิดจากหน้ากระดาษ | `a burst of warm gold light: frames 1-2 a blinding point, 3-6 a radial explosion with a flat shockwave ring and gold shards, 7-12 drifting gold sparks fade out` |
| `fx_cover_flash.png` | 4 × 2 · 1024 × 1024 | ทั้งปกสว่างวาบหลังแสงไล่ครบ | `a flat rectangular flash of gold light with a soft bloom, flaring then fading, loopable is not needed` |
| `fx_oculus_flare_gold.png` | 4 × 3 · 1024 × 1024 | ฉาก C เสาแสงถึงช่องฟ้า | เหมือน `fx_oculus_flare.png` เดิม แต่สีทอง |

ใช้ของเดิมต่อ: `fx_candle_flame`, `fx_page_wisp`, `pillar_blue/gold`, `orb_card`, แผ่นอักษร `glyph_reference`, ชิ้นแอสโตรเลบ, ปก/สันหนังสือลอย

## ลำดับการส่ง

1. `a_full.png` + `book_cover_front.png` ให้ผู้ใช้อนุมัติหน้าตาก่อน
2. ชั้นของฉาก A + ตำราใหม่ทั้งชุด: Claude ทำฉากก่อนแตะจนถึงพลิกหน้า/เขียนอักขระได้เลย
3. ฉาก C
4. VFX ใหม่
