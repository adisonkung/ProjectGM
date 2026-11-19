# สเปกภาพ: หน้าหลัก K7 + แอนิเมชันตอน hover

> สำหรับให้ผู้ใช้ gen ภาพด้วย AI แล้วส่ง ZIP กลับมา · Claude ตัดพื้น ตั้งจุดหมุน และทำแอนิเมชันในเกมเอง
> หน้าที่ใช้: `src/app/pages/home/` (K7 · merge แล้ว 2026-11-19) · ตอนนี้ทุกจุดยังเป็นเส้น SVG หรือภาพฮีโร่ยืมมาใช้
> โทน: **ดำ glass · เส้นทองแชมเปญ `#E6C88A` · ไฮไลต์เหลืองส้มอำพัน `#FFA830`** · แดงใช้เฉพาะป้ายแจ้งเตือน · ไม่เอาม่วง/น้ำเงินเป็นสีหลัก · ไม่มีมุมสามเหลี่ยม
> ภาพอ้างอิงสไตล์: `public/ui/gilded/hero_memory.webp`, `public/ui/generated/class/fighter.webp` (ทองโลหะขัดเงา ภาพวาดคมระดับเกมกาชา ไม่ใช่ flat icon / pixel art)

## หลักการแอนิเมชัน: ขอ "ชิ้นส่วน" ไม่ใช่ "หนังทั้งเรื่อง"

AI วาด sprite sheet หลายเฟรมให้ตรงกันทุกเฟรมได้ยาก (ดาบเปลี่ยนรูปทุกเฟรม ตำแหน่งขยับเอง) ชุดนี้เลยใช้ 2 แบบ:

1. **ชิ้นส่วนนิ่ง** (ส่วนใหญ่): ขอแต่ละชิ้นแยกไฟล์ เช่น ดาบซ้าย ดาบขวา แล้ว **Claude ขยับในโค้ด** (หมุน เลื่อน สั่น เรือง) ได้จังหวะเป๊ะ ลื่น 60 fps ปรับความเร็วได้ภายหลังโดยไม่ต้อง gen ใหม่
2. **แผ่น VFX** (เฉพาะแสง/ประกาย/ไฟ): กริดเฟรมบนพื้นดำ ซึ่งเป็นสิ่งที่ AI ทำได้ดี เพราะแต่ละเฟรมไม่ต้องเหมือนกันเป๊ะ

## กติกาไฟล์

| ประเภท | ขนาด | พื้นหลัง | หมายเหตุ |
|---|---|---|---|
| **ชิ้นส่วน / ไอคอน** | 1024 × 1024 ต่อชิ้น | **โปร่งใส (PNG alpha)** ถ้าทำไม่ได้ ใช้ขาวล้วน | 1 ไฟล์ = 1 ชิ้น · เว้นขอบ ~8 % · ชิ้นที่ต้องหมุนให้วางตามท่าที่กำหนดในตาราง (เช่น ดาบตั้งตรง ด้ามอยู่ล่าง) |
| **ภาพพื้นหลังการ์ด** | ตามตารางข้อ A | เต็มภาพ (ไม่โปร่ง) | วัตถุหลักอยู่ **ครึ่งขวา** · ครึ่งซ้ายมืด/โล่ง เพราะมีตัวหนังสือทับ · ห้ามมีตัวหนังสือในภาพ |
| **VFX** | กริด **4 × 3 = 12 เฟรม** ช่องละ 512 × 512 | **ดำสนิท #000000** | จุดศูนย์กลางเดียวกันทุกเฟรม · ห้ามมีตัวเลข/ป้าย/เส้นกริด · เฟรม 1 = เริ่ม, 12 = จางหมด |
| **ไฟลูป** | กริด 4 × 2 = 8 เฟรม ช่องละ 512 × 512 | ดำสนิท | เฟรม 8 ต่อกลับเฟรม 1 ได้เนียน |

ตั้งชื่อไฟล์ตามคอลัมน์ "ชื่อไฟล์" แล้วรวมเป็น ZIP เดียว · ส่งเป็นชุดย่อยได้ (แนะนำเริ่ม **ชุด 1** ก่อน)

### Prompt หลัก

ชิ้นส่วน/ไอคอน (ใส่หน้าทุก prompt):

```
premium fantasy gacha game UI asset, polished champagne gold metal with fine engraved filigree,
dark steel and obsidian accents, warm amber glow, painterly high-detail rendering, soft rim light,
centered, isolated on transparent background, no text, no border, no shadow on the ground
```

ภาพพื้นหลังการ์ด:

```
dark fantasy game key art, cinematic lighting, warm amber and gold light against deep black shadows,
main subject on the right half, left half dark and empty for text, painterly, high detail, no text, no logo
```

