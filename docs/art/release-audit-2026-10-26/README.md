# Eldervane — ตรวจวนภาพเก่า/ใหม่และนำขึ้นเว็บหลัก

26 ต.ค.2026 · ผู้ใช้สั่ง “เอาเข้าเกมให้หมดที่Genมาใหม่และของเก่าวนตรวจสอบ” หลังชี้แจงว่างานไอคอนยังอยู่taskbranch จึงอนุญาตนำงานที่ค้างเข้าmaster/Cloudflare production

## ผลตรวจ

- App/spec TypeScriptผ่าน, production buildผ่าน, **835/835testsผ่าน**; style/Pixi warningsเดิมยังอยู่ ไม่ปรับbudget
- [Browser audit](browser.json): **51views** เดสก์ท็อป1440×1000/มือถือ390×844 รวมHome, Heroes,5hero tabs,จัดทัพ,กระเป๋า,Forge3tabs,กาชา,หอคอย,ดันเจี้ยน4ประเภท,บัญชี,ห้องทดลอง,คลัง4หมวด/ตัวอย่างที่พักและพักรบจริง
- [Asset audit](assets.json):148WebPของชุดUI/วัสดุ/อุปกรณ์/atlas รวมไฟล์ดูใหญ่และแบบเก่าที่เก็บไว้ โหลดdecodeได้ครบ ไม่มีmissingfile/ชื่อไอคอนliteralที่ไม่มีรูป/HTTPภาพหาย/pageerror/แนวนอนล้นในการตรวจ
- [Hero art audit](heroes.json):12ฮีโร่ × portrait/banner/S1/S2/Ultimate รวม60ไฟล์เดิมโหลดได้ครบ รวมDraevenล่าสุด ไม่แก้ภาพฮีโร่ในรอบตรวจนี้
- เปิดดูหน้า/คลังไม่เปลี่ยนเซฟ ใช้local fixtureแยก มี20อุปกรณ์5TierและวัสดุตามIDจริงสำหรับตรวจ การต่อสู้ทดสอบเริ่มในbrowserแยก ไม่มีการแตะเซฟผู้เล่น

## ชุดที่รวมเข้าเว็บ

| ชุด | จำนวน | จุดแสดง |
| --- | ---: | --- |
| สถานะ | 36 | เหนือหัวในBattle/Sprite Lab,ชื่อไทย/เวลาจริง,รวม5สถานะฮีโร่ล่าสุด |
| สัญลักษณ์/เครื่องมือ | 18 | Shared Icon/CitadelIcon,บัญชี,ธีม/เต็มจอ,สัญลักษณ์พื้นฐาน |
| Affix | 13 | กระเป๋า/ตีบวก/ผลหลอม/คลัง,ค่าของEpicตรงrarity scaleจริง |
| วัสดุ | 15 | คลังวัสดุ/รางวัลดันเจี้ยน/พัฒนาฮีโร่/Forge/รางวัล |
| อุปกรณ์ | 20 | ดาบ/เกราะ/สร้อย/แหวนอย่างละ5Tier,แท่น/รายละเอียด/กระเป๋า/สวมใส่ |
| อาร์ตเดิม | ตามmanifest | เมนู6/อาชีพ6/ระบบ6/ปุ่มและstats22/เงิน-เพชร-EXP/ฉาก/โลโก้/กาชา |

คลังอาร์ตมี128รายการ:106active/12superseded/6example_paused/4concept_only; atlasนับเป็นแผ่นแต่แสดงไอคอนแยกได้ ชุดตัวอย่าง/แนวทางไม่ใช้แทนไอเทมจริง รุ่นที่ผู้ใช้ปฏิเสธไม่คืนมาใช้

## ภาพเกมจริงรอบตรวจ

[Home](images/home-desktop.webp) · [Forge](images/forge-desktop.webp) · [วัสดุ15แบบ](images/materials-stock.webp) · [Affixบนอุปกรณ์](images/owned-affix.webp) · [รางวัลตำรา](images/trial-desktop.webp) · [บัญชี/ปุ่ม](images/account-desktop.webp) · [พักรบ](images/battle-pause.webp)

ภาพอาร์ต/ภาพเทียบและการทำงานเฉพาะชุดอยู่ที่ [สถานะ36](../status-icons/README.md), [5สถานะฮีโร่](../status-icons/hero-five/README.md), [สัญลักษณ์18](../utility-icons/README.md), [Affix13](../affix-icons/README.md), [วัสดุ](../generated/completion/README.md), [อุปกรณ์/Forge](../forge-tier-showcase/README.md)

## ข้อยกเว้นที่คงตามคำสั่ง

- **พักมอนสเตอร์/บอสจนฮีโร่ครบ** ไม่มีไฟล์หรือข้อมูลมอนสเตอร์ถูกเปลี่ยนในงานชุดนี้
- หินรายฮีโร่พักรอPortraitใหม่, ตัวอย่างไป๋หลง6รูปอยู่คลังGM; ไม่ใส่หน้าไป๋หลงให้หินทุกฮีโร่
- Relic/ช่องสร้อยแหวนแยก/ระบบหิน1:1/ชุดสวมใส่ที่เปลี่ยนSprite ยังไม่มีระบบหรืออาร์ตผลิตจริง ไม่สมมติว่าเสร็จเพียงเพราะมีconcept
- ไม่ปรับbalance,effects,durations,save schemaหรือข้อมูลต่อสู้

สถานะmerge/productionให้ตรวจจากmasterและCloudflare checkของmerge commit เอกสาร “รอตรวจ/ยังไม่Deploy” ในโฟลเดอร์รอบผลิตเป็นsnapshotก่อนคำสั่งนำขึ้นเว็บครั้งนี้
