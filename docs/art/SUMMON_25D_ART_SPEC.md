# สเปกภาพ: ฉากอัญเชิญ 2.5D "หอดาราจารึก"

> ผู้ใช้ 2026-11-22: ไม่เอา 3D เต็มรูปแบบ ให้รู้สึกเป็น 2.5D ที่มีความลึก แบบคลิปตัวอย่าง (ฉากภาพวาดที่ขยับได้จริง)
> สเปกนี้ใช้แทนการสร้างห้องเป็นรูปทรง 3 มิติใน [SUMMON_ARCHIVE_ART_SPEC.md](SUMMON_ARCHIVE_ART_SPEC.md) · ชิ้นส่วนที่ส่งมาแล้ว (แอสโตรเลบ ปก/สันหนังสือลอย ฟ้าดาว เปลวเทียน VFX) ยังใช้ต่อ

## สถานะ

- **2026-11-22 อนุมัติแล้ว:** `a_full.png` (1672 × 941) และ `book_cover_front.png` (1060 × 1484) อยู่ใน `assets/ui/summon-25d/`
- `book_cover_trace.png` **ไม่ต้องทำ:** Claude ดึงเส้นทองจากปกได้เองอัตโนมัติ (ลายทองตัดกับหนังดำชัด)
- ก่อนแยกชั้นฉาก A ให้ขยาย `a_full.png` อย่างน้อย 2 เท่าด้วยตัวขยายภาพ AI ก่อน แล้วแยกทุกชั้นจากภาพที่ขยายแล้ว
- **2026-11-22 ลำดับใหม่ (ผู้ใช้):** ตำราไม่เปิดแล้ว · ตำราลอยเหนือแท่นใหญ่กลางหอ แตะแล้วซูมเข้าปก แสงค่อย ๆ ไล่ตามลวดลาย ตำราสั่น แล้วระเบิดแสงขึ้นฟ้า · สีแสงบอกผล 3 แบบ (ดูตารางลำดับ) · ต้นแบบ: claude.ai artifact Dj67mgsb9TRdCoZahUXQyz
- ต่อไป: **gen `a_full.png` ใหม่ให้แท่นอลังการ** (ภาพห้องที่อนุมัติไปใช้ได้ทุกอย่างยกเว้นแท่น) แล้วแยกชั้น + ปกหลัง/สัน/ขอบกระดาษ + VFX ระเบิดสองสี

## หลักการ 2.5D

- **ฉาก = ภาพวาดหลายชั้นซ้อนกัน** วาดจากมุมกล้องเดียวกัน แต่แยกตามระยะ (ไกล → ใกล้) แล้วโค้ดวางแต่ละชั้นไว้คนละระยะ
- **กล้องขยับนิดเดียว** (เลื่อน/ซูมช้า ๆ) ชั้นใกล้จะเลื่อนมากกว่าชั้นไกล จึงเห็นความลึกโดยไม่ต้องมีห้อง 3 มิติ และภาพไม่ยืดแบบรอบก่อน
- **ของที่ต้องขยับเองแยกเป็นชิ้น:** ตำรา แอสโตรเลบ ฟ้าในช่องฟ้า แสงจันทร์ เปลวเทียน ละออง
- **ตำราเป็นวัตถุชิ้นเดียวที่เป็น 3D** (บาง ๆ แบบหนังสือจริง) เพราะลอยหมุนช้า ๆ ให้เห็นความหนา · **ไม่เปิดปกแล้ว**
- **เอฟเฟกต์ใช้ภาพวาด VFX** ไม่วาดเส้นด้วยโค้ด (ผู้ใช้ติว่ารอบก่อนดูเป็นเส้นโค้ด)

## ลำดับฉาก (ตามที่ผู้ใช้กำหนด 2026-11-22)

