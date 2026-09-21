# API Specification — Pizza Shop

Base URL: `http://localhost:3000/api`
รูปแบบข้อมูล: JSON (`Content-Type: application/json`)
การยืนยันตัวตน: `Authorization: Bearer <token>`

## รหัสสถานะที่ใช้

| Code | ความหมาย |
|---|---|
| 200 | สำเร็จ |
| 201 | สร้างข้อมูลสำเร็จ |
| 400 | ข้อมูลที่ส่งมาไม่ถูกต้อง |
| 401 | ยังไม่ได้เข้าสู่ระบบ / token หมดอายุ |
| 403 | เข้าสู่ระบบแล้วแต่ไม่มีสิทธิ์ |
| 404 | ไม่พบข้อมูล |
| 409 | ข้อมูลซ้ำ (เช่น username ถูกใช้แล้ว) |
| 500 | ระบบผิดพลาด |

รูปแบบ error ทุกกรณี:
```json
{ "message": "คำอธิบายภาษาไทย" }
```

---

## 1. Auth

### POST /auth/register
สร้างบัญชีพนักงาน — เรียกได้โดยไม่ต้องล็อกอินเฉพาะตอนที่ยังไม่มีผู้ใช้ในระบบ (คนแรกจะเป็น `admin` เสมอ)
หลังจากนั้นต้องส่ง `Authorization: Bearer <token>` ของ admin (ไม่ใช่ admin → 403, ไม่มี token → 401)

```json
// request
{ "username": "admin", "password": "admin1234",
  "first_name": "แอดมิน", "last_name": "ระบบ", "role": "admin" }

// response 201
{ "id": 1, "username": "admin", "role": "admin", "status": "active" }
```

### POST /auth/login

```json
// request
{ "username": "admin", "password": "admin1234" }

// response 200
{ "token": "eyJhbGciOi...",
  "user": { "id": 1, "username": "admin", "role": "admin" } }
```

### GET /auth/me 🔒
คืนข้อมูลผู้ใช้จาก token ปัจจุบัน

---

## 2. Menu

### GET /menu/categories
```json
[ { "id": 1, "name": "พิซซ่า", "description": "พิซซ่าอบสดใหม่ทุกถาด" } ]
```

### GET /menu
Query: `category_id`, `search`

```json
[
  { "id": 2, "name": "Pepperoni", "description": "เปปเปอโรนีเต็มหน้า",
    "image_url": "/images/pepperoni.jpg", "category_name": "พิซซ่า",
    "variants": [
      { "id": 5, "size": "S", "crust": "classic", "price": "179.00", "is_available": true },
      { "id": 6, "size": "M", "crust": "classic", "price": "289.00", "is_available": true }
    ] }
]
```

### GET /menu/:id
เมนูเดียวพร้อม variants ทั้งหมด

### GET /menu/toppings/all
```json
[ { "id": 1, "name": "ชีสเพิ่ม", "price": "39.00", "is_available": true } ]
```

### POST /menu 🔒 admin, manager
```json
{ "category_id": 1, "name": "Truffle Mushroom",
  "description": "เห็ดทรัฟเฟิล", "image_url": "/images/truffle.jpg" }
```

### PUT /menu/:id 🔒 admin, manager
ส่งเฉพาะฟิลด์ที่ต้องการแก้ ฟิลด์ที่ไม่ส่งจะคงค่าเดิม

### DELETE /menu/:id 🔒 admin, manager
ปิดการขาย (`is_active = false`) ไม่ได้ลบจริง เพื่อให้ใบเสร็จเก่ายังอ้างอิงได้

### POST /menu/:id/variants 🔒 admin, manager
```json
{ "size": "L", "crust": "pan", "sauce": "tomato", "price": 429 }
```

---

## 3. Customers

ทุกเส้นทางในหมวดนี้ต้องล็อกอิน (เป็นข้อมูลส่วนบุคคล) — ลูกค้าที่สั่งเองไม่ต้องเรียกหมวดนี้ ให้ส่ง `customer` / `address` มาพร้อม `POST /orders`

### GET /customers 🔒
Query: `phone` (ตรงตัว) หรือ `search` (ชื่อบางส่วน)

### GET /customers/:id 🔒
คืนข้อมูลลูกค้าพร้อม array `addresses`

### POST /customers 🔒
สร้างลูกค้าใหม่ ถ้าเบอร์ซ้ำจะอัปเดตชื่อให้แทน (upsert)
```json
{ "first_name": "สมชาย", "last_name": "ใจดี", "phone_number": "0812345678" }
```

