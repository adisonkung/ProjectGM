# หินเลื่อนขั้นเฉพาะฮีโร่ — 30 ต.ค. 2026

ผลิตครบ **15 ฮีโร่ × (หินเต็ม 3 ระดับ + เศษหิน 3 ระดับ) = 90 ภาพ** จาก Portrait ปัจจุบัน ขนาด 512×512 พื้นหลังโปร่งใส พร้อมตรวจในเกม `/art-catalog` หมวด `hero-breakthrough`.

- [ดาวน์โหลด PNG ทั้ง 90 ภาพ](hero-breakthrough-icons.zip)
- [ภาพรวมพร้อม Portrait อ้างอิง](contact-sheet.jpg)
- [เกมจริง desktop](catalog-desktop.png) · [เกมจริงมือถือแนวนอน](catalog-landscape.png)
- [อ้างอิงเทียบภาพจริงในเกม](reference-vs-game.jpg)
- [Manifest: hash ต้นฉบับ/portrait/ผลลัพธ์ทุกไฟล์](manifest.json)
- [Prompt กลาง](common-prompt.txt) · [แหล่งไฟล์ที่เจน](generation-sources.json)

หิน I สีอำพันยอดเดี่ยว, II สีฟ้ายอดคู่, III ประกายมุกทรงมงกุฎ เศษหินแต่ละระดับจับคู่หน้าตาและสีของหินเต็ม แผ่นต้นฉบับเก็บใน `assets/generated/hero-breakthrough/` ไฟล์ WebP สำหรับเกมอยู่ `public/items/heroes/<hero>/` และ PNG รวมอยู่ใน ZIP. ใช้ imagegen สร้างภาพ และสคริปต์ `tools/dev/pack_hero_breakthrough_art.py` แยก sprite ตาม alpha โดยไม่วาดภาพทับ; รันด้วย Python + Pillow + NumPy + SciPy.

ฐานงาน `1e9f103` มี Portrait ใหม่ล่าสุด งานนี้เป็นอาร์ตและหน้าตรวจ GM ส่วนระบบหินผูกเจ้าของ/ดรอป/แปลงเป็นหินรวมยังเป็น backlog gameplay แยกต่างหาก ไม่มีการเปลี่ยนเซฟหรือเศรษฐกิจเกม และยังไม่ merge/deploy.

ภาพอ้างอิงของงานนี้คือ Portrait จริงทั้ง 15 ตัว และตระกูลหินตาม prompt เดิม ไม่มีแบบหน้า GM ใหม่ที่ผู้ใช้เลือก จึงคงหน้าคลังเดิมและเพิ่มแถว 6 ภาพต่อฮีโร่ ภาพคู่เทียบแสดง Portrait และภาพเจนด้านซ้ายเทียบ screenshot เกมจริงด้านขวา ไม่ใช่การอ้างว่าตรงแบบหน้า UI ใหม่.