| ช่วง | ฉาก | เกิดอะไร |
|---|---|---|
| ก่อนแตะ | **A ห้องกว้าง** | แท่นใหญ่กลางหอ ตำราลอยหมุนช้า ๆ เหนือแท่น ห้องมีชีวิต (ฟ้าในช่องฟ้าเลื่อน แสงจันทร์ส่าย เทียนไหว ละอองลอย) · ข้อความ "แตะเพื่ออัญเชิญ" |
| 0–1.0 วิ | A → ซูมเข้าปก | กล้องเคลื่อนเข้าหาปก ตำราค่อย ๆ หันหน้าเข้ากล้อง |
| 0.8–3.4 วิ | **B ใกล้ปก** | แสงไหล **ช้า ๆ และนุ่ม** จากตรากลางไปตามลวดลายทั่วปก · ละอองแสงลอยขึ้นจากปก · ลำแสงหมุนอยู่หลังตำรา |
| 3.3–4.0 วิ | B | ทั้งปกสว่างจ้า ตำราสั่นแรงขึ้นและยกตัว กล้องสั่น |
| 4.0 วิ | B | ระเบิดแสง เสาแสงพุ่งขึ้นฟ้า กล้องเงยตาม |
| 4.55 วิ | แสงวาบ ตัดภาพ | |
| 4.55–6.1 วิ | **C มุมต่ำ** | มองจากพื้นทะลุหอขึ้นฟ้า เสาแสงผ่านกลาง ดวงแสงหล่นแล้วบานเป็นการ์ด |

**สีแสงบอกผล (ใช้ทั้งเส้นที่ไล่ ละออง ลำแสง ระเบิด เสาแสง):**

| ผล | สีแสง |
|---|---|
| ไม่มี 3★ | **ขาวฟ้า** ตั้งแต่ต้นจนจบ |
| มี 3★ (ปกติ) | **ทอง** ตั้งแต่ต้นจนจบ |
| มี 3★ (แอ็กชัน 3 ลุ้น นาน ๆ ครั้ง) | เริ่ม **ขาวฟ้า** · พอแสงไล่ได้ครึ่งปก (≈ 2.1 วิ) **ระเบิดกลางปก** แล้วเส้นที่สว่างแล้วเปลี่ยนเป็น **ทอง** แผ่ออกจากตรากลาง และไล่ต่อเป็นทองจนจบ |

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
| `a_full.png` | 3840 × 2160 | อ้างอิง | **gen ใหม่ (แท่นอลังการ)** โดย image edit จาก `a_full.png` ที่อนุมัติ ให้ห้องเหมือนเดิมทุกอย่าง: `replace the central lectern with a grand ceremonial altar: a tiered round dais of white marble and gold, a ring of floating gold arcane circles and small glowing crystals around it, slender gold spires at its edge, a glowing magic seal on its top, and empty space above the altar where a book will float; keep the rest of the library exactly the same` |
| `a_sky.png` | 3840 × 1200 | 0 ไกลสุด | ฟ้าที่เห็นผ่านช่องฟ้า **กว้างกว่าช่อง** ให้เลื่อนได้ `a night sky with dense stars and a soft violet-blue nebula, seen at a steep upward angle` |
| `a_back.png` | 3840 × 2160 | 1 | ผนังชั้นหนังสือไกล + โดม + **ช่องฟ้าโปร่งใส** |
| `a_mid.png` | 3840 × 2160 | 2 โปร่งใส | ระเบียงและราวทองช่วงกลาง ซ้าย-ขวา (ส่วนที่ใกล้กว่าผนังไกล) |
| `a_floor.png` | 3840 × 2160 | 3 โปร่งใส | พื้นหินอ่อนขัดเงา + วงรูนทองรอบแท่น (ครึ่งล่างของภาพ) |
| `a_altar.png` | 3840 × 2160 | 4 โปร่งใส | แท่นอลังการ (ไม่มีตำรา) พร้อมเงาบนพื้น |
| `a_fore_left.png` · `a_fore_right.png` | 3840 × 2160 | 5 ใกล้สุด โปร่งใส | ชั้นหนังสือ/เสา/เชิงเทียนที่อยู่ใกล้กล้องที่ขอบซ้ายและขวา (จะถูกเบลอให้ดูใกล้) |
| `a_altar_hd.png` | 4096 × 2304 | 4 ฉบับละเอียด | ครอปเฉพาะส่วนบนของแท่น (ภาพเดียวกับ `a_altar` ส่วนบน) ใช้ตอนซูมใกล้ ไม่ให้ภาพแตก |
| `a_altar_ring.png` | 2048 × 2048 | แยกชิ้น โปร่งใส | วงเวททองรอบแท่น (มองตรง) ให้โค้ดหมุนได้ `a flat ornate gold arcane ring with runes, seen straight on, transparent center and outside` |

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

