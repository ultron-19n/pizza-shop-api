import { withTransaction } from '../config/db.js';
import * as orderRepo from '../repositories/order.repository.js';
import * as customerRepo from '../repositories/customer.repository.js';
import * as pricing from './pricing.service.js';
import * as inventory from './inventory.service.js';
import { ApiError } from '../utils/ApiError.js';
import { generateOrderCode, toDecimal, toBaht, toSatang } from '../utils/money.js';
import { ORDER_STATUS, ORDER_TYPE, ALLOWED_TRANSITIONS, BUSINESS } from '../config/constants.js';

/**
 * สร้างออเดอร์ — ทุกขั้นตอนอยู่ใน transaction เดียว
 *
 * เดิมโค้ดก้อนนี้ยาว ~120 บรรทัดอยู่ใน route handler
 * ตอนนี้อ่านแล้วเห็นลำดับงานชัดเจน รายละเอียดถูกย้ายไป pricing/inventory
 */
export async function createOrder(input, actorId = null) {
  const { order_type = ORDER_TYPE.PICKUP,
          note, promotion_code, payment_method = 'cash', items } = input;

  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
  }
  // ทุกบรรทัดยิงคิวรีของตัวเอง จำกัดไว้ไม่ให้ออเดอร์เดียวถ่วงฐานข้อมูลทั้งระบบ
  if (items.length > BUSINESS.MAX_ORDER_LINES) {
    throw ApiError.badRequest(`สั่งได้สูงสุด ${BUSINESS.MAX_ORDER_LINES} รายการต่อออเดอร์`);
  }

  return withTransaction(async (db) => {
    // 0. ระบุลูกค้า/ที่อยู่ (ลูกค้าที่ไม่ล็อกอินส่ง customer_id/address_id เองไม่ได้)
    const { customer_id, address_id } = await resolveCustomer(input, actorId !== null, db);

    // 1. คิดราคาจากฐานข้อมูล ไม่เชื่อราคาที่ client ส่งมา
    const pricedItems = await pricing.priceItems(items, db);

    // 2. ตรวจโค้ดส่วนลด
    const promotion = promotion_code
      ? await findValidPromotion(promotion_code, db)
      : null;

    // 3. รวมยอด
    const totals = pricing.calcTotals({ items: pricedItems, promotion, orderType: order_type });

    // 4. บันทึกหัวออเดอร์
    const order = await insertOrderWithUniqueCode({
      customer_id,
      user_id: actorId,
      address_id,
      promotion_id: promotion?.id || null,
      order_type,
      status: ORDER_STATUS.PENDING,
      subtotal: toDecimal(toBaht(totals.subtotal_satang)),
      discount: toDecimal(toBaht(totals.discount_satang)),
      delivery_fee: toDecimal(toBaht(totals.delivery_fee_satang)),
      total_amount: toDecimal(toBaht(totals.total_satang)),
      note: note || null,
    }, db);

    // 5. บันทึกรายการสินค้าและท็อปปิ้ง — รวมเป็น 2 คำสั่งไม่ว่าออเดอร์จะยาวแค่ไหน
    const itemIds = await orderRepo.insertOrderItems(order.id, pricedItems.map(item => ({
      ...item,
      unit_price: toDecimal(toBaht(item.unit_satang)),
      total_price: toDecimal(toBaht(item.total_satang)),
    })), db);

    await orderRepo.insertOrderItemToppings(
      pricedItems.flatMap((item, i) =>
        item.toppings.map(t => ({ ...t, order_item_id: itemIds[i] }))),
      db
    );

    // 6. ตัดสต๊อกตามสูตร
    await inventory.deductForOrder({ items: pricedItems, orderId: order.id, userId: actorId }, db);

    // 7. เปิดรายการชำระเงินค้างไว้
    await orderRepo.insertPayment(order.id, {
      method: payment_method,
      amount: order.total_amount,
    }, db);

    // 8. สะสมแต้ม
    await customerRepo.addPoints(customer_id, pricing.calcLoyaltyPoints(totals.total_satang), db);

    return order;
  });
}

const MAX_CODE_ATTEMPTS = 10;

/**
 * บันทึกหัวออเดอร์ ถ้ารหัสชนกับของเดิมให้สุ่มรหัสใหม่แล้วลองอีก
 *
 * ใช้ ON CONFLICT DO NOTHING แทนการดัก error: รหัสชนแล้วจะไม่มีแถวคืนมา ไม่ใช่ error
 * จึงไม่ต้องกาง SAVEPOINT ประกบทุกครั้งเพื่อกัน transaction พัง (ประหยัด 2 รอบคุยกับฐานข้อมูลต่อออเดอร์)
 */
async function insertOrderWithUniqueCode(order, db) {
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    const inserted = await orderRepo.insertOrder({ ...order, order_code: generateOrderCode() }, db);
    if (inserted) return inserted;
  }
  throw ApiError.internal('สร้างรหัสออเดอร์ไม่สำเร็จ กรุณาลองใหม่');
}

