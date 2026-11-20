# สเปกภาพ: ฉากเปิดกาชา "วีรชนจากต่างโลก"

> เอาไปให้ AI gen ภาพ แล้วส่งกลับมาเป็น ZIP · Claude จะตัดพื้น ตั้งจุดหมุน แล้วทำแอนิเมชันในเกมเอง
> ภาพร่างที่ผู้ใช้เห็นชอบแล้ว: animatic v4 (https://claude.ai/artifact/7ktZYf4vsYhwHVWiwVdorD) · ทุกอย่างในนั้นวาดด้วยโค้ดชั่วคราว
> เรื่อง: เอลเดอร์เวย์นส่งเสียงเรียกข้ามห้วงจักรวาล → โลกหนึ่งตอบรับ → วาร์ปเข้าสู่เอลเดอร์เวย์น → ฟ้าแยก → ดาวตกกลายเป็นการ์ด → วีรชนก้าวออกจากแสง
> โทน: ห้วงอวกาศสีดำครามลึก + **ทองแชมเปญ `#E6C88A`** เป็นสีของเอลเดอร์เวย์น · แต่ละโลกมีสีประจำของตัวเอง · รุ้งใช้เฉพาะตอนได้ 3★
> สไตล์: ภาพวาดคมระดับเกมกาชา (ภาพประกอบ painterly) ไม่ใช่ flat / pixel art · อ้างอิง: `public/banners/*.webp`, `public/island/sky_city/`

## หลักการ: ขอเป็น "ชิ้นส่วน" ไม่ใช่ "ฉากทั้งฉาก"

กล้อง การซูม การหมุน วงโคจร เส้นด้ายทอง ดาวยืดเป็นเส้นตอนวาร์ป และแสงวาบ จะทำในโค้ดทั้งหมด จังหวะจึงตรงเป๊ะและปรับทีหลังได้โดยไม่ต้อง gen ใหม่ ที่ขอจาก AI มีแค่ 2 แบบ:

1. **ชิ้นส่วนนิ่ง**: ดาว ฉากหลัง กรอบการ์ด
2. **แผ่น VFX**: แสง ระเบิด รอยแยก (เป็นสิ่งที่ AI ทำได้ดี เพราะแต่ละเฟรมไม่ต้องเหมือนกันเป๊ะ)

## กติกาไฟล์

| ประเภท | ขนาด | พื้นหลัง | หมายเหตุ |
|---|---|---|---|
| **ดาว / ชิ้นส่วน** | ตามตาราง | **โปร่งใส (PNG alpha)** · ถ้าทำไม่ได้ใช้**ดำสนิท** | 1 ไฟล์ = 1 ชิ้น · ดาวเป็นทรงกลมเต็มดวงอยู่กลางภาพ เว้นขอบ ~10 % · ไม่มีแสงฟุ้งรอบดวง (โค้ดใส่เอง) |
| **ฉากหลัง** | ตามตาราง | เต็มภาพ | ห้ามมีตัวหนังสือ / โลโก้ / ตัวละคร |
| **VFX** | กริด **4 × 3 = 12 เฟรม** ช่องละ 512 × 512 | **ดำสนิท #000000** | จุดศูนย์กลางเดียวกันทุกเฟรม · ห้ามมีตัวเลข / ป้าย / เส้นกริด · เฟรม 1 = เริ่ม, เฟรม 12 = จางหมด |
| **VFX ลูป** | กริด 4 × 2 = 8 เฟรม ขนาดช่องตามตาราง | ดำสนิท | เฟรม 8 ต้องต่อกลับเฟรม 1 ได้เนียน |

- ตั้งชื่อไฟล์ตามคอลัมน์ "ชื่อไฟล์" แล้วรวมเป็น ZIP เดียว
- ทยอยส่งเป็นชุดได้ แนะนำให้เริ่มที่**ชุด 1**ก่อน
- ต้นฉบับจะเก็บไว้ที่ `assets/ui/summon-worlds/` และเป็นไฟล์อ่านอย่างเดียว

### Prompt หลัก

ดาว / โลก (ใส่หน้าทุก prompt ของ B–C):

```
epic fantasy concept art of a magical world seen from space, semi-realistic cinematic matte painting,
AAA fantasy game key art quality, dramatic lighting: lit from the upper left by a warm sun,
the opposite side falls into deep shadow with tiny glowing lights, a thin glowing atmosphere rim,
volumetric clouds that wrap around the curve of the sphere, rich deep colors, high contrast,
fine surface detail, a sense of vast scale, landmarks are large but still read as part of the world,
only the tallest spires and peaks rise past the edge, one single world centered, pure black background
```

ใส่ท้ายทุก prompt (ห้าม):

```
not cartoon, not chibi, not cute, no pastel colors, no swirly cotton-candy clouds, not a sticker,
no white background, not a NASA photo, no realistic Earth continents, no Saturn rings,
no other planets, no text, no labels
```

> **จุดที่ต้องการอยู่ตรงกลางระหว่างสองรอบที่ลองแล้ว**
>
> | รอบ | เนื้อหาในดาว | วิธีวาด | ผล |
> |---|---|---|---|
> | 1 | ทวีป/เมฆแบบโลกจริง | ภาพถ่ายดาราศาสตร์ | จริงไป ไม่แฟนตาซี |
> | 2 | เมืองลอย น้ำตก เกาะลอย | การ์ตูนพาสเทล เมฆม้วน พื้นขาว | แฟนตาซีแต่ดูเด็ก แบน ไม่มีมิติ |
> | **ที่ต้องการ** | **ของแฟนตาซีแบบรอบ 2** | **แสงเงา/เมฆ/ผิวสัมผัสสมจริงแบบรอบ 1** | ภาพ key art แฟนตาซีมหากาพย์ |
>
> - สิ่งที่ทำให้ดาวดูยิ่งใหญ่ = **แสงส่องจากด้านเดียว** ด้านมืดมีแสงไฟเมืองเล็ก ๆ + ขอบบรรยากาศเรืองบาง ๆ + เมฆโค้งตามผิวทรงกลม (รอบ 2 ไม่มีด้านมืด เลยแบน)
> - gen บน**พื้นดำ** ไม่ใช่พื้นขาว · ห้ามใช้คำ `stylized`, `hand-painted`, `miniature`, `cute`, `icon` (ทำให้ออกการ์ตูน)
> - แนบภาพอ้างอิง 2 แบบ: **ความสมจริงของการวาด** = banner ฮีโร่ในเกม (`public/banners/*.webp`) · **หน้าตาเมืองของเอลเดอร์เวย์น** = ภาพเมืองลอยฟ้าในเกม (`public/island/sky_city/`) ดาวจะได้เข้ากับเกมที่มีอยู่
> - gen ทีละดวง ทีละไฟล์ ไม่มีชื่อในภาพ · gen **เอลเดอร์เวย์นก่อน** แล้วแนบเป็น style reference ตอน gen ดวงอื่น (`same art style and lighting as the reference image`)

VFX:

```
fantasy game VFX sprite sheet, 4 columns x 3 rows grid, 12 animation frames read left-to-right,
top-to-bottom, additive glow light, pure black background, same center point every frame,
no text, no grid lines, no numbers
```

---

## ชุด 1 — ห้วงจักรวาล (SC01–SC04) ⭐ สำคัญสุด

### A. ฉากหลังอวกาศ

| ชื่อไฟล์ | ขนาด | คืออะไร | prompt เพิ่ม |
|---|---|---|---|
| `cosmos_bg.png` | 3200 × 1800 | อวกาศเต็มจอ | `deep space backdrop, near-black indigo void, soft nebula clouds in faint teal and warm gold, dense tiny stars, the center of the image calmer and slightly brighter, no planets, no galaxy` |
| `cosmos_galaxy.png` | 2048 × 2048 | กาแล็กซีหลังดาว (โค้ดหมุนช้า ๆ) | `a faint spiral galaxy seen from above, golden core, pale blue-white arms, pure black background, centered` |

### B. ดาวเอลเดอร์เวย์น (ดวงกลาง)

| ชื่อไฟล์ | ขนาด | prompt เพิ่ม |
|---|---|---|
| `eldervane_world.png` | 2048 × 2048 | `the world of Eldervane: the world is covered by a sea of golden sunset clouds, a vast white-stone sky city with golden spires crowns the top of the world, its tallest spires rising past the edge, waterfalls spill from its cliffs into the clouds, a few small floating islands drift nearby, warm champagne-gold light` |
| `eldervane_rune_ring.png` | 2048 × 2048 | `a thin flat ring of glowing golden runes and engraved circles, seen straight from above, perfectly circular, empty transparent center, transparent background` (โค้ดจะเอียงและหมุนให้เป็นวงรอบดาว) |

### C. โลกที่โคจรรอบเอลเดอร์เวย์น

1 ทีมฮีโร่ = 1 โลก ตอนเปิดกาชา โลกของฮีโร่ดาวสูงสุดในผลสุ่มจะเป็นโลกที่ "ตอบรับ" ฮีโร่ใหม่ในทีมเดิมใช้ดาวดวงเดิมได้เลย ไม่ต้อง gen ดาวเพิ่ม

> **ชื่อโลกยังเป็นชื่อชั่วคราว** ภาพไม่มีตัวหนังสือ เปลี่ยนชื่อทีหลังได้โดยไม่ต้อง gen ใหม่

| ชื่อไฟล์ | ขนาด | โลก (ชั่วคราว) | ฮีโร่ | สีประจำ | prompt เพิ่ม |
|---|---|---|---|---|---|
| `world_wulin.png` | 1024 × 1024 | แผ่นดินยุทธภพหยก · THE JADE WULIN | ไป๋หลง · เยว่เจิ้ง · โม่เย่ · ถังซวิ่น · หลินเสวี่ย | หยก + แดงชาด | `an eastern wuxia world: jade-green mountain peaks so tall they rise past the world's edge, a long white dragon coiling around the world, red pagodas on the peaks, misty waterfalls, jade and vermilion palette` |
| `world_crown.png` | 1024 × 1024 | อาณาจักรมงกุฎทอง · THE GOLDEN CROWNLANDS | การ์ริก · เคล · มิเรลล์ · ซิลวารา · เอลิรา | ฟ้าใส + ทอง | `a classic western fantasy kingdom world: a golden-roofed castle with blue banners stands on the top of the world, rolling green meadows, a waterfall pouring off the world's edge into space, a frosted mountain on one side and a deep emerald forest on the other, bright sky blue and gold palette` |
| `world_dusk.png` | 1024 × 1024 | ดินแดนสนธยาทมิฬ · THE DUSKBLIGHT | เวลริค · เดรเวน · มอร์เดรียนน์ · ไซลัส · ลูเซียน | แดงเลือด + เขียวคำสาป + ดำ | `a dark fantasy world under eternal dusk: black gothic cathedral spires pierce out of the world, thorny black vines wrap around it, rivers of glowing crimson, faint emerald curse fog, a small blood-red moon beside it, charcoal and crimson palette` |
| `world_veiled.png` | 1024 × 1024 | โลกที่ยังไม่ปรากฏ (เผื่อทีมใหม่ในอนาคต) | — | เทาเงิน | `an unknown world wrapped in swirling silver mist and faint glowing runes, the silhouette of hidden towers barely visible inside, mysterious, desaturated silver-blue` (โค้ดย้อมสีแล้วใช้ซ้ำ 2–3 ดวง เพื่อให้วงโคจรดูเต็ม) |

### D. VFX ของชุด 1

| ชื่อไฟล์ | กริด | ใช้ตอน | prompt เพิ่ม |
|---|---|---|---|
| `fx_world_answer.png` | 4 × 3 (512) | SC03 โลกที่ตอบรับระเบิดออร่าทอง | `a golden aura bursting outward around an empty circular center (the center circle is 40% of the frame and stays black): frames 1-3 thin gold rim ignites, 4-6 strong radial gold rays and a shockwave ring, 7-12 rays fade and gold sparks drift away` |
| `warp_rune_gate.png` | ภาพเดี่ยว 2048 × 2048 ดำสนิท | SC04 ประตูรูนที่วิ่งผ่านตอนวาร์ป | `a single circular gate made of glowing golden runes and thin concentric rings, front view, large empty black center, pure black background` (โค้ดซ้อนหลายชั้นเป็นอุโมงค์แล้วซูมทะลุ) |

**สิ่งที่โค้ดทำเองในชุดนี้ (ไม่ต้อง gen):** ดาวระยิบ, ดาวตกเป็นระยะ, เส้นวงโคจร, เส้นด้ายทองจากเอลเดอร์เวย์น (SC02), แสงที่วิ่งกลับมา, ดาวยืดเป็นเส้นตอนวาร์ป, แสงวาบขาว และ**ข้อความ "แตะเพื่ออัญเชิญ"** (ตัวหนังสือลอยเรืองแสงด้วยโค้ด ไม่มีปุ่ม)

---

## ชุด 2 — ฟ้าเอลเดอร์เวย์นและรอยแยก (SC05–SC06)

ฉากหลังใช้ของที่มีอยู่แล้ว ได้แก่ ฟ้าสนธยา `bg_sky_dusk` ทะเลเมฆ และเมือง Sky City จาก `public/island/sky_city/` จึงไม่ต้อง gen ใหม่ ยกเว้นไฟล์ที่เป็น "ไม่บังคับ" ด้านล่าง

| ชื่อไฟล์ | กริด / ขนาด | ใช้ตอน | prompt เพิ่ม |
|---|---|---|---|
| `fx_rift_open.png` | 4 × 3 · ช่อง 512 × 1024 (แนวตั้ง) | SC05 ฟ้าแยกเป็นสีขาว | `a vertical tear of pure white-silver light ripping open in the sky: frames 1-3 a hairline crack of light, 4-8 the crack widens into a tall glowing rift with jagged edges and small light shards, 9-12 the rift stays open and settles` |
| `fx_rift_loop.png` | 4 × 2 · ช่อง 512 × 1024 | รอยแยกเปิดค้าง | `an open vertical rift of white-silver light, edges flickering and crackling gently, loopable` |
| `fx_rift_surprise.png` | 4 × 3 · ช่อง 1024 × 1024 | **เซอร์ไพรส์ 3★**: รอยแยกที่สองระเบิด | `a second diagonal crack splits across a glowing white rift, then explodes: frames 1-3 white diagonal fracture, 4-6 the fracture bursts into blazing gold light, 7-9 huge gold explosion with rainbow-tinted edges and prismatic shards, 10-12 gold and rainbow light settles into a radiant glow` |
| `comet_head_silver.png` · `comet_head_jade.png` · `comet_head_gold.png` | 512 × 512 ดำสนิท | SC06 หัวดาวตก (1★ / 2★ / 3★) | `a single bright comet head, a dense glowing core with a short soft flare, centered, pure black background` + สี `silver-white` / `jade green` / `rich gold` (หางดาวตกโค้ดลากเอง · 3★ เป็นหางเกลียวรุ้ง) |
| `fx_comet_land.png` | 4 × 3 (512) | ดาวตกตกลงแล้วกลายเป็นการ์ด | `a falling star hits and blooms into a tall vertical rectangle of light (card shaped, 2:3 ratio): frames 1-3 impact flash, 4-7 light stretches into a glowing card silhouette, 8-12 the glow fades leaving only a soft rim` |
| `sky_summon_wide.png` *(ไม่บังคับ)* | 3200 × 1800 | ฉากฟ้าเฉพาะหน้านี้ | `a vast dusk sky above a sea of clouds, the floating city small at the bottom edge, the upper center open and empty for a rift of light, warm violet-gold sunset, no characters, no text` |

**สิ่งที่โค้ดทำเอง:** สายฟ้า, คลื่นกระแทก, ลำแสงรุ้ง, การหน่วงเวลาให้ช้าลงตอนเซอร์ไพรส์, การสั่นกล้อง และหางดาวตก

---

## ชุด 3 — การ์ดและการเผยตัว (SC07–SC08)

ตอนนี้ในเกมมีหลังการ์ด `public/ui/summon-card.jpg` และ `summon-card-3star.jpg` อยู่แล้ว (ผู้ใช้อนุมัติแล้ว จะใช้ต่อ) ส่วนภาพเต็มของฮีโร่ใช้ `public/banners/*.webp` ซึ่งมีครบทั้ง 15 ตัว

| ชื่อไฟล์ | กริด / ขนาด | ใช้ตอน | prompt เพิ่ม |
|---|---|---|---|
| `card_back_2star.png` *(ไม่บังคับ)* | 853 × 1280 | หลังการ์ด 2★ ให้ต่างจาก 1★ | สไตล์เดียวกับ `summon-card.jpg` แต่ใช้ `jade green gems and silver filigree` |
| `card_frame_1star.png` · `_2star` · `_3star` | 853 × 1280 โปร่งใส | กรอบหน้าการ์ดตอนเปิด | `an ornate fantasy card frame border only, empty transparent window in the middle, an empty nameplate band at the bottom, no text` + วัสดุ `silver` / `jade and silver` / `champagne gold with small gems` |
| `fx_card_flip.png` | 4 × 3 (512) | แสงวาบตอนพลิกการ์ด | `a vertical flash of light sweeping across a card shape, bright center line spreading sideways then fading, soft sparkles` |
| `fx_light_pillar_loop.png` | 4 × 2 · ช่อง 512 × 1024 | **3★ ×1**: เสาแสงที่ฮีโร่ก้าวออกมา | `a tall vertical pillar of golden light from the top edge to a bright ground point, gentle flowing particles rising inside, loopable` |
| `fx_pillar_impact.png` | 4 × 3 (512) | เสาแสงกระแทกพื้น | `a ground-level burst seen at a low angle: a flat glowing gold ring expands outward with dust and sparks, then fades` |
| `crest_wulin.png` · `crest_crown.png` · `crest_dusk.png` | 1024 × 1024 โปร่งใส | ตราประจำโลกบนหน้า splash | `a heraldic emblem, polished metal with engraving, no text` + `jade dragon coiled around a sword` / `golden crown over a lion shield` / `black thorned crescent with a crimson gem` |

**สิ่งที่โค้ดทำเอง:**
- ประกายรุ้งเลื่อม ๆ บนการ์ด 3★ (ตั้งใจให้เบา)
- เงาฮีโร่ที่ค่อย ๆ ปรากฏในเสาแสง โดยใช้ banner เดิม
- ชื่อฮีโร่ ชื่อโลก และคำพูดเปิดตัวแบบพิมพ์ทีละตัว

---

## ลำดับเวลา (นับจากตอนแตะ, ปรับได้ในโค้ด)

| ช่วง | ฉาก | ภาพที่ใช้ |
|---|---|---|
| ก่อนแตะ (ลูป) | SC01 ห้วงจักรวาล · โลกโคจร | `cosmos_bg`, `cosmos_galaxy`, `eldervane_world`, `eldervane_rune_ring`, `world_*` + ข้อความ "แตะเพื่ออัญเชิญ" |
| 0.0–1.9 วิ | SC02 เสียงเรียก (เส้นด้ายทอง) | ชุดเดิม · วงโคจรช้าลง |
| 1.9–3.1 วิ | SC03 โลกที่ตอบรับ | `fx_world_answer` บนดาวโลกนั้น · โลกอื่นจางลง |
| 3.1–4.4 วิ | SC04 วาร์ปสู่เอลเดอร์เวย์น | `warp_rune_gate` หลายชั้น → แสงวาบขาว |
| 4.4–5.1 วิ | SC05 ฟ้าเอลเดอร์เวย์น · ฟ้าแยกเป็นสีขาว | ฉากฟ้าเดิม + `fx_rift_open` → `fx_rift_loop` |
| ≈ 5.45 วิ | **เฉพาะเมื่อได้ 3★**: เซอร์ไพรส์ | `fx_rift_surprise` (ช่วงหลังจากนี้จะเลื่อนออกไปอีก ~0.65 วิ) |
| 5.1–5.8 วิ | SC06 ดาวตกแห่งวีรชน | `comet_head_*` → `fx_comet_land` → หลังการ์ด |
| 5.8 วิ ขึ้นไป | SC07 ก้าวออกจากแสง (×1 + 3★) / เปิดการ์ด (×10) | `fx_light_pillar_loop`, `fx_pillar_impact`, `fx_card_flip`, `card_frame_*` |
| จบ | SC08 splash ฮีโร่ 3★ | banner ของฮีโร่ + `crest_*` |

## ลำดับการส่ง

1. **ชุด 1** (9 ไฟล์): ทำให้ฉากเปิดดูเป็นของจริงทันที
2. **ชุด 2** (8 ไฟล์ + 1 ไม่บังคับ)
3. **ชุด 3** (10 ไฟล์ + 1 ไม่บังคับ)

นอกจากภาพ ยังต้องมี**คำพูดเปิดตัวของฮีโร่ทั้ง 15 ตัว** (ประโยคละ ~1 บรรทัด) ส่วนนี้เป็นงานเขียน ไม่ใช่ภาพ ใน animatic มีตัวอย่างไว้แค่ 6 ตัว
