# Eldervane — พรอมป์ต์เจนวัสดุครบ 21 รายการ


## ข้อแก้ไขล่าสุดจากผู้ใช้ — หินต้องเป็นของฮีโร่แต่ละตัว

- หินเลื่อนขั้นไม่ใช่หินกลางสีเดียวกันทุกตัว:ต้องใช้portraitจริงของฮีโร่คนนั้นเป็นช่องภาพหลักในหิน คงtierด้วยรูปทรง/ฐาน/โทนขอบ ไม่ย้อมหน้าจนจำไม่ได้
- ในโค้ดปัจจุบันbt_stone_1/2/3และเศษยังเป็นของกลางตามtier การผูกเจ้าของและสูตรแปลงเป็นหินรวมเป็นข้อกำหนดใหม่ **ยังไม่ลงระบบเกม** งานนี้เตรียมพรอมป์ต์อาร์ต
- ต้องแนบไฟล์portraitอ้างอิงจริง ชื่อฮีโร่อย่างเดียวไม่พอ หากต้องการหน้าเหมือนต้นฉบับทุกpixel ให้ปกป้องบริเวณportraitในเครื่องมือedit และเจนเฉพาะหิน/กรอบรอบภาพ ไม่repaintใบหน้า
- แพ็กมีพรอมป์ต์หินเต็ม12ฮีโร่×3tierและพรอมป์ต์เศษคู่กันเป็นข้อเสนออาร์ต 72variants ไม่ใช่72ไอเทมใหม่ในregistry เศษคู่ฮีโร่เตรียมไว้เพื่อความสอดคล้องของภาพ แต่กติกาการรวมเศษข้ามฮีโร่ยังต้องออกแบบระบบตามคำสั่งผู้ใช้
- หินรวมมีconceptแยก ไม่มีหน้าฮีโร่ และใช้ตราประตูสามยอดเพื่อแยกจากUniversal Memory ไม่ตั้งitemIDใหม่ ไม่เดาเงื่อนไข/อัตราแปลงหรือว่าหินรวมต้องแยกtierหรือไม่
- **กติกาที่ผู้ใช้ยืนยัน:** เมื่อฮีโร่เลื่อนขั้นครบแล้ว หินส่วนเกินเฉพาะฮีโร่ตัวนั้นแปลงเป็นหินรวมในอัตรา **1:1** ไปก่อน
- กติกาข้างต้นยืนยันแล้ว แต่ยังไม่ได้ลงruntimeในงานเอกสารนี้ ยังไม่กำหนดว่าแปลงอัตโนมัติหรือกดเอง และไม่อนุมานว่าหินtierต่ำแลกเป็นtierสูงได้ ฟิลด์tierPolicyที่ยังไม่กำหนดคงnull

เอกสารนี้เป็นข้อเสนอArt Direction ไม่ใช่การเปลี่ยนกติกาเกม และยังไม่ได้เจน/อนุมัติอาร์ต สีใหม่เป็นข้อเสนอสำหรับasset ไม่ใช่การอ้างว่าเป็นสีcanonicalในregistry ภาพSVGชั่วคราวบางชิ้นใช้สีต่างจากชุดนี้ เช่นยาใหญ่เดิมม่วง แต่เสนออำพันเพื่อเลี่ยงภาพจำม่วงดำ

1. เจนทีละไอเทมด้วยพรอมป์ต์เต็มของIDนั้น แต่ละไฟล์มีสไตล์/วัตถุ/ข้อห้ามครบ ไม่ต้องนำข้อความอื่นมาต่อ
2. เริ่มชิ้นแม่ของแต่ละครอบครัวก่อน แล้วแนบภาพแม่ที่เลือกไว้เป็นstyle referenceให้ชิ้นที่เหลือ:ยา→หินเต็ม→เศษหิน→ตำราเต็ม→เศษตำรา→เศษอุปกรณ์→แร่→Universal Memory
3. รุ่นย่อยต้องต่างทั้งรูปทรงกับสี:ขวดหยดน้ำ/กระติกเหลี่ยม/โถกลม, ผลึก1/2/3สัน, ตำราบาง/หนากลาง/หนา+ตัวล็อกโล่ เศษต้องมีรอยแตก/ขาดชัด ไม่ย่อภาพชิ้นเต็มมาใช้แทน
4. บนภาพห้ามมีชื่อID/ชื่อไอเทม/เลขI-II-III/จำนวน/ดาว/rarityframe ค่าตัวเลขวาดด้วยUIเกม ชื่อไฟล์เท่านั้นที่ใช้IDตามรายการ
5. Masterเป้าหมาย512×512 PNG RGBAพื้นโปร่งใส ขอบว่างอย่างน้อย10% ถ้าโมเดลรองรับแค่1024ให้เจนสี่เหลี่ยม1024แล้วexport512โดยคงสัดส่วน ไม่ตัดส่วนสำคัญ RuntimeวางแผนWebPที่public/items/<id>.webp
6. ถ้าเครื่องมือไม่รองรับalpha ให้ระบุข้อจำกัดและทำพื้นเทากลางเรียบแยกสำหรับตัดพื้นหลัง ไม่วาดลายตารางแทนความโปร่งใส ห้ามอ้างว่าภาพRGBมีalpha
7. แสงซ้ายบน/มุมกล้อง/ระดับความคม/ปริมาณทองใช้ร่วมทั้งชุด วัตถุหลักต้องทึบแม้พื้นโปร่งใส ลดแสงฟุ้งจนขอบหาย ไม่วาดฐานตั้ง/กรอบไอเทมติดภาพ
8. ตรวจบนพื้น#10171Bและ#F1E8D6 ที่32/48/64px แยกยา/หิน/เศษ/ตำรา/โลหะ/แร่/Memoryได้แม้ปิดสี รูปทรงและหน้าตัดต้องยังอ่านออก ไม่ใช้สีเพียงอย่างเดียวบอกtier
9. ส่งไฟล์ตามIDจริงเท่านั้น ไม่มีการเพิ่มไอเทมหรือเปลี่ยนค่า EXP/สูตร/รางวัล ภาพใหญ่Hero Memoryของไป๋หลงเป็นillustrationอีกงาน; Universal Memoryนี้ต้องไม่เป็นportraitเฉพาะตัว
10. ไฟล์อาร์ตที่เจนยังต้องตรวจและเลือกก่อนผูกเข้าระบบ ห้ามตั้งfinalArtApproved=trueจากการมีพรอมป์ต์ ชื่อไทยในเอกสารเป็นคำอธิบาย ไม่ได้renameชื่อไอเทมในเกม

## ลำดับและการส่งงาน

