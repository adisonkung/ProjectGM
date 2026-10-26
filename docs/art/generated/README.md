# Eldervane — อาร์ตที่นำเข้าเกมและงานคงเหลือ

วันที่ 26 ต.ค. 2026 · งาน `wip/codex-generated-art-integration` ต่อจากชุด UI/อาร์ตที่ผู้ใช้ตรวจในแชท (`9c20198`) · ไม่ Deploy

## นำเข้าแล้ว

รวม **103 ไฟล์ WebP** ใน `public/ui/generated/` มี URL/ที่มา/SHA-256/สถานะรายไฟล์ใน [manifest.json](manifest.json)

| กลุ่ม | จำนวน | จุดใช้งาน |
| --- | ---: | --- |
| เมนูหลัก | 6 | Shared header / เมนูทั่วเกม |
| ปุ่มบันทึก แก้ไข ตั้งค่า ล็อก ย้อนกลับ ถัดไป | 6 | Shared Icon/CitadelIcon และปุ่มที่เรียกใช้ |
| อาชีพ | 6 | Home party, Heroes, Hero detail, จัดทัพ, summon pool — นักฆ่าม่วง นักสู้แดงเข้ม ใช้ดาบ/คทาทรงยาวรุ่นที่ผู้ใช้เลือก |
| ระบบหลัก | 6 | Tower / Forge / Bag / Training / Ascension / Skill Hall |
| ปุ่มต่อสู้ | 6 | เล่นต่อ / หยุด / เร็ว / เริ่มใหม่ / ออก / ปิด มีสีสื่อความหมาย |
| ปุ่มงานอุปกรณ์ | 6 | สร้าง / ตีบวก / ย่อย / ล่า / ค้นหา / กรอง |
| ค่าสถานะ | 22 | Base stats และ equipment stat lines; ผูกครบ 21 EquipStat + 7 Stats keys โดย ATK flat/% ใช้รูปเดียวกัน |
| วัสดุที่ไม่ผูกฮีโร่ | 15 | ยา EXP, ตำรา/เศษตำรา, เศษอุปกรณ์, แร่, Universal Memory — Forge / Growth / Skills / dungeon / tower / battle rewards ใช้ ID จริง |
| เงิน / เพชร / EXP | 3 | Header wallet และหน้ารางวัล/ค่าใช้จ่าย |
| เกราะ + เครื่องประดับฐานเดิม | 2 | กระเป๋า/สวมใส่/Forge; ยังเป็นฐานเดียวหลาย Tier ระหว่างรอผลิตชุดใหม่ |
| ดาบ 5 Tier + ออร่า 5 ชั้น | 10 | ทุกฐานช่อง WEAPON แสดงดาบตาม rarity; ใช้ master เดียวกันใน Forge/กระเป๋า/ช่องสวมใส่; ออร่าแยกไฟล์ |
| ฉากเตาหลอมเปล่า | 1 | ภาพ showcase เหนือเตาหลอม |

**89 ไฟล์เชื่อมกับระบบแสดงภาพแล้ว** บางรูปปรากฏเฉพาะเมื่อมีค่าสถานะ/สถานะปุ่มนั้น หรือในคลังอาร์ต GM ไม่ได้แปลว่าทุกรูปถูกโหลดทุกหน้า ส่วนภาพที่ไม่มีจุดเรียกเดิม (เช่นปุ่ม pause/close บางจุดเป็น SVG ภายใน) ต้องไล่แทนเพิ่มตามรายการด้านล่าง

## เก็บในเกมเพื่อดูตัวอย่าง แต่ไม่ใช้แทนข้อมูลจริง

เปิดจาก **บัญชี → คลังอาร์ตเกม · GM** (`/art-catalog` มี GM guard ตาม GameAccessService; ตอนนี้ทุกคนเป็น GM ตามคำสั่งก่อนหน้า)

| กลุ่ม | จำนวน | สถานะ |
| --- | ---: | --- |
| หิน/เศษหินไป๋หลง I–III | 6 | `example_paused` — พักจนเปลี่ยน Portrait; ห้ามใช้แทนหินทุกฮีโร่ |
| Universal breakthrough concept | 1 | `concept_only` — ยังไม่มี item ID/ระบบแปลงใช้งานจริง |
| Board 5 Tier + ตัวอย่าง Forge/Inventory/Equipped + ร่างหน้า Forge | 3 | `concept_only` — เป็นภาพออกแบบทั้งแผ่น ไม่ใช่ไอเทมแยก ไม่ใช่ screenshot เกม |
| ดาบ/มีด/ธนู/คทาชุดฐานเก่า | 4 | `superseded` — เก็บเทียบงานเดิม ปัจจุบัน weapon art ใช้ดาบ 5 Tier |