VFX:

```
fantasy game VFX sprite sheet, 4 columns x 3 rows grid, 12 animation frames read left-to-right,
top-to-bottom, warm amber and golden white light, additive glow, pure black background,
same center point every frame, no text, no grid lines
```

---

## ชุด 1 — การ์ดฟังก์ชันขวาล่าง (สำคัญสุด)

### A. ภาพพื้นหลังการ์ด

| ชื่อไฟล์ | ขนาด | การ์ด | prompt เพิ่ม |
|---|---|---|---|
| `card_adventure_bg.png` | 1680 × 800 | ผจญภัย | `a colossal ancient tower rising above a sea of clouds at dusk, glowing amber windows, floating rocks, the tower on the right side` |
| `card_arena_bg.png` | 820 × 448 | ประลอง | `the interior of a grand stone colosseum at night, torches and amber braziers, sand floor, banners, crowd silhouettes, arena gate on the right` |
| `card_daily_bg.png` | 820 × 448 | ดันเจี้ยนรายวัน | `a stone dungeon entrance carved into a cliff, iron portcullis, two torches, warm light leaking from inside, mossy steps, entrance on the right` |

### B. ประลอง — ดาบฟันกัน 2 ที แล้วไขว้

| ชื่อไฟล์ | คืออะไร | prompt เพิ่ม |
|---|---|---|
| `arena_sword_left.png` | ดาบเล่มซ้าย | `a single knight longsword, straight double-edged steel blade with gold fuller engraving, gold cross-guard with an amber gem, blade pointing straight up, hilt at the bottom, perfectly vertical` |
| `arena_sword_right.png` | ดาบเล่มขวา | `a single curved fantasy saber, dark steel blade with a gold edge line, ornate gold hand guard, blade pointing straight up, hilt at the bottom, perfectly vertical` |
| `fx_clash_spark.png` (VFX 4×3) | ประกายตอนดาบกระทบ | `a sharp metal clash: frames 1-2 tiny white-hot point, 3-5 starburst of thin sparks and a short horizontal flash line, 6-12 sparks fly outward and fade` |
| `arena_emblem_glow.png` | แสงหลังดาบตอนไขว้ค้าง | `a soft circular amber glow with a faint four-pointed sparkle in the center, transparent edges` |

**ลำดับตอน hover (โค้ดทำ, ~1.1 วิ):**

1. 0.00–0.18 วิ: ดาบสองเล่มเหวี่ยงเข้าจากซ้าย/ขวา หมุนรอบด้าม ปลายดาบชนกันกลางการ์ด
2. **0.18 วิ ฟันครั้งที่ 1**: `fx_clash_spark` ตรงจุดกระทบ การ์ดสั่น 2 px
3. 0.18–0.36 วิ: ดาบเด้งถอยออก
4. **0.50 วิ ฟันครั้งที่ 2**: ประกายใหญ่กว่าเดิม (สเกล ×1.3) สั่น 3 px
5. 0.50–0.80 วิ: ดาบหมุนเข้าหาจุดกลางจน**ไขว้เป็นรูป X** ค้างไว้ `arena_emblem_glow` ค่อย ๆ เรืองหลังดาบ แล้วหายใจเบา ๆ ตลอดที่ยังชี้อยู่
6. เอาเมาส์ออก: ดาบเลื่อนกลับออกพร้อมจาง 0.25 วิ

### C. ผจญภัย — เข็มทิศหมุนแล้วล็อกทิศ

แทนวงแหวนที่วาดด้วยโค้ดตอนนี้ ทุกชิ้นต้อง**วงกลมขนาดเท่ากันและศูนย์กลางตรงกัน** (แนะนำ gen `adv_ring_outer` ก่อน แล้วสั่งแก้ทีละชิ้น)

| ชื่อไฟล์ | คืออะไร | prompt เพิ่ม |
|---|---|---|
| `adv_ring_outer.png` | วงนอก มีขีดองศา | `a large thin gold astrolabe ring with fine degree tick marks and engraved runes, hollow transparent center` |
| `adv_ring_inner.png` | วงใน | `a smaller ornate gold ring with four small amber gems at the cardinal points, hollow transparent center` |
| `adv_needle.png` | เข็มทิศ | `a slender gold compass needle shaped like a four-pointed star with one long amber-tipped point, long point straight up, centered on its pivot` |
| `adv_core.png` | เม็ดกลาง | `a small round amber gemstone set in gold, glowing` |
| `fx_compass_burst.png` (VFX 4×3) | แสงตอนเข็มล็อก | `a golden ring of light expands from the center with eight thin rays, then fades` |