- ตรวจชิ้นแม่ที่128pxแล้วจึงทำชิ้นลูกให้คงวัสดุ/มุมภาพเดียวกัน
- สร้างภาพแยก21PNGก่อน แล้วจึงทำcontact sheetสำหรับตรวจ ไม่ใช้contact sheetเป็นไฟล์ไอเทมจริง
- ส่งmasterPNG,ภาพย่อ32/48/64,contact sheetที่ใส่IDภายนอกภาพ และmanifestID→ชื่อไฟล์→ขนาด→สถานะเลือก
- ชุดpromptพร้อมใช้ในprompts.json; ห้ามเอาgameFactsหรือรายละเอียดราคาไปวาดเป็นตัวเลขบนภาพ

## แหล่งข้อมูลจริง

src/app/core/data/economy.ts (ITEMS, BREAKTHROUGHS), src/app/core/data/skill-ranks.ts (UPGRADE_COST/SKILL_TOME ladder), src/app/core/data/equipment.ts (CRAFT_RECIPES/upgrade), src/app/core/data/stars.ts (Universal Memory) และbacklog.json21IDs

## สรุปรายการ

| # | IDจริง | คำอธิบาย | รูปทรงหลัก | โทนสีเสนอ |
|---|---|---|---|---|
| 01 | `exp_potion_s` | ยา EXP ขนาดเล็ก | ขวดเล็กทรงหยดน้ำ คอสั้น ฝาจุกเรียบ | เขียวหยก #48B28B / แก้วใส / ทองเก่า #B99048 |
| 02 | `exp_potion_m` | ยา EXP ขนาดกลาง | ขวดทรงกระติกหกเหลี่ยม ไหล่กว้าง ฝาแปดเหลี่ยม | ฟ้าแซฟไฟร์ #449FE0 / แก้วใส / ทองเก่า |
| 03 | `exp_potion_l` | ยา EXP ขนาดใหญ่ | ขวดโถทรงกลมแบน มีหูโลหะสั้นสองข้าง จุกสูง | อำพันสว่าง #EAB64D / งาช้าง / ทองเก่า |
| 04 | `bt_stone_1` | หินเลื่อนขั้น I | หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก | อำพัน #DFA23C / ทองเก่า / หินสีเข้ม |
| 05 | `bt_stone_2` | หินเลื่อนขั้น II | หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก | ฟ้าน้ำแข็ง #69CDEB / เงินหม่น / ทองเก่า |
| 06 | `bt_stone_3` | หินเลื่อนขั้น III | หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก | ขาวโอปอล #DCEFFA / ทองสว่าง #E9C673 / ฟ้าอ่อน |
| 07 | `bt_fragment_1` | เศษหินเลื่อนขั้น 1 | หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก | ใช้สี/วัสดุเดียวกับ bt_stone_1 |
| 08 | `bt_fragment_2` | เศษหินเลื่อนขั้น 2 | หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก | ใช้สี/วัสดุเดียวกับ bt_stone_2 |
| 09 | `bt_fragment_3` | เศษหินเลื่อนขั้น 3 | หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก | ใช้สี/วัสดุเดียวกับ bt_stone_3 |
| 10 | `skill_tome_1` | ตำราสกิล I | สมุดบางปิดเล่ม คล้องสายเดียว ตราวงกลมเรียบ | หนังเขียวป่า #3F775B / กระดาษงาช้าง / ทองเก่า |
| 11 | `skill_tome_2` | ตำราสกิล II | หนังสือหนาปานกลาง แถบสันคู่ มุมเหลี่ยมและเข็มขัดคู่ | หนังน้ำเงินคราม #315C93 / งาช้าง / ทองเก่า |
| 12 | `skill_tome_3` | ตำราสกิล III | คัมภีร์หนา สันเสริมโลหะ ตัวล็อกกลางทรงโล่ | หนังแดงไวน์ #922D35 / ขอบหน้างาช้าง / ทองเก่า |
| 13 | `skill_tome_frag_1` | เศษตำราสกิล 1 | มุมปกขาดติดหน้ากระดาษฉีกสองชั้น | ใช้สีปก/ตราเดียวกับ skill_tome_1 |
| 14 | `skill_tome_frag_2` | เศษตำราสกิล 2 | มุมปกขาดติดหน้ากระดาษฉีกสองชั้น | ใช้สีปก/ตราเดียวกับ skill_tome_2 |
| 15 | `skill_tome_frag_3` | เศษตำราสกิล 3 | มุมปกขาดติดหน้ากระดาษฉีกสองชั้น | ใช้สีปก/ตราเดียวกับ skill_tome_3 |
| 16 | `equip_frag_basic` | เศษอุปกรณ์ Basic | แผ่นเหล็กแตกชิ้นหนา ทรงสี่เหลี่ยมคางหมู มีรูหมุดเดียว | เหล็กอุ่น #7D8586 / สัมฤทธิ์หม่น / เขียวหยกเล็กน้อย |
| 17 | `equip_frag_rare` | เศษอุปกรณ์ Rare | แผ่นโลหะแตกทรงง่ามสองแฉก ขอบเงิน มีหมุดสองตำแหน่ง | เหล็กน้ำเงิน #356FA6 / เงิน #C3D1D8 / ทองเก่าเล็กน้อย |
| 18 | `equip_frag_elite` | เศษอุปกรณ์ Elite | แผ่นเสริมเกราะแตกทรงเสี้ยวหนา มีสันซ้อนสามชั้น | เหล็กแดงดำ #692D30 / เคลือบแดง #B5483B / สัมฤทธิ์ทอง |
| 19 | `equip_frag_epic` | เศษอุปกรณ์ Epic | แผ่นโลหะสลักแตกทรงพัดสามก้าน ผิวเคลือบงาช้าง | ทองเก่า #C5A15A / งาช้าง #F0E4C7 / ฟ้าแซฟไฟร์จุดเล็ก |
| 20 | `enhancement_ore` | แร่เสริมพลังอุปกรณ์ | ก้อนแร่ดิบเหลี่ยมขรุขระ ฐานหินเข้ม เส้นแร่ส้มทอง | บะซอลต์เทา #39464D / แร่ส้มทอง #F0A34A / แสงขาวอุ่น |
| 21 | `universal_memory` | ความทรงจำสากล | ปริซึมดาวสี่แฉกกลางวงโอบทองเปิดสองปลาย | ขาวมุก #E8F3FC / ฟ้าอ่อน #97DAF1 / ทอง #D9B76C |

## รูปฮีโร่จริงสำหรับหินเฉพาะตัว