### POST /customers/:id/addresses 🔒
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
  "customer": { "first_name": "สมชาย", "last_name": "ใจดี", "phone_number": "0812345678" },
  "address":  { "address_line": "99/1 หมู่ 3", "district": "บางรัก" },  // จำเป็นเมื่อ order_type = delivery
  "order_type": "delivery",          // delivery | pickup | dine_in
  "promotion_code": "WELCOME10",     // ไม่บังคับ
  "payment_method": "promptpay",
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
- เบอร์ที่มีอยู่แล้วในระบบ → ผูกออเดอร์กับลูกค้าเดิม โดย **ไม่แก้ชื่อ/อีเมลเดิม**
- ที่อยู่ที่ส่งมากับออเดอร์ถูกบันทึกเป็นที่อยู่ของลูกค้าคนนั้น (ไม่ตั้งเป็นที่อยู่หลัก)
- พนักงานที่ล็อกอิน ส่ง `customer_id` / `address_id` ของลูกค้าเดิมแทนได้ (ที่อยู่ต้องเป็นของลูกค้าคนนั้น) — ลูกค้าทั่วไปส่งสองฟิลด์นี้ไม่มีผล

**ข้อผิดพลาดที่เป็นไปได้**

| กรณี | Code | ข้อความ |
|---|---|---|
| ไม่ส่ง items | 400 | กรุณาเลือกสินค้าอย่างน้อย 1 รายการ |
| เบอร์โทรสั้นเกินไป | 400 | กรุณากรอกเบอร์โทรให้ถูกต้อง |
| delivery แต่ไม่มีที่อยู่ | 400 | กรุณาระบุที่อยู่จัดส่ง |
| variant ไม่มีจริง | 400 | ไม่พบสินค้า id X |
| สินค้าปิดขาย | 400 | ชื่อเมนู ไม่พร้อมขาย |
| โค้ดหมดอายุ | 400 | โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุ |
| ยอดไม่ถึงขั้นต่ำ | 400 | ยอดขั้นต่ำสำหรับโค้ดนี้คือ X บาท |

### GET /orders 🔒
Query: `status`, `date` (YYYY-MM-DD), `customer_id`

### GET /orders/:id 🔒
ใบเสร็จเต็ม พร้อม `items[]`, `toppings[]`, `customer`, `payment`

### PATCH /orders/:id/status 🔒
```json
{ "status": "preparing" }
```
ค่าที่รับ: `pending` `preparing` `ready` `delivering` `completed` `cancelled`

ยกเลิกออเดอร์จะคืนวัตถุดิบเข้าคลังและดึงแต้มที่ให้ไปตอนสั่งกลับคืนให้อัตโนมัติ

### GET /orders/promotions/:code
ตรวจโค้ดส่วนลดก่อนกดสั่ง (ไม่ต้องล็อกอิน) — ยอดจริงยังถูกคิดใหม่ที่เซิร์ฟเวอร์ตอนสร้างออเดอร์เสมอ
```json
// response 200
{ "code": "WELCOME10", "name": "ลูกค้าใหม่ลด 10%",
  "discount_type": "percent", "discount_value": 10, "min_order_amount": 200 }

// response 400 — โค้ดผิดหรือหมดอายุ
{ "message": "โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุแล้ว" }
```

### POST /orders/:id/pay 🔒
```json
{ "method": "promptpay", "transaction_ref": "TXN-99231" }
```

| กรณี | Code | ข้อความ |
|---|---|---|
| ชำระไปแล้ว | 409 | ออเดอร์นี้ชำระเงินแล้ว |
| ออเดอร์ถูกยกเลิก | 400 | ออเดอร์นี้ถูกยกเลิกแล้ว รับชำระเงินไม่ได้ |

### GET /orders/report/summary 🔒
```json
{ "daily": [ { "sale_date": "2026-09-08", "total_orders": 24,
               "revenue": "8420.00", "avg_order_value": "350.83" } ],
  "best_sellers": [ { "name": "Pepperoni", "sold": "38", "revenue": "10982.00" } ] }
```

---

## 5. Ingredients / Stock

### GET /ingredients 🔒
มีฟิลด์ `is_low` บอกว่าต่ำกว่าขั้นต่ำหรือยัง

### GET /ingredients/low-stock 🔒
เฉพาะวัตถุดิบที่ต้องสั่งเพิ่ม

### POST /ingredients 🔒 admin, manager
```json
{ "name": "มะกอกดำ", "stock_quantity": 5, "unit": "kg", "min_required_quantity": 1 }
```

### POST /ingredients/:id/restock 🔒
```json
{ "quantity": 10, "note": "รับของจากซัพพลายเออร์ A" }
```

### GET /ingredients/:id/logs 🔒
ประวัติการเข้า-ออกของวัตถุดิบ 100 รายการล่าสุด

---

## 6. Health

### GET /health
```json
{ "status": "ok", "db_time": "2026-09-08T18:20:00.000Z" }
```

---

## ทดสอบด้วย REST Client

สร้างไฟล์ `test.http` ใน VS Code (ติดตั้ง extension "REST Client") แล้วกด Send Request:

```http
### เข้าสู่ระบบ
# @name login
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{ "username": "admin", "password": "admin1234" }

### ดูเมนู
GET http://localhost:3000/api/menu

### สั่งซื้อ
POST http://localhost:3000/api/orders
Content-Type: application/json

{ "order_type": "pickup",
  "items": [ { "pizza_variant_id": 6, "quantity": 1 } ] }

### ดูสต๊อก (ใช้ token จาก login)
GET http://localhost:3000/api/ingredients
Authorization: Bearer {{login.response.body.token}}
```