**ลำดับตอน hover (~1.2 วิ):**

1. วงนอกหมุนเร็วขึ้น (ปกติหมุนช้ามาก) และวงในหมุนสวนทาง
2. เข็มหมุนเร็ว 2 รอบ แล้วค่อย ๆ ช้าลงจนส่ายนิดหนึ่ง
3. เข็มล็อกชี้ขึ้นขวา (ทางไปหอคอย) → `fx_compass_burst` ปุ่ม "เข้าสู่หอคอย" เรืองขึ้นหนึ่งจังหวะ
4. ระหว่างยังชี้อยู่ ประกายไฟลอยขึ้นถี่กว่าปกติ

### D. ดันเจี้ยนรายวัน — ประตูเหล็กยกขึ้น แสงทะลักออก

| ชื่อไฟล์ | คืออะไร | prompt เพิ่ม |
|---|---|---|
| `daily_gate_arch.png` | ซุ้มหินรอบประตู (ด้านในโปร่ง) | `a carved stone archway with gold trim and a keystone gem, the opening is fully transparent` |
| `daily_gate_bars.png` | ซี่ประตูเหล็ก | `an iron portcullis grille with gold rivets and spiked bottom ends, front view, rectangular` |
| `daily_gate_light.png` | แสงจากในดันเจี้ยน | `warm amber light glowing from a dark doorway, soft fog, transparent edges` |
| `fx_torch_loop.png` (ไฟลูป 4×2) | ไฟคบเพลิงสองข้าง | `a single torch flame looping animation, 8 frames, warm orange and gold fire, small embers` |

**ลำดับตอน hover (~0.8 วิ):** ซี่ประตูยกขึ้น 60 % แล้วเด้งหยุด → แสงด้านในค่อย ๆ สว่าง ฝุ่นเล็ก ๆ ร่วงจากขอบบน → ไฟคบเพลิงลุกแรงขึ้นชั่วครู่ · เอาเมาส์ออก = ประตูค่อย ๆ ลงกลับ

---

## ชุด 2 — เมนูหลักด้านล่าง (5 ปุ่ม)

ไอคอนเห็นจริงประมาณ 42–48 px ต้อง**รูปทรงชัด อ่านออกตอนเล็ก** อย่าใส่รายละเอียดยิบเกินไป

| ชื่อไฟล์ | ปุ่ม | prompt เพิ่ม | ตอน hover (โค้ดทำ) |
|---|---|---|---|
| `nav_hero_helm.png` | ฮีโร่ | `a gold knight helmet seen from the front, simple bold silhouette` | แสงวาบวิ่งผ่านหมวก + หมวกเชิดขึ้นเล็กน้อย |
| `nav_hero_plume.png` | ฮีโร่ | `a single amber feather plume, base at the bottom` | พู่ขนนกโบกไปมา 2 ครั้ง |
| `nav_squad_pole.png` | จัดทัพ | `a gold banner pole with a spear tip, vertical` | — |
| `nav_squad_flag.png` | จัดทัพ | `a dark cloth war banner with a gold sun emblem, hanging straight down, attached at the top-left` | ธงสะบัดเป็นคลื่น |
| `nav_gear_shield.png` | อุปกรณ์ | `a gold-rimmed round shield with an amber gem boss` | — |
| `nav_gear_hammer.png` | อุปกรณ์ | `a small gold smithing hammer, handle pointing down-left` | ค้อนเคาะโล่ 2 ที มีประกายเล็ก (`fx_small_spark`) |
| `nav_summon_crystal.png` | อัญเชิญ | `a floating faceted amber crystal with gold caps` | คริสตัลลอยขึ้น หมุนเล็กน้อย ประกายรอบ ๆ |
| `nav_summon_ring.png` | อัญเชิญ | `a thin gold rune circle seen flat from the front, hollow center` | วงรูนหมุนเร็วขึ้นแล้วเรือง |
| `nav_isle_island.png` | เกาะลอยฟ้า | `a tiny floating island with a white castle and a small waterfall, gold rim under the rock` | เกาะลอยขึ้นลงช้า ๆ |
| `nav_isle_cloud.png` | เกาะลอยฟ้า | `a small soft cloud puff` | เมฆลอยผ่านหน้าเกาะ |
| `fx_small_spark.png` (VFX 4×3) | ใช้ร่วม | `a small burst of gold sparks from a single point, quick, then fade` | — |

ปุ่มที่ชี้อยู่ยังมีพื้นเรืองเหลืองส้มกับเส้นใต้แบบเดิม

---

## ชุด 3 — ปุ่มขวาบน + เมนูย่อย

### E. ปุ่มกลมขวาบน

