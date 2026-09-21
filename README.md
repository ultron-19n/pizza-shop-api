# 🍕 FORNO — ระบบสั่งพิซซ่าออนไลน์

โปรเจกต์เต็มรูปแบบ: ฐานข้อมูล 4 แบบ + เอกสารออกแบบระบบ + REST API + หน้าเว็บ

## หัวข้อที่ส่ง กับไฟล์ที่เกี่ยวข้อง

| หัวข้อ | ไฟล์ |
|---|---|
| **Scheme** (ออกแบบฐานข้อมูล) | `db/schema.sql` + ERD ใน `docs/system-design.md` |
| **Supabase** | `db/schema-supabase.sql` (RLS, Realtime, Storage, RPC) |
| **SQLite** | `db/schema-sqlite.sql` |
| **MySQL** | `db/schema-mysql.sql` |
| **MongoDB** | `db/mongodb/models.js` (Mongoose + aggregation) |
| **System design** | `docs/system-design.md` |
| **API** | `docs/api-spec.md` + โค้ดใน `src/routes/` |
| **Wireframe & Frontend** | `docs/wireframe.md` + `public/index.html`, `public/admin.html` |
| **Connect DB** | `src/config/db.js` (Postgres) + `src/config/connections.js` (ทั้ง 4 แบบ) |
| **Refactor** | `docs/refactor-notes.md` + `tests/pricing.test.js` |

## โครงสร้างไฟล์

```
pizza-shop-api/
├── db/
│   ├── schema.sql              # PostgreSQL / Supabase (หลัก)
│   ├── schema-sqlite.sql       # SQLite
│   ├── schema-mysql.sql        # MySQL / MariaDB
│   ├── schema-supabase.sql     # RLS + Realtime + Storage + RPC
│   ├── seed.sql                # ข้อมูลตัวอย่าง
│   └── mongodb/models.js       # MongoDB (Mongoose)
├── docs/
│   ├── system-design.md        # สถาปัตยกรรม ERD flow ความปลอดภัย เปรียบเทียบ DB
│   ├── api-spec.md             # เอกสาร API ทุก endpoint
│   ├── wireframe.md            # wireframe + แนวคิดงานออกแบบ
│   └── refactor-notes.md       # เหตุผลและผลของการ refactor
├── public/
│   ├── index.html              # หน้าสั่งซื้อของลูกค้า
│   └── admin.html              # หน้าพนักงาน: คิวออเดอร์ สต๊อก รายงาน
├── scripts/
│   ├── migrate.js
│   └── seed.js
├── tests/
│   └── pricing.test.js         # เทสกฎการคิดเงิน ไม่ต้องต่อฐานข้อมูล
├── src/
│   ├── server.js               # เปิดพอร์ต + ปิดระบบให้เรียบร้อย
│   ├── app.js                  # ประกอบ express app (แยกไว้ให้เทสใช้ได้)
│   ├── config/
│   │   ├── env.js              # โหลดและตรวจ .env
│   │   ├── constants.js        # ค่าคงที่ทั้งระบบ
│   │   ├── db.js               # PostgreSQL pool + transaction helper
│   │   └── connections.js      # เชื่อมต่อ SQLite / MySQL / MongoDB / Supabase
│   ├── routes/                 # เส้นทาง + สิทธิ์ + ตรวจข้อมูล
│   ├── controllers/            # แปลง HTTP ↔ service
│   ├── services/               # ตรรกะธุรกิจ (คิดราคา ตัดสต๊อก ออเดอร์)
│   ├── repositories/           # SQL ทั้งหมดอยู่ที่นี่ที่เดียว
│   ├── middleware/             # auth, validate, errorHandler
│   └── utils/                  # ApiError, asyncHandler, money
├── .env.example
├── .gitignore
└── package.json
```

### สถาปัตยกรรม 4 ชั้น

```
routes  →  controllers  →  services  →  repositories  →  PostgreSQL
(สิทธิ์)   (HTTP)          (ตรรกะ)       (SQL)
```

