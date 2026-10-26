# ไอคอน material — พรอมป์ต์และสถานะอาร์ต

อัปเดต 26 ต.ค.2026: วัสดุที่ไม่ผูกฮีโร่15ภาพGenและเชื่อมruntimeแล้ว รวมช่องรางวัลดันเจี้ยนและคลังวัสดุในหน้าอุปกรณ์ ดู [สถานะล่าสุด/ภาพเกมจริง](../generated/README.md) ส่วนหินรายฮีโร่พักรอเปลี่ยนPortrait ตัวอย่างไป๋หลงเปิดดูได้ในคลังGM

รายละเอียดพรอมป์ต์และข้อความลงวันที่24–25ต.ค.ด้านล่างเป็นบันทึกแผนก่อนผลิต ไม่ใช่สถานะruntimeปัจจุบัน

ชื่อไอเทม,ID,จำนวน,รางวัลและโอกาสดรอปเป็นข้อมูลเกมจริง คำว่าmockหมายถึงภาพเท่านั้น ไม่ใช่ข้อมูลเกม

[รายการJSONสำหรับงานอาร์ตภายหลัง](backlog.json) · Rendererปัจจุบัน: `src/app/pages/dungeons/dungeon-reward-icon.component.ts` และ `src/app/shared/icon.component.ts`

## ชุดพรอมป์ต์พร้อมให้ AI เจน — 25 ต.ค.2026

- [รายละเอียดและพรอมป์ต์ครบ21รายการ](GENERATION_PROMPTS.md)
- [ดาวน์โหลดZIP:พรอมป์ต์แยกไฟล์ +คู่มือ +JSON +referenceฮีโร่](material-generation-prompts.zip)
- [JSONวัสดุ21รายการ](prompts.json)
- [JSONหิน/เศษหินเฉพาะ12ฮีโร่ รวม72แบบ](hero-breakthrough-prompts.json)
- [พรอมป์ต์conceptหินเลื่อนขั้นรวม](universal-breakthrough-concept.txt)
- [ผลตรวจID/ZIP/ลิงก์portraitจริง](prompt-pack-validation.json)

**ข้อกำหนดผู้ใช้ล่าสุด:** หินเลื่อนขั้นต้องเป็นของฮีโร่ตัวนั้น โดยใช้portraitจริงของแต่ละตัว; เมื่อฮีโร่เลื่อนขั้นครบแล้ว หินส่วนเกินของตัวนั้นแปลงเป็นหินรวม **1:1** ไปก่อน คำสั่งนี้บันทึกเป็นข้อกำหนดยืนยันแล้ว แต่โค้ดปัจจุบันยังเป็นหินกลางตามtierและยังไม่มีระบบผูกเจ้าของ/แปลงดังกล่าว งานรอบนี้สร้างเอกสารpromptเท่านั้น ไม่เปลี่ยนกติกา/เซฟในruntime

สี/ทรงในpromptเป็นข้อเสนออาร์ต ไม่ใช่assetที่genหรืออนุมัติแล้ว พรอมป์ต์เศษหินจับคู่ฮีโร่เตรียมให้ภาพสอดคล้องกัน แต่กติกาผสมเศษข้ามฮีโร่/วิธีแปลงอัตโนมัติหรือกดเอง/นโยบายtierหินรวมยังไม่กำหนด จึงไม่เดาเพิ่ม

## คิวหลัก 21 รายการ

