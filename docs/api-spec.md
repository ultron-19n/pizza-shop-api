# API Specification — Pizza Shop

Base URL: `http://localhost:3000/api`
รูปแบบข้อมูล: JSON (`Content-Type: application/json`)
การยืนยันตัวตน: `Authorization: Bearer <token>`

## สิทธิ์การใช้งาน

สัญลักษณ์ท้ายชื่อเส้นทางบอกว่าใครเรียกได้

| สัญลักษณ์ | เรียกได้โดย |
|---|---|
| (ไม่มี) | ทุกคน ไม่ต้องล็อกอิน |
| 🔒 staff | `admin` `manager` `staff` — งานหน้าร้าน (**ไม่รวม `rider`**) |
| 🔒 manager | `admin` `manager` — จัดการเมนู ราคา โปรโมชั่น และดูรายงาน |
| 🔒 admin | `admin` เท่านั้น — จัดการบัญชีพนักงาน |

role ทั้งหมด: `admin` `manager` `staff` `rider`

## รหัสสถานะที่ใช้

| Code | ความหมาย |
|---|---|
| 200 | สำเร็จ |
| 201 | สร้างข้อมูลสำเร็จ |
| 400 | ข้อมูลที่ส่งมาไม่ถูกต้อง |
| 401 | ยังไม่ได้เข้าสู่ระบบ / token หมดอายุ |
| 403 | เข้าสู่ระบบแล้วแต่ไม่มีสิทธิ์ |
| 404 | ไม่พบข้อมูล |
| 409 | ข้อมูลซ้ำ (เช่น ชื่อผู้ใช้หรืออีเมลถูกใช้แล้ว) |
| 429 | ส่งคำขอถี่เกินไป (ดูหัวข้อ "การจำกัดจำนวนคำขอ") |
| 500 | ระบบผิดพลาด |

รูปแบบ error ทุกกรณี:
```json
{ "message": "คำอธิบายภาษาไทย" }
```

กรณีตรวจข้อมูลไม่ผ่านหลายฟิลด์พร้อมกัน จะมี `errors` เพิ่มมาด้วย:
```json
{ "message": "ข้อมูลที่ส่งมาไม่ถูกต้อง",
  "errors": { "password": "รหัสผ่าน ต้องยาวอย่างน้อย 8 ตัวอักษร" } }
```

## การจำกัดจำนวนคำขอ

นับแยกตาม IP เก็บในหน่วยความจำของเซิร์ฟเวอร์ ถ้าเกินจะได้ `429`

| เส้นทาง | เพดาน | หมายเหตุ |
|---|---|---|
| `POST /auth/login`, `POST /auth/register` | 10 ครั้ง / 15 นาที | **นับเฉพาะครั้งที่ล้มเหลว** ล็อกอินสำเร็จจะคืนโควตาให้ |
| `POST /orders` | 12 ครั้ง / 10 นาที | กันสคริปต์ยิงสั่งซื้อจนสต๊อกหมด |

---

## 1. Auth

### GET /auth/setup
บอกว่าระบบยังไม่มีบัญชีผู้ใช้เลยหรือไม่ — หน้าหลังร้านใช้ตัดสินใจว่าจะแสดงฟอร์ม "ตั้งค่าครั้งแรก" ไหม

```json
{ "needs_setup": true }
```

### POST /auth/register
สร้างบัญชีพนักงาน — เรียกได้โดยไม่ต้องล็อกอินเฉพาะตอนที่ยังไม่มีผู้ใช้ในระบบ (คนแรกจะเป็น `admin` เสมอ)
หลังจากนั้นต้องส่ง token ของ admin (ไม่ใช่ admin → 403, ไม่มี token → 401)

```json
// request
{ "username": "somchai", "email": "somchai@forno.co", "password": "pizza12345",
  "first_name": "สมชาย", "last_name": "ใจดี", "phone_number": "0812345678", "role": "staff" }

// response 201
{ "id": 2, "username": "somchai", "email": "somchai@forno.co",
  "first_name": "สมชาย", "last_name": "ใจดี", "phone_number": "0812345678",
  "role": "staff", "status": "active", "created_at": "2026-09-23T02:10:00.000Z" }
```