const clip = (v, max) => String(v ?? '').trim().slice(0, max);

/** รหัสอ้างอิงต้องเป็นจำนวนเต็มบวก ไม่งั้น PostgreSQL จะโยน 22P02 แล้วยกเลิก transaction ทั้งก้อน */
const toId = (value, label) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw ApiError.badRequest(`${label}ไม่ถูกต้อง`);
  return n;
};

/**
 * หาว่าออเดอร์นี้เป็นของลูกค้าคนไหน / ส่งไปที่อยู่ไหน
 * - พนักงาน (มี token): ระบุ customer_id / address_id ของลูกค้าเดิมได้ โดยที่อยู่ต้องเป็นของลูกค้าคนนั้น
 * - ลูกค้าทั่วไป: ส่ง customer {first_name,last_name,phone_number} และ address {address_line,...} มาในออเดอร์เดียว
 *   ระบบสร้าง/หาลูกค้าจากเบอร์ให้เอง จึงไม่ต้องเปิด /customers ให้คนนอกใช้
 */
async function resolveCustomer(input, isStaff, db) {
  const { customer, address, order_type = ORDER_TYPE.PICKUP } = input;
  const isDelivery = order_type === ORDER_TYPE.DELIVERY;

  let customerId = null;
  if (isStaff && input.customer_id) {
    customerId = toId(input.customer_id, 'รหัสลูกค้า');
  } else if (customer && typeof customer === 'object') {
    const phone = clip(customer.phone_number, 20);
    if (phone.length < 9) throw ApiError.badRequest('กรุณากรอกเบอร์โทรให้ถูกต้อง');
    const email = clip(customer.email, 150).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw ApiError.badRequest('รูปแบบอีเมลไม่ถูกต้อง');
    }

    ({ id: customerId } = await customerRepo.findOrCreateByPhone({
      first_name: clip(customer.first_name, 100) || 'ลูกค้า',
      last_name: clip(customer.last_name, 100),
      phone_number: phone,
      email: email || null,
    }, db));
  }

  let addressId = null;
  if (isDelivery) {
    if (isStaff && input.address_id) {
      const found = await customerRepo.findAddressById(toId(input.address_id, 'รหัสที่อยู่'), db);
      if (!found || String(found.customer_id) !== String(customerId)) {
        throw ApiError.badRequest('ที่อยู่ไม่ตรงกับลูกค้า');
      }
      addressId = found.id;
    } else if (customerId && address && typeof address === 'object' && clip(address.address_line, 500)) {
      const saved = await customerRepo.insertAddress(customerId, {
        address_line: clip(address.address_line, 500),
        sub_district: clip(address.sub_district, 100) || null,
        district: clip(address.district, 100) || null,
        province: clip(address.province, 100) || null,
        postal_code: clip(address.postal_code, 10) || null,
        is_default: false,   // ออเดอร์สาธารณะไม่ไปเปลี่ยนที่อยู่หลักของลูกค้า
      }, db);
      addressId = saved.id;
    }
    if (!addressId) throw ApiError.badRequest('กรุณาระบุที่อยู่จัดส่ง');
  }

  return { customer_id: customerId, address_id: addressId };
}

/** เปลี่ยนสถานะ พร้อมตรวจว่าเปลี่ยนจากสถานะเดิมไปได้จริงไหม */
export async function changeStatus(orderId, nextStatus, actorId = null) {
  return withTransaction(async (db) => {
    const current = await orderRepo.findOrderStatus(orderId, db);
    if (!current) throw ApiError.notFound('ไม่พบออเดอร์');

    const allowed = ALLOWED_TRANSITIONS[current.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw ApiError.badRequest(
        `เปลี่ยนจาก "${current.status}" เป็น "${nextStatus}" ไม่ได้` +
        (allowed.length ? ` สถานะถัดไปที่เป็นไปได้: ${allowed.join(', ')}` : ' ออเดอร์นี้ปิดแล้ว')
      );
    }

    // ยกเลิกแล้วต้องคืนวัตถุดิบเข้าคลัง ดึงแต้มที่ให้ไปตอนสั่งกลับคืน และตีกลับรายการชำระเงิน
    if (nextStatus === ORDER_STATUS.CANCELLED) {
      const items = await orderRepo.findItemsForRestock(orderId, db);
      await inventory.returnForOrder({ items, orderId, userId: actorId }, db);

      const points = pricing.calcLoyaltyPoints(toSatang(current.total_amount));
      await customerRepo.removePoints(current.customer_id, points, db);

      // ถ้าเก็บเงินไปแล้ว ต้องทำเครื่องหมายว่าคืนเงิน ไม่งั้นรายงานยอดขายจะยังนับเงินก้อนนี้อยู่
      // (เงินสดคืนหน้าร้าน ส่วนช่องทางอื่นต้องไปกดคืนในระบบของผู้ให้บริการเอง)
      await orderRepo.markRefunded(orderId, db);
    }

    return orderRepo.updateStatus(orderId, nextStatus, db);
  });
}