| ประเภท | ID จริง | ชื่อในเกม | สถานะภาพ |
|---|---|---|---|
| ยา EXP | `exp_potion_s` | Small Training Potion | Mock SVG ชั่วคราว |
| ยา EXP | `exp_potion_m` | Medium Training Potion | Mock SVG ชั่วคราว |
| ยา EXP | `exp_potion_l` | Large Training Potion | Mock SVG ชั่วคราว |
| หินเลื่อนขั้น | `bt_stone_1` | Breakthrough Stone I | Mock SVG ชั่วคราว |
| หินเลื่อนขั้น | `bt_stone_2` | Breakthrough Stone II | Mock SVG ชั่วคราว |
| หินเลื่อนขั้น | `bt_stone_3` | Breakthrough Stone III | Mock SVG ชั่วคราว |
| เศษหิน | `bt_fragment_1` | Breakthrough Fragment I | ยังไม่มีอาร์ตรายไอเทม |
| เศษหิน | `bt_fragment_2` | Breakthrough Fragment II | ยังไม่มีอาร์ตรายไอเทม |
| เศษหิน | `bt_fragment_3` | Breakthrough Fragment III | ยังไม่มีอาร์ตรายไอเทม |
| ตำราสกิล | `skill_tome_1` | Skill Tome I | Mock SVG ชั่วคราว |
| ตำราสกิล | `skill_tome_2` | Skill Tome II | Mock SVG ชั่วคราว |
| ตำราสกิล | `skill_tome_3` | Skill Tome III | Mock SVG ชั่วคราว |
| เศษตำรา | `skill_tome_frag_1` | Skill Tome Fragment I | ยังไม่มีอาร์ตรายไอเทม |
| เศษตำรา | `skill_tome_frag_2` | Skill Tome Fragment II | ยังไม่มีอาร์ตรายไอเทม |
| เศษตำรา | `skill_tome_frag_3` | Skill Tome Fragment III | ยังไม่มีอาร์ตรายไอเทม |
| เศษอุปกรณ์ | `equip_frag_basic` | Basic Equipment Fragment | Mock SVG ชั่วคราว |
| เศษอุปกรณ์ | `equip_frag_rare` | Rare Equipment Fragment | Mock SVG ชั่วคราว |
| เศษอุปกรณ์ | `equip_frag_elite` | Elite Equipment Fragment | Mock SVG ชั่วคราว |
| เศษอุปกรณ์ | `equip_frag_epic` | Epic Equipment Fragment | Mock SVG ชั่วคราว |
| แร่ตีบวก | `enhancement_ore` | Enhancement Ore | Mock SVG ชั่วคราว |
| Memory | `universal_memory` | Universal Memory | Glyph ดาว / SVG ชั่วคราว |

## ข้อสังเกตสำหรับทำอาร์ตทีเดียว

- SVGยา3ขนาดเปลี่ยนสีตามID แต่ยังไม่ใช่อาร์ตรายไอเทมที่อนุมัติ
- หิน3ระดับใช้ทรงคริสตัล SVGร่วมกันและเปลี่ยนสี
- แร่ตีบวกและเศษอุปกรณ์ยังตกไปใช้รูปคริสตัลทั่วไป จึงควรออกแบบให้แยกประเภทได้ชัดที่สุด
- ตำรา3ระดับใช้SVGหนังสือร่วมกัน/เปลี่ยนสี
- เศษหินและเศษตำรา6รายการมีอยู่ในregistry แต่ยังไม่มีassetเฉพาะ และไม่ได้เป็นภาพหลักในpreviewดันเจี้ยนปัจจุบัน
- Universal Memoryในรายละเอียดใช้glyphดาว; memorySVGมีในrenderer แต่ยังไม่ใช่อาร์ตจริง
- EXPฮีโร่,ทอง,โอกาสดรอปอุปกรณ์และดาวผลการเล่นเป็นUIglyph ไม่ใช่materialใหม่ จึงไม่นับใน21รายการ
- อาวุธ/เกราะ/เครื่องประดับใน `EquipmentArtComponent` เป็นvectorตัวอย่างอีกชุด แยกงานequipmentออกจากmaterialนี้
- ภาพใหญ่ประจำดันเจี้ยน4ภาพเป็นของตกแต่งที่สร้างแล้ว ไม่ใช่ไอคอนmaterialหรือภาพบอสจริง

## แนวทางเมื่อเริ่มผลิตอาร์ต

ใช้รายการIDนี้เท่านั้น ไม่เพิ่มไอเทม/เปลี่ยนค่าเกม ทำmaster512×512พื้นโปร่งใส เผื่อขอบ10% แล้วตรวจที่32/48/64px แยกทรงเงาตามประเภท ไม่ใช้สีอย่างเดียวบอกความต่าง ภาษาภาพแฟนตาซีญี่ปุ่น–เกาหลี รายละเอียดทองเก่า/งาช้างและสีวัสดุชัด เพื่อเข้ากับRef

ชื่อไฟล์ที่วางแผนไว้ในJSONยังเป็นแผน ไม่ได้สร้างไฟล์ว่างหรือผูกpathที่ยังไม่มีเข้ากับเกม เมื่ออาร์ตแต่ละชิ้นผ่านการตรวจแล้วค่อยเชื่อมassetและอัปเดตstatus/approved

ข้อมูลอ้างอิง: `src/app/core/data/economy.ts` → `ITEMS` ไม่มีอาร์ตรายmaterialในpublicที่ใช้IDเหล่านี้ขณะทำลิสต์นี้


## อัปเดตการนำเข้าอาร์ต — 26 ต.ค. 2026

นำเข้าวัสดุที่ไม่ผูกฮีโร่ครบ15รูปแล้ว ดู [สถานะรายไฟล์และงานคงเหลือ](../generated/README.md) และ manifest. หินฮีโร่ยังพักรอ Portrait; ระบบผูกฮีโร่/แปลง1:1ยังไม่ implement. สถานะเก่าใน prompt package เป็น snapshot ก่อนนำเข้าอาร์ต ไม่ใช่สถานะ runtime ล่าสุด.