| ฟิลด์ | บังคับ | เงื่อนไข |
|---|---|---|
| `username` | ✓ | อย่างน้อย 3 ตัวอักษร ห้ามซ้ำ |
| `email` | ✓ | รูปแบบอีเมล เก็บเป็นตัวพิมพ์เล็กเสมอ ห้ามซ้ำ |
| `password` | ✓ | อย่างน้อย 8 ตัวอักษร |
| `role` | | `admin` `manager` `staff` `rider` (ไม่ส่ง = `staff`) |

| กรณี | Code | ข้อความ |
|---|---|---|
| ชื่อผู้ใช้ซ้ำ | 409 | ชื่อผู้ใช้นี้ถูกใช้แล้ว |
| อีเมลซ้ำ | 409 | อีเมลนี้ถูกใช้แล้ว |
| อีเมลผิดรูปแบบ | 400 | รูปแบบอีเมลไม่ถูกต้อง |
| ไม่ใช่ admin | 403 | เฉพาะผู้ดูแลระบบที่สร้างบัญชีใหม่ได้ |

### POST /auth/login
**เข้าสู่ระบบด้วยชื่อผู้ใช้หรืออีเมลก็ได้** ส่งค่าที่ผู้ใช้กรอกมาในฟิลด์ `username` หรือ `email` ก็ได้ (หน้าเว็บส่งค่าเดียวกันไปทั้งสองฟิลด์) การเทียบอีเมลไม่สนตัวพิมพ์เล็กใหญ่

```json
// request
{ "username": "somchai@forno.co", "email": "somchai@forno.co", "password": "pizza12345" }

// response 200
{ "token": "eyJhbGciOi...",
  "user": { "id": 2, "username": "somchai", "email": "somchai@forno.co",
            "first_name": "สมชาย", "last_name": "ใจดี", "role": "staff" } }
```

| กรณี | Code | ข้อความ |
|---|---|---|
| ชื่อผู้ใช้/อีเมล/รหัสผ่านผิด | 401 | ชื่อผู้ใช้ อีเมล หรือรหัสผ่านไม่ถูกต้อง |
| บัญชีถูกระงับ | 403 | บัญชีนี้ถูกระงับการใช้งาน |
| ผิดถี่เกินไป | 429 | กรอกรหัสผ่านผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่ |

> ข้อความ 401 เหมือนกันทุกกรณี และเทียบรหัสผ่านกับ hash หลอกเมื่อไม่พบบัญชี เพื่อไม่ให้เดาได้ว่าชื่อไหนมีอยู่จริง

### GET /auth/me 🔒
คืนข้อมูลผู้ใช้จาก token ปัจจุบัน

### GET /auth/users 🔒 admin
รายชื่อบัญชีพนักงานทั้งหมด (ไม่มี password hash)

### PATCH /auth/users/:id 🔒 admin
แก้อีเมล สิทธิ์ สถานะ หรือข้อมูลติดต่อ ส่งเฉพาะฟิลด์ที่ต้องการแก้

```json
{ "email": "new@forno.co", "role": "manager", "status": "inactive" }
```

| กรณี | Code | ข้อความ |
|---|---|---|
| ลดสิทธิ์/ระงับบัญชีตัวเอง | 400 | เปลี่ยนสิทธิ์หรือระงับบัญชีตัวเองไม่ได้ |
| จะไม่เหลือ admin ที่ใช้งานอยู่ | 400 | ต้องเหลือผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 บัญชี |
| อีเมลซ้ำกับบัญชีอื่น | 409 | อีเมลนี้ถูกใช้แล้ว |

### POST /auth/users/:id/password 🔒 admin
ตั้งรหัสผ่านใหม่ให้พนักงาน (ใช้ตอนลืมรหัส) — ไม่ต้องใช้รหัสเดิม

```json
{ "password": "newpass12345" }
```

---

## 2. Menu

### GET /menu/categories
```json
[ { "id": 1, "name": "พิซซ่า", "description": "พิซซ่าอบสดใหม่ทุกถาด" } ]
```

### GET /menu
เฉพาะเมนูที่เปิดขายอยู่ Query: `category_id`, `search`

```json
[
  { "id": 2, "name": "Pepperoni", "description": "เปปเปอโรนีเต็มหน้า",
    "image_url": "images/pepperoni.png", "category_id": 1, "category_name": "พิซซ่า",
    "variants": [
      { "id": 5, "size": "S", "crust": "classic", "price": "179.00", "is_available": true },
      { "id": 6, "size": "M", "crust": "classic", "price": "289.00", "is_available": true }
    ] }
]
```

