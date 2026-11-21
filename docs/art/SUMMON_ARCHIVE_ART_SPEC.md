# สเปกภาพ: ห้องอัญเชิญ "หอดาราจารึก" (The Astral Archive)

> ผู้ใช้เลือกแบบ A จากหน้าคอนเซปต์ห้อง 3 แบบ (https://claude.ai/artifact/J1Lf2knztZkBWwLdzb2xrk) · 2026-11-21
> สเปกนี้ใช้แทน **ชุด 3 วิหารลอยฟ้า** ใน [SUMMON_BOOK_ART_SPEC.md](SUMMON_BOOK_ART_SPEC.md) · ชุด 1 ตำรา, ชุด 2 อักษร และชุด 4 VFX ที่ส่งมาแล้ว (Summon-Book-Complete-Art.zip) ใช้ต่อทั้งหมด ไม่ต้อง gen ใหม่

## ทำไมรอบนี้ขอภาพต่างจากเดิม

รอบก่อนฉากเป็นภาพวาดภาพเดียวที่โค้ดดันให้นูน (depth mesh) พอกล้องซูมหรือเปลี่ยนมุม ภาพก็ยังดูแบน ขอบยืด และมุมกล้องต่ำต้องใช้ภาพวาดอีกภาพแยกต่างหาก

รอบนี้**ห้องสร้างเป็น 3 มิติจริงในโค้ด (three.js)** แล้วขอภาพเป็น**ลายผิวกับชิ้นส่วน**มาห่อทับ:

- ชั้นหนังสือ = วงทรงกระบอกจริงหลายวง ซ้อนกันทั้งแนวสูงและแนวลึก ห่อด้วยลายชั้นหนังสือที่ต่อกันได้
- แท่นวางตำรา = ทรงกลึงจริง (ฐาน เสา บ่าวางหนังสือ) ห่อลายหินอ่อนและขอบทอง → มีเงาและแสงสะท้อนจริง ไม่แบนแล้ว
- แอสโตรเลบ = วงแหวนหลายวงหมุนแยกกันเป็น 3 มิติ
- หนังสือลอย = กล่องหนังสือจริงที่หมุนและบินวนได้
- **มุมกล้องต่ำตอนการ์ดออก = กล้องตัวเดิมย้ายลงไปจริง** ไม่ต้องมีภาพวาดมุมต่ำแยกแล้ว

ผล: ทุกมุมกล้องมีพาราแลกซ์และความลึกจริง แสงเทียน/แสงจากช่องฟ้าส่องโดนพื้นผิวจริง

## เรื่องและอารมณ์

- **เรื่อง:** หอสมุดทรงกลมสูงเสียดฟ้าของเอลเดอร์เวย์น ทุกเล่มบนชั้นคือเรื่องราวของวีรชนที่เคยถูกเรียกมา ตำราวีรชนตั้งอยู่กลางหอ ใต้แอสโตรเลบทองที่ลอยอยู่ บนยอดหอเป็นช่องเปิดรูปวงกลมที่เห็นฟ้าดาว
- **โทน:** ครามอมม่วงลึก ตัดกับแสงเทียนอุ่นและทองแชมเปญ แสงเย็นสีฟ้าเงินส่องลงมาจากช่องฟ้า
  - **มืดแบบมีแสงนำ ไม่ใช่ dark fantasy:** ไม้สีน้ำตาลอุ่น หนังสือหลากสี ทองเงางาม มีเทียนสว่างกระจายทั้งหอ ไม่มีโครงกระดูก ใยแมงมุม หรือหินดำหม่น
  - **สีของแสงสกิล:** ปกติขาวฟ้า และทองเฉพาะ 3★ (เหมือนเดิม โค้ดเปลี่ยนสีเอง)
- **สไตล์:** key art แฟนตาซีกึ่งสมจริง (semi-realistic painterly) ระดับเดียวกับ banner ฮีโร่ · ห้ามการ์ตูน ห้ามภาพถ่าย
- **สีหลัก:** `#14102A` ครามดำ · `#2A2250` ครามม่วง · `#5B4AA0` ม่วงแสง · `#C99A4A` ทอง · `#FFCF8D` แสงเทียน · `#9CCAFF` แสงฟ้าจากช่องฟ้า

## กติกาไฟล์

| ประเภท | พื้นหลัง | หมายเหตุ |
|---|---|---|
| **ภาพอ้างอิง** | เต็มภาพ | ไม่ใช้ในเกม ใช้แนบเป็น style reference ตอน gen ไฟล์อื่นทุกไฟล์ |
| **ลายผิวต่อกันได้ (tileable)** | เต็มภาพ | **มุมตรงแบนเหมือนสแกน** ไม่มีมุมเอียง ไม่มีเงาตก แสงสม่ำเสมอ · ขอบซ้ายต้องต่อกับขอบขวาได้เนียน (บางไฟล์ต่อบน-ล่างด้วย ดูตาราง) |
| **ชิ้นส่วน** | โปร่งใส PNG alpha (ถ้าทำไม่ได้ใช้ดำสนิท) | 1 ไฟล์ = 1 ชิ้น มุมตรงหน้า เว้นขอบประมาณ 6 % |
| **VFX** | **ดำสนิท #000000** | กริดตามตาราง จุดศูนย์กลางเดียวกันทุกเฟรม ห้ามมีตัวเลข ป้าย เส้นกริด |

- ห้ามมีตัวหนังสือ ตัวละคร หรือโลโก้ในทุกไฟล์ (สันหนังสือมีลายทองได้ แต่ห้ามเป็นตัวอักษรที่อ่านได้)
- ตั้งชื่อไฟล์ตามตาราง รวมเป็น ZIP ทยอยส่งเป็นชุดได้ · ต้นฉบับจะเก็บที่ `assets/ui/summon-archive/` (อ่านอย่างเดียว)

### Prompt หลัก

ภาพอ้างอิงและชิ้นส่วน (ใส่หน้าทุก prompt):

```
epic fantasy game art, semi-realistic painterly, AAA fantasy gacha quality,
a grand circular astral library at night, deep indigo and violet shadows,
warm candlelight and polished champagne gold, cool silver-blue moonlight from above, rich detail
```

ลายผิว (ใช้แทน prompt ข้างบน):

```
game texture, perfectly flat orthographic front view, evenly lit, no perspective, no cast shadow,
fills the whole image edge to edge, seamless tileable, semi-realistic painterly, high detail,
deep indigo, warm wood and champagne gold palette
```

VFX: ใช้ prompt VFX เดิมใน SUMMON_BOOK_ART_SPEC.md

ใส่ท้ายทุก prompt (ห้าม):

```
not cartoon, not chibi, not a photo, no pastel colors, no skulls, no cobwebs, no grim gothic ruin,
no text, no readable letters, no logo, no characters, no people
```

---

## ชุด A — ภาพอ้างอิง ⭐ gen อันนี้ก่อน

| ชื่อไฟล์ | ขนาด | คืออะไร | prompt เพิ่ม |
|---|---|---|---|
| `archive_reference.png` | 3840 × 2160 | ภาพคอนเซปต์ทั้งหอ (ไม่ใช้ในเกม) | `interior of a colossal circular library tower, spiraling tiers of curved bookshelves rising toward an open round oculus full of stars, carved dark wood balconies with gold railings, hundreds of books with gold-tooled spines, floating candles, a golden astrolabe of several nested rings hovering above a central white marble lectern with an ancient closed book, a glowing gold rune circle inlaid in the marble floor, volumetric moonlight falling from the oculus, camera at eye level a little above the lectern, wide shot` |

ใช้ภาพนี้เป็น style reference ตอน gen ไฟล์อื่นทุกไฟล์ (`same library, same materials and lighting as the reference image`) เพื่อให้ทุกชิ้นเข้าชุดกัน

## ชุด B — ลายผิวของห้อง (ห่อลงรูปทรง 3 มิติ)

| ชื่อไฟล์ | ขนาด | ต่อกัน | ห่อลงบน | prompt เพิ่ม |
|---|---|---|---|---|
| `shelf_wall.png` | 2048 × 1024 | ซ้าย-ขวา | ผนังชั้นหนังสือทุกวง (ทรงกระบอก) | `the straight-on front of a tall wooden bookshelf section: three rows of shelves packed with old leather books of mixed heights, deep red, indigo, forest green and brown covers with gold-tooled spines, a few books lying flat, a small brass candle holder on one shelf, carved dark wood uprights with thin gold inlay` |
| `shelf_wall_alt.png` | 2048 × 1024 | ซ้าย-ขวา | สลับกับไฟล์บนเพื่อไม่ให้ซ้ำตา | เหมือนข้างบน แต่จัดหนังสือต่างกัน มีกล่องม้วนคัมภีร์ ลูกโลกทองเหลืองเล็ก ๆ และขวดหมึก |
| `balcony_rail.png` | 2048 × 512 | ซ้าย-ขวา · **โปร่งใส** | ราวระเบียงหน้าชั้นทุกวง | `an ornate balcony railing seen straight on: dark carved wood handrail with champagne-gold balusters in an elegant repeating pattern, transparent gaps between balusters` |
| `ledge_trim.png` | 2048 × 256 | ซ้าย-ขวา | ขอบพื้นระเบียง/ใต้ชั้นแต่ละวง | `a carved dark wood ledge trim with a gold molding line and a small repeating star motif, front view` |
| `pillar_wood.png` | 512 × 2048 | บน-ล่าง | เสาไม้คั่นระหว่างช่วงชั้น | `a tall carved dark wood pilaster with spiral gold inlay and small star rosettes, front view` |
| `floor_marble.png` | 2048 × 2048 | ไม่ต่อ | พื้นกลางหอ (มองตรงจากบน) | `a round floor seen exactly from straight above: white and pale grey marble with soft veins, an inlaid ring of champagne gold runes and star points around the center, darker polished marble toward the outer edge, the center is plain marble where the lectern stands` · วงกลางรูนต้องอยู่**กลางภาพพอดี** |
| `marble_white.png` | 1024 × 1024 | ทุกทิศ | แท่นวางตำรา (โค้ดกลึงเป็นทรง) | `polished white marble with faint grey and gold veins, slight luster` |
| `gold_trim.png` | 1024 × 128 | ซ้าย-ขวา | ขอบทองของแท่นและแอสโตรเลบ | `a band of polished champagne gold with an engraved repeating rune and star pattern, front view` |
| `dome_ceiling.png` | 2048 × 2048 | ไม่ต่อ · **วงกลางโปร่งใส** | โดมเพดาน (มองตรงขึ้นไป) | `looking straight up at the inside of a dark indigo domed ceiling: carved wooden ribs radiating from a large round opening in the exact center, painted constellations and gold stars between the ribs` · รูกลางต้องโปร่งใส (alpha) กว้างราว 40 % ของภาพ |
| `oculus_sky.png` | 2048 × 2048 | ไม่ต่อ | ฟ้าที่เห็นผ่านช่องบนยอด | `looking straight up into a deep night sky: dense stars, a soft violet and blue nebula, a faint band of the milky way across, one bright star near the center` |

**สิ่งที่โค้ดทำเอง:**
- ขึ้นรูปวงชั้นหนังสือ 7–8 วงไล่ขึ้นเป็นเกลียว (วงล่างกว้าง วงบนแคบ) และวงใกล้กล้องที่อยู่ด้านหน้า
- แผนที่แสงเรืองของสันหนังสือ: ดึงจากส่วนสว่างของ `shelf_wall*.png` เอง (ไม่ต้องส่งภาพแยก) ใช้ตอน "สันหนังสือสว่างไล่ขึ้นทีละวง"
- แสงเทียนจริง (จุดแสง) แสงฟ้าจากช่องบนยอด หมอกบาง ๆ และฝุ่นละอองในลำแสง
- เทียนเป็นรูปทรงในโค้ด เปลวไฟใช้ VFX ชุด D

## ชุด C — ชิ้นส่วนที่ขยับ (โปร่งใส)

| ชื่อไฟล์ | ขนาด | คืออะไร | prompt เพิ่ม |
|---|---|---|---|
| `astrolabe_outer.png` | 2048 × 2048 | วงนอกของแอสโตรเลบ มองตรงหน้า | `a single flat ornate golden astrolabe ring seen straight on, engraved with zodiac-like star symbols and fine tick marks, thin and elegant, transparent inside and outside the ring` |
| `astrolabe_middle.png` | 2048 × 2048 | วงกลาง | เหมือนข้างบน วงเล็กกว่าเล็กน้อย ลายเป็นเส้นโคจรและดาวดวงเล็ก มีแขนโค้งสองข้าง |
| `astrolabe_inner.png` | 2048 × 2048 | วงในพร้อมเข็ม | `the innermost astrolabe disc: an openwork gold rete with curved pointers and small star gems, transparent gaps` |
| `astrolabe_core.png` | 512 × 512 | แกนกลาง | `a small glowing crystal star at the center of an astrolabe, pale blue-white light, gold setting` |
| `book_covers.png` | 2048 × 1024 · กริด 4 × 2 | ปกหนังสือลอย 8 แบบ (โค้ดทำเป็นกล่องหนังสือ ใช้ขอบกระดาษเดิม) | `eight flat front covers of old fantasy books in a 4 x 2 grid, each cover a different color of aged leather (crimson, indigo, emerald, brown, violet, black, teal, ochre) with gold corner guards and a different gold emblem, straight-on flat view, small even gaps between covers` |
| `book_spines.png` | 1024 × 1024 · กริด 8 × 1 | สันของหนังสือลอยทั้ง 8 เล่ม (ลำดับสีเดียวกับปก) | `eight vertical book spines side by side, matching aged leather colors, raised bands and gold tooling, no readable text` |

**สิ่งที่โค้ดทำเอง:** หมุนวงแอสโตรเลบแต่ละวงคนละแกนคนละความเร็ว · หนังสือลอยขึ้นลงและบินวน · ตำราวีรชนใช้ลายผิวชุด 1 เดิม

### (ไม่บังคับ) รูปปั้นวีรชน — ยืมจากแบบ C

ถ้าอยากได้ จะวางไว้ในซุ้มชั้นล่างสุดของหอ 4–6 ตัว ตอนได้ 3★ รูปปั้นที่ใกล้ตำราที่สุดจะเรืองทอง

| ชื่อไฟล์ | ขนาด | คืออะไร | prompt เพิ่ม |
|---|---|---|---|
| `statue_1.png` … `statue_4.png` | 1024 × 2048 โปร่งใส | รูปปั้นหินอ่อนขาวของวีรชนนิรนาม ยืนบนฐาน มุมตรงหน้า | `a white marble statue of an anonymous fantasy hero standing on a round gold-trimmed plinth, (1) knight with a sword held point-down, (2) robed mage holding a staff, (3) archer with a bow, (4) priestess holding a lantern, face softly stylized and not a specific person, front view` |

## ชุด D — VFX ใหม่ของห้อง (เพิ่มจากชุดเดิม)

| ชื่อไฟล์ | กริด / ช่อง | ใช้ตอน | prompt เพิ่ม |
|---|---|---|---|
| `fx_candle_flame.png` | 4 × 2 · 128 × 256 | เปลวเทียนทั้งหอ (ลูป) | `a single small candle flame, warm orange-gold with a white core, gently flickering, loopable` |
| `fx_oculus_flare.png` | 4 × 3 · 1024 × 1024 | เสาแสงพุ่งทะลุช่องฟ้า | `seen from below, a beam of light bursts through a round opening into the night sky: frames 1-3 a bright flash, 4-8 a radiant star burst with rays and a ring spreading across the sky, 9-12 sparks drift and fade` |
| `fx_page_wisp.png` | 4 × 2 · 256 × 256 | สายแสงที่ถูกดูดจากสันหนังสือเข้าหาตำรา (ลูป) | `a soft wisp of white-blue light shaped like a thin ribbon trail, loopable` |

VFX เดิมที่ใช้ต่อ: `fx_blackhole_charge`, `fx_blackhole_loop`, `fx_book_burst`, `fx_light_pillar_blue/gold`, `fx_orb_to_card` · **ไม่ใช้แล้ว:** `sky_dusk`, `cloud_sea`, `far_islands`, `shrine_platform`, `shrine_low_angle`, `crystal_shard` (ของวิหารลอยฟ้า)

---

## ห้องร่วมแสดงในแต่ละจังหวะ (ลำดับเวลาเดิม ปรับได้ในโค้ด)

| ช่วง | กล้อง | ห้องทำอะไร |
|---|---|---|
| ก่อนแตะ | ภาพกว้างระดับสายตา หมุนรอบแกนหอช้า ๆ แล้วซูมเข้าหาตำราที่ปิดอยู่ | แอสโตรเลบหมุนช้า หนังสือลอยเบา ๆ เทียนไหว **ตำรายังไม่มีแสง** |
| 0.00–1.35 วิ ชาร์จ | ซูมเข้าช้า ๆ สั่นแรงขึ้น | หนังสือบนชั้นสั่น แสงจากสันหนังสือถูกดูดเป็นสายเข้าหาตำรา (`fx_page_wisp`) เทียนเอนเข้าหาตำรา ห้องค่อย ๆ มืดลง |
| 1.35 วิ ระเบิด | กระตุกถอย | คลื่นแสงแผ่ไปทั่วหอ หนังสือลอยถูกผลักออก แอสโตรเลบหมุนเร็วขึ้น |
| 1.65–3.40 วิ พลิกหน้า | หมุนรอบตำราครึ่งวง | หนังสือลอยหลายสิบเล่มบินวนเป็นพายุรอบแท่น |
| 3.50–5.20 วิ อักษร | ใกล้หน้ากระดาษ | สันหนังสือบนชั้นสว่างไล่ขึ้นทีละวงตามจังหวะการเขียน (3★ เป็นทอง) |
| 5.20–5.60 วิ เสาแสง | เงยตามเสาแสงขึ้นไป | เสาแสงพุ่งผ่านใจกลางแอสโตรเลบ ทะลุช่องฟ้า (`fx_oculus_flare`) ดาวทั้งฟ้าสว่าง |
| 5.60 วิ | กล้องลดต่ำลงที่พื้น มองขึ้น (ไม่ตัดภาพ) | ชั้นหนังสือไล่ขึ้นเป็นเกลียวรอบกล้อง |
| 5.95–7.10 วิ การ์ด | ต่ำ มองขึ้น | ดวงแสงหล่นจากเสาแสง กลายเป็นการ์ดลอยเรียงหน้าแท่น |

## ลำดับการส่ง

1. **ชุด A** `archive_reference.png` (1 ไฟล์): ใช้คุมสไตล์ทุกไฟล์ที่เหลือ
2. **ชุด B** ลายผิวห้อง (10 ไฟล์): เห็นความลึกของหอได้ทันทีเมื่อห่อลงรูปทรง
3. **ชุด C** ชิ้นส่วน (6 ไฟล์ + รูปปั้น 4 ไฟล์ถ้าเอา)
4. **ชุด D** VFX ใหม่ (3 ไฟล์)

> ก่อนได้ภาพ Claude จะขึ้นรูปห้องด้วยลายผิวชั่วคราวในต้นแบบ three.js ก่อน เพื่อให้ตรวจความลึกและมุมกล้องได้ แล้วจึงสลับเป็นภาพจริงทีละชุด
