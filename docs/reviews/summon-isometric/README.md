# ฉากเปิดกาชา Isometric

ฉากหลังยืนยันอัญเชิญใช้แท่นหินอ่อนตัดขอบทองตอนกลางคืน มุมกล้องเฉียงให้เห็นพื้นแท่นและความหนาของแต่ละชั้น กล้องค่อย ๆ ดันเข้า แสงกวาดตามวงสลัก แล้วไพ่ยกจากจุดกลางแท่นและพุ่งผ่านกล้องก่อนเข้าหน้าเลือกเปิดไพ่ ฉาก 3★ ใช้แสงอำพันและใช้เวลา 3.4 วินาที ส่วนระดับปกติใช้แสงฟ้าอ่อนและใช้เวลา 2.1 วินาที

ต้นแบบใช้เฟรมจังหวะเปิดกาชาบน [แผ่นอ้างอิง 10](../../design/eldervane-ui/10-summon-flow.png) และเฟรมเปิดตัวฮีโร่บน [แผ่นอ้างอิง 17](../../design/eldervane-ui/17-summon-information-reveal.png) แบบนี้ตั้งใจเปลี่ยนเวลากับมุมของฉาก และจัดไพ่ตามจำนวนที่ผู้เล่นได้รับจริงจากเกม

## ภาพจากเกมจริง

ใช้เซฟทดสอบใหม่ที่หน้า `/gacha` อัญเชิญ 10 ครั้งแล้วเปิดไพ่ทีละใบ ภาพคู่เทียบวางเฟรมเปิดกาชาจากแผ่นอ้างอิง 10 ไว้ซ้าย และช็อตปล่อยไพ่จากเกมไว้ขวา

| จอ | จังหวะแสงรวม | ไพ่พุ่ง | เลือกไพ่ | เปิดตัวฮีโร่ | ภาพคู่เทียบ |
|---|---|---|---|---|---|
| เดสก์ท็อป 1440 × 860 | [ภาพเกม](desktop-charge.png) | [ภาพเกม](desktop-release.png) | [ภาพเกม](desktop-cards.png) | [ภาพเกม](desktop-spotlight.png) | [คู่เทียบ](desktop-comparison.jpg) |
| มือถือแนวนอน 844 × 390 | [ภาพเกม](landscape-charge.png) | [ภาพเกม](landscape-release.png) | [ภาพเกม](landscape-cards.png) | [ภาพเกม](landscape-spotlight.png) | [คู่เทียบ](landscape-comparison.jpg) |

คลิปจากเกมจริง [เดสก์ท็อป](desktop.mp4) · [มือถือแนวนอน](landscape.mp4)

ตรวจใน Chrome ว่าจุดเริ่มของไพ่และแสงตรงกับกลางแท่นทั้งสองจอ ยืนยันการอัญเชิญ 10 ครั้ง เปิดทีละใบแล้วเปิดทั้งหมด และตรวจผลในเซฟเดิมหลังข้ามฉาก พร้อมทดสอบการอัญเชิญครั้งเดียวและ Reduced Motion ดูรายละเอียดใน [ผลทดสอบเบราว์เซอร์](browser-report.json) Typecheck ของแอปและเทสต์, production build และ Karma 1,014 เทสต์ผ่าน

## อาร์ตต้นฉบับ

สร้างด้วย ImageGen ในตัวโดยใช้แผ่นอ้างอิง 10 เป็นแนวทางของวัสดุและสถานที่ แล้วปรับมุมกล้องจากภาพร่างแรก ต้นฉบับเก็บที่ [altar.png](../../../assets/ui/summon-isometric/altar.png) และภาพในเกมอยู่ที่ [summon-isometric-altar.webp](../../../public/ui/summon-isometric-altar.webp) ขนาด 1672 × 941 ใช้ `cwebp -q 88 -m 6` สำหรับส่งออก

คำสั่งปรับภาพสุดท้าย

> Use case: reframe and change camera geometry. Render a fresh 16:9 camera view of this exact same Eldervane setting, retaining its champagne-gold inlays, cool navy starry air and ivory marble palace. Change the camera from frontal/balanced symmetry to a distinctly elevated ISOMETRIC three-quarter angle, seen down from the front-right corner about 36 degrees above the floor and 27 degrees to the pedestal's side. Show visibly asymmetric walls and clear left and right receding gold edges of the tiered altar. The altar is a non-square elongated rectangular stone plinth with chamfered corners and concentric engraved circles on the surface; it's angled relative to the frame so its front long edge slopes diagonally from lower left up toward right and a side slopes diagonally up-left. Do not center a symmetric front edge at all. Push its cast-metal astronomical center slightly below the vertical center, at x=50%, y=57%, and make the structure about 65% of frame width. Its glowing pinprick is tiny and calm. Retain expansive negative space directly above the altar's center for animated objects, and distant sky citadels and gold ivory architecture in the corners. A polished game environment plate, no text, characters, cards, frame, beams or overlaid UI.