### GET /menu/:id
เมนูเดียวพร้อม variants ทั้งหมด

### GET /menu/toppings/all
เฉพาะท็อปปิ้งที่เปิดขาย
```json
[ { "id": 1, "name": "ชีสเพิ่ม", "price": "39.00", "is_available": true } ]
```

### GET /menu/manage/all 🔒 manager
เหมือน `GET /menu` แต่**รวมเมนูที่ปิดขายอยู่ด้วย** (หลังร้านต้องเห็นเพื่อเปิดกลับมาขายได้)

### GET /menu/manage/toppings 🔒 manager
ท็อปปิ้งทั้งหมดรวมที่ปิดขาย

### POST /menu 🔒 manager
```json
{ "category_id": 1, "name": "Truffle Mushroom",
  "description": "เห็ดทรัฟเฟิล", "image_url": "images/truffle.png" }
```

### PUT /menu/:id 🔒 manager
ส่งเฉพาะฟิลด์ที่ต้องการแก้ ฟิลด์ที่ไม่ส่งจะคงค่าเดิม ใช้เปิด-ปิดการขายได้ด้วย (`is_active`)

### DELETE /menu/:id 🔒 manager
ปิดการขาย (`is_active = false`) ไม่ได้ลบจริง เพื่อให้ใบเสร็จเก่ายังอ้างอิงได้

### POST /menu/:id/variants 🔒 manager
```json
{ "size": "L", "crust": "pan", "sauce": "tomato", "price": 429 }
```

### PATCH /menu/variants/:id 🔒 manager
แก้ราคาหรือทำเครื่องหมายว่าของหมดเฉพาะขนาดนั้น
```json
{ "price": 449, "is_available": false }
```

### POST /menu/toppings 🔒 manager
```json
{ "name": "เบคอนกรอบ", "price": 45 }
```

### PATCH /menu/toppings/:id 🔒 manager
```json
{ "price": 49, "is_available": true }
```

---

## 3. Customers

ข้อมูลส่วนบุคคล เปิดเฉพาะพนักงานหน้าร้านขึ้นไป — ลูกค้าที่สั่งเองไม่ต้องเรียกหมวดนี้ ให้ส่ง `customer` / `address` มาพร้อม `POST /orders`

### GET /customers 🔒 staff
Query: `phone` (ตรงตัว) หรือ `name` (ชื่อบางส่วน)

### GET /customers/:id 🔒 staff
คืนข้อมูลลูกค้าพร้อม array `addresses`

### POST /customers 🔒 staff
สร้างลูกค้าใหม่ ถ้าเบอร์ซ้ำจะอัปเดตชื่อให้แทน (upsert)
```json
{ "first_name": "สมชาย", "last_name": "ใจดี",
  "phone_number": "0812345678", "email": "somchai@example.com" }
```

### POST /customers/:id/addresses 🔒 staff
```json
{ "address_line": "99/1 หมู่ 3", "sub_district": "บางรัก",
  "district": "บางรัก", "province": "กรุงเทพมหานคร",
  "postal_code": "10500", "is_default": true }
```

---

## 4. Orders

### POST /orders
สร้างออเดอร์ — **ราคาคำนวณจากฐานข้อมูลทั้งหมด ไม่รับราคาจาก client**

```json
// request (ลูกค้าทั่วไป ไม่ต้องล็อกอิน)
{
  "customer": { "first_name": "สมชาย", "last_name": "ใจดี",
                "phone_number": "0812345678",
                "email": "somchai@example.com" },     // ไม่บังคับ
  "address":  { "address_line": "99/1 หมู่ 3", "district": "บางรัก" },  // จำเป็นเมื่อ order_type = delivery
  "order_type": "delivery",          // delivery | pickup | dine_in
  "promotion_code": "WELCOME10",     // ไม่บังคับ
  "payment_method": "promptpay",     // cash | promptpay | card | transfer
  "note": "ไม่ใส่หอมใหญ่",
  "items": [
    { "pizza_variant_id": 6, "quantity": 1,
      "toppings": [ { "topping_id": 1, "quantity": 1 } ] },
    { "pizza_variant_id": 10, "quantity": 2 }
  ]
}

// response 201
{ "id": 12, "order_code": "PZ260908-4821", "status": "pending",
  "subtotal": "886.00", "discount": "88.60", "delivery_fee": "39.00",
  "total_amount": "836.40", "created_at": "2026-09-08T18:22:04.000Z" }
```