ไม่รวมภาพที่ผู้ใช้ปฏิเสธหรือเวอร์ชันทดลองซ้ำ: นักสู้สีส้ม, นักฆ่าสีแดง, ดาบ/คทาทรงอ้วน ฯลฯ ชุดที่นำเข้าคือเวอร์ชันเลือกใช้ล่าสุด ภาพ logo, hero-memory, summon cards และฉากก่อนหน้าที่อยู่ใน runtime แล้วคงไว้ ไม่ทำสำเนาซ้ำ

## ยังเหลืออะไรบ้าง

- [ ] **อาร์ตแยกเกราะ 5 Tier** — ตอนนี้มี board + รูปเกราะฐานเดิม 1 แบบ
- [ ] **อาร์ตแยกสร้อย 5 Tier และแหวน 5 Tier** — รวม 10 รูป; ยังมีเพียง concept board, ช่อง ACCESSORY ใช้ trinket ฐานเดิม
- [ ] ออร่าที่ออกแบบเฉพาะเกราะ/สร้อย/แหวน — ปัจจุบันใช้ชุดออร่า Tier ร่วมเป็นงานระหว่างรอ
- [ ] รูปฮีโร่สวมชุด/ถืออาวุธจริง หรือ sprites ที่เปลี่ยนตามอุปกรณ์ — ยังไม่ได้ผลิตแยก; ภาพตัวละครใน board เป็นเพียงแนวทาง
- [ ] แยกช่องสร้อย/แหวน/Relic และออกแบบ save migration/recipe/drop/equip rules — ปัจจุบันยัง 3 ช่อง WEAPON/ARMOR/ACCESSORY, ไม่เพิ่มช่องจากภาพแบบร่าง
- [ ] รวม **ระบบอาวุธเป็นดาบอย่างเดียว** ในระดับ gameplay — รอบนี้เปลี่ยนเฉพาะภาพ weapon; IDs `heavy_blade/twin_daggers/longbow/focus_staff`, family restrictions, stats, range และเซฟเดิมคงอยู่ ต้องทำ migration/กติกาแยกต่างหาก ไม่อ้างว่ารวมระบบเสร็จแล้ว
- [ ] เปลี่ยน Portrait ก่อนผลิตหินรายฮีโร่ต่อ — ใช้ไป๋หลงเป็นตัวอย่างเท่านั้น
- [ ] ระบบหินผูกฮีโร่ และแปลงส่วนเกินเป็นหินรวม **1:1 เมื่อฮีโร่เลื่อนขั้นครบ** — ยืนยัน requirement แล้ว แต่ยังไม่ลงระบบ; หิน BT ทั้ง 6 ID เดิมยังใช้ glyph กลาง ห้ามติดหน้าไป๋หลงกับหินรวมเดิม
- [ ] แทน inline SVG/ข้อความที่ยังเหลือ เช่น close ที่วาดเฉพาะในบางหน้าต่าง, pause emblem ขนาดใหญ่, status/affix glyphs และไอคอนที่ยังไม่ Gen เช่น import/load, lab, palette, fullscreen, people, skull/crown, star, generic sword/book/crystal — มี fallback เดิมให้ทำงานต่อ
- [ ] แอนิเมชันออร่า/particle/CG ของอุปกรณ์ — ไฟล์รอบนี้เป็น static transparent layers ไม่ใช่วิดีโอหรือ spritesheet
- [ ] ผู้ใช้ตรวจภาพจริง desktop/mobile และความอ่านง่ายเมื่อไอคอนเล็ก; ยังไม่ยืนยันว่าเหมือน ref เป๊ะหรืออนุมัติสวยงามแทนผู้ใช้
- [ ] Review/merge/deploy — ยังไม่ทำ ไม่มีการเปลี่ยน production master

## การเชื่อม

- `src/app/core/data/generated-art.ts`: semantic icon paths, stat aliases และ catalog metadata
- Shared `IconComponent`/`CitadelIconComponent`: ใช้ภาพเมื่อมี key, glyph เดิมเมื่อยังไม่มีอาร์ต
- `EquipmentArtComponent`: แยก foreground/aura, `context="forge"` สำหรับฉาก showcase, opacity ไล่ .22/.5/.75/.85/1
- ไม่มีการแก้ combat engine, equipment rules, hero canonical portraits/sprites, recipe values หรือ save format
- หลักฐาน screenshot จริงและคู่เทียบอยู่ใน [review/README.md](review/README.md)

รายการนี้ supersedes สถานะ `not_started` ของไฟล์ prompt เดิมเฉพาะ **งานภาพ 15 material ที่ระบุ** ส่วน prompt หินฮีโร่ยังเป็น backlog ไม่ถือว่าระบบผูกฮีโร่เสร็จเพราะมีภาพตัวอย่าง