สัดส่วนหน้า **1 : 1.4** · ปกหน้าอนุมัติแล้ว · ตำราไม่เปิด จึง **ไม่ต้องทำ** ด้านในปก หน้ากระดาษ และเส้น trace (ดึงจากปกเอง)

| ชื่อไฟล์ | ขนาด | คืออะไร | prompt |
|---|---|---|---|
| `book_cover_front.png` | 1060 × 1484 | ปกหน้า ✅ อนุมัติแล้ว | — |
| `book_cover_back.png` | 1060 × 1484 | ปกหลัง (เห็นตอนตำราหมุน) | image edit จากปกหน้า: `the back cover of the same grimoire: same black leather and corner guards, a simpler gold border and one small central star sigil, no clasp, flat front view` |
| `book_spine.png` | 300 × 1484 | สันหนังสือ | `the spine of the same grimoire, black leather with raised bands and gold rune tooling, flat front view` |
| `book_page_edge.png` | 1484 × 200 | ขอบปึกกระดาษ | `the gilded edge of a thick stack of old vellum pages seen straight on, fine uneven layers, gold leaf edge` |

**สิ่งที่โค้ดทำเอง:** ห่อลายผิวเป็นหนังสือ, ลอยหมุน, แสงไล่ตามลายทองบนปก (3 แบบสี), สั่น

## VFX ที่ต้องเพิ่ม

ทุกระเบิดต้องมี **สองสี: ขาวฟ้า และ ทอง** (ตั้งชื่อ `_blue` / `_gold`) ใช้ตามผล

| ชื่อไฟล์ | กริด / ช่อง | ใช้ตอน | prompt เพิ่ม |
|---|---|---|---|
| `fx_moonlight.png` | 4 × 2 · 512 × 1024 | ฉาก A แสงจันทร์ส่าย (ลูป) | `soft volumetric moonlight god rays falling diagonally from the top, silver-blue, gently shifting, loopable` |
| `fx_sky_burst_blue.png` · `_gold.png` | 4 × 3 · 1024 × 1024 | ตำราระเบิดแสงขึ้นฟ้า | `an epic upward burst of light from a single point: frames 1-2 a blinding core, 3-6 a radial explosion with a shockwave ring and a column of light shooting straight up, 7-12 sparks and light shards drift and fade` + `white-blue` / `rich gold` |
| `fx_upgrade_flare.png` | 4 × 3 · 1024 × 1024 | แอ็กชัน 3 เปลี่ยนเป็นทองกลางปก | `a gold flare bursting outward from a small blue-white point: a ring of gold fire expands and swallows the blue light, gold sparks spray out, then settles into a steady gold glow` |
| `fx_seal_rays_blue.png` · `_gold.png` | 4 × 2 · 1024 × 1024 | ลำแสงหมุนหลังตำราตอนแสงไล่และตอนสั่น (ลูป) | `radiant light rays from a center like a holy star, slowly rotating, soft edges, loopable` + สี |
| `fx_oculus_flare_gold.png` | 4 × 3 · 1024 × 1024 | ฉาก C เสาแสงถึงช่องฟ้า (ทอง) | เหมือน `fx_oculus_flare.png` เดิม แต่สีทอง · ของเดิมใช้กับสีฟ้า |

ใช้ของเดิมต่อ: `fx_candle_flame`, `pillar_blue/gold`, `orb_card`, ชิ้นแอสโตรเลบ

## ลำดับการส่ง

1. `a_full.png` แท่นอลังการ (image edit จากภาพเดิม) ให้ผู้ใช้อนุมัติก่อน
2. ชั้นของฉาก A (จากภาพที่ขยาย 2 เท่าแล้ว) + ปกหลัง / สัน / ขอบกระดาษ
3. VFX สองสี
4. ฉาก C