**หมายเหตุเรื่องลูกค้า**
- เบอร์ที่มีอยู่แล้วในระบบ → ผูกออเดอร์กับลูกค้าเดิม โดย **ไม่แก้ชื่อเดิม** ส่วนอีเมลจะเติมให้เฉพาะเมื่อลูกค้ารายนั้นยังไม่มีอีเมล (ไม่ทับของเดิม)
- ที่อยู่ที่ส่งมากับออเดอร์ถูกบันทึกเป็นที่อยู่ของลูกค้าคนนั้น (ไม่ตั้งเป็นที่อยู่หลัก)
- พนักงานที่ล็อกอิน ส่ง `customer_id` / `address_id` ของลูกค้าเดิมแทนได้ (ที่อยู่ต้องเป็นของลูกค้าคนนั้น) — ลูกค้าทั่วไปส่งสองฟิลด์นี้ไม่มีผล

**ข้อผิดพลาดที่เป็นไปได้**

| กรณี | Code | ข้อความ |
|---|---|---|
| ไม่ส่ง items | 400 | กรุณาเลือกสินค้าอย่างน้อย 1 รายการ |
| เกิน 50 บรรทัด | 400 | สั่งได้สูงสุด 50 รายการต่อออเดอร์ |
| เบอร์โทรสั้นเกินไป | 400 | กรุณากรอกเบอร์โทรให้ถูกต้อง |
| อีเมลผิดรูปแบบ | 400 | รูปแบบอีเมลไม่ถูกต้อง |
| delivery แต่ไม่มีที่อยู่ | 400 | กรุณาระบุที่อยู่จัดส่ง |
| variant ไม่มีจริง | 400 | ไม่พบสินค้ารหัส X |
| สินค้าปิดขาย | 400 | ชื่อเมนู ไม่พร้อมขายในตอนนี้ |
| ยอดไม่ถึงขั้นต่ำของโค้ด | 400 | ยอดขั้นต่ำของโค้ดนี้คือ X บาท เพิ่มอีก Y บาท |
| วัตถุดิบไม่พอ | 409 | วัตถุดิบไม่พอ: ชื่อวัตถุดิบ คงเหลือ X, ต้องใช้ Y |
| สั่งถี่เกินไป | 429 | สั่งซื้อถี่เกินไป กรุณารอสักครู่ |

### GET /orders 🔒 staff
Query: `status`, `date` (YYYY-MM-DD), `customer_id`, `limit` (ค่าเริ่มต้น 30 สูงสุด 200)

**`detail=1`** ส่งรายการสินค้า ท็อปปิ้ง ลูกค้า และการชำระเงินมาพร้อมกันเลย โครงสร้างเหมือน `GET /orders/:id` ทุกประการ — หน้าคิวหลังร้านใช้แบบนี้เพื่อยิงคำขอเดียวแทนที่จะยิง 1 + N ครั้ง

### GET /orders/:id 🔒 staff
ใบเสร็จเต็ม พร้อม `items[]`, `toppings[]`, `customer`, `payment`

### PATCH /orders/:id/status 🔒 staff
```json
{ "status": "preparing" }
```

ลำดับสถานะที่เปลี่ยนได้ (ข้ามขั้นไม่ได้ จะได้ 400 พร้อมบอกสถานะถัดไปที่เป็นไปได้)

| จาก | ไปได้ |
|---|---|
| `pending` | `preparing` · `cancelled` |
| `preparing` | `ready` · `cancelled` |
| `ready` | `delivering` · `completed` |
| `delivering` | `completed` |
| `completed` / `cancelled` | — (ปิดแล้ว) |

**เมื่อยกเลิก** ระบบทำ 3 อย่างให้อัตโนมัติในทรานแซกชันเดียว
1. คืนวัตถุดิบเข้าคลัง พร้อมบันทึก log
2. ดึงแต้มที่ให้ไปตอนสั่งกลับคืน
3. ถ้าเก็บเงินไปแล้ว เปลี่ยนสถานะการชำระเงินเป็น `refunded` เพื่อไม่ให้รายงานยอดขายนับเงินก้อนนั้น (เงินสดคืนหน้าร้าน ช่องทางอื่นต้องไปกดคืนในระบบผู้ให้บริการเอง)