/**
 * รับชำระเงิน
 *
 * เงินทอนคำนวณที่นี่เสมอ ไม่รับค่าจากหน้าจอ — หน้าจอคิดไว้ให้พนักงานเห็นล่วงหน้าได้
 * แต่ตัวเลขที่บันทึกลงบิลต้องมาจากเซิร์ฟเวอร์ที่รู้ยอดจริงของออเดอร์
 */
export async function pay(orderId, { method = 'cash', transaction_ref = null, received_amount = null }) {
  return withTransaction(async (db) => {
    const order = await orderRepo.findOrderStatus(orderId, db);
    if (!order) throw ApiError.notFound('ไม่พบออเดอร์');
    if (order.status === ORDER_STATUS.CANCELLED) {
      throw ApiError.badRequest('ออเดอร์นี้ถูกยกเลิกแล้ว รับชำระเงินไม่ได้');
    }

    const existing = await orderRepo.findPayment(orderId, db);
    if (!existing) throw ApiError.notFound('ไม่พบรายการชำระเงินของออเดอร์นี้');
    if (existing.status === 'paid') throw ApiError.conflict('ออเดอร์นี้ชำระเงินแล้ว');

    // payments.transaction_ref เป็น VARCHAR(100) — ตัดไว้ก่อน ไม่งั้นข้อความยาวจะทำให้ทั้ง transaction พัง
    const ref = clip(transaction_ref, 100) || null;

    // เงินสด: ถ้าพนักงานกรอกเงินที่รับมา ต้องพอจ่ายและคำนวณเงินทอนให้
    let received = null;
    let change = null;
    if (received_amount !== null && received_amount !== '') {
      const receivedSatang = toSatang(received_amount);
      const dueSatang = toSatang(existing.amount);

      if (!Number.isFinite(receivedSatang) || receivedSatang < 0) {
        throw ApiError.badRequest('จำนวนเงินที่รับมาไม่ถูกต้อง');
      }
      if (receivedSatang < dueSatang) {
        throw ApiError.badRequest(
          `เงินที่รับมา ${toBaht(receivedSatang)} บาท น้อยกว่ายอดที่ต้องชำระ ${toBaht(dueSatang)} บาท`
        );
      }
      received = toDecimal(toBaht(receivedSatang));
      change = toDecimal(toBaht(receivedSatang - dueSatang));
    }

    return orderRepo.markPaid(orderId, {
      method, transaction_ref: ref, received_amount: received, change_amount: change,
    }, db);
  });
}

/** detail = true: ส่งรายการสินค้า ลูกค้า และการชำระเงินมาด้วยในคำขอเดียว (หน้าคิวหลังร้านใช้แบบนี้) */
export const list = ({ detail = false, ...filters }) =>
  detail ? orderRepo.findOrdersWithDetail(filters) : orderRepo.findOrders(filters);

export async function getDetail(orderId) {
  const order = await orderRepo.findOrderDetail(orderId);
  if (!order) throw ApiError.notFound('ไม่พบออเดอร์');
  return order;
}

export async function summary({ date = null } = {}) {
  const [daily, best_sellers, by_method] = await Promise.all([
    orderRepo.dailySales(30),
    orderRepo.bestSellers(10),
    orderRepo.paymentsByMethod(date),
  ]);

  // เงินสดที่ควรมีในลิ้นชัก = ยอดของบิลที่จ่ายด้วยเงินสด
  // (ไม่ใช้ "เงินที่รับมา ลบ เงินทอน" เพราะได้ค่าเท่ากันอยู่แล้ว แต่บิลที่พนักงานไม่ได้กรอกเงินที่รับมาจะหายไป)
  const cash = by_method.find(m => m.method === 'cash');
  const cash_in_drawer = toDecimal(Number(cash?.amount || 0));

  return { daily, best_sellers, by_method, cash_in_drawer };
}

async function findValidPromotion(code, db) {
  const promotion = await orderRepo.findActivePromotionByCode(String(code).trim().toUpperCase(), db);
  if (!promotion) throw ApiError.badRequest('โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุแล้ว');
  return promotion;
}

/**
 * ตรวจโค้ดส่วนลดให้หน้าเว็บแสดงยอดได้ตรงก่อนกดสั่ง
 * คืนเฉพาะเงื่อนไขของโค้ดที่ผู้ใช้พิมพ์มาเอง — ยอดจริงยังคิดใหม่ที่เซิร์ฟเวอร์ตอนสร้างออเดอร์เสมอ
 */
export async function checkPromotion(code) {
  const p = await findValidPromotion(code);
  return {
    code: p.code,
    name: p.name,
    discount_type: p.discount_type,
    discount_value: Number(p.discount_value),
    min_order_amount: Number(p.min_order_amount),
  };
}