| ชื่อไฟล์ | ปุ่ม | prompt เพิ่ม | ตอน hover |
|---|---|---|---|
| `btn_news_horn.png` | ประกาศ | `a gold herald horn with a small amber banner hanging from it, bell facing right` | แตรเงยขึ้น มีวงคลื่นเสียง 2 วง (โค้ดวาด) |
| `btn_mail_closed.png` | จดหมาย | `a dark envelope sealed with a gold wax seal` | — |
| `btn_mail_open.png` | จดหมาย | `the same envelope opened, a cream letter sliding out the top` | สลับเป็นซองเปิด จดหมายเลื่อนขึ้น |
| `btn_settings_gear.png` | ตั้งค่า | `a single ornate gold cogwheel with an amber gem center` | เฟืองหมุน 90° แบบมีน้ำหนัก |
| — | เมนู (4 ช่อง) | ไม่ต้องใช้ภาพ | 4 ช่องแยกออกแล้วหมุนเป็นข้าวหลามตัด (โค้ดทำ) |

### F. ช่องในเมนูที่กดเปิด + แถบบอสโลก

| ชื่อไฟล์ | ช่อง | prompt เพิ่ม | ตอน hover |
|---|---|---|---|
| `tile_event_lantern.png` | กิจกรรม | `a festival lantern made of gold filigree with a glowing amber star inside` | โคมแกว่ง แสงในโคมเต้น |
| `tile_mission_scroll_closed.png` | ภารกิจ | `a rolled parchment scroll tied with a gold ribbon` | — |
| `tile_mission_scroll_open.png` | ภารกิจ | `the same parchment scroll unrolled, faint quest marks on it` | สลับเป็นม้วนที่คลี่ออก |
| `tile_achieve_trophy.png` | ความสำเร็จ | `a gold trophy cup with amber gems and laurel handles` | ถ้วยเด้ง + แสงวาบวิ่งผ่าน |
| `tile_login_calendar.png` | ล็อกอินรายวัน | `a small gold-bound calendar book with an amber ribbon bookmark` | หน้ากระดาษพลิก 1 หน้า (โค้ดทำ) |
| `tile_forge_anvil.png` | ตีเหล็ก | `a dark iron anvil with gold trim` | — |
| `tile_forge_hammer.png` | ตีเหล็ก | `a heavy blacksmith hammer, handle pointing down-right` | ค้อนตีทั่ง 1 ที + `fx_small_spark` |
| `tile_account_crest.png` | บัญชี | `a heraldic gold crest shield with a blank center and a small crown on top` | แสงวาบวิ่งผ่าน |
| `boss_emblem.png` | แถบบอสโลก | `a horned dark beast skull emblem framed by a gold ring, glowing amber eyes` | ตาเรืองแรงขึ้น + สั่นเบา ๆ |

---

## บนมือถือ (ไม่มี hover)

- **การ์ดขวาล่าง**: เล่นแอนิเมชันหนึ่งรอบตอนเปิดหน้าหลัก (ไล่ทีละการ์ด ห่างกัน 0.3 วิ) และเล่นตอนแตะ **โดยไม่หน่วงการเปลี่ยนหน้า**
- **ปุ่มเมนู / ไอคอนเล็ก**: เล่นตอนนิ้วแตะลง (pointerdown) ฉบับสั้นลง
- **เปิดโหมดลดการเคลื่อนไหว**: ไม่มีแอนิเมชัน แสดงท่าจบนิ่ง ๆ (เช่น ดาบไขว้อยู่แล้ว)

## หลังได้ภาพ (ฝั่ง Claude)

1. วางต้นฉบับใน `assets/ui/home-k7/` (track แล้ว ห้ามแก้) → สคริปต์แปลงแบบเดียวกับ `tools/ui/import_gilded.py`: ชิ้นส่วนย่อเป็น WebP 256–512 px, ภาพพื้นหลังเป็น WebP คุณภาพสูง, VFX พื้นดำแปลงเป็นพื้นโปร่งใส → `public/ui/home-k7/`
2. ตั้งจุดหมุนของแต่ละชิ้น (ด้ามดาบ, แกนเข็มทิศ, ขอบบนธง) แล้วทำลำดับแอนิเมชันตามข้อ B–F ด้วย CSS/Web Animations; VFX ใช้ `app-sheet-fx` ที่มีอยู่แล้ว
3. ภาพยังไม่มาครบก็ใส่ได้ทีละชิ้น จุดที่ยังไม่มีภาพใช้ไอคอนเส้นเดิมไปก่อน
4. อัดคลิปจากเกมจริง (จอคอม + มือถือแนวนอน) ให้ผู้ใช้ดูก่อน merge
