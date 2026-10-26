# Eldervane — ไอคอนสถานะต่อสู้31แบบ

26 ต.ค.2026 · สาขา `wip/codex-status-icon-art` · base `d5eaa70` · ยังไม่merge/Deploy

## ดูภาพ

- [ครบ31แบบจากคลังเกมจริง](review/status-catalog-desktop.webp) · [มือถือ](review/status-catalog-mobile.webp)
- [อาร์ตต้นฉบับเทียบกับการแสดงในเกม](review/art-comparison.webp)
- [ระบบต่อสู้จริงในห้องทดลอง · poison/Draeven · DOM](review/engine-status-desktop.webp) · [จอแนวนอน](review/engine-status-landscape.webp)
- [ระบบต่อสู้จริงในห้องทดลอง · chill/Sylvara · Pixi](review/engine-chill-desktop.webp)
- แผ่นอาร์ตโปร่งใส: [คำสาป/โลหิต/น้ำแข็ง/พิษ](../../../public/ui/status/afflictions.webp) · [ควบคุม/เลือด/หมอก/วิญญาณ](../../../public/ui/status/control.webp) · [ป้องกัน/เกราะ/ผู้พิทักษ์](../../../public/ui/status/wards.webp) · [คลั่ง/หมาป่า/ยั่วยุ](../../../public/ui/status/fury.webp)

## ขอบเขต

- Genใหม่31สัญลักษณ์ ครอบคลุมทุกIDที่เคยแสดงใน `STATUS_ICONS` ณbaseข้างต้น ต่างทั้งรูปทรงและสี เช่นพิษเป็นหยดเขียว เลือดไหลเป็นรอยกรงเล็บ ตรึงรากเป็นรากพันเท้า และยั่วยุเป็นตราท้าทาย
- จัดเป็น4แผ่นโปร่งใส3×3 (8/8/8/7ไอคอน) ช่องที่ไม่ใช้เว้นว่าง; runtime WebP1024 แสดงหนึ่งช่องเต็มด้วยCSSatlas ไม่cropหรือวาดทับชิ้นงาน ใช้ร่วมกันเพื่อลดจำนวนrequest
- `StatusIconComponent` แสดงชื่อไทยและเวลาคงเหลือจริงผ่านtitle/aria-label; ขนาดสนาม22px, คลังGMมี72/28/22pxเพื่อดูความอ่านง่าย กรอบรองพื้นเข้มช่วยแยกจากฉากสว่าง
- ตัวแสดงสถานะอยู่ในBoardเดียวกันที่ใช้ทั้งต่อสู้ปกติและSprite Lab ทั้งDOM/Pixi; แถวสถานะพับเมื่อเกิน4ไอคอนต่อแถว ไม่ขยายออกแนวนอน
- ไม่เพิ่มสถานะ ไม่เปลี่ยนeffect ID/ค่าพลัง/ระยะเวลา/การกรองหรือระบบบันทึก มีfallbackสัญลักษณ์กลางเมื่อได้รับIDที่ยังไม่มีอาร์ต
- Emojiเดิมใน `visuals.ts` ยังเป็นmetadataเก่าสำหรับcompatibility แต่Boardไม่แสดงเป็นEmojiแล้ว ใช้ `statusId` หาอาร์ตโดยตรง
- คลังGMเพิ่มหมวด `status-icons` และแผ่นต้นฉบับใน `status-atlas`; ภาพเมนู/อาชีพ/วัสดุ/อุปกรณ์เดิมคงอยู่

## ผลตรวจ

App/spec typecheckผ่าน, production buildผ่าน, unit tests **831/831ผ่าน**; ยังคงมีbudget/style/Pixi warningsของโปรเจกต์ ไม่ปรับbudget

[Browser validation](review/validation.json):31ไอคอน/31ช่องไม่ซ้ำ,4แผ่นโหลดได้, ไม่มีpage error/ภาพสถานะหาย/แนวนอนล้น, ตรวจcatalog1440×1000/390×844 และสถานะจริงจากengine preview1440×1000/844×390 ในDOMและPixi ภาพเกมไม่แต่งเฟรม ไม่อ้างว่าเหมือนอาร์ตทุกพิกเซลที่ขนาด22px

[Manifest](manifest.json) ระบุsource/hash/alpha/ช่อง/คำอธิบายไอคอน ภาพPNGต้นฉบับคงอยู่ในworkspace generated_images; ไม่เขียนทับต้นฉบับ

## ยังเหลือ

- ไอคอนทั่วไป/เมนูที่ยังเป็นSVG, อาร์ตมอนสเตอร์จำลอง, หินรายฮีโร่ที่พักรอPortrait และงานRelic/เปลี่ยนชุดจริง ยังอยู่นอกชุดนี้
- สถานะอื่นที่ไม่ได้อยู่ในรายการแสดง `STATUS_ICONS` เดิมยังไม่ได้เพิ่มbadgeใหม่อัตโนมัติ ต้องเลือกความเหมาะสม/ลดความรกก่อน
- ผู้ใช้ตรวจความสวยงามและขนาดไอคอนก่อนmerge/Deploy