### POST /orders/:id/pay 🔒 staff

```json
// เงินสด — ส่งเงินที่รับมา เซิร์ฟเวอร์คำนวณเงินทอนให้
{ "method": "cash", "received_amount": 500 }

// ช่องทางอื่น — ใส่เลขอ้างอิงสลิปหรือ 4 ตัวท้ายบัตรได้
{ "method": "promptpay", "transaction_ref": "TXN-99231" }

// response 200
{ "id": 9, "order_id": 12, "method": "cash", "amount": "359.00", "status": "paid",
  "received_amount": "500.00", "change_amount": "141.00",
  "transaction_ref": null, "paid_at": "2026-09-23T07:40:00.000Z" }
```

| ฟิลด์ | ความหมาย |
|---|---|
| `received_amount` | เงินที่รับมาจากลูกค้า ไม่บังคับ ใส่เฉพาะเงินสด |
| `change_amount` | เงินทอน **เซิร์ฟเวอร์คำนวณเองเสมอ** ส่งมาจาก client ไม่มีผล |
| `transaction_ref` | เลขอ้างอิงสลิป / 4 ตัวท้ายบัตร ยาวได้ไม่เกิน 100 ตัวอักษร (เกินจะถูกตัด) |

| กรณี | Code | ข้อความ |
|---|---|---|
| ชำระไปแล้ว | 409 | ออเดอร์นี้ชำระเงินแล้ว |
| ออเดอร์ถูกยกเลิก | 400 | ออเดอร์นี้ถูกยกเลิกแล้ว รับชำระเงินไม่ได้ |
| เงินที่รับมาน้อยกว่ายอด | 400 | เงินที่รับมา X บาท น้อยกว่ายอดที่ต้องชำระ Y บาท |

### GET /orders/report/summary 🔒 manager
Query: `date` (YYYY-MM-DD) — ใช้กับส่วน `by_method` เท่านั้น ไม่ระบุ = วันนี้ตามเวลาไทย

```json
{ "daily": [ { "sale_date": "2026-09-08", "total_orders": 24,
               "revenue": "8420.00", "avg_order_value": "350.83" } ],
  "best_sellers": [ { "name": "Pepperoni", "sold": "38", "revenue": "10982.00" } ],
  "by_method": [ { "method": "cash", "bills": 12, "amount": "4180.00",
                   "received": "5000.00", "change_given": "820.00" },
                 { "method": "promptpay", "bills": 8, "amount": "3010.00",
                   "received": "0", "change_given": "0" } ],
  "cash_in_drawer": "4180.00" }
```

`cash_in_drawer` คือยอดบิลที่จ่ายด้วยเงินสดของวันนั้น ใช้เทียบกับเงินที่นับได้จริงตอนปิดร้าน (ยังไม่รวมเงินทอนตั้งต้นที่ใส่ลิ้นชักไว้ก่อนเปิดร้าน)

### GET /orders/promotions/:code
ตรวจโค้ดส่วนลดก่อนกดสั่ง (ไม่ต้องล็อกอิน) — ยอดจริงยังถูกคิดใหม่ที่เซิร์ฟเวอร์ตอนสร้างออเดอร์เสมอ
```json
// response 200
{ "code": "WELCOME10", "name": "ลูกค้าใหม่ลด 10%",
  "discount_type": "percent", "discount_value": 10, "min_order_amount": 200 }

// response 400 — โค้ดผิดหรือหมดอายุ
{ "message": "โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุแล้ว" }
```

---

## 5. Promotions

### GET /promotions/usable
โค้ดที่ใช้ได้ตอนนี้ (เปิดอยู่และอยู่ในช่วงวันที่) — หน้าร้านเอาไปแสดงให้ลูกค้ากดเลือก ไม่ต้องล็อกอิน

```json
[ { "id": 1, "code": "WELCOME10", "name": "ลูกค้าใหม่ลด 10%",
    "discount_type": "percent", "discount_value": "10.00",
    "min_order_amount": "200.00", "end_date": "2026-12-13" } ]
```

### GET /promotions 🔒 manager
ทุกโค้ดรวมที่ปิดหรือหมดอายุแล้ว พร้อม `used_count` (จำนวนออเดอร์ที่ใช้โค้ดนี้ ไม่นับออเดอร์ที่ยกเลิก)