แต่ละชั้นรู้จักเฉพาะชั้นที่อยู่ใต้ตัวเอง — ย้ายไป MySQL แก้แค่ชั้น repository
รายละเอียดอยู่ใน `docs/refactor-notes.md`

## เริ่มใช้งานใน VS Code

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

แก้ `.env` ให้ตรงกับฐานข้อมูลที่ใช้ แล้ว:

```bash
npm run db:migrate        # สร้างตาราง
npm run db:seed           # ใส่ข้อมูลตัวอย่าง
npm test                  # รันเทสกฎการคิดเงิน (ไม่ต้องมีฐานข้อมูล)
npm run dev               # รันเซิร์ฟเวอร์
```

เปิดเบราว์เซอร์:

| หน้า | URL |
|---|---|
| หน้าสั่งซื้อลูกค้า | http://localhost:3000/ |
| หน้าพนักงาน | http://localhost:3000/admin.html |
| ตรวจสถานะระบบ | http://localhost:3000/api/health |

สร้างบัญชีแอดมินตัวแรกก่อนเข้าหน้าพนักงาน:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin1234\",\"first_name\":\"แอดมิน\",\"role\":\"admin\"}"
```

## สลับฐานข้อมูล

แก้บรรทัดเดียวใน `.env`:

```
DB_DRIVER=postgres    # หรือ sqlite | mysql | mongodb | supabase
```

แล้วติดตั้งไดรเวอร์ที่ต้องใช้:

```bash
npm install better-sqlite3          # SQLite
npm install mysql2                  # MySQL
npm install mongoose                # MongoDB
npm install @supabase/supabase-js   # Supabase client
```

**SQLite** (เร็วที่สุดสำหรับตอนนำเสนอ ไม่ต้องติดตั้ง server):
```bash
sqlite3 pizza_shop.db < db/schema-sqlite.sql
```

**MySQL**:
```bash
mysql -u root -p < db/schema-mysql.sql
```

**MongoDB**: ใช้ `db/mongodb/models.js` ร่วมกับ `connectMongo()` ใน `src/config/connections.js`

**Supabase**: คัดลอก `db/schema.sql` แล้วต่อด้วย `db/schema-supabase.sql` ไปวางใน SQL Editor แล้วกด Run

## จุดเด่นของระบบ

- **คิดราคาจากฐานข้อมูลเสมอ** ไม่รับราคาจากฝั่ง client — แก้ราคาผ่าน DevTools ไม่ได้
- **ตัดสต๊อกอัตโนมัติตามสูตร** ใน `pizza_recipes` ทุกครั้งที่ขาย พร้อมบันทึกลง `inventory_logs`
- **ทั้งออเดอร์อยู่ใน transaction เดียว** พลาดขั้นตอนไหน rollback ทั้งหมด
- **JWT + จำกัดสิทธิ์ตาม role** admin / manager / staff / rider
- **หน้าครัวรีเฟรชเองทุก 15 วินาที** ไม่ต้องกดใหม่
- **โปรโมชั่น** รองรับทั้งลด % และลดเป็นจำนวนเงิน ตรวจยอดขั้นต่ำและวันหมดอายุ
- **สะสมแต้ม** 25 บาท = 1 แต้ม

## เช็กลิสต์ก่อนส่งอาจารย์

- [ ] `npm run dev` แล้วเปิดหน้าเว็บทั้งสองหน้าได้
- [ ] สั่งซื้อจากหน้าลูกค้า แล้วเห็นออเดอร์โผล่ในหน้าพนักงาน
- [ ] กดเปลี่ยนสถานะ รอทำ → กำลังทำ → พร้อมเสิร์ฟ → เสร็จแล้ว
- [ ] เปิดแท็บสต๊อก ดูว่าวัตถุดิบลดลงหลังสั่งซื้อ
- [ ] เปิดแท็บรายงาน หลังปิดออเดอร์เป็น completed แล้ว
- [ ] `npm test` ผ่านทั้ง 16 เทส
- [ ] เปลี่ยน `JWT_SECRET` เป็นค่าสุ่ม และไม่ commit ไฟล์ `.env`