| Hero ID | ชื่อในเกม | รูปอ้างอิงจริง |
|---|---|---|
| `bailong` | ไป๋หลง | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/bailong.webp) · `public/portraits/bailong.webp` |
| `yuezheng` | เยว่เจิ้ง | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/yuezheng.webp) · `public/portraits/yuezheng.webp` |
| `moye` | โม่เย่ | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/moye.webp) · `public/portraits/moye.webp` |
| `tangxun` | ถังซวิ่น | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/tangxun.webp) · `public/portraits/tangxun.webp` |
| `linxue` | หลินเสวี่ย | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/linxue.webp) · `public/portraits/linxue.webp` |
| `garrick` | การ์ริก | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/garrick.webp) · `public/portraits/garrick.webp` |
| `kael` | เคล | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/kael.webp) · `public/portraits/kael.webp` |
| `mirelle` | มิเรลล์ ฟรอสต์กลาส | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/mirelle.webp) · `public/portraits/mirelle.webp` |
| `sylvara` | ซิลวารา วินด์วิสเปอร์ | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/sylvara.webp) · `public/portraits/sylvara.webp` |
| `elira` | เอลิรา ดอว์นเมียร์ | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/elira.webp) · `public/portraits/elira.webp` |
| `vaelric` | เวลริค น็อกธาร์ | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/vaelric.webp) · `public/portraits/vaelric.webp` |
| `draeven` | เดรเวน มอร์แคนต์ | [เปิดportrait](https://raw.githubusercontent.com/adisonkung/ProjectGM/2b06592cd8a56e1faa432a55fa89e85435dd5eee/public/portraits/draeven.webp) · `public/portraits/draeven.webp` |

ไฟล์JSON hero-breakthrough-prompts.json มีpromptแยกครบ72variants พร้อมheroIdและreferenceURL ชื่อไฟล์เป็นassetvariant ไม่ใช่IDไอเทมเกม สำหรับหินให้ใช้ชื่อไฟล์เฉพาะฮีโร่ในvariants ไม่ใช้pathgenericเดิมของbacklog หินรวมอ่านuniversal-breakthrough-concept.txt กติกายืนยันเมื่อฮีโร่เลื่อนขั้นครบแล้วแปลงหินส่วนเกิน1:1

## Prompt แยกรายชิ้น

ทุกบล็อกเป็นพรอมป์ต์เต็ม ใช้เดี่ยวได้ทันที ภาษาอังกฤษใช้กับโมเดลภาพได้กว้าง ส่วนรายละเอียดไทยใช้ตรวจว่ารูปถูกหน้าที่

## 01 — exp_potion_s

**ชื่อจริง:** Small Training Potion

**คำอธิบาย:** ยา EXP ขนาดเล็ก

**หน้าที่ในเกม:** ให้ EXP 50 หน่วย; ไม่ใช่ยาเพิ่ม HP หรือมานา

**รูปทรงเสนอ:** ขวดเล็กทรงหยดน้ำ คอสั้น ฝาจุกเรียบ

**สี/วัสดุเสนอ:** เขียวหยก #48B28B / แก้วใส / ทองเก่า #B99048

**จุดที่ต้องตรวจ:** อย่าวาดกากบาท/หัวใจ/ขวดหลายใบ/เลข50; สีเขียวไม่ได้หมายถึงยาHP

**ไฟล์ที่ส่ง:** `exp_potion_s.png` → แผนruntime `public/items/exp_potion_s.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
A small squat teardrop-shaped clear glass training-potion vial, short narrow neck, a plain dark cork held by one slim antique-gold collar, and luminous jade-green liquid filling the lower two thirds. Show a strong readable curved meniscus, one broad glass highlight, one tiny golden energy mote suspended inside, and a subtle embossed non-letter diamond on the collar. The bottle is compact and modest; its simple pear silhouette must remain recognizable when viewed at 32 pixels.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 02 — exp_potion_m

**ชื่อจริง:** Medium Training Potion

**คำอธิบาย:** ยา EXP ขนาดกลาง

**หน้าที่ในเกม:** ให้ EXP 150 หน่วย; ใช้เพิ่ม EXP ฮีโร่

**รูปทรงเสนอ:** ขวดทรงกระติกหกเหลี่ยม ไหล่กว้าง ฝาแปดเหลี่ยม

**สี/วัสดุเสนอ:** ฟ้าแซฟไฟร์ #449FE0 / แก้วใส / ทองเก่า

**จุดที่ต้องตรวจ:** อย่าทำเป็นขวดหยดน้ำเหมือนขนาดเล็ก; ไม่มีสัญลักษณ์มานาหรือเลข150

**ไฟล์ที่ส่ง:** `exp_potion_m.png` → แผนruntime `public/items/exp_potion_m.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
A medium hexagonal-shouldered clear glass training-potion flask with a flat broad body, short neck, and an octagonal antique-gold cap. Fill it with luminous sapphire-blue liquid. A single tasteful gold brace follows the lower bottle edge; two tiny suspended light motes and a broad liquid meniscus give depth. Preserve the same glass, metal finish and viewpoint as the small jade vial, but use a clearly wider angular canteen silhouette instead of merely enlarging or recoloring the small bottle.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 03 — exp_potion_l

**ชื่อจริง:** Large Training Potion

**คำอธิบาย:** ยา EXP ขนาดใหญ่

**หน้าที่ในเกม:** ให้ EXP 500 หน่วย; เป็นขนาดใหญ่สุดในรายการยาปัจจุบัน

**รูปทรงเสนอ:** ขวดโถทรงกลมแบน มีหูโลหะสั้นสองข้าง จุกสูง

**สี/วัสดุเสนอ:** อำพันสว่าง #EAB64D / งาช้าง / ทองเก่า

**จุดที่ต้องตรวจ:** ไม่ใช้ม่วงเป็นสีหลัก; ไม่ทำเป็นHP/มานา/น้ำยาวิเศษชนิดใหม่; ไม่วาดเลข500

**ไฟล์ที่ส่ง:** `exp_potion_l.png` → แผนruntime `public/items/exp_potion_l.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
A large flattened round glass training-potion decanter, visibly broader than it is tall, with two short elegant metal shoulder handles and a tall faceted antique-gold stopper. Rich amber-gold liquid glows inside the clear vessel. The handles belong to the bottle and are not loose objects. Add a restrained ivory inlay on the neck and a small internal swirl of concentrated golden energy. Its broad round decanter outline must distinguish it from both the pear-shaped small vial and the angular medium flask.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 04 — bt_stone_1

**ชื่อจริง:** Breakthrough Stone I

**คำอธิบาย:** หินเลื่อนขั้น I

**หน้าที่ในเกม:** ใช้เลื่อน Lv5→6; ต้องใช้หินชนิดนี้ 4 ชิ้น ตาม BREAKTHROUGHS ข้อกำหนดใหม่:ต้องเป็นของฮีโร่ที่ระบุ; runtimeยังไม่แยกเจ้าของและยังไม่มีสูตรแปลงเป็นหินรวม

**รูปทรงเสนอ:** หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก

**สี/วัสดุเสนอ:** อำพัน #DFA23C / ทองเก่า / หินสีเข้ม

**จุดที่ต้องตรวจ:** ไม่ใช่แร่ดิบหรือกองเศษ; ไม่ใส่เลขI/ดาว/ระดับในภาพ; ต้องแนบportraitฮีโร่ที่ถูกตัว ห้ามใช้ภาพgenericหรือสลับฮีโร่

**ไฟล์ที่ส่ง:** `bt_stone_1__{heroId}.png` → แผนruntime `public/items/heroes/{heroId}/bt_stone_1.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One intact upright single-point breakthrough crystal, a warm amber polished monolith with five broad readable facets. A thin antique-gold socket embraces only its base, with a small abstract diamond-shaped incision on the front. The crystal is whole, symmetric and deliberate, conveying a first-stage growth catalyst. Keep the top a simple sharp peak, the main face broad, and the inner light modest. No secondary crystal spikes. IMPORTANT USER CORRECTION: This is NOT a generic shared breakthrough stone. It belongs exclusively to [HERO_ID]. Use the attached canonical [HERO_PORTRAIT_REFERENCE] image as a recognizable protected portrait inset inside the crystal. Keep the actual hero face, hairstyle, skin tone, gender and outfit from that reference; do not invent a different person or reuse Bai Long for every hero. The portrait window should occupy roughly 40-50% of the visible front face, leaving the tier-specific crystal silhouette and gold fittings visible. Do not tint the face so strongly that identity is lost. For a fragment, place the broken edges around a still-readable identity inset; do not remove the face or turn it into an unrelated generic shard. No name or number printed on the icon. If the actual hero portrait has not been supplied, request it before generating this asset.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, unrelated character, full-body scene, hands outside the item, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 05 — bt_stone_2

**ชื่อจริง:** Breakthrough Stone II

**คำอธิบาย:** หินเลื่อนขั้น II

**หน้าที่ในเกม:** ใช้เลื่อน Lv8→9; ต้องใช้หินชนิดนี้ 6 ชิ้น ข้อกำหนดใหม่:ต้องเป็นของฮีโร่ที่ระบุ; runtimeยังไม่แยกเจ้าของและยังไม่มีสูตรแปลงเป็นหินรวม

**รูปทรงเสนอ:** หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก

**สี/วัสดุเสนอ:** ฟ้าน้ำแข็ง #69CDEB / เงินหม่น / ทองเก่า

**จุดที่ต้องตรวจ:** สองยอดต้องต่อเป็นชิ้นเดียว ไม่ใช่หินสองชิ้น; ไม่ใส่เลขII/ดาว; ต้องแนบportraitฮีโร่ที่ถูกตัว ห้ามใช้ภาพgenericหรือสลับฮีโร่

**ไฟล์ที่ส่ง:** `bt_stone_2__{heroId}.png` → แผนruntime `public/items/heroes/{heroId}/bt_stone_2.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One intact twin-ridged breakthrough crystal with a single coherent body: a broad icy-cyan central prism whose top splits into two clear, unequal faceted peaks. A narrow antique-gold ring circles its middle and a muted silver-gold socket secures its base. Use crystalline depth and a restrained inner cyan core, with the two-ridge outline and central ring readable at icon scale. It belongs to the same crafted growth-stone family as the amber single-point crystal, not a geological ore cluster. IMPORTANT USER CORRECTION: This is NOT a generic shared breakthrough stone. It belongs exclusively to [HERO_ID]. Use the attached canonical [HERO_PORTRAIT_REFERENCE] image as a recognizable protected portrait inset inside the crystal. Keep the actual hero face, hairstyle, skin tone, gender and outfit from that reference; do not invent a different person or reuse Bai Long for every hero. The portrait window should occupy roughly 40-50% of the visible front face, leaving the tier-specific crystal silhouette and gold fittings visible. Do not tint the face so strongly that identity is lost. For a fragment, place the broken edges around a still-readable identity inset; do not remove the face or turn it into an unrelated generic shard. No name or number printed on the icon. If the actual hero portrait has not been supplied, request it before generating this asset.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, unrelated character, full-body scene, hands outside the item, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 06 — bt_stone_3

**ชื่อจริง:** Breakthrough Stone III

**คำอธิบาย:** หินเลื่อนขั้น III

**หน้าที่ในเกม:** ใช้เลื่อน Lv9→10; ต้องใช้หินชนิดนี้ 8 ชิ้น ข้อกำหนดใหม่:ต้องเป็นของฮีโร่ที่ระบุ; runtimeยังไม่แยกเจ้าของและยังไม่มีสูตรแปลงเป็นหินรวม

**รูปทรงเสนอ:** หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก

**สี/วัสดุเสนอ:** ขาวโอปอล #DCEFFA / ทองสว่าง #E9C673 / ฟ้าอ่อน

**จุดที่ต้องตรวจ:** ไม่ใช่มงกุฎสวมศีรษะหรือUniversal Memory; ไม่ใช้วงดาว; ไม่มีเลขIII; ต้องแนบportraitฮีโร่ที่ถูกตัว ห้ามใช้ภาพgenericหรือสลับฮีโร่

**ไฟล์ที่ส่ง:** `bt_stone_3__{heroId}.png` → แผนruntime `public/items/heroes/{heroId}/bt_stone_3.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One complete opalescent breakthrough crystal with a low crown-like silhouette: one tall central faceted ridge flanked by two shorter integrated ridges. The three ridges share a single solid crystal base. Slender antique-gold prongs cradle the lower third like a refined growth catalyst, with restrained ivory-blue internal radiance and a warm gold core. Use richer facets and mounting than the lower stones while preserving a large clean silhouette and controlled highlights. IMPORTANT USER CORRECTION: This is NOT a generic shared breakthrough stone. It belongs exclusively to [HERO_ID]. Use the attached canonical [HERO_PORTRAIT_REFERENCE] image as a recognizable protected portrait inset inside the crystal. Keep the actual hero face, hairstyle, skin tone, gender and outfit from that reference; do not invent a different person or reuse Bai Long for every hero. The portrait window should occupy roughly 40-50% of the visible front face, leaving the tier-specific crystal silhouette and gold fittings visible. Do not tint the face so strongly that identity is lost. For a fragment, place the broken edges around a still-readable identity inset; do not remove the face or turn it into an unrelated generic shard. No name or number printed on the icon. If the actual hero portrait has not been supplied, request it before generating this asset.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, unrelated character, full-body scene, hands outside the item, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 07 — bt_fragment_1

**ชื่อจริง:** Breakthrough Fragment I

**คำอธิบาย:** เศษหินเลื่อนขั้น 1

**หน้าที่ในเกม:** เศษหินชนิดเดียวกัน 10 ชิ้นรวมเป็น bt_stone_1 1 ชิ้น; จำนวนเป็นข้อมูลUI ไม่วาดในภาพ ข้อกำหนดใหม่:ต้องเป็นของฮีโร่ที่ระบุ; runtimeยังไม่แยกเจ้าของและยังไม่มีสูตรแปลงเป็นหินรวม

**รูปทรงเสนอ:** หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก

**สี/วัสดุเสนอ:** ใช้สี/วัสดุเดียวกับ bt_stone_1

**จุดที่ต้องตรวจ:** ห้ามเป็นหินเต็มก้อน/แร่ดิบ/เศษโลหะ; ต้องเข้าคู่กับ bt_stone_1; ไม่วาด10:1; ต้องแนบportraitฮีโร่ที่ถูกตัว ห้ามใช้ภาพgenericหรือสลับฮีโร่

**ไฟล์ที่ส่ง:** `bt_fragment_1__{heroId}.png` → แผนruntime `public/items/heroes/{heroId}/bt_fragment_1.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One large broken wedge fragment from the single-point amber monolith breakthrough stone, not a complete stone. Preserve its warm amber crystalline material and the same facet language as its matching whole item. Show one sharp polished outside face and one broad jagged freshly fractured inside surface, with one broken golden base rim. The broken silhouette has a conspicuous diagonal missing top, making it unmistakably a fragment at 32 pixels. The metal remnants belong to the shard. Keep it a single readable fragment rather than a pile of crystals. IMPORTANT USER CORRECTION: This is NOT a generic shared breakthrough stone. It belongs exclusively to [HERO_ID]. Use the attached canonical [HERO_PORTRAIT_REFERENCE] image as a recognizable protected portrait inset inside the crystal. Keep the actual hero face, hairstyle, skin tone, gender and outfit from that reference; do not invent a different person or reuse Bai Long for every hero. The portrait window should occupy roughly 40-50% of the visible front face, leaving the tier-specific crystal silhouette and gold fittings visible. Do not tint the face so strongly that identity is lost. For a fragment, place the broken edges around a still-readable identity inset; do not remove the face or turn it into an unrelated generic shard. No name or number printed on the icon. If the actual hero portrait has not been supplied, request it before generating this asset.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, unrelated character, full-body scene, hands outside the item, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 08 — bt_fragment_2

**ชื่อจริง:** Breakthrough Fragment II

**คำอธิบาย:** เศษหินเลื่อนขั้น 2

**หน้าที่ในเกม:** เศษหินชนิดเดียวกัน 10 ชิ้นรวมเป็น bt_stone_2 1 ชิ้น; จำนวนเป็นข้อมูลUI ไม่วาดในภาพ ข้อกำหนดใหม่:ต้องเป็นของฮีโร่ที่ระบุ; runtimeยังไม่แยกเจ้าของและยังไม่มีสูตรแปลงเป็นหินรวม

**รูปทรงเสนอ:** หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก

**สี/วัสดุเสนอ:** ใช้สี/วัสดุเดียวกับ bt_stone_2

**จุดที่ต้องตรวจ:** ห้ามเป็นหินเต็มก้อน/แร่ดิบ/เศษโลหะ; ต้องเข้าคู่กับ bt_stone_2; ไม่วาด10:1; ต้องแนบportraitฮีโร่ที่ถูกตัว ห้ามใช้ภาพgenericหรือสลับฮีโร่

**ไฟล์ที่ส่ง:** `bt_fragment_2__{heroId}.png` → แผนruntime `public/items/heroes/{heroId}/bt_fragment_2.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One large broken wedge fragment from the twin-ridged cyan prism breakthrough stone, not a complete stone. Preserve its icy cyan crystalline material and the same facet language as its matching whole item. Show one sharp polished outside face and one broad jagged freshly fractured inside surface, with a recognizable broken section of its slim central gold ring. The broken silhouette has a conspicuous diagonal missing top, making it unmistakably a fragment at 32 pixels. The metal remnants belong to the shard. Keep it a single readable fragment rather than a pile of crystals. IMPORTANT USER CORRECTION: This is NOT a generic shared breakthrough stone. It belongs exclusively to [HERO_ID]. Use the attached canonical [HERO_PORTRAIT_REFERENCE] image as a recognizable protected portrait inset inside the crystal. Keep the actual hero face, hairstyle, skin tone, gender and outfit from that reference; do not invent a different person or reuse Bai Long for every hero. The portrait window should occupy roughly 40-50% of the visible front face, leaving the tier-specific crystal silhouette and gold fittings visible. Do not tint the face so strongly that identity is lost. For a fragment, place the broken edges around a still-readable identity inset; do not remove the face or turn it into an unrelated generic shard. No name or number printed on the icon. If the actual hero portrait has not been supplied, request it before generating this asset.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, unrelated character, full-body scene, hands outside the item, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 09 — bt_fragment_3

**ชื่อจริง:** Breakthrough Fragment III

**คำอธิบาย:** เศษหินเลื่อนขั้น 3

**หน้าที่ในเกม:** เศษหินชนิดเดียวกัน 10 ชิ้นรวมเป็น bt_stone_3 1 ชิ้น; จำนวนเป็นข้อมูลUI ไม่วาดในภาพ ข้อกำหนดใหม่:ต้องเป็นของฮีโร่ที่ระบุ; runtimeยังไม่แยกเจ้าของและยังไม่มีสูตรแปลงเป็นหินรวม

**รูปทรงเสนอ:** หินหรือเศษหินตามระดับเดิม มีช่องภาพฮีโร่จริงที่อ่านหน้าออก

**สี/วัสดุเสนอ:** ใช้สี/วัสดุเดียวกับ bt_stone_3

**จุดที่ต้องตรวจ:** ห้ามเป็นหินเต็มก้อน/แร่ดิบ/เศษโลหะ; ต้องเข้าคู่กับ bt_stone_3; ไม่วาด10:1; ต้องแนบportraitฮีโร่ที่ถูกตัว ห้ามใช้ภาพgenericหรือสลับฮีโร่

**ไฟล์ที่ส่ง:** `bt_fragment_3__{heroId}.png` → แผนruntime `public/items/heroes/{heroId}/bt_fragment_3.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One large broken wedge fragment from the three-ridged opalescent crown crystal breakthrough stone, not a complete stone. Preserve its opalescent ivory-blue crystalline material and the same facet language as its matching whole item. Show one sharp polished outside face and one broad jagged freshly fractured inside surface, with two tiny intact gold prong remnants along its lower edge. The broken silhouette has a conspicuous diagonal missing top, making it unmistakably a fragment at 32 pixels. The metal remnants belong to the shard. Keep it a single readable fragment rather than a pile of crystals. IMPORTANT USER CORRECTION: This is NOT a generic shared breakthrough stone. It belongs exclusively to [HERO_ID]. Use the attached canonical [HERO_PORTRAIT_REFERENCE] image as a recognizable protected portrait inset inside the crystal. Keep the actual hero face, hairstyle, skin tone, gender and outfit from that reference; do not invent a different person or reuse Bai Long for every hero. The portrait window should occupy roughly 40-50% of the visible front face, leaving the tier-specific crystal silhouette and gold fittings visible. Do not tint the face so strongly that identity is lost. For a fragment, place the broken edges around a still-readable identity inset; do not remove the face or turn it into an unrelated generic shard. No name or number printed on the icon. If the actual hero portrait has not been supplied, request it before generating this asset.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, unrelated character, full-body scene, hands outside the item, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 10 — skill_tome_1

**ชื่อจริง:** Skill Tome I

**คำอธิบาย:** ตำราสกิล I

**หน้าที่ในเกม:** ใช้เพิ่ม rank สกิล: Rank1→2 ใช้2เล่ม; Rank2→3 ใช้ I 4เล่มร่วมกับ II 1เล่ม (ยังมีเงื่อนไขเกมอื่น); ไม่ใช่ตำราเฉพาะS1

**รูปทรงเสนอ:** สมุดบางปิดเล่ม คล้องสายเดียว ตราวงกลมเรียบ

**สี/วัสดุเสนอ:** หนังเขียวป่า #3F775B / กระดาษงาช้าง / ทองเก่า

**จุดที่ต้องตรวจ:** ไม่ใส่S1/ตัวหนังสือ/เลขI; ไม่ทำเป็นคัมภีร์หนาสูงสุดหรือหนังสือเปิด

**ไฟล์ที่ส่ง:** `skill_tome_1.png` → แผนruntime `public/items/skill_tome_1.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One closed slim skill tome in a three-quarter view, its forest-green leather cover facing the viewer and a narrow ivory page block visible at the lower right. One simple dark leather strap with an antique-gold clasp crosses the cover. A small embossed circular starburst seal sits centrally, with no writing or readable glyphs. Use modest rounded gold corner protectors and light signs of careful use; the thin book-and-single-strap silhouette denotes the entry skill manual.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 11 — skill_tome_2

**ชื่อจริง:** Skill Tome II

**คำอธิบาย:** ตำราสกิล II

**หน้าที่ในเกม:** ใช้ร่วมในการเพิ่ม Rank2→3 (1เล่ม) และ Rank3→4 (4เล่ม); เป็นระดับตำรา ไม่ใช่สกิลS2

**รูปทรงเสนอ:** หนังสือหนาปานกลาง แถบสันคู่ มุมเหลี่ยมและเข็มขัดคู่

**สี/วัสดุเสนอ:** หนังน้ำเงินคราม #315C93 / งาช้าง / ทองเก่า

**จุดที่ต้องตรวจ:** ไม่ใส่S2/เลขII; แยกจากเล่มเขียวด้วยทรงและตัวล็อก ไม่ใช่เปลี่ยนสีอย่างเดียว

**ไฟล์ที่ส่ง:** `skill_tome_2.png` → แผนruntime `public/items/skill_tome_2.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One closed medium-thickness skill grimoire, deep sapphire-blue leather, two raised spine bands and two narrow aligned metal-and-leather clasps. Show a visible ivory page block and refined antique-gold corner plates. The cover bears a large embossed interlocking diamond seal without letters, with a tiny blue glass inlay at its center. Match the viewing angle, leather grain and light direction of the slim green tome; distinguish this tier by a thicker rectangular silhouette, two clasps, and more deliberate metalwork.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 12 — skill_tome_3

**ชื่อจริง:** Skill Tome III

**คำอธิบาย:** ตำราสกิล III

**หน้าที่ในเกม:** ใช้เพิ่ม Rank4→5 ตามปัจจุบัน 5เล่ม; ไม่ใช่ตำราเฉพาะUltimate

**รูปทรงเสนอ:** คัมภีร์หนา สันเสริมโลหะ ตัวล็อกกลางทรงโล่

**สี/วัสดุเสนอ:** หนังแดงไวน์ #922D35 / ขอบหน้างาช้าง / ทองเก่า

**จุดที่ต้องตรวจ:** ไม่ใช้ธีมม่วงดำ; ไม่ใส่ULT/เลขIII/ตัวหนังสือ; ไม่แปลงเป็นเครื่องประดับ

**ไฟล์ที่ส่ง:** `skill_tome_3.png` → แผนruntime `public/items/skill_tome_3.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One closed heavy master skill grimoire, deep wine-red leather with an antique-gold reinforced spine and one bold shield-shaped central clasp. A thick layered ivory page block and three clearly raised spine ribs distinguish it from the lower tomes. Add restrained engraved gold corner armor and a luminous but small ivory cover inlay. The book must still feel like a usable leather-bound manual, not a jewelry box or an altar. Keep its complex fittings subordinate to the broad readable red-book silhouette.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 13 — skill_tome_frag_1

**ชื่อจริง:** Skill Tome Fragment I

**คำอธิบาย:** เศษตำราสกิล 1

**หน้าที่ในเกม:** เศษตำราชนิดเดียวกัน 10 ชิ้นรวมเป็น skill_tome_1 1 เล่ม

**รูปทรงเสนอ:** มุมปกขาดติดหน้ากระดาษฉีกสองชั้น

**สี/วัสดุเสนอ:** ใช้สีปก/ตราเดียวกับ skill_tome_1

**จุดที่ต้องตรวจ:** ต้องดูเป็นเศษปก+กระดาษ ไม่ใช่หนังสือจิ๋ว; จับคู่ skill_tome_1; ไม่วาด10/ตัวหนังสือ

**ไฟล์ที่ส่ง:** `skill_tome_frag_1.png` → แผนruntime `public/items/skill_tome_frag_1.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One clearly torn corner fragment of the forest-green skill tome, with one torn strap edge and a partial circular starburst embossed cover motif. A broad irregular leather cover scrap remains attached to two visibly torn ivory paper layers. Show fibrous paper edges and a broken binding seam; the main silhouette is an uneven L-shaped page-and-cover scrap, not a whole book, a scroll, a crystal or a metal plate. Keep the family leather color, gilding and surface treatment identical to its matching complete tome. No readable marks on the paper.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 14 — skill_tome_frag_2

**ชื่อจริง:** Skill Tome Fragment II

**คำอธิบาย:** เศษตำราสกิล 2

**หน้าที่ในเกม:** เศษตำราชนิดเดียวกัน 10 ชิ้นรวมเป็น skill_tome_2 1 เล่ม

**รูปทรงเสนอ:** มุมปกขาดติดหน้ากระดาษฉีกสองชั้น

**สี/วัสดุเสนอ:** ใช้สีปก/ตราเดียวกับ skill_tome_2

**จุดที่ต้องตรวจ:** ต้องดูเป็นเศษปก+กระดาษ ไม่ใช่หนังสือจิ๋ว; จับคู่ skill_tome_2; ไม่วาด10/ตัวหนังสือ

**ไฟล์ที่ส่ง:** `skill_tome_frag_2.png` → แผนruntime `public/items/skill_tome_frag_2.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One clearly torn corner fragment of the deep sapphire-blue skill tome, with a partial narrow gold clasp and a partial interlocking diamond embossed cover motif. A broad irregular leather cover scrap remains attached to two visibly torn ivory paper layers. Show fibrous paper edges and a broken binding seam; the main silhouette is an uneven L-shaped page-and-cover scrap, not a whole book, a scroll, a crystal or a metal plate. Keep the family leather color, gilding and surface treatment identical to its matching complete tome. No readable marks on the paper.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 15 — skill_tome_frag_3

**ชื่อจริง:** Skill Tome Fragment III

**คำอธิบาย:** เศษตำราสกิล 3

**หน้าที่ในเกม:** เศษตำราชนิดเดียวกัน 10 ชิ้นรวมเป็น skill_tome_3 1 เล่ม

**รูปทรงเสนอ:** มุมปกขาดติดหน้ากระดาษฉีกสองชั้น

**สี/วัสดุเสนอ:** ใช้สีปก/ตราเดียวกับ skill_tome_3

**จุดที่ต้องตรวจ:** ต้องดูเป็นเศษปก+กระดาษ ไม่ใช่หนังสือจิ๋ว; จับคู่ skill_tome_3; ไม่วาด10/ตัวหนังสือ

**ไฟล์ที่ส่ง:** `skill_tome_frag_3.png` → แผนruntime `public/items/skill_tome_frag_3.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One clearly torn corner fragment of the wine-red skill tome, with a small reinforced gold corner and a partial shield-shaped embossed cover motif. A broad irregular leather cover scrap remains attached to two visibly torn ivory paper layers. Show fibrous paper edges and a broken binding seam; the main silhouette is an uneven L-shaped page-and-cover scrap, not a whole book, a scroll, a crystal or a metal plate. Keep the family leather color, gilding and surface treatment identical to its matching complete tome. No readable marks on the paper.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 16 — equip_frag_basic

**ชื่อจริง:** Basic Equipment Fragment

**คำอธิบาย:** เศษอุปกรณ์ Basic

**หน้าที่ในเกม:** ใช้สร้างอุปกรณ์ระดับ Uncommon: 25เศษ +300ทอง; อย่าสับสนว่าใช้สร้างCommon

**รูปทรงเสนอ:** แผ่นเหล็กแตกชิ้นหนา ทรงสี่เหลี่ยมคางหมู มีรูหมุดเดียว

**สี/วัสดุเสนอ:** เหล็กอุ่น #7D8586 / สัมฤทธิ์หม่น / เขียวหยกเล็กน้อย

**จุดที่ต้องตรวจ:** ต้องเป็นเศษโลหะ ไม่ใช่อัญมณี; ไม่วาดอุปกรณ์สมบูรณ์/จำนวน25/กรอบrarity

**ไฟล์ที่ส่ง:** `equip_frag_basic.png` → แผนruntime `public/items/equip_frag_basic.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One rugged broken equipment plate of warm iron, a chunky trapezoidal silhouette with one empty rivet hole, a folded edge and one visibly snapped corner. A modest dark-bronze rim and a tiny muted jade enamel remnant imply reclaimable low-tier equipment material. Show brushed metal and a clear thick fractured cross-section. It is a crafting fragment shared by weapons and armor, so do not make a recognizable complete sword, helmet or chestplate. No crystal body.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 17 — equip_frag_rare

**ชื่อจริง:** Rare Equipment Fragment

**คำอธิบาย:** เศษอุปกรณ์ Rare

**หน้าที่ในเกม:** ใช้สร้างอุปกรณ์ Rare: 40เศษ +800ทอง

**รูปทรงเสนอ:** แผ่นโลหะแตกทรงง่ามสองแฉก ขอบเงิน มีหมุดสองตำแหน่ง

**สี/วัสดุเสนอ:** เหล็กน้ำเงิน #356FA6 / เงิน #C3D1D8 / ทองเก่าเล็กน้อย

**จุดที่ต้องตรวจ:** ไม่เป็นผลึกฟ้าทั้งก้อน; ไม่ใส่ดาว/คำRare/จำนวน40; ใช้เศษชิ้นเดียว

**ไฟล์ที่ส่ง:** `equip_frag_rare.png` → แผนruntime `public/items/equip_frag_rare.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One broken high-quality equipment fitting shaped as a two-pronged metal plate. Sapphire-blue enamel covers part of a polished cool-steel body, with muted silver edging and two visible rivet sockets. One prong is cleanly broken, exposing dense forged metal, while a slim antique-gold incised line follows the intact edge. Keep it visibly manufactured metal with an angular plate silhouette, related to the basic iron fragment but more precise and refined. The blue surface is enamel, not a blue gemstone.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 18 — equip_frag_elite

**ชื่อจริง:** Elite Equipment Fragment

**คำอธิบาย:** เศษอุปกรณ์ Elite

**หน้าที่ในเกม:** ใช้สร้างอุปกรณ์ Elite: 70เศษ +2000ทอง

**รูปทรงเสนอ:** แผ่นเสริมเกราะแตกทรงเสี้ยวหนา มีสันซ้อนสามชั้น

**สี/วัสดุเสนอ:** เหล็กแดงดำ #692D30 / เคลือบแดง #B5483B / สัมฤทธิ์ทอง

**จุดที่ต้องตรวจ:** ไม่ใช่พระจันทร์/เครื่องประดับทั้งชิ้น; ไม่เป็นคริสตัลแดง; ไม่ใช้กองไฟบังรูปทรง

**ไฟล์ที่ส่ง:** `equip_frag_elite.png` → แผนruntime `public/items/equip_frag_elite.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One elite forged equipment fragment, a thick crescent-shaped broken reinforcement plate with three layered metal ridges and a conspicuous torn attachment lug. Deep crimson enamel sits over dark forged steel, edged with aged warm gold and bronze. One broken edge reveals the layered metal construction. Its curved crescent outline must differ from both the basic trapezoid and rare forked plate. Use controlled ember reflections on the metal, not floating fire or a bright crystal core.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 19 — equip_frag_epic

**ชื่อจริง:** Epic Equipment Fragment

**คำอธิบาย:** เศษอุปกรณ์ Epic

**หน้าที่ในเกม:** ใช้สร้างอุปกรณ์ Epic: 110เศษ +4000ทอง

**รูปทรงเสนอ:** แผ่นโลหะสลักแตกทรงพัดสามก้าน ผิวเคลือบงาช้าง

**สี/วัสดุเสนอ:** ทองเก่า #C5A15A / งาช้าง #F0E4C7 / ฟ้าแซฟไฟร์จุดเล็ก

**จุดที่ต้องตรวจ:** ห้ามเป็นRelic/ตราราชวงศ์สมบูรณ์/อัญมณีก้อน; ไม่มีคำEpic/ดาว/จำนวน110

**ไฟล์ที่ส่ง:** `equip_frag_epic.png` → แผนruntime `public/items/equip_frag_epic.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One epic equipment crafting fragment: a broken fan-shaped gilded metal plate with three broad structural ribs, one missing attachment corner and a thick exposed forged cross-section. Ivory enamel panels sit between antique-gold ribs, with one tiny sapphire rivet head as an accent. Use refined engraved edge work and a soft warm highlight, while the broken plate outline stays dominant at small sizes. It is precious manufactured equipment scrap, not a complete royal badge, finished relic, crystal cluster or pile of coins.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 20 — enhancement_ore

**ชื่อจริง:** Enhancement Ore

**คำอธิบาย:** แร่เสริมพลังอุปกรณ์

**หน้าที่ในเกม:** ใช้ตีบวกอุปกรณ์; ปริมาณแร่ขึ้นกับrarityและระดับตีบวก และมีค่าทองร่วมด้วย

**รูปทรงเสนอ:** ก้อนแร่ดิบเหลี่ยมขรุขระ ฐานหินเข้ม เส้นแร่ส้มทอง

**สี/วัสดุเสนอ:** บะซอลต์เทา #39464D / แร่ส้มทอง #F0A34A / แสงขาวอุ่น

**จุดที่ต้องตรวจ:** ไม่เป็นแท่งโลหะ/คริสตัลเจียระไน/ก้อนลาวาที่มีไฟล้อม; ไม่มีค้อนหรือทั่งพ่วงในasset

**ไฟล์ที่ส่ง:** `enhancement_ore.png` → แผนruntime `public/items/enhancement_ore.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One irregular raw enhancement-ore nugget, a dense dark basalt-like rock with several broad angular chipped faces. Molten amber-orange mineral veins run through the stone, ending in two small bright metallic inclusions. Its chunky asymmetrical geological silhouette must read as raw forge material, with rough stone texture and restrained warm inner light. No gold socket, ring, jewelry mount or clean symmetric cut; it must be visually distinct from the crafted breakthrough crystals and from manufactured equipment plate fragments.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## 21 — universal_memory

**ชื่อจริง:** Universal Memory

**คำอธิบาย:** ความทรงจำสากล

**หน้าที่ในเกม:** ใช้แทนHero Memoryเพื่อพัฒนาดาวของฮีโร่ใดก็ได้ โดยใช้Memoryของฮีโร่ตัวนั้นก่อน; ไม่ใช่Memoryเฉพาะไป๋หลง

**รูปทรงเสนอ:** ปริซึมดาวสี่แฉกกลางวงโอบทองเปิดสองปลาย

**สี/วัสดุเสนอ:** ขาวมุก #E8F3FC / ฟ้าอ่อน #97DAF1 / ทอง #D9B76C

**จุดที่ต้องตรวจ:** ไม่ใช้ใบหน้าไป๋หลง/ฮีโร่ใด; ไม่ใช่เหรียญหรือHero Memoryรายตัว; ไม่มีเลข/ตัวอักษร

**ไฟล์ที่ส่ง:** `universal_memory.png` → แผนruntime `public/items/universal_memory.webp`

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One universal-memory talisman: a single opalescent four-point faceted star prism suspended at the center of a thin antique-gold open crescent ring. The two open ring tips are clearly separated, making it unlike a coin or a closed medallion. Pearl-white and faint icy-cyan reflections cross the star, with a restrained gold core and a tiny internal swirl of light. The dominant outline is a radiant four-point star within an open arc, representing memory usable by any hero. Keep it iconic, clean and precious. No human face, character portrait, card, book or character-specific emblem.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```

## Concept หินเลื่อนขั้นรวม — เลื่อนขั้นครบแล้วแปลง1:1

ไม่มีportraitฮีโร่ ใช้ตราประตูสามยอด สีขาวมุก/ฟ้าอ่อน/ทอง เป็นวัสดุคนละชนิดกับUniversal Memory รูปยังเป็นconcept; ผู้ใช้ยืนยันให้แปลงหินส่วนเกินเฉพาะตัวเป็นหินรวม1:1เมื่อฮีโร่เลื่อนขั้นครบ ไม่กำหนดtier/IDruntimeใหม่ในงานนี้

```text
Create exactly one isolated inventory material icon for Eldervane, a premium Japanese/Korean high-fantasy mobile RPG. Polished hand-painted 2.5D game item art with believable dimensional materials, crisp designed edges, broad readable surface planes and restrained antique-gold craftsmanship. Use the stated item silhouette and palette; avoid a purple-and-black default aesthetic. Show the object at a consistent slight three-quarter angle, its front and right-hand thickness visible, with warm neutral key light from the upper left, gentle cool fill, and a clear silhouette against both dark charcoal and pale ivory interfaces. Keep major features readable at 32, 48 and 64 pixels; prioritize shape and material over fine ornament. Center the complete object in one square 512x512 canvas, occupying roughly 75-80% of its width and height, with at least 10% clear padding on every side. True transparent RGBA background, sharp clean alpha edges, fully solid object materials, and only a restrained local alpha glow if specified. Do not add any inventory-tile frame, surrounding square border, background scene, floor, pedestal, cast-shadow rectangle, labels, letters, numerals, stars denoting rarity, quantity badges, logos or watermark. Abstract non-readable geometric ornament is acceptable. Output one item only, not a contact sheet, collage or multiple views.

ITEM SUBJECT:
One universal breakthrough catalyst stone, a broad intact hexagonal opalescent crystal monolith embraced at its base by restrained antique-gold prongs. The central front face carries an abstract three-spire gateway seal made of gold light, with no portrait, human silhouette or character-specific insignia. Pearl-white facets reflect faint cyan and warm amber; the shape is a crafted growth stone, not the four-point star-and-open-ring Universal Memory talisman. Keep the catalyst silhouette bold and readable. It represents a shared breakthrough resource obtained by converting surplus hero-bound breakthrough stones one for one after that hero has completed all breakthroughs, as explicitly confirmed by the user, but do not draw a conversion arrow, rate, tier number or recipe. This is an art concept only; the confirmed conversion is one hero-bound stone to one universal stone after the hero is fully broken through; no runtime item ID or cross-tier conversion policy is being assigned.

Negative prompt: text, typography, readable runes, Roman numerals, numbers, rarity badges, inventory border, UI tile, opaque background, fake checkerboard transparency, scene, landscape, pedestal, floor shadow, character, hands, cropped object, cut-off glow, multiple unrelated items, flat emoji, simplistic vector placeholder, pixel art, blurry edges, dense micro-detail, excessive bloom, neon purple-black styling, oversaturated rainbow light, watermark.
```