### POST /promotions 🔒 manager
```json
{ "code": "SAVE50", "name": "ลด 50 บาท เมื่อครบ 500",
  "discount_type": "amount",        // percent | amount
  "discount_value": 50,
  "min_order_amount": 500,
  "start_date": "2026-10-01",       // ไม่บังคับ
  "end_date": "2026-12-31" }        // ไม่บังคับ
```
โค้ดถูกเก็บเป็นตัวพิมพ์ใหญ่เสมอ

| กรณี | Code | ข้อความ |
|---|---|---|
| โค้ดซ้ำ | 409 | โค้ดนี้ถูกใช้แล้ว |
| ส่วนลด ≤ 0 | 400 | ส่วนลดต้องมากกว่า 0 |
| เปอร์เซ็นต์ > 100 | 400 | ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100 |
| วันเริ่มหลังวันสิ้นสุด | 400 | วันเริ่มต้องไม่หลังวันสิ้นสุด |

### PUT /promotions/:id 🔒 manager
แก้เงื่อนไขหรือเปิด-ปิดโค้ด (`is_active`) — **แก้ตัว `code` ไม่ได้** เพราะออเดอร์เก่าอ้างถึงโค้ดเดิมอยู่

---

## 6. Ingredients / Stock

### GET /ingredients 🔒 staff
มีฟิลด์ `is_low` บอกว่าต่ำกว่าขั้นต่ำหรือยัง

### GET /ingredients/low-stock 🔒 staff
เฉพาะวัตถุดิบที่ต้องสั่งเพิ่ม

### POST /ingredients 🔒 manager
```json
{ "name": "มะกอกดำ", "stock_quantity": 5, "unit": "kg", "min_required_quantity": 1 }
```

### POST /ingredients/:id/restock 🔒 staff
```json
{ "quantity": 10, "note": "รับของจากซัพพลายเออร์ A" }
```

### GET /ingredients/:id/logs 🔒 staff
ประวัติการเข้า-ออกของวัตถุดิบ 100 รายการล่าสุด

---

## 7. Health

### GET /health
```json
{ "status": "ok", "db_time": "2026-09-08T18:20:00.000Z" }
```

---

## ค่าตั้งต้นที่ต้องมี (.env)

| ตัวแปร | บังคับ | หมายเหตุ |
|---|---|---|
| `DATABASE_URL` | ✓ | production ไม่มีค่านี้ เซิร์ฟเวอร์จะไม่สตาร์ต |
| `JWT_SECRET` | ✓ ตอน production | ยาวอย่างน้อย 32 ตัวอักษร สร้างด้วย `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ALLOWED_ORIGINS` | | โดเมนที่เรียก API ข้ามเว็บได้ คั่นด้วยจุลภาค ไม่ตั้ง = ทุกโดเมน |
| `NODE_ENV` | | ตั้งเป็น `production` ตอนขึ้นเซิร์ฟเวอร์จริง |

---

## ทดสอบด้วย REST Client

สร้างไฟล์ `test.http` ใน VS Code (ติดตั้ง extension "REST Client") แล้วกด Send Request:

```http
### เข้าสู่ระบบ (ใช้อีเมลหรือชื่อผู้ใช้ก็ได้)
# @name login
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{ "username": "somchai@forno.co", "email": "somchai@forno.co", "password": "pizza12345" }

### ดูเมนู
GET http://localhost:3000/api/menu

### ดูโปรโมชั่นที่ใช้ได้
GET http://localhost:3000/api/promotions/usable

### สั่งซื้อ
POST http://localhost:3000/api/orders
Content-Type: application/json

{ "order_type": "pickup",
  "customer": { "first_name": "สมชาย", "phone_number": "0812345678",
                "email": "somchai@example.com" },
  "items": [ { "pizza_variant_id": 6, "quantity": 1 } ] }

### ดูสต๊อก (ใช้ token จาก login)
GET http://localhost:3000/api/ingredients
Authorization: Bearer {{login.response.body.token}}

### รับชำระเงินสด
POST http://localhost:3000/api/orders/12/pay
Content-Type: application/json
Authorization: Bearer {{login.response.body.token}}

{ "method": "cash", "transaction_ref": "รับ 500.00 ทอน 141.00" }
```
