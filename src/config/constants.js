import './env.js';  // โหลด .env ก่อนอ่านค่าด้านล่าง

/**
 * ค่าคงที่ของระบบ — รวมไว้ที่เดียว
 * เดิมค่าพวกนี้กระจายอยู่ในไฟล์ route ทำให้แก้ทีต้องไล่หาหลายที่
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  RIDER: 'rider',
});

/** role ที่จัดการเมนู ราคา โปรโมชั่น และดูรายงานยอดขายได้ */
export const MANAGEMENT_ROLES = [ROLES.ADMIN, ROLES.MANAGER];

/** role ที่ทำงานหน้าร้านได้ — รับออเดอร์ รับเงิน จัดการสต๊อก และเห็นข้อมูลลูกค้า
 *  ไรเดอร์ไม่รวมอยู่ในกลุ่มนี้ เพราะมีหน้าที่แค่ส่งของ ไม่ต้องเห็นออเดอร์ทั้งร้านหรือรายชื่อลูกค้า */
export const STAFF_ROLES = [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF];

export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  PREPARING: 'preparing',
  READY: 'ready',
  DELIVERING: 'delivering',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const ORDER_STATUS_LIST = Object.values(ORDER_STATUS);

/** สถานะถัดไปที่เปลี่ยนได้ — กันการข้ามขั้นตอน เช่น pending → completed */
export const ALLOWED_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]:    [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]:  [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY]:      [ORDER_STATUS.DELIVERING, ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.COMPLETED]:  [],
  [ORDER_STATUS.CANCELLED]:  [],
});

export const ORDER_TYPE = Object.freeze({
  DELIVERY: 'delivery',
  PICKUP: 'pickup',
  DINE_IN: 'dine_in',
});

export const ORDER_TYPE_LIST = Object.values(ORDER_TYPE);

export const PAYMENT_METHOD_LIST = ['cash', 'promptpay', 'card', 'transfer'];

export const DISCOUNT_TYPE = Object.freeze({ PERCENT: 'percent', AMOUNT: 'amount' });

export const INVENTORY_LOG_TYPE = Object.freeze({
  RESTOCK: 'restock',
  SALE: 'sale',
  WASTE: 'waste',
  ADJUST: 'adjust',
});

/** กติกาทางธุรกิจ — ปรับได้จาก .env โดยไม่ต้องแก้โค้ด */
export const BUSINESS = Object.freeze({
  DELIVERY_FEE: Number(process.env.DELIVERY_FEE ?? 39),
  BAHT_PER_POINT: Number(process.env.BAHT_PER_POINT ?? 25),
  BCRYPT_ROUNDS: 10,
  MAX_ITEMS_PER_ORDER: 50,   // จำนวนสูงสุดต่อ 1 รายการ (เช่น พิซซ่าหน้าเดิม 50 ถาด)
  MAX_ORDER_LINES: 50,       // จำนวนบรรทัดสินค้าสูงสุดต่อออเดอร์ — กันคนยิง items ยาวเป็นหมื่นบรรทัด
});
